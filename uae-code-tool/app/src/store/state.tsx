import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AnswersFile, AuditEntry, CodeAnswer, Config, Lang, ReviewsFile, Snapshot, User } from '../types'
import { FolderAdapter, LocalAdapter, ConflictError, ReadOnlyError, mergeAnswers, hasFolderApi, loadHandle, storeHandle, type StorageAdapter } from './storage'
import { now } from './scoring'
import { t as tr, type Key } from '../i18n'

type Theme = 'light' | 'dark' | 'system'
interface Ctx {
  lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string
  theme: Theme; setTheme: (t: Theme) => void
  adapter: StorageAdapter | null; snap: Snapshot | null; loading: boolean; error: string | null; lastSync: string | null
  user: User | null; setUserId: (id: string | null) => void
  cycleId: string | null; setCycleId: (id: string) => void
  isAdmin: boolean
  connectFolder: () => Promise<boolean>; reconnect: () => Promise<boolean>; useLocal: () => void; refresh: () => Promise<void>; needsReconnect: boolean
  saveConfig: (c: Config, audit?: string) => Promise<void>
  /** Resolves with the stored (merged) answer for that code; it differs from `a` only if a newer copy already existed on disk. */
  saveMyAnswer: (cycleId: string, codeId: string, a: CodeAnswer) => Promise<CodeAnswer | undefined>
  saveMyNote: (codeId: string, text: string) => Promise<void>
  /** The owner's choice of responsible department for a code they are assigned to (null clears it back to the configured default). */
  saveMyDepartment: (codeId: string, deptId: string | null) => Promise<void>
  saveReviews: (r: ReviewsFile, audit?: string) => Promise<void>
  myAnswers: AnswersFile | null
}
const C = createContext<Ctx>(null as unknown as Ctx)
export const useApp = () => useContext(C)

