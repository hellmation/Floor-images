import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { WorkState, AnswerStatus, Impact } from '../types'
import { useApp } from '../store/state'
import { Icon, type IconName } from './icons'

export function Pill({ kind, children, dot }: { kind: 'ok' | 'warn' | 'bad' | 'info' | 'flag' | 'muted' | 'accent'; children: ReactNode; dot?: boolean }) {
  return <span className={`pill pill-${kind}`}>{dot && <i className="dot" />}{children}</span>
}
export const stateKind: Record<WorkState, 'ok' | 'warn' | 'bad' | 'info' | 'muted'> = { none: 'muted', draft: 'warn', submitted: 'info', returned: 'bad', approved: 'ok' }
export function StatePill({ state }: { state: WorkState }) {
  const { t } = useApp()
  const label: Record<WorkState, string> = { none: t('notStarted'), draft: t('draft'), submitted: t('submitted'), returned: t('returned'), approved: t('approved') }
  return <Pill kind={stateKind[state]} dot>{label[state]}</Pill>
}
export function StatusPill({ status }: { status: AnswerStatus | null }) {
  const { t } = useApp()
  if (!status) return <Pill kind="muted">{t('unanswered')}</Pill>
  const map: Record<AnswerStatus, ['ok' | 'warn' | 'bad' | 'muted', string]> = { yes: ['ok', t('yes')], partial: ['warn', t('partial')], no: ['bad', t('no')], na: ['muted', t('na')] }
  const [k, l] = map[status]; return <Pill kind={k} dot>{l}</Pill>
}
export function ImpactPill({ impact, short }: { impact: Impact | 'none' | null; short?: boolean }) {
  const { t } = useApp()
  const map = { high: ['bad', t('high')], medium: ['warn', t('medium')], low: ['ok', t('low')], none: ['flag', t('notSpecified')] } as const
  const [k, l] = map[impact || 'none']; return <Pill kind={k}>{short ? l : `${t('impact')}: ${l}`}</Pill>
}
export function Bar({ value, max, tone, thin }: { value: number; max: number; tone?: 'ok' | 'bad' | 'warn'; thin?: boolean }) {
  const pct = max ? Math.round((value / max) * 100) : 0
  return <div className={`bar ${thin ? 'thin' : ''}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i className={tone || ''} style={{ width: pct + '%' }} /></div>
}
export function Ring({ value, size = 88, stroke = 9, tone = 'accent', label, sub }: { value: number | null; size?: number; stroke?: number; tone?: 'accent' | 'ok' | 'warn' | 'bad' | 'info'; label?: ReactNode; sub?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, value ?? 0))
  return <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
    <svg className="ring-svg" width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`var(--${tone})`} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ transition: 'stroke-dashoffset .8s var(--ease)' }} />
    </svg>
    <div className="absolute inset-0 grid place-items-center text-center leading-none"><div className="font-bold num" style={{ fontSize: size * 0.24 }}>{label ?? (value === null ? '—' : Math.round(value) + '%')}</div>{sub && <div className="text-muted mt-1" style={{ fontSize: size * 0.11 }}>{sub}</div>}</div>
  </div>
}
export function Stat({ label, value, sub, icon, tone }: { label: string; value: ReactNode; sub?: ReactNode; icon?: IconName; tone?: 'ok' | 'warn' | 'bad' | 'accent' | 'info' }) {
  return <div className="card p-4 flex items-start gap-3">
    {icon && <span className={`inline-grid place-items-center w-10 h-10 rounded-lg shrink-0 ${tone ? `bg-${tone}-soft text-${tone}-ink` : 'bg-surface-2 text-fg-2'}`}><Icon name={icon} /></span>}
    <div className="min-w-0 flex-1"><div className="label !mb-0">{label}</div><div className={`text-2xl font-bold num leading-tight ${tone ? `text-${tone}-ink` : ''}`}>{value}</div>{sub && <div className="text-sm text-muted mt-0.5 truncate">{sub}</div>}</div>
  </div>
}
export function PageHeader({ title, sub, eyebrow, actions, children }: { title: ReactNode; sub?: ReactNode; eyebrow?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return <div className="flex flex-wrap items-end justify-between gap-3 mb-5"><div className="min-w-0">{eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}<h1 className="page-title">{title}</h1>{sub && <p className="page-sub">{sub}</p>}{children}</div>{actions && <div className="flex flex-wrap gap-2 items-center">{actions}</div>}</div>
}
export function Empty({ icon = 'sparkle', title, children }: { icon?: IconName; title?: ReactNode; children?: ReactNode }) {
  const { t } = useApp()
  return <div className="card p-10 text-center flex flex-col items-center gap-2"><span className="inline-grid place-items-center w-14 h-14 rounded-full bg-accent-soft text-accent-ink"><Icon name={icon} style={{ width: 26, height: 26 }} /></span><div className="font-semibold">{title || t('noItems')}</div>{children && <div className="text-muted text-sm max-w-md">{children}</div>}</div>
}
export function Avatar({ name, photo, size }: { name: string; photo?: string | null; size?: 'lg' | 'xl' }) {
  const parts = name.trim().split(/\s+/); const ini = (parts[0]?.[0] || '') + (parts[1]?.[0] || '')
  if (photo) return <img src={photo} alt="" className={`avatar ${size || ''}`} style={{ objectFit: 'cover' }} />
  return <span className={`avatar ${size || ''}`} aria-hidden="true">{ini}</span>
}
export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => { if (!open) return; const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; addEventListener('keydown', f); return () => removeEventListener('keydown', f) }, [open, onClose])
  if (!open) return null
  return <><div className="backdrop" onClick={onClose} /><div className="modal" role="dialog" aria-modal="true"><div className="px-5 py-4 border-b border-line font-semibold text-lg flex items-center justify-between">{title}<button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="close"><Icon name="x" /></button></div><div className="px-5 py-4">{children}</div>{footer && <div className="px-5 py-3 border-t border-line bg-surface-2 flex flex-wrap gap-2 justify-end">{footer}</div>}</div></>
}
/* toasts */
interface Toast { id: number; text: string; kind?: 'ok' | 'bad' }
const ToastCtx = createContext<(text: string, kind?: 'ok' | 'bad') => void>(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([])
  const push = useCallback((text: string, kind?: 'ok' | 'bad') => { const id = Date.now() + Math.random(); setList(l => [...l, { id, text, kind }]); setTimeout(() => setList(l => l.filter(x => x.id !== id)), 3200) }, [])
  return <ToastCtx.Provider value={push}>{children}<div className="toast-wrap" aria-live="polite">{list.map(x => <div key={x.id} className={`toast ${x.kind || ''}`}><Icon name={x.kind === 'bad' ? 'alert' : 'checkCircle'} />{x.text}</div>)}</div></ToastCtx.Provider>
}
export const fmtDate = (iso?: string | null, lang: 'ar' | 'en' = (document.documentElement.lang as 'ar' | 'en') || 'ar') => iso ? new Date(iso).toLocaleString(lang === 'ar' ? 'ar-AE-u-nu-latn' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : ''
export const fmtDay = (iso?: string | null, lang: 'ar' | 'en' = (document.documentElement.lang as 'ar' | 'en') || 'ar') => iso ? new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-AE-u-nu-latn' : 'en-GB', { dateStyle: 'medium' }) : ''
export const fmtPct = (v: number | null | undefined) => v === null || v === undefined ? '—' : Math.round(v) + '%'
export const ringTone = (v: number | null): 'accent' | 'ok' | 'warn' | 'bad' => v === null ? 'accent' : v >= 80 ? 'ok' : v >= 50 ? 'warn' : 'bad'
export const tone = (v: number | null) => v === null ? 'muted' as const : v >= 80 ? 'ok' as const : v >= 50 ? 'warn' as const : 'bad' as const
