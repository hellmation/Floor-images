import type { AnswersFile, Config, ReviewsFile, AuditEntry, Snapshot } from '../types'
import { defaultConfig, emptyReviews, migrateConfig, ensureAdmin } from './defaults'

/** Moves data stored under a renamed cycle id to the new id. Returns true when something changed. */
export function applyCycleRenames<T extends { cycles?: Record<string, unknown>; clarifications?: Record<string, unknown> }>(file: T, renames?: Record<string, string>): boolean {
  let changed = false
  for (const [from, to] of Object.entries(renames || {})) for (const key of ['cycles', 'clarifications'] as const) {
    const m = file[key] as Record<string, unknown> | undefined; if (m && m[from] !== undefined && m[to] === undefined) { m[to] = m[from]; delete m[from]; changed = true }
  }
  return changed
}


/** A storage adapter persists the shared state. Evaluators write only their own answers file;
 *  admins write config, reviews and audit. The folder adapter uses the File System Access API;
 *  the local adapter keeps everything in localStorage for browsers without it (or demos). */
export interface StorageAdapter {
  kind: 'folder' | 'local'
  label: string
  load(): Promise<Snapshot>
  /** expectedUpdatedAt: the config.updatedAt the caller started from; throws ConflictError when the stored file moved on since. */
  saveConfig(c: Config, expectedUpdatedAt?: string): Promise<void>
  /** Merges with what is on disk (per code / per note, latest wins) so a stale in-memory copy can never drop data. Returns the merged file. */
  saveAnswers(a: AnswersFile, base?: AnswersFile | null): Promise<AnswersFile>
  saveReviews(r: ReviewsFile, expectedUpdatedAt?: string): Promise<void>
  appendAudit(entries: AuditEntry[], userId: string): Promise<void>
  /** Set when the stored data belongs to a newer app version: every write is refused so an old file cannot damage it. */
  readOnly?: string
}
export class ReadOnlyError extends Error { constructor(msg: string) { super(msg); this.name = 'ReadOnlyError' } }
export class ConflictError extends Error { constructor() { super('conflict'); this.name = 'ConflictError' } }
export const APP_CONFIG_VERSION = 6

/** Merge two copies of one person's answers file: per cycle/code and per note the newer updatedAt wins. */
export function mergeAnswers(disk: AnswersFile | null, next: AnswersFile, base?: AnswersFile | null): AnswersFile {
  if (!disk) return next
  // three-way: an entry the disk still holds unchanged since our base (same updatedAt) never beats our fresh edit,
  // so a device whose clock runs ahead cannot make another device's save disappear
  const cycles: AnswersFile['cycles'] = {}
  for (const cy of new Set([...Object.keys(disk.cycles || {}), ...Object.keys(next.cycles || {})])) {
    cycles[cy] = { ...(disk.cycles?.[cy] || {}) }
    for (const [code, a] of Object.entries(next.cycles?.[cy] || {})) { const d = cycles[cy][code]; const b = base?.cycles?.[cy]?.[code]
      if (!d || (b && d.updatedAt === b.updatedAt) || (a.updatedAt || '') >= (d.updatedAt || '')) cycles[cy][code] = a }
  }
  const notes = { ...(disk.notes || {}) }
  for (const [code, n] of Object.entries(next.notes || {})) { const d = notes[code]; const b = base?.notes?.[code]; if (!d || (b && d.updatedAt === b.updatedAt) || (n.updatedAt || '') >= (d.updatedAt || '')) notes[code] = n }
  return { ...disk, ...next, cycles, notes, updatedAt: [disk.updatedAt, next.updatedAt].sort().pop() || next.updatedAt }
}