const ls = { get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* ignore */ } } }
/* The chosen person lives only for the current tab: every fresh open starts on the landing page. */
const ss = { get: (k: string) => { try { return sessionStorage.getItem(k) } catch { return null } }, set: (k: string, v: string) => { try { sessionStorage.setItem(k, v) } catch { /* ignore */ } } }

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangS] = useState<Lang>((ls.get('lang') as Lang) || 'ar')
  const [theme, setThemeS] = useState<Theme>((ls.get('theme') as Theme) || 'system')
  const [adapter, setAdapter] = useState<StorageAdapter | null>(null)
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [userId, setUserIdS] = useState<string | null>(ss.get('userId'))
  const [cycleId, setCycleIdS] = useState<string | null>(ls.get('cycleId'))
  const [needsReconnect, setNeedsReconnect] = useState(false)
  const handleRef = useRef<FileSystemDirectoryHandle | null>(null)

  useEffect(() => { document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'; ls.set('lang', lang) }, [lang])
  useEffect(() => {
    const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', dark); ls.set('theme', theme)
  }, [theme])

  /** All writes go through one queue so two quick saves (answer + note, or two admin edits) can never race each other. */
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const writeSeq = useRef(0); const pending = useRef(0)
  /** Lost folder permission: ask the browser once (works while the click that triggered the save is still "live"), else show the reconnect banner. */
  const withPerm = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    try { return await fn() }
    catch (e) {
      const n = (e as DOMException)?.name
      if ((n === 'NotAllowedError' || n === 'SecurityError') && handleRef.current) {
        const p = await (handleRef.current as unknown as { requestPermission: (o: { mode: string }) => Promise<string> }).requestPermission({ mode: 'readwrite' }).catch(() => 'denied')
        if (p === 'granted') return fn()
        setNeedsReconnect(true)
      }
      throw e
    }
  }, [])
  const enqueue = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    pending.current++
    const run = () => withPerm(fn).finally(() => { pending.current--; writeSeq.current++ })
    const p = queue.current.then(run, run); queue.current = p.catch(() => undefined); return p
  }, [withPerm])
  /** The authoritative copy of the current person's answers file (updated synchronously after every write). */
  const myFileRef = useRef<AnswersFile | null>(null)
  const userIdRef = useRef<string | null>(null)

  const load = useCallback(async (ad: StorageAdapter): Promise<void> => {
    setLoading(true); setError(null)
    const seq = writeSeq.current
    try {
      const s = await ad.load()
      // a write landed while this read was in progress: what we read may predate it, so read again instead of publishing it
      if (writeSeq.current !== seq) { setLoading(false); return load(ad) }
      const me = userIdRef.current
      if (me && myFileRef.current) s.answers[me] = mergeAnswers(s.answers[me] || null, myFileRef.current)
      // never let a slower read roll back a newer config/reviews copy already in memory
      setSnap(prev => prev ? { ...s, config: (prev.config.updatedAt || '') > (s.config.updatedAt || '') ? prev.config : s.config, reviews: (prev.reviews.updatedAt || '') > (s.reviews.updatedAt || '') ? prev.reviews : s.reviews } : s)
      setLastSync(now())
    }
    catch (e) { const name = (e as DOMException)?.name; if (name === 'NotAllowedError' || name === 'SecurityError') setNeedsReconnect(true); setError(String((e as Error)?.message || e)) }
    finally { setLoading(false) }
  }, [])

  // boot: try the stored folder handle, else wait for user action
  useEffect(() => {
    (async () => {
      // nothing here may hang: whatever the browser allows, the landing page must end up showing its buttons
      const timeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> => Promise.race([p, new Promise<null>(r => setTimeout(() => r(null), ms))])
      try {
        const h = hasFolderApi() ? await timeout(loadHandle(), 4000) : null
        if (h) {
          handleRef.current = h
          const perm = await timeout((h as unknown as { queryPermission: (o: { mode: string }) => Promise<string> }).queryPermission({ mode: 'readwrite' }), 4000)
          if (perm === 'granted') { const ad = new FolderAdapter(h); setAdapter(ad); await load(ad); return }
          setNeedsReconnect(true)
        } else if (ls.get('mode') === 'local') { const ad = new LocalAdapter(); setAdapter(ad); await load(ad); return }
      } catch (e) { console.error(e); setError(String((e as Error)?.message || e)) }
      finally { setLoading(false) }
    })()
  }, [load])

  /** Picks the shared folder. When called from local mode, local data is copied into the folder if the folder is still empty. Returns true when a copy happened. */
  const connectFolder = useCallback(async () => {
    const h = await (window as unknown as { showDirectoryPicker: (o: { mode: string }) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({ mode: 'readwrite' })
    const ad = new FolderAdapter(h)
    let migrated = false
    if (adapter instanceof LocalAdapter && snap && Object.keys(snap.answers).length && await ad.isEmpty()) { await ad.importSnapshot(snap); migrated = true }
    await storeHandle(h); handleRef.current = h; ls.set('mode', 'folder')
    setAdapter(ad); setNeedsReconnect(false); await load(ad)
    return migrated
  }, [load, adapter, snap])
  const reconnect = useCallback(async () => {
    const h = handleRef.current; if (!h) return false
    const p = await (h as unknown as { requestPermission: (o: { mode: string }) => Promise<string> }).requestPermission({ mode: 'readwrite' })
    if (p !== 'granted') return false
    const ad = new FolderAdapter(h); setAdapter(ad); setNeedsReconnect(false); await load(ad); return true
  }, [load])
  const useLocal = useCallback(() => { ls.set('mode', 'local'); const ad = new LocalAdapter(); setAdapter(ad); setNeedsReconnect(false); load(ad) }, [load])
  const refresh = useCallback(async () => { if (adapter) await load(adapter) }, [adapter, load])

  // periodic refresh so evaluators see each other's progress (skipped while a write is in flight or the tab is hidden)
  useEffect(() => { if (!adapter) return; const id = setInterval(() => { if (!pending.current && !document.hidden) load(adapter) }, 90000); return () => clearInterval(id) }, [adapter, load])

  const user = useMemo(() => snap?.config.users.find(u => u.id === userId) || null, [snap, userId])
  const isAdmin = user?.role === 'admin'
  const effCycle = cycleId && snap?.config.cycles.some(c => c.id === cycleId) ? cycleId : (snap?.config.currentCycleId || null)
  // remember the resolved cycle so an admin changing the current cycle never silently moves someone mid-edit
  useEffect(() => { if (effCycle && effCycle !== cycleId) { setCycleIdS(effCycle); ls.set('cycleId', effCycle) } }, [effCycle, cycleId])
  useEffect(() => { userIdRef.current = userId }, [userId])

  const audit = useCallback(async (entries: AuditEntry[]) => { if (!adapter) return; try { await enqueue(() => adapter.appendAudit(entries, userId || 'unknown')); setSnap(s => s ? { ...s, audit: [...s.audit, ...entries] } : s) } catch { /* the log is informational; never block a save */ } }, [adapter, userId, enqueue])

  const saveConfig = useCallback(async (c: Config, a?: string) => {
    if (!adapter) return; const expected = snap?.config.updatedAt; c.updatedAt = now()
    try { await enqueue(() => adapter.saveConfig(c, expected)) }
    catch (e) { if (e instanceof ConflictError) { await load(adapter); throw new Error(tr(lang, 'configConflict')) } if (e instanceof ReadOnlyError) { setError(e.message); throw new Error(tr(lang, 'readOnlyData')) } throw e }
    setSnap(s => s ? { ...s, config: c } : s)
    if (a) await audit([{ at: now(), by: userId || '?', action: 'config', target: a }])
  }, [adapter, audit, userId, snap?.config.updatedAt, enqueue, load, lang])

  /** Write the current person's file: build from the latest known copy, merge on disk, then publish the merged result. */
  const snapRef = useRef<Snapshot | null>(null); snapRef.current = snap
  const writeMine = useCallback(async (patch: (file: AnswersFile) => AnswersFile) => {
    if (!adapter || !userId) throw new Error('not connected')
    try {
      return await enqueue(async () => {
        const base: AnswersFile = myFileRef.current || snapRef.current?.answers[userId] || { userId, updatedAt: now(), cycles: {} }
        const merged = await adapter.saveAnswers(patch(base), base)
        myFileRef.current = merged
        setSnap(s => s ? { ...s, answers: { ...s.answers, [userId]: merged } } : s)
        return merged
      })
    } catch (e) { if (e instanceof ReadOnlyError) { setError(e.message); throw new Error(tr(lang, 'readOnlyData')) } throw e }
  }, [adapter, userId, enqueue, lang])

  const saveMyNote = useCallback(async (codeId: string, text: string) => {
    // an empty text is kept as a tombstone so a deletion also wins the merge with an older copy on disk
    await writeMine(file => ({ ...file, updatedAt: now(), notes: { ...(file.notes || {}), [codeId]: { text, updatedAt: now() } } }))
  }, [writeMine])

  const saveMyDepartment = useCallback(async (codeId: string, deptId: string | null) => {
    await writeMine(file => { const departments = { ...(file.departments || {}) }; if (deptId) departments[codeId] = deptId; else delete departments[codeId]; return { ...file, updatedAt: now(), departments } })
  }, [writeMine])

  const saveMyAnswer = useCallback(async (cy: string, codeId: string, a: CodeAnswer) => {
    const merged = await writeMine(file => ({ ...file, updatedAt: now(), cycles: { ...file.cycles, [cy]: { ...(file.cycles[cy] || {}), [codeId]: a } } }))
    void audit([{ at: now(), by: userId || '?', action: a.state === 'submitted' ? 'submit' : 'save', target: `${cy}/${codeId}` }]) // informational; never delays the save
    return merged.cycles?.[cy]?.[codeId]
  }, [writeMine, audit, userId])

  const saveReviews = useCallback(async (r: ReviewsFile, a?: string) => {
    if (!adapter) return; const expected = snap?.reviews.updatedAt ?? ''; r.updatedAt = now()
    try { await enqueue(() => adapter.saveReviews(r, expected)) }
    catch (e) { if (e instanceof ConflictError) { await load(adapter); throw new Error(tr(lang, 'reviewConflict')) } if (e instanceof ReadOnlyError) { setError(e.message); throw new Error(tr(lang, 'readOnlyData')) } throw e }
    setSnap(s => s ? { ...s, reviews: r } : s)
    if (a) await audit([{ at: now(), by: userId || '?', action: 'review', target: a }])
  }, [adapter, audit, userId, enqueue, snap?.reviews.updatedAt, load, lang])

  const value: Ctx = {
    lang, setLang: setLangS, t: (k) => tr(lang, k), theme, setTheme: setThemeS,
    adapter, snap, loading, error, lastSync, user, setUserId: (id) => { setUserIdS(id); ss.set('userId', id || ''); if (id) ls.set('lastUserId', id) },
    cycleId: effCycle, setCycleId: (id) => { setCycleIdS(id); ls.set('cycleId', id) }, isAdmin,
    connectFolder, reconnect, useLocal, refresh, needsReconnect, saveConfig, saveMyAnswer, saveMyNote, saveMyDepartment, saveReviews,
    myAnswers: userId && snap ? snap.answers[userId] || null : null,
  }
  return <C.Provider value={value}>{children}</C.Provider>
}
