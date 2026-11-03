import { useEffect, useState } from 'react'
import { useApp } from './store/state'
import Setup from './pages/Setup'
import MyWork from './pages/MyWork'
import Browse from './pages/Browse'
import CodeView from './pages/CodeView'
import Mapping from './pages/Mapping'
import Cycles from './pages/Cycles'
import Review from './pages/Review'
import Dashboard from './pages/Dashboard'
import Admin from './pages/Admin'
import { exportWorkbook } from './export/excel'
import { fmtDate } from './components/ui'

function useHash() {
  const [h, setH] = useState(location.hash.replace(/^#\/?/, ''))
  useEffect(() => { const f = () => setH(location.hash.replace(/^#\/?/, '')); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [])
  return h
}

export default function App() {
  const app = useApp(); const { t, lang, setLang, theme, setTheme, snap, user, isAdmin, cycleId, setCycleId, lastSync, refresh, adapter } = app
  const hash = useHash()
  const [busy, setBusy] = useState(false)

  if (!snap || !user) return <Setup />

  const route = hash.split('/')
  const page = route[0] || 'my'
  const nav: [string, string, boolean][] = [
    ['my', t('myWork'), true], ['browse', t('browse'), true], ['dashboard', t('dashboard'), true],
    ['review', t('review'), isAdmin], ['mapping', t('mapping'), isAdmin], ['cycles', t('cycles'), isAdmin], ['admin', t('admin'), isAdmin],
  ]
  const cycle = snap.config.cycles.find(c => c.id === cycleId)
  const doExport = async () => { if (!cycleId) return; setBusy(true); try { await exportWorkbook(snap, cycleId, lang) } finally { setBusy(false) } }

  let body
  switch (page) {
    case 'browse': body = <Browse />; break
    case 'code': body = <CodeView id={decodeURIComponent(route[1] || '')} />; break
    case 'mapping': body = isAdmin ? <Mapping /> : <MyWork />; break
    case 'cycles': body = isAdmin ? <Cycles /> : <MyWork />; break
    case 'review': body = isAdmin ? <Review /> : <MyWork />; break
    case 'dashboard': body = <Dashboard />; break
    case 'admin': body = isAdmin ? <Admin /> : <MyWork />; break
    default: body = <MyWork />
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-line bg-surface sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center gap-3">
          <div className="font-semibold"><span className="text-accent">●</span> {t('appName')} <span className="text-muted font-normal text-sm">· {lang === 'ar' ? snap.config.entity.name_ar : snap.config.entity.name_en}</span></div>
          <div className="ms-auto flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-1"><span className="text-muted">{t('cycle')}</span>
              <select className="select !w-auto !py-1" value={cycleId || ''} onChange={e => setCycleId(e.target.value)}>{snap.config.cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <button className="btn btn-sm" onClick={doExport} disabled={busy}>{busy ? '…' : t('exportExcel')}</button>
            <div className="seg" role="group" aria-label={t('language')}><button aria-pressed={lang === 'ar'} onClick={() => setLang('ar')}>عربي</button><button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button></div>
            <div className="seg" role="group" aria-label={t('theme')}><button aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>☀</button><button aria-pressed={theme === 'system'} onClick={() => setTheme('system')}>A</button><button aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>☾</button></div>
            <button className="btn btn-sm" onClick={() => app.setUserId(null)} title={t('signOut')}>{lang === 'ar' ? user.name_ar : user.name_en} ▾</button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 pb-2 flex flex-wrap items-center gap-1 nav text-sm">
          {nav.filter(n => n[2]).map(([k, l]) => <a key={k} href={'#/' + k} aria-current={page === k || (page === 'code' && k === 'browse') ? 'page' : undefined}>{l}</a>)}
          <span className="ms-auto text-xs text-muted flex items-center gap-2">
            {cycle && <span>{cycle.name} · {t(cycle.status === 'open' ? 'open' : cycle.status === 'closed' ? 'closed' : cycle.status === 'review' ? 'inReview' : 'planning')}</span>}
            <span>{adapter?.kind === 'folder' ? '📁 ' + adapter.label : '💾 local'}</span>
            <button className="btn btn-sm" onClick={refresh}>{t('refresh')}</button><span>{t('lastSync')}: {fmtDate(lastSync)}</span>
          </span>
        </div>
      </header>
      <main className="max-w-7xl w-full mx-auto px-4 py-5 flex-1">{body}</main>
    </div>
  )
}