/* ---------- helpers ---------- */
/** Returns null only when the file does not exist. Any other failure (lock, read error, bad JSON) is thrown so a
 *  momentary problem on a network share can never be mistaken for "no data" and overwritten with defaults. */
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
async function readText(dir: FileSystemDirectoryHandle, name: string, retry = true): Promise<string | null> {
  try {
    const fh = await dir.getFileHandle(name); const f = await fh.getFile(); return await f.text()
  } catch (e) {
    const n = (e as DOMException).name
    // a file being replaced on a network share can be briefly "missing" or unreadable: look once more before deciding
    if (retry && (n === 'NotFoundError' || n === 'NotReadableError' || n === 'InvalidStateError')) { await sleep(300); return readText(dir, name, false) }
    if (n === 'NotFoundError') return null
    throw e
  }
}
async function readJson<T>(dir: FileSystemDirectoryHandle, name: string): Promise<T | null> {
  const txt = await readText(dir, name)
  if (txt === null || !txt.trim()) return null
  try { return JSON.parse(txt) as T } catch { throw new Error(`Unreadable file: ${name}`) }
}
async function exists(dir: FileSystemDirectoryHandle, name: string) { try { await dir.getFileHandle(name); return true } catch { return false } }
async function hasFiles(dir: FileSystemDirectoryHandle, sub: string) { try { const d = await dir.getDirectoryHandle(sub); for await (const [, h] of (d as unknown as AsyncIterable<[string, FileSystemHandle]>)) if (h.kind === 'file') return true } catch { /* missing */ } return false }
const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
/** Writes and then reads back; a save that did not land exactly is reported instead of silently trusted. */
async function writeJson(dir: FileSystemDirectoryHandle, name: string, data: unknown, verify = true) {
  const text = JSON.stringify(data, null, 1)
  const fh = await dir.getFileHandle(name, { create: true })
  const w = await fh.createWritable()
  await w.write(text)
  await w.close()
  if (verify) { const back = await readText(dir, name); if (back !== text) throw new Error(`Write not confirmed: ${name}`) }
}

/* ---------- IndexedDB for the directory handle ---------- */
const DB = 'uae-code-tool', STORE = 'handles'
function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE)
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error)
  })
}
export async function storeHandle(h: FileSystemDirectoryHandle) {
  const db = await idb(); const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(h, 'dir')
  await new Promise((res, rej) => { tx.oncomplete = () => res(null); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error) })
}
export async function loadHandle(): Promise<FileSystemDirectoryHandle | null> {
  try { const db = await idb(); const tx = db.transaction(STORE, 'readonly'); const req = tx.objectStore(STORE).get('dir')
    return await new Promise(r => { req.onsuccess = () => r(req.result || null); req.onerror = () => r(null) }) } catch { return null }
}
export const hasFolderApi = () => typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function'

