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

type Listing = [string, Dir][]
/** Folder listings remembered for one batch, so creating folders for many codes does not re-read the share each time. */
export type DirCache = Map<Dir, Listing>
const dirs = async (d: Dir, cache?: DirCache): Promise<Listing> => {
  const hit = cache?.get(d); if (hit) return hit
  const out: Listing = []; for await (const [name, h] of d as unknown as AsyncIterable<[string, FileSystemHandle]>) if (h.kind === 'directory') out.push([name, h as Dir])
  out.sort((a, b) => a[0].localeCompare(b[0])); cache?.set(d, out); return out
}
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** Windows-safe folder name: no reserved characters, no trailing dot or space. */
export const safeName = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 80)
/* Folder names are matched leniently, because the folders are made by hand: Arabic-Indic digits count as digits, a
 * leading word (المحور / Pillar / كود / Code) is optional, and the number may be followed by ".", "-", a space or nothing —
 * but not by more digits, so "1" never matches "10" or "1.2". */
const latin = (s: string) => s.replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 0x6F0))
const NUM_END = '(?!\\d|\\.\\d)'
const ORDINAL: Record<string, string> = { '1': 'الأول|الاول|الأولى', '2': 'الثاني|الثانية', '3': 'الثالث|الثالثة', '4': 'الرابع|الرابعة', '5': 'الخامس|الخامسة', '6': 'السادس|السادسة', '7': 'السابع|السابعة', '8': 'الثامن|الثامنة', '9': 'التاسع|التاسعة' }
export const isPillarFolder = (name: string, id: string) => { const n = latin(name)
  return new RegExp('^\\s*(?:المحور|محور|Pillar|P)?\\s*[-_#]?\\s*0*' + esc(id) + NUM_END, 'i').test(n) || (!!ORDINAL[id] && new RegExp('^\\s*(?:المحور|محور)\\s+(?:' + ORDINAL[id] + ')(?![\\u0600-\\u06FF])').test(n)) }
export const startsWithId = (name: string, id: string) => new RegExp('^\\s*(?:الكود|كود|المحور الفرعي|Code|Sub-?pillar)?\\s*[-_#]?\\s*' + esc(id) + NUM_END, 'i').test(latin(name))

export interface SaveResult { segments: string[]; saved: string[]; createdCode: boolean; createdPillar: boolean }
/** Saves files into the code's folder under the evidence root, creating the folder when it does not exist. With no
 *  files it only makes sure the folder is there. The code folder is looked for by its number inside the pillar folder,
 *  directly or one level down inside a sub-pillar folder; a code folder sitting directly in the root is used too. */
