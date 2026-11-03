import { useEffect, useState } from 'react'
import { useApp } from '../store/state'
import { hasFolderApi, LocalAdapter } from '../store/storage'
import { Icon } from '../components/icons'
import { Avatar } from '../components/ui'
import lockup from '../assets/brand/fta-lockup.png'

function Ribbons() {
  return <svg className="ribbons" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="g1" x1="0" x2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".0" /><stop offset=".5" stopColor="var(--accent)" stopOpacity=".35" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></linearGradient>
      <linearGradient id="g2" x1="0" x2="1"><stop offset="0" stopColor="var(--ok)" stopOpacity="0" /><stop offset=".5" stopColor="var(--ok)" stopOpacity=".22" /><stop offset="1" stopColor="var(--ok)" stopOpacity="0" /></linearGradient>
      <linearGradient id="g3" x1="0" x2="1"><stop offset="0" stopColor="var(--bad)" stopOpacity="0" /><stop offset=".5" stopColor="var(--bad)" stopOpacity=".16" /><stop offset="1" stopColor="var(--bad)" stopOpacity="0" /></linearGradient>
      <filter id="blur"><feGaussianBlur stdDeviation="18" /></filter>
    </defs>
    <g filter="url(#blur)" fill="none" strokeWidth="70" strokeLinecap="round">
      <path d="M-100 650 C 300 400, 700 900, 1100 500 S 1700 300, 1800 450" stroke="url(#g1)" />
      <path d="M-100 250 C 400 100, 600 600, 1000 300 S 1500 200, 1750 150" stroke="url(#g2)" />
      <path d="M-50 820 C 500 700, 900 1000, 1300 700 S 1650 650, 1750 750" stroke="url(#g3)" />
    </g>
  </svg>
}

export default function Setup() {
  const { t, lang, setLang, theme, setTheme, snap, loading, error, connectFolder, reconnect, useLocal, needsReconnect, setUserId, adapter, refresh } = useApp()
  const [err, setErr] = useState<string | null>(null)
  const api = hasFolderApi()
  const connect = async () => { setErr(null); try { await connectFolder() } catch (e) { if (!String(e).includes('Abort')) setErr(String(e)) } }
  useEffect(() => { if (snap) return; const f = (e: KeyboardEvent) => { if (e.key === 'Enter' && !loading) { if (api && needsReconnect) reconnect(); else if (api) connect() } }; addEventListener('keydown', f); return () => removeEventListener('keydown', f) }) // eslint-disable-line react-hooks/exhaustive-deps
  const doImport = async (f: File) => { if (adapter instanceof LocalAdapter) { adapter.importAll(await f.text()); await refresh() } }
  return (
    <div className="landing">
      <Ribbons />
      <div className="absolute top-4 inset-inline-end-4 flex gap-2" style={{ insetInlineEnd: '1rem' }}>
        <div className="seg"><button aria-pressed={lang === 'ar'} onClick={() => setLang('ar')}>عربي</button><button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button></div>
        <div className="seg"><button aria-pressed={theme === 'light'} onClick={() => setTheme('light')}><Icon name="sun" /></button><button aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}><Icon name="moon" /></button></div>
      </div>
      <div className="landing-card flex flex-col gap-4">
        <img src={lockup} alt="Federal Tax Authority" className="h-14 w-auto self-center object-contain" style={{ maxWidth: 260 }} />
        <div className="text-center">
          <div className="eyebrow">{t('internalTool')}</div>
          <h1 className="display text-3xl md:text-4xl m-0 mt-1">{t('appName')}</h1>
          <div className="text-muted mt-1" dir={lang === 'ar' ? 'ltr' : 'rtl'}>{lang === 'ar' ? 'UAE Code Championship' : 'بطولة كود الإمارات'}</div>
          <div className="mx-auto my-3 w-12 border-t-2 border-accent" />
          <p className="m-0 text-fg-2">{t('landingLine')}</p>
        </div>
        {!snap ? (
          <div className="flex flex-col items-center gap-3 mt-2">
            {loading && <div className="skeleton h-10 w-40" />}
            {!loading && api && !needsReconnect && <button className="btn btn-primary !px-7 !py-3 text-base" onClick={connect}><Icon name="folder" />{t('chooseFolder')}<Icon name={lang === 'ar' ? 'arrowL' : 'arrowR'} /></button>}
            {!loading && api && needsReconnect && <button className="btn btn-primary !px-7 !py-3 text-base" onClick={() => reconnect().then(ok => !ok && setErr(t('permissionDenied')))}><Icon name="folder" />{t('reconnect')}</button>}
            {!loading && api && <div className="text-xs text-muted">{t('orPressEnter')}</div>}
            {!loading && !api && <p className="text-bad m-0 text-sm text-center">{t('noFolderApi')}</p>}
            {!loading && <button className="btn btn-ghost btn-sm" onClick={useLocal}>{t('localMode')}</button>}
            <p className="text-xs text-muted m-0 text-center max-w-sm">{t('folderHelp')}</p>
            {(err || error) && <p className="text-bad text-sm m-0">{err || error}</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div><div className="font-semibold">{t('whoAreYou')}</div><div className="text-sm text-muted">{t('chooseUser')}</div></div>
            <div className="grid sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pe-1">{snap.config.users.filter(u => u.active).map(u => { const n = lang === 'ar' ? u.name_ar : u.name_en
              return <button key={u.id} className="user-card" onClick={() => setUserId(u.id)}><Avatar name={n} photo={u.photo} size="lg" /><span className="min-w-0"><span className="block font-semibold truncate">{n}</span><span className="block text-xs text-muted">{t(u.role === 'admin' ? 'adminRole' : u.role === 'viewer' ? 'viewerRole' : 'evaluatorRole')}</span></span></button> })}</div>
            <div className="flex items-center gap-2 text-xs text-muted"><Icon name={adapter?.kind === 'folder' ? 'folder' : 'monitor'} />{adapter?.kind === 'folder' ? `${t('folderLabel')}: ${adapter.label}` : t('localModeLabel')}
              {adapter instanceof LocalAdapter && <span className="ms-auto flex gap-2"><a className="btn btn-sm" download="uae-code-backup.json" href={'data:application/json;charset=utf-8,' + encodeURIComponent(adapter.exportAll())}>{t('exportJson')}</a><label className="btn btn-sm">{t('importJson')}<input type="file" accept=".json" hidden onChange={e => e.target.files?.[0] && doImport(e.target.files[0])} /></label></span>}</div>
          </div>
        )}
        <div className="text-center text-xs text-muted pt-2 border-t border-line">{t('developedBy')} · {t('version')} 1.0</div>
      </div>
    </div>
  )
}
