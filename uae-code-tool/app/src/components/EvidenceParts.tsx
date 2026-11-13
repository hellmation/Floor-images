import { useApp } from '../store/state'
import type { ItemAnswer } from '../types'

export const EV_PARTS = ['doc', 'exec', 'monitor'] as const
export type EvPart = typeof EV_PARTS[number]
const Q: Record<EvPart, 'evQDoc' | 'evQExec' | 'evQMonitor'> = { doc: 'evQDoc', exec: 'evQExec', monitor: 'evQMonitor' }
const S: Record<EvPart, 'evDocShort' | 'evExecShort' | 'evMonitorShort'> = { doc: 'evDocShort', exec: 'evExecShort', monitor: 'evMonitorShort' }
export const partsCount = (it?: ItemAnswer | null) => EV_PARTS.filter(k => it?.evidenceParts?.[k] === true).length
export const partsAnswered = (it?: ItemAnswer | null) => EV_PARTS.every(k => typeof it?.evidenceParts?.[k] === 'boolean')

/** The three evidence questions for one requirement: a yes / no pair per question. */
export function EvidencePartsEdit({ it, onChange, idp }: { it: ItemAnswer; onChange: (p: NonNullable<ItemAnswer['evidenceParts']>) => void; idp: string }) {
  const { t } = useApp(); const v = it.evidenceParts || {}
  return <div className="panel px-3 py-2 mt-2"><div className="text-xs font-semibold text-fg-2 mb-1.5">{t('evPartsTitle')}</div>
    <div className="flex flex-col gap-1.5">{EV_PARTS.map((k, i) => <div key={k} className="flex flex-wrap items-center gap-2 text-sm"><span className="num inline-grid place-items-center w-5 h-5 rounded-full bg-accent-soft text-accent-ink text-xs font-bold shrink-0">{i + 1}</span><span className="flex-1 min-w-40" id={`${idp}-${k}`}>{t(Q[k])}</span>
      <span className="seg seg-q text-xs" role="group" aria-labelledby={`${idp}-${k}`}><button type="button" aria-pressed={v[k] === true} className={v[k] === true ? '!bg-ok-soft !text-ok-ink' : ''} onClick={() => onChange({ ...v, [k]: v[k] === true ? null : true })}>{t('yes')}</button><button type="button" aria-pressed={v[k] === false} className={v[k] === false ? '!bg-bad-soft !text-bad-ink' : ''} onClick={() => onChange({ ...v, [k]: v[k] === false ? null : false })}>{t('no')}</button></span></div>)}</div></div>
}
/** Read-only: three small pills, green when the folder contains that part, red when it does not, grey when unanswered. */
export function EvidencePartsView({ it }: { it?: ItemAnswer | null }) {
  const { t } = useApp(); const v = it?.evidenceParts
  if (!v || EV_PARTS.every(k => v[k] === null || v[k] === undefined)) return null
  return <span className="inline-flex flex-wrap gap-1">{EV_PARTS.map(k => <span key={k} className={`pill ${v[k] === true ? 'pill-ok' : v[k] === false ? 'pill-bad' : 'pill-muted'}`} title={t(Q[k])}>{v[k] === true ? '✓' : v[k] === false ? '✗' : '–'} {t(S[k])}</span>)}</span>
}
