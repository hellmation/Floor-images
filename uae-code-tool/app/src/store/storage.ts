import type { AnswersFile, Config, ReviewsFile, AuditEntry, Snapshot } from '../types'
import { defaultConfig, emptyReviews, migrateConfig, ensureAdmin } from './defaults'

/** A storage adapter persists the shared state. Evaluators write only their own answers file;
 *  admins write config, reviews and audit. The folder adapter uses the File System Access API;
 *  the local adapter keeps everything in localStorage for browsers without it (or demos). */
export interface StorageAdapter {
  kind: 'folder' | 'local'
  label: string
  load(): Promise<Snapshot>
  saveConfig(c: Config): Promise<void>
  saveAnswers(a: AnswersFile): Promise<void>
  saveReviews(r: ReviewsFile): Promise<void>
  appendAudit(entries: AuditEntry[]): Promise<void>
}

/* ---------- helpers ---------- */
async function readJson<T>(dir: FileSystemDirectoryHandle, name: string): Promise<T | null> {
  try { const fh = await dir.getFileHandle(name); const f = await fh.getFile(); const txt = await f.text(); return txt.trim() ? JSON.parse(txt) as T : null }
  catch { return null }
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
  await new Promise(r => { tx.oncomplete = r })
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
    else if ((config.version || 1) < 5) { await this.backupConfig(d, config, 'before-migration'); config = migrateConfig(config); await writeJson(d, 'config.json', config) }
    if (!config.users.some(u => u.active && u.role === 'admin')) { await this.backupConfig(d, config, 'before-admin-recovery'); config = ensureAdmin(config); await writeJson(d, 'config.json', config) }
    const reviews = (await readJson<ReviewsFile>(d, 'reviews.json')) || emptyReviews()
    const audit = (await readJson<AuditEntry[]>(d, 'audit.json')) || []
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
  async saveConfig(c: Config) { await writeJson(await this.data(), 'config.json', c) }
  async saveReviews(r: ReviewsFile) { await writeJson(await this.data(), 'reviews.json', r) }
  async saveAnswers(a: AnswersFile) { const ad = await (await this.data()).getDirectoryHandle('answers', { create: true }); await writeJson(ad, `${a.userId}.json`, a) }
  async appendAudit(entries: AuditEntry[]) { const d = await this.data(); const cur = (await readJson<AuditEntry[]>(d, 'audit.json')) || []; await writeJson(d, 'audit.json', [...cur, ...entries].slice(-5000)) }
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
  async saveAnswers(a: AnswersFile) { const s = this.read(); s.answers[a.userId] = a; this.write(s) }
  async saveReviews(r: ReviewsFile) { const s = this.read(); s.reviews = r; this.write(s) }
  async appendAudit(e: AuditEntry[]) { const s = this.read(); s.audit = [...s.audit, ...e].slice(-5000); this.write(s) }
  exportAll(): string { return JSON.stringify(this.read(), null, 1) }
  importAll(json: string) { this.write(JSON.parse(json)) }
}