/* ---------- folder adapter ---------- */
export class FolderAdapter implements StorageAdapter {
  kind = 'folder' as const
  label: string
  readOnly?: string
  private dir: FileSystemDirectoryHandle
  constructor(dir: FileSystemDirectoryHandle) { this.dir = dir; this.label = dir.name }
  private async data() { return this.dir.getDirectoryHandle('data', { create: true }) }
  /** Copies the current config aside before any automatic rewrite (migration, admin recovery). */
  private async backupConfig(d: FileSystemDirectoryHandle, config: Config, why: string) {
    try { const b = await d.getDirectoryHandle('backups', { create: true }); await writeJson(b, `config-${why}-v${config.version || 1}-${stamp()}.json`, config) } catch { /* backups never block loading */ }
  }
  /** One full snapshot per day in data/backups, keeping the last 14, so a deleted or corrupted file can be restored. */
  private async dailySnapshot(d: FileSystemDirectoryHandle, snap: Snapshot) {
    try {
      const b = await d.getDirectoryHandle('backups', { create: true }); const name = `snapshot-${new Date().toISOString().slice(0, 10)}.json`
      if (await exists(b, name)) return
      await writeJson(b, name, snap)
      const names: string[] = []
      for await (const [n, h] of (b as unknown as AsyncIterable<[string, FileSystemHandle]>)) if (h.kind === 'file' && n.startsWith('snapshot-')) names.push(n)
      for (const n of names.sort().slice(0, Math.max(0, names.length - 14))) await b.removeEntry(n)
    } catch { /* ignore */ }
  }
  async load(): Promise<Snapshot> {
    const d = await this.data()
    let config = await readJson<Config>(d, 'config.json')
    if (!config) {
      if (await exists(d, 'reviews.json') || await hasFiles(d, 'answers') || await hasFiles(d, 'backups')) throw new Error('config.json is missing although other data exists; restore it from data/backups')
      config = defaultConfig(); await writeJson(d, 'config.json', config)
    }
    else if ((config.version || 1) > APP_CONFIG_VERSION) { this.readOnly = `This file is older than the data (config v${config.version}); open the newer UAE-Code-Championship.html`; throw new ReadOnlyError(this.readOnly) }
    else if ((config.version || 1) < APP_CONFIG_VERSION) { await this.backupConfig(d, config, 'before-migration'); config = migrateConfig(config); await writeJson(d, 'config.json', config) }
    if (!config.users.some(u => u.active && u.role === 'admin')) { await this.backupConfig(d, config, 'before-admin-recovery'); config = ensureAdmin(config); await writeJson(d, 'config.json', config) }
    const reviews = (await readJson<ReviewsFile>(d, 'reviews.json')) || emptyReviews()
    // a rename is only replayed while no live cycle uses the old id, so a future cycle with that id is never swallowed
    const renames = Object.fromEntries(Object.entries(config.renamedCycles || {}).filter(([from]) => !config.cycles.some(c => c.id === from)))
    if (applyCycleRenames(reviews, renames)) await writeJson(d, 'reviews.json', reviews)
    // audit: one file per writer (data/audit/<userId>.json) plus the legacy shared audit.json, merged by time
    const audit: AuditEntry[] = (await readJson<AuditEntry[]>(d, 'audit.json')) || []
    try { const au = await d.getDirectoryHandle('audit', { create: true })
      for await (const [name, h] of (au as unknown as AsyncIterable<[string, FileSystemHandle]>)) if (h.kind === 'file' && name.endsWith('.json')) audit.push(...((await readJson<AuditEntry[]>(au, name)) || []))
    } catch { /* audit is informational */ }
    audit.sort((a, b) => a.at.localeCompare(b.at))
    const answers: Record<string, AnswersFile> = {}
    const ad = await d.getDirectoryHandle('answers', { create: true })
    for await (const [name, h] of (ad as unknown as AsyncIterable<[string, FileSystemHandle]>)) {
      if (h.kind === 'file' && name.endsWith('.json')) {
        const a = await readJson<AnswersFile>(ad, name)
        if (a && a.userId) { if (applyCycleRenames(a, renames)) await writeJson(ad, name, a); answers[a.userId] = a }
      }
    }
    const snap = { config, answers, reviews, audit }
    await this.dailySnapshot(d, snap)
    return snap
  }
  private guard() { if (this.readOnly) throw new ReadOnlyError(this.readOnly) }
  /** Refuses the write when a newer app version owns the data (another, newer file was opened on the share meanwhile). */
  private async checkVersion(d: FileSystemDirectoryHandle) {
    const cfg = await readJson<Config>(d, 'config.json')
    if (cfg && (cfg.version || 1) > APP_CONFIG_VERSION) { this.readOnly = `The data was upgraded by a newer file (config v${cfg.version}); reopen the newer UAE-Code-Championship.html`; throw new ReadOnlyError(this.readOnly) }
  }
  /** True when the folder has never been used by the tool (no data/config.json). */
  async isEmpty() { try { const d = await this.dir.getDirectoryHandle('data'); return !(await exists(d, 'config.json')) } catch { return true } }
  /** Writes a whole snapshot (e.g. local-mode data) into the folder. Used once when moving from local mode to an empty shared folder. */
  async importSnapshot(snap: Snapshot) {
    const d = await this.data(); await writeJson(d, 'config.json', snap.config); await writeJson(d, 'reviews.json', snap.reviews); await writeJson(d, 'audit.json', snap.audit)
    const ad = await d.getDirectoryHandle('answers', { create: true }); for (const a of Object.values(snap.answers)) await writeJson(ad, `${a.userId}.json`, a)
  }
  async saveConfig(c: Config, expectedUpdatedAt?: string) {
    this.guard(); const d = await this.data()
    const disk = await readJson<Config>(d, 'config.json')
    if (disk && (disk.version || 1) > APP_CONFIG_VERSION) { this.readOnly = `The data was upgraded by a newer file (config v${disk.version}); reopen the newer UAE-Code-Championship.html`; throw new ReadOnlyError(this.readOnly) }
    if ((disk?.updatedAt ?? '') !== (expectedUpdatedAt ?? '')) throw new ConflictError()
    await writeJson(d, 'config.json', c)
  }
  async saveReviews(r: ReviewsFile, expectedUpdatedAt?: string) {
    this.guard(); const d = await this.data(); await this.checkVersion(d)
    const disk = await readJson<ReviewsFile>(d, 'reviews.json')
    // no file yet means nobody else has written reviews: nothing to conflict with
    if (disk && expectedUpdatedAt !== undefined && (disk.updatedAt ?? '') !== expectedUpdatedAt) throw new ConflictError()
    await writeJson(d, 'reviews.json', r)
  }
  async saveAnswers(a: AnswersFile, base?: AnswersFile | null) {
    this.guard(); const d = await this.data(); await this.checkVersion(d)
    const ad = await d.getDirectoryHandle('answers', { create: true }); const name = `${a.userId}.json`
    // read-merge-write, then confirm nobody wrote in between; if they did, merge once more (bounded)
    let merged = a
    for (let attempt = 0; attempt < 3; attempt++) {
      const disk = await readJson<AnswersFile>(ad, name)
      merged = mergeAnswers(disk, a, base)
      try { await writeJson(ad, name, merged); return merged }
      catch (e) { if (attempt === 2 || !(e as Error).message?.startsWith('Write not confirmed')) throw e }
    }
    return merged
  }
  async appendAudit(entries: AuditEntry[], userId: string) {
    const au = await (await this.data()).getDirectoryHandle('audit', { create: true }); const name = `${userId || 'unknown'}.json`
    const cur = (await readJson<AuditEntry[]>(au, name)) || []; await writeJson(au, name, [...cur, ...entries].slice(-2000))
  }
}

