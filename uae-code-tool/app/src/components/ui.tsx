import { createContext, useCallback, useContext, useEffect, useState, type ReactNode, useRef, useMemo } from 'react'
import type { WorkState, AnswerStatus, Impact } from '../types'
import { useApp } from '../store/state'
import { Icon, type IconName } from './icons'
import lockupLight from '../assets/brand/fta-lockup-light.png'
import lockupDark from '../assets/brand/fta-lockup-dark.png'


/** Eased 0→1 progress over `ms` after mount (or when `key` changes); 1 immediately under reduced motion. */
export function useProgress(ms = 900, key: unknown = 0): number {
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const [k, setK] = useState(reduced ? 1 : 0)
  useEffect(() => { if (reduced) { setK(1); return } let raf = 0; const t0 = performance.now(); const step = (now: number) => { const x = Math.min(1, (now - t0) / ms); setK(1 - Math.pow(1 - x, 3)); if (x < 1) raf = requestAnimationFrame(step) }; raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf) }, [ms, key, reduced])
  return k
}
/** Counts a number up from 0 on mount and whenever the target changes. */
export function useCountUp(target: number, ms = 900): number { const k = useProgress(ms, target); return target * k }
/** A KPI value that counts up; keeps any suffix (e.g. %). */
export function CountUp({ value, decimals = 0, suffix = '' }: { value: number; decimals?: number; suffix?: string }) { const v = useCountUp(value); return <>{decimals ? v.toFixed(decimals) : Math.round(v).toLocaleString('en')}{suffix}</> }
/** Report header shown only when printing: logo, title, cycle and date. */
export function PrintHeader({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  const { lang, t, snap } = useApp(); const date = new Date().toLocaleDateString(lang === 'ar' ? 'ar-AE-u-nu-latn' : 'en-GB', { dateStyle: 'long' })
  const entity = snap ? (lang === 'ar' ? snap.config.entity.name_ar : snap.config.entity.name_en) : ''
  void lockupDark
  return <><div className="print-head"><div><div className="pt">{title}</div>{sub && <div className="text-sm text-muted">{sub}</div>}<div className="text-xs text-muted">{entity} · {t('appName')} · {date}</div></div><img src={lockupLight} alt="" /></div>
    <div className="print-foot"><span>{entity} · {t('appName')}</span><span>{title} · {date}</span></div></>
}

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
export function Bar({ value, max, tone, thin, label }: { value: number; max: number; tone?: 'ok' | 'bad' | 'warn'; thin?: boolean; label?: string }) {
  const pct = max ? Math.round((value / max) * 100) : 0
  return <div className={`bar ${thin ? 'thin' : ''}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label || `${value}/${max}`}><i className={tone || ''} style={{ width: pct + '%' }} /></div>
}
export function Ring({ value, size = 88, stroke = 9, tone = 'accent', label, sub }: { value: number | null; size?: number; stroke?: number; tone?: 'accent' | 'ok' | 'warn' | 'bad' | 'info'; label?: ReactNode; sub?: ReactNode }) {
  const k = useProgress(900, value); const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, value ?? 0)) * k
  return <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
    <svg className="ring-svg" width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`var(--${tone})`} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ transition: 'stroke-dashoffset .8s var(--ease)' }} />
    </svg>
    <div className="absolute inset-0 grid place-items-center text-center leading-none"><div className="font-bold num" style={{ fontSize: size * 0.24 }}>{label ?? (value === null || value === undefined ? fmtPct(value) : fmtPct(value * k))}</div>{sub && <div className="text-muted mt-1" style={{ fontSize: size * 0.11 }}>{sub}</div>}</div>
  </div>
}
export function Stat({ label, value, sub, icon, tone }: { label: string; value: ReactNode; sub?: ReactNode; icon?: IconName; tone?: 'ok' | 'warn' | 'bad' | 'accent' | 'info' }) {
  return <div className="card p-5 flex items-start gap-3 fade-up">
    {icon && <span className={`inline-grid place-items-center w-10 h-10 rounded-lg shrink-0 ${tone ? `bg-${tone}-soft text-${tone}-ink` : 'bg-surface-2 text-fg-2'}`}><Icon name={icon} /></span>}
    <div className="min-w-0 flex-1"><div className="label !mb-0">{label}</div><div className={`kpi-value num leading-tight ${tone ? `text-${tone}-ink` : ''}`}>{typeof value === 'number' ? <CountUp value={value} /> : typeof value === 'string' && /^\d+(\.\d+)?%$/.test(value) ? <CountUp value={parseFloat(value)} decimals={value.includes('.') ? 1 : 0} suffix="%" /> : value}</div>{sub && <div className="text-sm text-muted mt-0.5 truncate">{sub}</div>}</div>
  </div>
}
/** Re-reads the shared folder so numbers saved by other people appear. Shows when the data was last read. */
export function RefreshButton({ compact }: { compact?: boolean }) {
  const { t, lang, refresh, lastSync } = useApp(); const toast = useToast(); const [busy, setBusy] = useState(false)
  const run = async () => { if (busy) return; if (window.__leaveGuard && !window.__leaveGuard()) return; setBusy(true); try { await refresh(); toast(t('refreshed'), 'ok') } catch { toast(t('storageError'), 'bad') } finally { setBusy(false) } }
  const time = lastSync ? new Date(lastSync).toLocaleTimeString(lang === 'ar' ? 'ar-AE-u-nu-latn' : 'en-GB', { hour: '2-digit', minute: '2-digit' }) : ''
  return <button type="button" className={`btn no-print ${compact ? 'btn-ghost btn-icon 2xl:!w-auto 2xl:!px-2' : 'btn-sm'}`} onClick={run} disabled={busy} title={`${t('refreshHint')}${time ? ` · ${t('lastSync')}: ${time}` : ''}`} aria-label={t('refreshData')}>
    <Icon name="refresh" className={busy ? 'animate-spin' : ''} />{!compact && <span>{t('refreshData')}</span>}{time && <span className={`num text-xs text-muted ${compact ? 'hidden 2xl:inline' : ''}`}>{time}</span>}</button>
}
/** Red asterisk for a mandatory field (announced to screen readers as "required"). */
export function Req() { const { t } = useApp(); return <><span className="req-star" aria-hidden="true">*</span><span className="sr-only"> ({t('mandatory')})</span></> }
/** Muted "(optional)" tag for a field that may be left empty. */
export function Opt({ text }: { text?: string }) { const { t } = useApp(); return <span className="opt-tag">({text || t('optional')})</span> }
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
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
/** Accessible dialog: Escape closes, Tab is trapped inside, focus moves in on open and back to the opener on close. */
export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode }) {
  const { t } = useApp(); const ref = useRef<HTMLDivElement>(null); const id = useMemo(() => 'dlg-' + Math.random().toString(36).slice(2, 8), [])
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const first = ref.current?.querySelector<HTMLElement>('.modal-body ' + FOCUSABLE) || ref.current?.querySelector<HTMLElement>(FOCUSABLE); first?.focus()
    const f = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return }
      if (e.key !== 'Tab' || !ref.current) return
      const els = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)]; if (!els.length) return
      const a = els[0], z = els[els.length - 1]
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
    }
    addEventListener('keydown', f, true); return () => { removeEventListener('keydown', f, true); opener?.focus?.() }
  }, [open, onClose])
  if (!open) return null
  return <><div className="backdrop" onClick={onClose} /><div ref={ref} className="modal" role="dialog" aria-modal="true" aria-labelledby={id}><div className="px-5 py-4 border-b border-line font-semibold text-lg flex items-center justify-between"><h2 id={id} className="m-0 text-lg font-semibold">{title}</h2><button className="btn btn-ghost btn-icon" onClick={onClose} aria-label={t('close')}><Icon name="x" /></button></div><div className="px-5 py-4 modal-body">{children}</div>{footer && <div className="px-5 py-3 border-t border-line bg-surface-2 flex flex-wrap gap-2 justify-end">{footer}</div>}</div></>
}
/* toasts */
interface Toast { id: number; text: string; kind?: 'ok' | 'bad' }
const ToastCtx = createContext<(text: string, kind?: 'ok' | 'bad') => void>(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([])
  const push = useCallback((text: string, kind?: 'ok' | 'bad') => { const id = Date.now() + Math.random(); setList(l => [...l, { id, text, kind }]); setTimeout(() => setList(l => l.filter(x => x.id !== id)), kind === 'bad' ? 7000 : 3200) }, [])
  return <ToastCtx.Provider value={push}>{children}<div className="toast-wrap" aria-live="polite">{list.map(x => <div key={x.id} className={`toast ${x.kind || ''}`} role={x.kind === 'bad' ? 'alert' : undefined}><Icon name={x.kind === 'bad' ? 'alert' : 'checkCircle'} />{x.text}</div>)}</div></ToastCtx.Provider>
}
export const fmtDate = (iso?: string | null, lang: 'ar' | 'en' = (document.documentElement.lang as 'ar' | 'en') || 'ar') => iso ? new Date(iso).toLocaleString(lang === 'ar' ? 'ar-AE-u-nu-latn' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : ''
export const fmtDay = (iso?: string | null, lang: 'ar' | 'en' = (document.documentElement.lang as 'ar' | 'en') || 'ar') => iso ? new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-AE-u-nu-latn' : 'en-GB', { dateStyle: 'medium' }) : ''
export const fmtPct = (v: number | null | undefined) => v === null || v === undefined ? '—' : (v > 0 && v < 1 ? v.toFixed(1) : String(Math.round(v))) + '%'
/** Human message for a storage error; the raw text goes to the console. */
export function errMsg(e: unknown, t: (k: 'errNotAllowed' | 'errNotFound' | 'saveFailed') => string): string { const n = (e as DOMException)?.name; console.error(e); if (n === 'NotAllowedError' || n === 'SecurityError') return t('errNotAllowed'); if (n === 'NotFoundError') return t('errNotFound'); const m = (e as Error)?.message; return m && !/^[A-Za-z]+Error/.test(m) && m !== 'conflict' ? m : t('saveFailed') }
export const ringTone = (v: number | null): 'accent' | 'ok' | 'warn' | 'bad' => v === null ? 'accent' : v >= 80 ? 'ok' : v >= 50 ? 'warn' : 'bad'
export const tone = (v: number | null) => v === null ? 'muted' as const : v >= 80 ? 'ok' as const : v >= 50 ? 'warn' as const : 'bad' as const
