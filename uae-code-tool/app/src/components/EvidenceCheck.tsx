import { useState } from 'react'
import { useApp } from '../store/state'
import { Modal, useToast } from './ui'
import { Icon } from './icons'
import { master } from '../store/scoring'
import { DEFAULT_EVIDENCE_ROOT, checkEvidenceRoot, linkEvidenceRoot, writeEvidenceMarker, removeEvidenceMarker, type RootCheck } from '../store/evidenceFolder'

/** "Check the evidence folder": tells the person, on their own computer, whether this browser is linked to a folder,
 *  whether it can write there, and whether the folder looks like the evidence root (name and pillar folders). The
 *  browser never reveals a folder's full path, so the last step is a marker file the person looks for in the shared
 *  path with the file explorer. */
export function EvidenceCheck({ small }: { small?: boolean }) {
  const { t, lang, snap, user } = useApp(); const toast = useToast()
  const [open, setOpen] = useState(false); const [res, setRes] = useState<RootCheck | null>(null); const [busy, setBusy] = useState(false); const [marker, setMarker] = useState<string | null>(null)
  const rootPath = (snap?.config.settings.evidenceRoot || DEFAULT_EVIDENCE_ROOT).replace(/[\\/]+$/, ''); const expected = rootPath.split(/[\\/]/).pop() || ''
  const run = async (ask: boolean) => { setBusy(true); try { setRes(await checkEvidenceRoot(master.pillars.map(p => p.id), ask)) } catch (e) { console.error(e); toast(t('dropFailed'), 'bad') } finally { setBusy(false) } }
  const start = () => { setOpen(true); setMarker(null); void run(true) }
  const pick = async (force: boolean) => { try { await linkEvidenceRoot(force) } catch { /* cancelled */ } await run(false) }
  const mark = async () => { setBusy(true); try { const who = user ? (lang === 'ar' ? user.name_ar : user.name_en) : ''; const n = await writeEvidenceMarker(who, `${t('evCheckMarkerText')}\n${rootPath}\n${new Date().toISOString()}`); setMarker(n); if (!n) toast(t('dropFailed'), 'bad') } catch (e) { console.error(e); toast(t('dropFailed'), 'bad') } finally { setBusy(false) } }
  const unmark = async () => { if (!marker) return; const ok = await removeEvidenceMarker(marker); if (ok) { setMarker(null); toast(t('evCheckMarkerRemoved'), 'ok') } else toast(t('dropFailed'), 'bad') }
  const copy = async () => { try { await navigator.clipboard.writeText(rootPath); toast(t('copied'), 'ok') } catch { /* clipboard unavailable */ } }
  const Row = ({ ok, children }: { ok: boolean | null; children: React.ReactNode }) => <li className="flex items-start gap-2"><span className={`shrink-0 mt-0.5 ${ok === true ? 'text-ok-ink' : ok === false ? 'text-bad-ink' : 'text-warn-ink'}`}><Icon name={ok === true ? 'checkCircle' : 'alert'} style={{ width: 16, height: 16 }} /></span><span className="min-w-0">{children}</span></li>
  const found = res ? res.pillars.filter(p => p.folder).length : 0; const codes = res ? res.pillars.reduce((a, p) => a + p.codeFolders, 0) + res.codeFoldersAtRoot : 0
  const nameOk = !!res?.name && res.name === expected
  const allGood = !!res && res.linked && res.permission === 'granted' && res.canWrite === true && nameOk
  return <>
    <button type="button" className={small ? 'underline' : 'btn btn-sm'} onClick={start}>{!small && <Icon name="shield" />}{t('evCheck')}</button>
    <Modal open={open} onClose={() => setOpen(false)} title={t('evCheck')} footer={<><button className="btn" onClick={() => setOpen(false)}>{t('close')}</button><button className="btn" disabled={busy} onClick={() => run(true)}><Icon name="refresh" />{t('evCheckAgain')}</button></>}>
      <div className="text-sm flex flex-col gap-3">
        <div><div className="label">{t('evCheckExpected')}</div><div className="panel px-3 py-2 flex items-center gap-2"><bdi dir="ltr" className="flex-1 min-w-0 break-all text-xs">{rootPath}</bdi><button type="button" className="btn btn-xs shrink-0" onClick={copy}><Icon name="copy" />{t('copy')}</button></div></div>
        {busy && !res && <p className="m-0 text-muted">{t('evCheckRunning')}</p>}
        {res && <ul className="m-0 p-0 list-none flex flex-col gap-2">
          <Row ok={res.supported}>{res.supported ? t('evCheckBrowserOk') : t('dropUnsupported')}</Row>
          {res.supported && <Row ok={res.linked}>{res.linked ? <>{t('evCheckLinked')} <b><bdi>{res.name}</bdi></b></> : t('evCheckNotLinked')}{!res.linked && <button type="button" className="btn btn-xs btn-primary ms-2" onClick={() => pick(false)}>{t('dropLink')}</button>}</Row>}
          {res.linked && <Row ok={nameOk ? true : null}>{nameOk ? t('evCheckNameOk') : <>{t('evCheckNameDiff')} <b><bdi>{expected}</bdi></b></>}{!nameOk && <button type="button" className="btn btn-xs ms-2" onClick={() => pick(true)}>{t('changeEvidenceFolder')}</button>}</Row>}
          {res.linked && <Row ok={res.permission === 'granted'}>{res.permission === 'granted' ? t('evCheckPermOk') : t('evCheckPermNo')}{res.permission !== 'granted' && <button type="button" className="btn btn-xs btn-primary ms-2" onClick={() => run(true)}>{t('evCheckAllow')}</button>}</Row>}
          {res.canWrite !== null && <Row ok={res.canWrite}>{res.canWrite ? t('evCheckWriteOk') : <>{t('evCheckWriteNo')}{res.writeError && <span className="block text-xs text-muted" dir="ltr">{res.writeError}</span>}</>}</Row>}
          {res.permission === 'granted' && <Row ok={found === res.pillars.length ? true : null}>{t('evCheckPillars')} <b className="num">{found} / {res.pillars.length}</b> · {t('evCheckCodeFolders')} <b className="num">{codes}</b>
            <span className="block text-xs text-muted mt-0.5">{found < res.pillars.length ? `${t('evCheckPillarsMissing')} ${res.pillars.filter(p => !p.folder).map(p => p.id).join('، ')}. ${t('evCheckPillarsCreate')}` : res.pillars.map(p => p.folder).join(' · ')}</span></Row>}
          {res.permission === 'granted' && res.other.length > 0 && <Row ok={null}>{t('evCheckOther')} <span className="num">({res.other.length})</span><span className="block text-xs text-muted mt-0.5"><bdi>{res.other.slice(0, 12).join(' · ')}{res.other.length > 12 ? ' …' : ''}</bdi></span></Row>}
        </ul>}
        {res && res.permission === 'granted' && res.canWrite && <div className="panel p-3 flex flex-col gap-2">
          <div className="font-semibold flex items-center gap-2"><Icon name="folder" className="text-accent-ink" />{t('evCheckConfirmTitle')}</div>
          <p className="m-0 text-xs text-muted">{t('evCheckConfirmHint')}</p>
          {marker ? <div className="flex flex-wrap items-center gap-2"><span className="text-ok-ink flex items-center gap-1"><Icon name="checkCircle" style={{ width: 14, height: 14 }} />{t('evCheckMarkerMade')}</span><bdi className="text-xs break-all">{marker}</bdi><button type="button" className="btn btn-xs ms-auto" onClick={unmark}>{t('evCheckMarkerRemove')}</button></div>
            : <button type="button" className="btn btn-sm self-start" disabled={busy} onClick={mark}><Icon name="plus" />{t('evCheckMarker')}</button>}
        </div>}
        {res && <p className={`m-0 rounded-lg px-3 py-2 ${allGood ? 'bg-ok-soft text-ok-ink' : 'bg-warn-soft text-warn-ink'}`}>{allGood ? t('evCheckVerdictOk') : t('evCheckVerdictNo')}</p>}
      </div>
    </Modal>
  </>
}
