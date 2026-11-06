import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AnswersFile, AuditEntry, CodeAnswer, Config, Lang, ReviewsFile, Snapshot, User } from '../types'
import { FolderAdapter, LocalAdapter, hasFolderApi, loadHandle, storeHandle, type StorageAdapter } from './storage'
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
  connectFolder: () => Promise<void>; reconnect: () => Promise<boolean>; useLocal: () => void; refresh: () => Promise<void>; needsReconnect: boolean
  saveConfig: (c: Config, audit?: string) => Promise<void>
  saveMyAnswer: (cycleId: string, codeId: string, a: CodeAnswer) => Promise<void>
  saveMyNote: (codeId: string, text: string) => Promise<void>
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

  const load = useCallback(async (ad: StorageAdapter) => {
    setLoading(true); setError(null)
    try { const s = await ad.load(); setSnap(s); setLastSync(now()) } catch (e) { setError(String(e)) } finally { setLoading(false) }
  }, [])

  // boot: try the stored folder handle, else wait for user action
  useEffect(() => {
    (async () => {
      const h = hasFolderApi() ? await loadHandle() : null
      if (h) {
        handleRef.current = h
        const perm = await (h as unknown as { queryPermission: (o: { mode: string }) => Promise<string> }).queryPermission({ mode: 'readwrite' })
        if (perm === 'granted') { const ad = new FolderAdapter(h); setAdapter(ad); await load(ad); return }
        setNeedsReconnect(true)
      } else if (ls.get('mode') === 'local') { const ad = new LocalAdapter(); setAdapter(ad); await load(ad); return }
      setLoading(false)
    })()
  }, [load])

  const connectFolder = useCallback(async () => {
    const h = await (window as unknown as { showDirectoryPicker: (o: { mode: string }) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({ mode: 'readwrite' })
    await storeHandle(h); handleRef.current = h; ls.set('mode', 'folder')
    const ad = new FolderAdapter(h); setAdapter(ad); setNeedsReconnect(false); await load(ad)
  }, [load])
  const reconnect = useCallback(async () => {
    const h = handleRef.current; if (!h) return false
    const p = await (h as unknown as { requestPermission: (o: { mode: string }) => Promise<string> }).requestPermission({ mode: 'readwrite' })
    if (p !== 'granted') return false
    const ad = new FolderAdapter(h); setAdapter(ad); setNeedsReconnect(false); await load(ad); return true
  }, [load])
  const useLocal = useCallback(() => { ls.set('mode', 'local'); const ad = new LocalAdapter(); setAdapter(ad); setNeedsReconnect(false); load(ad) }, [load])
  const refresh = useCallback(async () => { if (adapter) await load(adapter) }, [adapter, load])

  // periodic refresh so evaluators see each other's progress
  useEffect(() => { if (!adapter) return; const id = setInterval(() => { load(adapter) }, 90000); return () => clearInterval(id) }, [adapter, load])

  const user = useMemo(() => snap?.config.users.find(u => u.id === userId) || null, [snap, userId])
  const isAdmin = user?.role === 'admin'
  const effCycle = cycleId && snap?.config.cycles.some(c => c.id === cycleId) ? cycleId : (snap?.config.currentCycleId || null)

  const audit = useCallback(async (entries: AuditEntry[]) => { if (adapter) { await adapter.appendAudit(entries); setSnap(s => s ? { ...s, audit: [...s.audit, ...entries] } : s) } }, [adapter])

  const saveConfig = useCallback(async (c: Config, a?: string) => {
    if (!adapter) return; c.updatedAt = now(); await adapter.saveConfig(c); setSnap(s => s ? { ...s, config: c } : s)
    if (a) await audit([{ at: now(), by: userId || '?', action: 'config', target: a }])
  }, [adapter, audit, userId])

  const saveMyNote = useCallback(async (codeId: string, text: string) => {
    if (!adapter || !userId || !snap) return
    const file: AnswersFile = snap.answers[userId] || { userId, updatedAt: now(), cycles: {} }
    const notes = { ...(file.notes || {}) }
    if (text.trim()) notes[codeId] = { text, updatedAt: now() }; else delete notes[codeId]
    const next: AnswersFile = { ...file, updatedAt: now(), notes }
    await adapter.saveAnswers(next)
    setSnap(s => s ? { ...s, answers: { ...s.answers, [userId]: next } } : s)
  }, [adapter, userId, snap])

  const saveMyAnswer = useCallback(async (cy: string, codeId: string, a: CodeAnswer) => {
    if (!adapter || !userId || !snap) return
    const file: AnswersFile = snap.answers[userId] || { userId, updatedAt: now(), cycles: {} }
    const next: AnswersFile = { ...file, updatedAt: now(), cycles: { ...file.cycles, [cy]: { ...(file.cycles[cy] || {}), [codeId]: a } } }
    await adapter.saveAnswers(next)
    setSnap(s => s ? { ...s, answers: { ...s.answers, [userId]: next } } : s)
    await audit([{ at: now(), by: userId, action: a.state === 'submitted' ? 'submit' : 'save', target: `${cy}/${codeId}` }])
  }, [adapter, audit, snap, userId])

  const saveReviews = useCallback(async (r: ReviewsFile, a?: string) => {
    if (!adapter) return; r.updatedAt = now(); await adapter.saveReviews(r); setSnap(s => s ? { ...s, reviews: r } : s)
    if (a) await audit([{ at: now(), by: userId || '?', action: 'review', target: a }])
  }, [adapter, audit, userId])

  const value: Ctx = {
    lang, setLang: setLangS, t: (k) => tr(lang, k), theme, setTheme: setThemeS,
    adapter, snap, loading, error, lastSync, user, setUserId: (id) => { setUserIdS(id); ss.set('userId', id || ''); if (id) ls.set('lastUserId', id) },
    cycleId: effCycle, setCycleId: (id) => { setCycleIdS(id); ls.set('cycleId', id) }, isAdmin,
    connectFolder, reconnect, useLocal, refresh, needsReconnect, saveConfig, saveMyAnswer, saveMyNote, saveReviews,
    myAnswers: userId && snap ? snap.answers[userId] || null : null,
  }
  return <C.Provider value={value}>{children}</C.Provider>
}
