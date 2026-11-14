/** Evidence files on the shared drive. The person links the evidence root folder once per browser; files dropped on a
 *  requirement are written to <root>\<pillar folder>\[<sub-pillar folder>\]<code folder>, creating the code folder when
 *  it does not exist. Nothing here runs at start-up: every call is the result of a click or a drop. */
export const DEFAULT_EVIDENCE_ROOT = '\\\\Aprodinfsmb.tax.ae\\Taxpayer_Support_Office\\Development Team\\2026\\كود الامارات - مجلدات الأدلة'
type Dir = FileSystemDirectoryHandle
type AnyDir = Dir & { queryPermission?: (o: { mode: string }) => Promise<string>; requestPermission?: (o: { mode: string }) => Promise<string> }
let root: Dir | null = null

export const evidenceSupported = () => typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function'
export const evidenceRootName = () => root?.name || null

const DB = 'uae-code-evidence', STORE = 'handles'
const withTimeout = <T,>(p: Promise<T>, ms = 3000) => Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))])
function idb(): Promise<IDBDatabase> { return new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error('blocked')) }) }
async function remember(h: Dir) { try { const db = await withTimeout(idb()); await withTimeout(new Promise<void>((res, rej) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(h, 'root'); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error) })); db.close() } catch { /* the link then lasts for this tab only */ } }
async function recall(): Promise<Dir | null> { try { const db = await withTimeout(idb()); const h = await withTimeout(new Promise<Dir | null>((res, rej) => { const q = db.transaction(STORE).objectStore(STORE).get('root'); q.onsuccess = () => res((q.result as Dir) || null); q.onerror = () => rej(q.error) })); db.close(); return h && typeof (h as Dir).getDirectoryHandle === 'function' ? h : null } catch { return null } }
async function allowed(h: AnyDir, ask: boolean): Promise<boolean> {
  try { if (!h.queryPermission) return true; if (await h.queryPermission({ mode: 'readwrite' }) === 'granted') return true; if (ask && h.requestPermission) return await h.requestPermission({ mode: 'readwrite' }) === 'granted'; return false } catch { return false }
}
/** The linked evidence root if it is usable right now without asking (no prompt, no picker). */
export async function evidenceRootReady(): Promise<Dir | null> {
  if (!evidenceSupported()) return null
  if (!root) root = await recall()
  return root && await allowed(root as AnyDir, false) ? root : null
}
/** Links the evidence root: re-grants a remembered folder or opens the picker. Must be called from a click. */
export async function linkEvidenceRoot(forcePick = false): Promise<Dir | null> {
  if (!evidenceSupported()) return null
  if (!forcePick) { if (!root) root = await recall(); if (root && await allowed(root as AnyDir, true)) return root }
  const picked = await (window as unknown as { showDirectoryPicker: (o: object) => Promise<Dir> }).showDirectoryPicker({ mode: 'readwrite', id: 'uae-code-evidence' })
  root = picked; await remember(picked); return picked
}

const dirs = async (d: Dir) => { const out: [string, Dir][] = []; for await (const [name, h] of d as unknown as AsyncIterable<[string, FileSystemHandle]>) if (h.kind === 'directory') out.push([name, h as Dir]); return out.sort((a, b) => a[0].localeCompare(b[0])) }
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** Windows-safe folder name: no reserved characters, no trailing dot or space. */
export const safeName = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 80)
const startsWithId = (name: string, id: string) => new RegExp('^\\s*' + esc(id) + '(?![\\d.])').test(name)

export interface SaveResult { segments: string[]; saved: string[]; createdCode: boolean; createdPillar: boolean }
/** Saves files into the code's folder under the evidence root. The code folder is searched inside the pillar folder
 *  (directly, or one level down inside a sub-pillar folder) by its number; it is created when missing. */
export async function saveEvidenceFiles(rootDir: Dir, pillar: { id: string; name: string }, subId: string, codeId: string, files: File[]): Promise<SaveResult> {
  const top = await dirs(rootDir)
  const pillarRe = new RegExp('^\\s*(?:المحور|محور|Pillar)?\\s*0*' + esc(pillar.id) + '(?![\\d.])', 'i')
  let pEntry = top.find(([n]) => pillarRe.test(n)); let createdPillar = false
  if (!pEntry) { const name = safeName(`المحور ${pillar.id} - ${pillar.name}`); pEntry = [name, await rootDir.getDirectoryHandle(name, { create: true })]; createdPillar = true }
  const [pName, pDir] = pEntry; const level1 = await dirs(pDir)
  let segments: string[] | null = null; let codeDir: Dir | null = null
  const direct = level1.find(([n]) => startsWithId(n, codeId))
  if (direct) { segments = [pName, direct[0]]; codeDir = direct[1] }
  let subEntry: [string, Dir] | undefined
  if (!codeDir) for (const [sn, sd] of level1) { if (startsWithId(sn, subId)) subEntry = [sn, sd]; const hit = (await dirs(sd)).find(([n]) => startsWithId(n, codeId)); if (hit) { segments = [pName, sn, hit[0]]; codeDir = hit[1]; break } }
  let createdCode = false
  if (!codeDir) { const parent = subEntry ? subEntry[1] : pDir; codeDir = await parent.getDirectoryHandle(codeId, { create: true }); segments = subEntry ? [pName, subEntry[0], codeId] : [pName, codeId]; createdCode = true }
  const saved: string[] = []
  for (const f of files) {
    let name = safeFile(f.name); const dot = name.lastIndexOf('.'); const stem = dot > 0 ? name.slice(0, dot) : name, ext = dot > 0 ? name.slice(dot) : ''
    for (let i = 2; i < 200 && await exists(codeDir, name); i++) name = `${stem} (${i})${ext}` // never overwrite an existing evidence file
    const fh = await codeDir.getFileHandle(name, { create: true }); const w = await fh.createWritable(); await w.write(f); await w.close(); saved.push(name)
  }
  return { segments: segments!, saved, createdCode, createdPillar }
}
const safeFile = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || 'file'
async function exists(d: Dir, name: string) { try { await d.getFileHandle(name); return true } catch { return false } }
