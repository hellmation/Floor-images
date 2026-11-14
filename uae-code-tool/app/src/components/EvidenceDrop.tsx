import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store/state'
import { useToast } from './ui'
import { Icon } from './icons'
import { pillarById } from '../store/scoring'
import { DEFAULT_EVIDENCE_ROOT, evidenceRootReady, evidenceSupported, linkEvidenceRoot, saveEvidenceFiles } from '../store/evidenceFolder'
import type { Code } from '../types'

/** Drop zone for evidence files of one requirement. Files go to the code's folder under the evidence root on the shared
 *  drive (the folder is created when missing) and the folder link is handed back so it can be added as the evidence link. */
export function EvidenceDrop({ code, onLinked }: { code: Code; onLinked: (title: string, url: string) => void }) {
  const { t, snap } = useApp(); const toast = useToast()
  const [over, setOver] = useState(false); const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<File[]>([]); const [ready, setReady] = useState<boolean | null>(null)
  const [last, setLast] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const supported = evidenceSupported()
  const rootPath = (snap?.config.settings.evidenceRoot || DEFAULT_EVIDENCE_ROOT).replace(/[\\/]+$/, '')
  useEffect(() => { let on = true; if (supported) evidenceRootReady().then(r => { if (on) setReady(!!r) }); return () => { on = false } }, [supported])

  const store = async (files: File[], interactive: boolean, forcePick = false) => {
    if (!files.length || busy) return
    setBusy(true)
    try {
      let root = forcePick ? null : await evidenceRootReady()
      if (!root && interactive) {
        root = await linkEvidenceRoot(forcePick)
        const expected = rootPath.split(/[\\/]/).pop() || ''
        if (root && expected && root.name !== expected && !window.confirm(`${t('dropWrongFolder')}\n\n${root.name}\n≠ ${expected}`)) { root = null }
      }
      if (!root) { setPending(files); setReady(false); return } // wait for the click that links the folder
      setReady(true)
      const pil = pillarById.get(code.pillar)!
      const res = await saveEvidenceFiles(root, { id: pil.id, name: pil.name_ar }, code.sub, code.id, files)
      const path = [rootPath, ...res.segments].join('\\')
      onLinked(`${t('evidenceFolderTitle')} ${code.id}`, path)
      setPending([]); setLast(`${res.segments.join(' \\ ')} · ${res.saved.join('، ')}`)
      toast(`${res.createdCode ? t('dropCreated') + ' · ' : ''}${t('dropSaved')} ${res.segments[res.segments.length - 1]} (${res.saved.length})`, 'ok')
    } catch (e) { if ((e as DOMException)?.name !== 'AbortError') { console.error(e); toast(t('dropFailed'), 'bad') } }
    finally { setBusy(false) }
  }
  if (!supported) return <p className="text-xs text-muted m-0 mb-2 flex items-start gap-1.5"><Icon name="info" className="shrink-0 mt-0.5" style={{ width: 13, height: 13 }} /><span>{t('dropUnsupported')}</span></p>
  return <div className="mb-2">
    <div className={`drop-zone ${over ? 'over' : ''} ${busy ? 'busy' : ''}`} role="button" tabIndex={0} aria-label={t('dropTitle')}
      onClick={() => input.current?.click()} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.current?.click() } }}
      onDragOver={e => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); void store(Array.from(e.dataTransfer.files || []), false) }}>
      <span className="dz-icon"><Icon name="folder" style={{ width: 26, height: 26 }} /></span>
      <div className="min-w-0"><div className="dz-title">{busy ? t('dropSaving') : t('dropTitle')}</div><div className="dz-hint mt-1">{t('dropHint')}</div></div>
      <input ref={input} type="file" multiple className="sr-only" tabIndex={-1} onClick={e => e.stopPropagation()} onChange={e => { const fs = Array.from(e.target.files || []); e.target.value = ''; void store(fs, true) }} />
    </div>
    {pending.length > 0 && <div className="flex flex-wrap items-center gap-2 text-sm bg-warn-soft text-warn-ink rounded-lg px-3 py-2 mt-2"><Icon name="alert" className="shrink-0" /><span className="flex-1 min-w-40">{pending.length} {t('dropPending')} · {t('dropLinkHint')}</span><button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => store(pending, true)}><Icon name="folder" />{t('dropLink')}</button><button type="button" className="btn btn-sm btn-ghost" onClick={() => setPending([])}>{t('cancel')}</button></div>}
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted">
      {last && <span className="text-ok-ink flex items-center gap-1"><Icon name="checkCircle" style={{ width: 12, height: 12 }} /><bdi>{last}</bdi></span>}
      {ready === false && pending.length === 0 && <button type="button" className="underline" onClick={() => linkEvidenceRoot().then(r => setReady(!!r)).catch(() => {})}>{t('dropLink')}</button>}
      {ready && <button type="button" className="underline" onClick={() => linkEvidenceRoot(true).then(r => setReady(!!r)).catch(() => {})}>{t('changeEvidenceFolder')}</button>}
    </div>
  </div>
}
