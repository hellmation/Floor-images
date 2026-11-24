import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useApp } from '../store/state'
import { Icon, type IconName } from './icons'

/* One filter language for the whole tool: a bar that holds tabs, chips, a search box and a summary. Every control is a
 * native element underneath (select, input, button), so keyboard use and screen readers work as before. */

/** The bar itself. `shown / total` is the result count; `active` is how many filters are narrowing the list. */
export function FilterBar({ children, tabs, shown, total, active = 0, onClear, extra, className = '', selected }: { children?: ReactNode; tabs?: ReactNode; shown?: number; total?: number; active?: number; onClear?: () => void; extra?: ReactNode; className?: string; selected?: boolean }) {
  const { t } = useApp()
  return <div className={`card fbar ${className}`} data-active={active > 0 || undefined} data-on={selected || undefined}>
    {tabs && <div className="fbar-tabs">{tabs}</div>}
    <div className="fbar-row">
      <span className="fbar-ico" aria-hidden="true"><Icon name="filter" /></span>
      {children}
      {(shown !== undefined || extra || (active > 0 && onClear)) && <span className="fbar-end">
        {extra}
        {shown !== undefined && <span className="fbar-count num" aria-live="polite"><b>{shown.toLocaleString('en')}</b>{total !== undefined && <> / {total.toLocaleString('en')}</>}</span>}
        {active > 0 && onClear && <button type="button" className="fbar-clear" onClick={onClear}><span className="fbar-n num">{active}</span>{t('clearFilters')}<Icon name="x" /></button>}
      </span>}
    </div>
  </div>
}

/** A dropdown filter drawn as a chip: "label  value ▾". It lights up when it is narrowing the list and then offers an × to clear it.
 *  `neutral` is the value that means "no filter"; pass `plain` for a choice that is never empty (a sort order). */
export function FilterChip({ id, label, icon, value, onChange, children, neutral = '', plain }: { id?: string; label: string; icon?: IconName; value: string; onChange: (v: string) => void; children: ReactNode; neutral?: string; plain?: boolean }) {
  const { t } = useApp(); const on = !plain && value !== neutral
  // The chip is as wide as the chosen value, not as the longest option: the value is drawn as text and the real select lies over it.
  const ref = useRef<HTMLSelectElement>(null); const [text, setText] = useState('')
  useLayoutEffect(() => { const o = ref.current?.selectedOptions[0]; const v = o ? o.text : ''; if (v !== text) setText(v) })
  return <span className="fchip" data-on={on || undefined}>
    <label className="fchip-main">{icon && <Icon name={icon} />}<span className="fchip-l">{label}</span><span className="fchip-v" aria-hidden="true">{text}</span><i className="fchip-car" aria-hidden="true" />
      <select ref={ref} id={id} aria-label={label} value={value} onChange={e => onChange(e.target.value)}>{children}</select></label>
    {on && <button type="button" className="fchip-x" aria-label={`${t('remove')}: ${label}`} title={t('remove')} onClick={() => onChange(neutral)}><Icon name="x" /></button>}
  </span>
}

/** A yes / no filter as a chip. */
export function FilterToggle({ pressed, onChange, icon, children, count }: { pressed: boolean; onChange: (v: boolean) => void; icon?: IconName; children: ReactNode; count?: number }) {
  return <button type="button" className="fchip ftoggle" aria-pressed={pressed} data-on={pressed || undefined} onClick={() => onChange(!pressed)}>
    <span className="fchip-main">{icon && <Icon name={icon} />}<span className="fchip-v">{children}</span>{count !== undefined && <span className="fbadge num">{count}</span>}</span>
  </button>
}

/** The search box of a filter bar, with a clear button. */
export function FilterSearch({ id, value, onChange, placeholder }: { id?: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const { t } = useApp()
  return <span className="fsearch" data-on={!!value || undefined}><Icon name="search" />
    <input id={id} type="search" placeholder={placeholder || t('search')} aria-label={placeholder || t('search')} value={value} onChange={e => onChange(e.target.value)} />
    {value && <button type="button" className="fchip-x" aria-label={t('remove')} onClick={() => onChange('')}><Icon name="x" /></button>}
  </span>
}

/** Tabs with a count badge each (statuses, views). */
export function FilterTabs<K extends string>({ value, onChange, tabs, label }: { value: K; onChange: (k: K) => void; tabs: { k: K; label: ReactNode; n?: number; icon?: IconName }[]; label?: string }) {
  return <div className="seg ftabs" role="group" aria-label={label}>{tabs.map(x => <button key={x.k} type="button" aria-pressed={value === x.k} data-empty={x.n === 0 || undefined} onClick={() => onChange(x.k)}>{x.icon && <Icon name={x.icon} />}{x.label}{x.n !== undefined && <span className="num">{x.n.toLocaleString('en')}</span>}</button>)}</div>
}
