import { useEffect, useRef, useState, useLayoutEffect } from 'react'
import { navigate } from './store/viewState'
import { useApp } from './store/state'
import { Shell } from './components/Shell'
import Setup from './pages/Setup'
import Home from './pages/Home'
import MyWork from './pages/MyWork'
import Browse from './pages/Browse'
import Notes from './pages/Notes'
import CodeView from './pages/CodeView'
import Mapping from './pages/Mapping'
import Cycles from './pages/Cycles'
import Review from './pages/Review'
import Dashboard from './pages/Dashboard'
import Fulfil from './pages/Fulfil'
import Standings from './pages/Standings'
import Admin from './pages/Admin'

declare global { interface Window { __leaveGuard?: () => boolean } }
const PAGES = new Set(['home', 'my', 'browse', 'notes', 'code', 'dashboard', 'fulfil', 'standings', 'review', 'mapping', 'cycles', 'admin'])
function useHash() {
  const [h, setH] = useState(location.hash.replace(/^#\/?/, ''))
  const prev = useRef(h); const skip = useRef(false); const target = useRef(0); const first = useRef(true)
  // after the new page has rendered: top for a fresh visit, the remembered offset when coming back
  useLayoutEffect(() => { if (first.current) { first.current = false; return } const y = target.current; window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior }); if (y <= 0) return; let n = 0, raf = 0
    const tick = () => { if (Math.abs(window.scrollY - y) > 2 && n++ < 30) { window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior }); raf = requestAnimationFrame(tick) } }
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf) }, [h])
  useEffect(() => { const f = () => {
    const next = location.hash.replace(/^#\/?/, '')
    if (skip.current) { skip.current = false; return }
    // a page with unsaved edits may veto the navigation (CodeView registers the guard)
    if (window.__leaveGuard && !window.__leaveGuard()) { skip.current = true; location.hash = '#/' + prev.current; return }
    target.current = navigate(prev.current, window.scrollY, next); prev.current = next; setH(next) }
    addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [])
  return h
}

export default function App() {
  const { t, snap, user, isAdmin, canReview } = useApp()
  const hash = useHash()
  useEffect(() => { document.title = `${t('appName')} · ${t('appTagline')}` })
  if (!snap || !user) return <Setup />
  const route = hash.split('?')[0].split('/')
  let page = route[0] || 'home'
  const adminOnly = ['review', 'mapping', 'cycles', 'admin']
  if (!PAGES.has(page) || (adminOnly.includes(page) && !isAdmin && !(page === 'review' && canReview))) page = 'home'
  let body
  switch (page) {
    case 'my': body = <MyWork key={hash} />; break
    case 'browse': body = <Browse key={hash} />; break
    case 'notes': body = <Notes />; break
    case 'code': body = <CodeView id={decodeURIComponent(route[1] || '')} />; break
    case 'dashboard': body = <Dashboard />; break
    case 'fulfil': body = <Fulfil />; break
    case 'standings': body = <Standings />; break
    case 'review': body = <Review />; break
    case 'mapping': body = <Mapping />; break
    case 'cycles': body = <Cycles />; break
    case 'admin': body = <Admin />; break
    default: body = <Home />
  }
  return <Shell page={page}>{body}</Shell>
}
