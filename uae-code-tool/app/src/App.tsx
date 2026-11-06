import { useEffect, useRef, useState } from 'react'
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
import Standings from './pages/Standings'
import Admin from './pages/Admin'

declare global { interface Window { __leaveGuard?: () => boolean } }
const PAGES = new Set(['home', 'my', 'browse', 'notes', 'code', 'dashboard', 'standings', 'review', 'mapping', 'cycles', 'admin'])
function useHash() {
  const [h, setH] = useState(location.hash.replace(/^#\/?/, ''))
  const prev = useRef(h); const skip = useRef(false)
  useEffect(() => { const f = () => {
    const next = location.hash.replace(/^#\/?/, '')
    if (skip.current) { skip.current = false; return }
    // a page with unsaved edits may veto the navigation (CodeView registers the guard)
    if (window.__leaveGuard && !window.__leaveGuard()) { skip.current = true; location.hash = '#/' + prev.current; return }
    prev.current = next; setH(next); window.scrollTo({ top: 0 }) }
    addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [])
  return h
}

export default function App() {
  const { t, snap, user, isAdmin } = useApp()
  const hash = useHash()
  useEffect(() => { document.title = `${t('appName')} · ${t('appTagline')}` })
  if (!snap || !user) return <Setup />
  const route = hash.split('?')[0].split('/')
  let page = route[0] || 'home'
  const adminOnly = ['review', 'mapping', 'cycles', 'admin']
  if (!PAGES.has(page) || (adminOnly.includes(page) && !isAdmin)) page = 'home'
  let body
  switch (page) {
    case 'my': body = <MyWork key={hash} />; break
    case 'browse': body = <Browse key={hash} />; break
    case 'notes': body = <Notes />; break
    case 'code': body = <CodeView id={decodeURIComponent(route[1] || '')} />; break
    case 'dashboard': body = <Dashboard />; break
    case 'standings': body = <Standings />; break
    case 'review': body = <Review />; break
    case 'mapping': body = <Mapping />; break
    case 'cycles': body = <Cycles />; break
    case 'admin': body = <Admin />; break
    default: body = <Home />
  }
  return <Shell page={page}>{body}</Shell>
}
