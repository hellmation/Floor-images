import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useApp } from '../store/state'
import { Icon, type IconName } from './icons'
import { Avatar, useToast } from './ui'
import { master, sortIds } from '../store/scoring'
import { pickDesc } from '../i18n'
import emblem from '../assets/brand/fta-emblem.png'
import wordmark from '../assets/brand/fta-lockup-alt.png'
import { exportWorkbook } from '../export/excel'

export function Shell({ page, children }: { page: string; children: ReactNode }) {
  const app = useApp(); const { t, lang, setLang, theme, setTheme, snap, user, isAdmin, cycleId, setCycleId, refresh, adapter, lastSync } = app
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [pal, setPal] = useState(false)
  const [busy, setBusy] = useState(false)
  const cfg = snap!.config
  const cycle = cfg.cycles.find(c => c.id === cycleId)
  const cname = (c?: { name: string; name_en?: string }) => c ? (lang === 'ar' ? c.name : (c.name_en || c.name)) : ''
  useEffect(() => { const f = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPal(p => !p) } }; addEventListener('keydown', f); return () => removeEventListener('keydown', f) }, [])
  useEffect(() => { setOpen(false) }, [page])
  const groups: { label: string; items: [string, string, IconName][] }[] = [
    { label: t('work'), items: [['home', t('home'), 'home'], ['my', t('myWork'), 'tasks'], ['browse', t('browse'), 'book'], ['notes', t('notes'), 'edit']] },
    { label: t('insights'), items: [['dashboard', t('dashboard'), 'chart'], ['standings', t('standings'), 'trophy']] },
    ...(isAdmin ? [{ label: t('administration'), items: [['review', t('review'), 'shield'], ['mapping', t('mapping'), 'map'], ['cycles', t('cycles'), 'calendar'], ['admin', t('admin'), 'settings']] as [string, string, IconName][] }] : []),
  ]
  const doExport = async () => { if (!cycleId) return; setBusy(true); try { await exportWorkbook(snap!, cycleId, lang); toast(t('exportDone'), 'ok') } catch (e) { toast(String(e), 'bad') } finally { setBusy(false) } }
  const uname = lang === 'ar' ? user!.name_ar : user!.name_en
  return (
    <div>
      <aside className={`rail ${open ? 'open' : ''}`}>
        <a href="#/home" className="flex items-center gap-3 px-4 pt-4 pb-3 no-underline text-fg">
          <img src={emblem} alt="" className="w-9 h-9" /><div className="min-w-0"><div className="font-bold leading-tight truncate">{t('appName')}</div><div className="text-xs text-muted truncate">{lang === 'ar' ? cfg.entity.name_ar : cfg.entity.name_en}</div></div>
        </a>
        <div className="px-3 pb-2"><div className="panel px-3 py-2 text-xs"><div className="text-muted">{t('currentCycle')}</div><div className="font-semibold truncate">{cname(cycle)}</div>{cycle && <div className="text-muted">{t('dueDate')}: {cycle.due}</div>}</div></div>
        <nav className="px-3 flex-1 overflow-y-auto">{groups.map(g => <div key={g.label}><div className="nav-group">{g.label}</div>{g.items.map(([k, l, ic]) => <a key={k} href={'#/' + k} className="nav-link" aria-current={page === k || (page === 'code' && k === 'browse') ? 'page' : undefined}><Icon name={ic} />{l}</a>)}</div>)}</nav>
        <div className="p-3 border-t border-line flex items-center gap-2"><Avatar name={uname} photo={user!.photo} /><div className="min-w-0 flex-1"><div className="font-semibold text-sm truncate">{uname}</div><div className="text-xs text-muted">{t(user!.role === 'admin' ? 'adminRole' : user!.role === 'viewer' ? 'viewerRole' : 'evaluatorRole')}</div></div><button className="btn btn-ghost btn-icon" title={t('signOut')} onClick={() => app.setUserId(null)}><Icon name="logout" /></button></div>
      </aside>
      {open && <div className="backdrop lg:hidden" style={{ zIndex: 25 }} onClick={() => setOpen(false)} />}
      <div className="content">
        <header className="topbar">
          <button className="btn btn-ghost btn-icon lg:hidden" onClick={() => setOpen(o => !o)} aria-label="menu"><Icon name="menu" /></button>
          <button className="search-btn hidden sm:inline-flex" onClick={() => setPal(true)}><Icon name="search" /><span className="flex-1 text-start">{t('searchHint')}</span><span className="kbd">Ctrl K</span></button>
          <button className="btn btn-ghost btn-icon sm:hidden" onClick={() => setPal(true)} aria-label={t('search')}><Icon name="search" /></button>
          <div className="ms-auto flex items-center gap-2">
            <select className="select !w-auto !py-1.5 text-sm hidden md:block" value={cycleId || ''} onChange={e => setCycleId(e.target.value)} aria-label={t('cycle')}>{cfg.cycles.map(c => <option key={c.id} value={c.id}>{cname(c)}</option>)}</select>
            <button className="btn btn-sm" onClick={doExport} disabled={busy} title={t('exportExcelHint')}><Icon name="download" /><span className="hidden sm:inline">{busy ? '…' : t('exportExcel')}</span></button>
            <button className="btn btn-ghost btn-icon hidden sm:inline-flex" title={t('refresh')} onClick={() => { refresh(); toast(t('refreshed'), 'ok') }}><Icon name="refresh" /></button>
            <div className="seg" role="group" aria-label={t('language')}><button aria-pressed={lang === 'ar'} onClick={() => setLang('ar')}>عربي</button><button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button></div>
            <div className="seg hidden sm:inline-flex" role="group" aria-label={t('theme')}><button aria-pressed={theme === 'light'} title={t('light')} onClick={() => setTheme('light')}><Icon name="sun" /></button><button aria-pressed={theme === 'system'} title={t('system')} onClick={() => setTheme('system')}><Icon name="monitor" /></button><button aria-pressed={theme === 'dark'} title={t('dark')} onClick={() => setTheme('dark')}><Icon name="moon" /></button></div>
          </div>
        </header>
        <main className="page flex-1">{children}</main>
        <footer className="px-6 py-4 text-xs text-muted flex flex-wrap items-center gap-3 border-t border-line"><img src={wordmark} alt="Federal Tax Authority" className="brand-wordmark" /><span className="ms-auto">{adapter?.kind === 'folder' ? `${t('folderLabel')}: ${adapter.label}` : t('localModeLabel')} · {t('lastSync')}: {lastSync ? new Date(lastSync).toLocaleTimeString(lang === 'ar' ? 'ar-AE-u-nu-latn' : 'en-GB', { timeStyle: 'short' }) : '—'}</span><span>{t('developedBy')} · {t('version')} {__APP_VERSION__} · {t('build')} {__BUILD__}</span></footer>
      </div>
      {pal && <Palette onClose={() => setPal(false)} />}
    </div>
  )
}

