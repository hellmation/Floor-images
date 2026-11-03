import type { ReactNode } from 'react'
import type { WorkState, AnswerStatus, Impact } from '../types'
import { useApp } from '../store/state'

export function Pill({ kind, children }: { kind: 'ok' | 'warn' | 'bad' | 'info' | 'flag' | 'muted' | 'accent'; children: ReactNode }) {
  return <span className={`pill pill-${kind}`}>{children}</span>
}
export function StatePill({ state }: { state: WorkState }) {
  const { t } = useApp()
  const map: Record<WorkState, ['ok' | 'warn' | 'bad' | 'info' | 'muted', string]> = { none: ['muted', t('notStarted')], draft: ['warn', t('draft')], submitted: ['info', t('submitted')], returned: ['bad', t('returned')], approved: ['ok', t('approved')] }
  const [k, l] = map[state]; return <Pill kind={k}>{l}</Pill>
}
export function StatusPill({ status }: { status: AnswerStatus | null }) {
  const { t } = useApp()
  if (!status) return <Pill kind="muted">{t('unanswered')}</Pill>
  const map: Record<AnswerStatus, ['ok' | 'warn' | 'bad' | 'muted', string]> = { yes: ['ok', t('yes')], partial: ['warn', t('partial')], no: ['bad', t('no')], na: ['muted', t('na')] }
  const [k, l] = map[status]; return <Pill kind={k}>{l}</Pill>
}
export function ImpactPill({ impact }: { impact: Impact | 'none' | null }) {
  const { t } = useApp()
  const map = { high: ['bad', t('high')], medium: ['warn', t('medium')], low: ['ok', t('low')], none: ['flag', t('notSpecified')] } as const
  const [k, l] = map[impact || 'none']; return <Pill kind={k}>{t('impact')}: {l}</Pill>
}
export function Bar({ value, max }: { value: number; max: number }) {
  const pct = max ? Math.round((value / max) * 100) : 0
  return <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: pct + '%' }} /></div>
}
export function Tile({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'ok' | 'warn' | 'bad' | 'accent' }) {
  return <div className="card p-3"><div className="label">{label}</div><div className={`text-2xl font-semibold num ${tone ? `text-${tone}` : ''}`}>{value}</div>{sub && <div className="text-sm text-muted">{sub}</div>}</div>
}
export function Empty({ children }: { children?: ReactNode }) { const { t } = useApp(); return <div className="card p-6 text-center text-muted">{children || t('noItems')}</div> }
export const fmtDate = (iso?: string | null) => iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : ''
export const fmtPct = (v: number | null | undefined) => v === null || v === undefined ? '—' : Math.round(v) + '%'
