import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store/state'
import { hasFolderApi, LocalAdapter } from '../store/storage'
import { Icon } from '../components/icons'
import { Avatar, errMsg } from '../components/ui'
import lockup from '../assets/brand/fta-lockup-light.png'
import lockupDark from '../assets/brand/fta-lockup-dark.png'
import { Field } from '../components/Field'

export default function Setup() {
  const { t, lang, setLang, theme, setTheme, snap, loading, error, connectFolder, reconnect, useLocal, needsReconnect, setUserId, adapter, refresh } = useApp()
  let lastUserId: string | null = null; try { lastUserId = localStorage.getItem('lastUserId') } catch { /* ignore */ }
  const [err, setErr] = useState<string | null>(null)
  const logoRef = useRef<HTMLImageElement>(null); const cardRef = useRef<HTMLDivElement>(null)
  const api = hasFolderApi()
  const [moved, setMoved] = useState(false)
  const connect = async () => { setErr(null); try { const m = await connectFolder(); setMoved(m) } catch (e) { if (!String(e).includes('Abort')) setErr(errMsg(e, t)) } }
  useEffect(() => { if (snap) return; const f = (e: KeyboardEvent) => { if (e.key === 'Enter' && !loading) { if (api && needsReconnect) reconnect(); else if (api) connect() } }; addEventListener('keydown', f); return () => removeEventListener('keydown', f) }) // eslint-disable-line react-hooks/exhaustive-deps
  const doImport = async (f: File) => { if (adapter instanceof LocalAdapter) { adapter.importAll(await f.text()); await refresh() } }
  return (
    <div className="landing">
      <Field anchorRef={logoRef} parallaxRef={cardRef} />
      <div className="veil" />
      <div className="absolute top-4 flex gap-2" style={{ insetInlineEnd: '1rem' }}>
        <div className="seg" role="group" aria-label={t('language')}><button aria-pressed={lang === 'ar'} onClick={() => setLang('ar')}>عربي</button><button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button></div>
        <div className="seg" role="group" aria-label={t('theme')}><button aria-pressed={theme === 'light'} aria-label={t('light')} title={t('light')} onClick={() => setTheme('light')}><Icon name="sun" /></button><button aria-pressed={theme === 'dark'} aria-label={t('dark')} title={t('dark')} onClick={() => setTheme('dark')}><Icon name="moon" /></button></div>
      </div>
      <div ref={cardRef} className="landing-card flex flex-col gap-4">
        <img ref={logoRef} src={theme === 'dark' ? lockupDark : lockup} alt={t('entity')} className="h-14 w-auto self-center object-contain" style={{ maxWidth: 260 }} />
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
            <div className="grid sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pe-1">{snap.config.users.filter(u => u.active).map(u => { const n = lang === 'ar' ? u.name_ar : u.name_en; const last = u.id === lastUserId
              return <button key={u.id} className={'user-card' + (last ? ' user-card-last' : '')} onClick={() => setUserId(u.id)}><Avatar name={n} photo={u.photo} size="lg" /><span className="min-w-0"><span className="block font-semibold truncate">{n}</span><span className="block text-xs text-muted">{t(u.role === 'admin' ? 'adminRole' : u.role === 'viewer' ? 'viewerRole' : 'evaluatorRole')}{last && <> · <span style={{ color: "var(--accent-ink)" }}>{t("lastSignIn")}</span></>}</span></span></button> })}</div>
            {adapter instanceof LocalAdapter && api && <div className="rounded-lg bg-warn-soft text-warn-ink px-3 py-2 text-sm flex flex-wrap items-center gap-2"><Icon name="alert" className="shrink-0" /><span className="flex-1 min-w-48">{t('localWarning')}</span><button className="btn btn-sm btn-primary" onClick={connect}><Icon name="folder" />{t('switchToFolder')}</button></div>}
            {moved && <div className="rounded-lg bg-ok-soft text-ok-ink px-3 py-2 text-sm flex items-center gap-2"><Icon name="checkCircle" />{t('migrated')}</div>}
            {(err || error) && <p className="text-bad text-sm m-0" role="alert">{err || error}</p>}
            <div className="flex items-center gap-2 text-xs text-muted"><Icon name={adapter?.kind === 'folder' ? 'folder' : 'monitor'} />{adapter?.kind === 'folder' ? `${t('folderLabel')}: ${adapter.label}` : t('localModeLabel')}
              {adapter instanceof LocalAdapter && <span className="ms-auto flex gap-2"><a className="btn btn-sm" download="uae-code-backup.json" href={'data:application/json;charset=utf-8,' + encodeURIComponent(adapter.exportAll())}>{t('exportJson')}</a><label className="btn btn-sm">{t('importJson')}<input type="file" accept=".json" className="sr-only" onChange={e => e.target.files?.[0] && doImport(e.target.files[0])} /></label></span>}</div>
          </div>
        )}
        <div className="text-center text-xs text-muted pt-2 border-t border-line">{t('developedBy')} · {t('version')} {__APP_VERSION__} · {t('build')} {__BUILD__}</div>
      </div>
    </div>
  )
}