/* ---------- local adapter ---------- */
const LS = 'uae-code-tool:snapshot'
export class LocalAdapter implements StorageAdapter {
  kind = 'local' as const
  label = 'local'
  private cache: Snapshot | null = null
  constructor() { try { addEventListener('storage', e => { if (e.key === LS) this.cache = null }) } catch { /* ignore */ } }
  private read(): Snapshot {
    if (this.cache) return this.cache
    const s = localStorage.getItem(LS)
    if (!s) return { config: defaultConfig(), answers: {}, reviews: emptyReviews(), audit: [] }
    let snap: Snapshot
    try { snap = JSON.parse(s) as Snapshot } catch { throw new Error('Local data is unreadable; restore it with Import on the landing page') }
    snap.config = ensureAdmin(migrateConfig(snap.config))
    const renames = Object.fromEntries(Object.entries(snap.config.renamedCycles || {}).filter(([from]) => !snap.config.cycles.some(c => c.id === from)))
    applyCycleRenames(snap.reviews, renames); for (const a of Object.values(snap.answers)) applyCycleRenames(a, renames)
    this.cache = snap; return snap
  }
  /** Throws on quota or storage failure so the caller can tell the person instead of pretending the save worked. */
  private write(s: Snapshot) { localStorage.setItem(LS, JSON.stringify(s)); this.cache = s }
  async load() { return this.read() }
  async saveConfig(c: Config) { const s = this.read(); s.config = c; this.write(s) }
  async saveAnswers(a: AnswersFile, base?: AnswersFile | null) { const s = this.read(); const m = mergeAnswers(s.answers[a.userId] || null, a, base); s.answers[a.userId] = m; this.write(s); return m }
  async saveReviews(r: ReviewsFile) { const s = this.read(); s.reviews = r; this.write(s) }
  async appendAudit(e: AuditEntry[]) { const s = this.read(); s.audit = [...s.audit, ...e].slice(-5000); this.write(s) }
  exportAll(): string { return JSON.stringify(this.read(), null, 1) }
  importAll(json: string) { this.write(JSON.parse(json)); this.cache = null }
}