function Palette({ onClose }: { onClose: () => void }) {
  const { t, lang, isAdmin } = useApp()
  const [q, setQ] = useState(''); const [i, setI] = useState(0)
  const pages: [string, string, IconName][] = [['home', t('home'), 'home'], ['my', t('myWork'), 'tasks'], ['browse', t('browse'), 'book'], ['dashboard', t('dashboard'), 'chart'], ['standings', t('standings'), 'trophy'], ...(isAdmin ? [['review', t('review'), 'shield'], ['mapping', t('mapping'), 'map'], ['cycles', t('cycles'), 'calendar'], ['admin', t('admin'), 'settings']] as [string, string, IconName][] : [])]
  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    const p = pages.filter(x => !s || x[1].toLowerCase().includes(s)).map(x => ({ href: '#/' + x[0], label: x[1], icon: x[2], sub: '' }))
    const c = !s ? [] : master.codes.filter(x => x.id.startsWith(s) || pickDesc(lang, x).toLowerCase().includes(s)).sort((a, b) => sortIds(a.id, b.id)).slice(0, 8).map(x => ({ href: '#/code/' + x.id, label: x.id, icon: 'book' as IconName, sub: pickDesc(lang, x).slice(0, 90) }))
    return [...p, ...c].slice(0, 12)
  }, [q, lang]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setI(0) }, [q])
  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; addEventListener('keydown', f); return () => removeEventListener('keydown', f) }, [onClose])
  const go = (href: string) => { location.hash = href; onClose() }
  return <><div className="backdrop" onClick={onClose} /><div className="modal !top-[10vh]" role="dialog" aria-modal="true">
    <div className="flex items-center gap-2 px-4 py-3 border-b border-line"><Icon name="search" className="text-muted" /><input autoFocus className="flex-1 bg-transparent border-0 outline-none text-base" placeholder={t('searchHint')} value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); setI(x => Math.min(results.length - 1, x + 1)) } if (e.key === 'ArrowUp') { e.preventDefault(); setI(x => Math.max(0, x - 1)) } if (e.key === 'Enter' && results[i]) go(results[i].href) }} /><span className="kbd">Esc</span></div>
    <ul className="m-0 p-2 list-none max-h-[50vh] overflow-y-auto">{results.map((r, idx) => <li key={r.href}><button className={`w-full text-start flex items-center gap-3 px-3 py-2 rounded-lg ${idx === i ? 'bg-accent-soft' : 'hover:bg-surface-2'}`} onMouseEnter={() => setI(idx)} onClick={() => go(r.href)}><Icon name={r.icon} className="text-muted" /><span className={r.sub ? 'code-id' : 'font-medium'}>{r.label}</span>{r.sub && <span className="text-sm text-muted truncate">{r.sub}</span>}</button></li>)}{results.length === 0 && <li className="px-3 py-4 text-muted text-sm">{t('noItems')}</li>}</ul>
  </div></>
}
