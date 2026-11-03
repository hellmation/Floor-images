import { useState } from 'react'
import { useApp } from '../store/state'
import { hasFolderApi, LocalAdapter } from '../store/storage'

export default function Setup() {
  const { t, lang, setLang, snap, loading, error, connectFolder, reconnect, useLocal, needsReconnect, setUserId, adapter, refresh } = useApp()
  const [picked, setPicked] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const api = hasFolderApi()
  const connect = async () => { setErr(null); try { await connectFolder() } catch (e) { setErr(String(e)) } }
  const doImport = async (f: File) => { if (adapter instanceof LocalAdapter) { adapter.importAll(await f.text()); await refresh() } }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-lg p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div><h1 className="text-xl font-semibold m-0">{t('appName')}</h1><div className="text-sm text-muted">{t('appTagline')}</div></div>
          <div className="seg"><button aria-pressed={lang === 'ar'} onClick={() => setLang('ar')}>عربي</button><button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button></div>
        </div>
        {!snap ? (
          <>
            <p className="text-muted m-0">{t('folderHelp')}</p>
            {loading && <p className="m-0">…</p>}
            {!loading && api && !needsReconnect && <button className="btn btn-primary" onClick={connect}>{t('chooseFolder')}</button>}
            {!loading && api && needsReconnect && <button className="btn btn-primary" onClick={() => reconnect().then(ok => !ok && setErr(t('permissionDenied')))}>{t('reconnect')}</button>}
            {!loading && !api && <p className="text-bad m-0 text-sm">{t('noFolderApi')}</p>}
            {!loading && <button className="btn" onClick={useLocal}>{t('localMode')}</button>}
            {(err || error) && <p className="text-bad text-sm m-0">{err || error}</p>}
          </>
        ) : (
          <>
            <h2 className="text-lg m-0">{t('whoAreYou')}</h2>
            <p className="text-muted m-0 text-sm">{t('chooseUser')}</p>
            <select className="select" value={picked} onChange={e => setPicked(e.target.value)}>
              <option value="">—</option>
              {snap.config.users.filter(u => u.active).map(u => <option key={u.id} value={u.id}>{lang === 'ar' ? u.name_ar : u.name_en} · {t(u.role === 'admin' ? 'adminRole' : u.role === 'viewer' ? 'viewerRole' : 'evaluatorRole')}</option>)}
            </select>
            <button className="btn btn-primary" disabled={!picked} onClick={() => setUserId(picked)}>{t('continue')}</button>
            {adapter instanceof LocalAdapter && (
              <div className="flex gap-2 text-sm">
                <a className="btn btn-sm" download="uae-code-backup.json" href={'data:application/json;charset=utf-8,' + encodeURIComponent(adapter.exportAll())}>{t('exportJson')}</a>
                <label className="btn btn-sm">{t('importJson')}<input type="file" accept=".json" hidden onChange={e => e.target.files?.[0] && doImport(e.target.files[0])} /></label>
              </div>
            )}
            <p className="text-xs text-muted m-0">{adapter?.kind === 'folder' ? `${t('folderLabel')}: ${adapter.label}` : t('localModeLabel')}</p>
          </>
        )}
      </div>
    </div>
  )
}
