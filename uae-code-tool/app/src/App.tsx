import { useEffect, useState } from 'react'
import { useApp } from './store/state'
import { Shell } from './components/Shell'
import Setup from './pages/Setup'
import Home from './pages/Home'
import MyWork from './pages/MyWork'
import Browse from './pages/Browse'
import CodeView from './pages/CodeView'
import Mapping from './pages/Mapping'
import Cycles from './pages/Cycles'
import Review from './pages/Review'
import Dashboard from './pages/Dashboard'
import Standings from './pages/Standings'
import Admin from './pages/Admin'

function useHash() {
  const [h, setH] = useState(location.hash.replace(/^#\/?/, ''))
  useEffect(() => { const f = () => { setH(location.hash.replace(/^#\/?/, '')); window.scrollTo({ top: 0 }) }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [])
  return h
}

export default function App() {
  const { t, snap, user, isAdmin } = useApp()
  const hash = useHash()
  useEffect(() => { document.title = `${t('appName')} · ${t('appTagline')}` })
  if (!snap || !user) return <Setup />
  const route = hash.split('?')[0].split('/')
  const page = route[0] || 'home'
  let body
  switch (page) {
    case 'my': body = <MyWork />; break
    case 'browse': body = <Browse key={hash} />; break
    case 'code': body = <CodeView id={decodeURIComponent(route[1] || '')} />; break
    case 'dashboard': body = <Dashboard />; break
    case 'standings': body = <Standings />; break
    case 'review': body = isAdmin ? <Review /> : <Home />; break
    case 'mapping': body = isAdmin ? <Mapping /> : <Home />; break
    case 'cycles': body = isAdmin ? <Cycles /> : <Home />; break
    case 'admin': body = isAdmin ? <Admin /> : <Home />; break
    default: body = <Home />
  }
  return <Shell page={page}>{body}</Shell>
}
