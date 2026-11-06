import type { AnswersFile, Config, ReviewsFile, AuditEntry, Snapshot } from '../types'
import { defaultConfig, emptyReviews, migrateConfig, ensureAdmin } from './defaults'


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
  saveAnswers(a: AnswersFile): Promise<AnswersFile>
  saveReviews(r: ReviewsFile): Promise<void>
  appendAudit(entries: AuditEntry[], userId: string): Promise<void>
}
export class ConflictError extends Error { constructor() { super('conflict'); this.name = 'ConflictError' } }
export const APP_CONFIG_VERSION = 5

/** Merge two copies of one person's answers file: per cycle/code and per note the newer updatedAt wins. */
export function mergeAnswers(disk: AnswersFile | null, next: AnswersFile): AnswersFile {
  if (!disk) return next
  const cycles: AnswersFile['cycles'] = {}
  for (const cy of new Set([...Object.keys(disk.cycles || {}), ...Object.keys(next.cycles || {})])) {
    cycles[cy] = { ...(disk.cycles?.[cy] || {}) }
    for (const [code, a] of Object.entries(next.cycles?.[cy] || {})) { const d = cycles[cy][code]; if (!d || (a.updatedAt || '') >= (d.updatedAt || '')) cycles[cy][code] = a }
  }
  const notes = { ...(disk.notes || {}) }
  for (const [code, n] of Object.entries(next.notes || {})) { const d = notes[code]; if (!d || (n.updatedAt || '') >= (d.updatedAt || '')) notes[code] = n }
  return { ...disk, ...next, cycles, notes, updatedAt: [disk.updatedAt, next.updatedAt].sort().pop() || next.updatedAt }
}

/* ---------- helpers ---------- */
/** Returns null only when the file does not exist. Any other failure (lock, read error, bad JSON) is thrown so a
 *  momentary problem on a network share can never be mistaken for "no data" and overwritten with defaults. */
async function readJson<T>(dir: FileSystemDirectoryHandle, name: string): Promise<T | null> {
  let fh: FileSystemFileHandle
  try { fh = await dir.getFileHandle(name) } catch (e) { if ((e as DOMException).name === 'NotFoundError') return null; throw e }
  const f = await fh.getFile(); const txt = await f.text()
  if (!txt.trim()) return null
  try { return JSON.parse(txt) as T } catch { throw new Error(`Unreadable file: ${name}`) }
}
async function exists(dir: FileSystemDirectoryHandle, name: string) { try { await dir.getFileHandle(name); return true } catch { return false } }
const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
async function writeJson(dir: FileSystemDirectoryHandle, name: string, data: unknown) {
  const fh = await dir.getFileHandle(name, { create: true })
  const w = await fh.createWritable()
  await w.write(JSON.stringify(data, null, 1))
  await w.close()
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
    if (!config) { config = defaultConfig(); await writeJson(d, 'config.json', config) }
    else if ((config.version || 1) > APP_CONFIG_VERSION) throw new Error(`This file is older than the data (config v${config.version}); open the newer UAE-Code-Championship.html`)
    else if ((config.version || 1) < APP_CONFIG_VERSION) { await this.backupConfig(d, config, 'before-migration'); config = migrateConfig(config); await writeJson(d, 'config.json', config) }
    if (!config.users.some(u => u.active && u.role === 'admin')) { await this.backupConfig(d, config, 'before-admin-recovery'); config = ensureAdmin(config); await writeJson(d, 'config.json', config) }
    const reviews = (await readJson<ReviewsFile>(d, 'reviews.json')) || emptyReviews()
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
        if (a && a.userId) answers[a.userId] = a
      }
    }
    const snap = { config, answers, reviews, audit }
    await this.dailySnapshot(d, snap)
    return snap
  }
  /** True when the folder has never been used by the tool (no data/config.json). */
  async isEmpty() { try { const d = await this.dir.getDirectoryHandle('data'); return !(await exists(d, 'config.json')) } catch { return true } }
  /** Writes a whole snapshot (e.g. local-mode data) into the folder. Used once when moving from local mode to an empty shared folder. */
  async importSnapshot(snap: Snapshot) {
    const d = await this.data(); await writeJson(d, 'config.json', snap.config); await writeJson(d, 'reviews.json', snap.reviews); await writeJson(d, 'audit.json', snap.audit)
    const ad = await d.getDirectoryHandle('answers', { create: true }); for (const a of Object.values(snap.answers)) await writeJson(ad, `${a.userId}.json`, a)
  }
  async saveConfig(c: Config, expectedUpdatedAt?: string) {
    const d = await this.data()
    if (expectedUpdatedAt) { const disk = await readJson<Config>(d, 'config.json'); if (disk?.updatedAt && disk.updatedAt !== expectedUpdatedAt) throw new ConflictError() }
    await writeJson(d, 'config.json', c)
  }
  async saveReviews(r: ReviewsFile) { await writeJson(await this.data(), 'reviews.json', r) }
  async saveAnswers(a: AnswersFile) {
    const ad = await (await this.data()).getDirectoryHandle('answers', { create: true })
    const merged = mergeAnswers(await readJson<AnswersFile>(ad, `${a.userId}.json`), a)
    await writeJson(ad, `${a.userId}.json`, merged); return merged
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
  private read(): Snapshot {
    try { const s = localStorage.getItem(LS); if (s) { const snap = JSON.parse(s) as Snapshot; snap.config = ensureAdmin(migrateConfig(snap.config)); return snap } } catch { /* ignore */ }
    return { config: defaultConfig(), answers: {}, reviews: emptyReviews(), audit: [] }
  }
  private write(s: Snapshot) { try { localStorage.setItem(LS, JSON.stringify(s)) } catch { /* ignore */ } }
  async load() { return this.read() }
  async saveConfig(c: Config) { const s = this.read(); s.config = c; this.write(s) }
  async saveAnswers(a: AnswersFile) { const s = this.read(); const m = mergeAnswers(s.answers[a.userId] || null, a); s.answers[a.userId] = m; this.write(s); return m }
  async saveReviews(r: ReviewsFile) { const s = this.read(); s.reviews = r; this.write(s) }
  async appendAudit(e: AuditEntry[]) { const s = this.read(); s.audit = [...s.audit, ...e].slice(-5000); this.write(s) }
  exportAll(): string { return JSON.stringify(this.read(), null, 1) }
  importAll(json: string) { this.write(JSON.parse(json)) }
}