export async function saveEvidenceFiles(rootDir: Dir, pillar: { id: string; name: string }, subId: string, codeId: string, files: File[], cache?: DirCache): Promise<SaveResult> {
  const top = await dirs(rootDir, cache)
  let segments: string[] | null = null; let codeDir: Dir | null = null; let createdPillar = false, createdCode = false
  const atRoot = top.find(([n]) => startsWithId(n, codeId))
  if (atRoot) { segments = [atRoot[0]]; codeDir = atRoot[1] }
  if (!codeDir) {
    let pEntry = top.find(([n]) => isPillarFolder(n, pillar.id))
    if (!pEntry) { const name = safeName(`المحور ${pillar.id} - ${pillar.name}`); pEntry = [name, await rootDir.getDirectoryHandle(name, { create: true })]; createdPillar = true; top.push(pEntry) }
    const [pName, pDir] = pEntry; const level1 = await dirs(pDir, cache)
    const direct = level1.find(([n]) => startsWithId(n, codeId))
    if (direct) { segments = [pName, direct[0]]; codeDir = direct[1] }
    let subEntry: [string, Dir] | undefined
    if (!codeDir) for (const [sn, sd] of level1) { if (!startsWithId(sn, subId)) continue; subEntry = [sn, sd]; const hit = (await dirs(sd, cache)).find(([n]) => startsWithId(n, codeId)); if (hit) { segments = [pName, sn, hit[0]]; codeDir = hit[1] } break }
    // the code may have been filed under a differently numbered folder by hand: look one level down everywhere before creating
    if (!codeDir) for (const [sn, sd] of level1) { if (subEntry && sd === subEntry[1]) continue; const hit = (await dirs(sd, cache)).find(([n]) => startsWithId(n, codeId)); if (hit) { segments = [pName, sn, hit[0]]; codeDir = hit[1]; break } }
    if (!codeDir) { const parent = subEntry ? subEntry[1] : pDir; codeDir = await parent.getDirectoryHandle(codeId, { create: true }); segments = subEntry ? [pName, subEntry[0], codeId] : [pName, codeId]; createdCode = true
      const list = cache?.get(parent); if (list) list.push([codeId, codeDir]) }
  }
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

/* ---------- Self-check: is this browser linked to a usable evidence folder, and does it look like the right one? ---------- */
export interface RootCheck {
  supported: boolean
  linked: boolean                       // a folder was chosen on this browser at some point
  name: string | null                   // its name (the browser never reveals the full path)
  permission: 'granted' | 'prompt' | 'denied' | 'unknown'
  canWrite: boolean | null              // a file could be created and removed in it
  writeError?: string
  pillars: { id: string; folder: string | null; subFolders: number; codeFolders: number }[]
  codeFoldersAtRoot: number
  other: string[]                       // top-level folders that are neither a pillar nor a code folder
}
const looksLikeCode = (n: string) => /^\s*(?:\S+\s+)?\d+\.\d+\.\d+[a-z]?(?!\d|\.\d)/i.test(latin(n))
const looksLikeSub = (n: string) => /^\s*(?:\S+\s+){0,2}\d+\.\d+(?!\d|\.\d)/.test(latin(n))
/** Checks the linked evidence folder without changing anything in it except a test file that is removed again.
 *  `ask` may show the browser's permission prompt, so pass true only from a click. */
export async function checkEvidenceRoot(pillarIds: string[], ask: boolean): Promise<RootCheck> {
  const res: RootCheck = { supported: evidenceSupported(), linked: false, name: null, permission: 'unknown', canWrite: null, pillars: pillarIds.map(id => ({ id, folder: null, subFolders: 0, codeFolders: 0 })), codeFoldersAtRoot: 0, other: [] }
  if (!res.supported) return res
  if (!root) root = await recall()
  if (!root) return res
  res.linked = true; res.name = root.name
  const h = root as AnyDir
  try { res.permission = h.queryPermission ? await h.queryPermission({ mode: 'readwrite' }) as RootCheck['permission'] : 'granted' } catch { res.permission = 'unknown' }
  if (res.permission !== 'granted' && ask && h.requestPermission) { try { res.permission = await h.requestPermission({ mode: 'readwrite' }) as RootCheck['permission'] } catch { /* stays as it was */ } }
  if (res.permission !== 'granted') return res
  const probe = `.uae-code-check-${Date.now()}.tmp`
  try { const fh = await root.getFileHandle(probe, { create: true }); const w = await fh.createWritable(); await w.write('ok'); await w.close(); await root.removeEntry(probe); res.canWrite = true }
  catch (e) { res.canWrite = false; res.writeError = (e as Error)?.message || String(e); try { await root.removeEntry(probe) } catch { /* nothing was left */ } }
  try {
    const top = await dirs(root)
    for (const [n, d] of top) {
      const p = res.pillars.find(x => !x.folder && isPillarFolder(n, x.id))
      if (!p) { if (looksLikeCode(n)) res.codeFoldersAtRoot++; else res.other.push(n); continue }
      p.folder = n
      for (const [n1, d1] of await dirs(d)) { if (looksLikeCode(n1)) p.codeFolders++; else if (looksLikeSub(n1)) { p.subFolders++; p.codeFolders += (await dirs(d1)).filter(([n2]) => looksLikeCode(n2)).length } }
    }
  } catch (e) { res.writeError = res.writeError || (e as Error)?.message }
  return res
}
/** Leaves a small marker file in the linked folder so a person can open the shared path in the file explorer and see
 *  that it is the same folder. Returns the file name. */
export async function writeEvidenceMarker(who: string, text: string): Promise<string | null> {
  const r = await evidenceRootReady(); if (!r) return null
  const d = new Date(); const pad = (n: number) => String(n).padStart(2, '0')
  const name = safeFile(`_فحص ربط الأداة - ${who} - ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}.${pad(d.getMinutes())}.txt`)
  const fh = await r.getFileHandle(name, { create: true }); const w = await fh.createWritable(); await w.write(text); await w.close(); return name
}
export async function removeEvidenceMarker(name: string): Promise<boolean> { const r = await evidenceRootReady(); if (!r) return false; try { await r.removeEntry(name); return true } catch { return false } }

