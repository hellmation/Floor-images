import { useRef, useState, type ReactNode, type PointerEvent as RPE } from 'react'
import { useProgress } from './ui'

/* ----------------------------------------------------------------------------------------------
 * Chart primitives for the dashboard. All marks are thin, grids are hairlines, one hue per
 * chart unless the colour *means* a status. Every mark carries a hover/focus tooltip and the
 * same values exist in text elsewhere (tables, exports), so colour is never the only channel.
 * -------------------------------------------------------------------------------------------- */

export interface TipState { x: number; y: number; node: ReactNode }
/** Pointer-following tooltip anchored inside a `position: relative` chart box. */
export function useTip() {
  const [tip, setTip] = useState<TipState | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const show = (e: RPE<Element> | { clientX: number; clientY: number }, node: ReactNode) => { const r = box.current?.getBoundingClientRect(); if (!r) return; setTip({ x: e.clientX - r.left, y: e.clientY - r.top, node }) }
  const hide = () => setTip(null)
  const Tip = tip ? <div className="chart-tip" style={{ left: tip.x, top: tip.y }} role="status">{tip.node}</div> : null
  return { box, show, hide, Tip }
}
export const TipRow = ({ label, value, color }: { label: ReactNode; value: ReactNode; color?: string }) => (
  <div className="flex items-center gap-2 whitespace-nowrap"><i className="chart-key" style={{ background: color || 'transparent' }} /><b className="num">{value}</b><span className="opacity-80">{label}</span></div>)

export type Part = { key: string; label: string; value: number; color: string }

/** Tall segmented bar: one whole split into ≤ 6 parts, each block printing its share when it fits. Legend lists names only. */
export function Segmented({ parts, total, height = 28, fmt = (_v: number, pct: number) => `${Math.round(pct)}%` }: { parts: Part[]; total?: number; height?: number; fmt?: (v: number, pct: number) => string }) {
  const { box, show, hide, Tip } = useTip()
  const sum = total ?? parts.reduce((a, p) => a + p.value, 0)
  const live = parts.filter(p => p.value > 0)
  return <div ref={box} className="relative">
    <div className="flex w-full overflow-hidden rounded-md" style={{ height, gap: 2 }} role="img" aria-label={parts.map(p => `${p.label}: ${p.value}`).join(' · ')}>
      {sum === 0 ? <div className="flex-1 rounded-md" style={{ background: 'var(--surface-3)' }} /> : live.map(p => { const pct = p.value / sum * 100; return <button type="button" key={p.key} className="chart-seg" style={{ width: `${pct}%`, background: p.color }} aria-label={`${p.label}: ${p.value} (${Math.round(pct)}%)`}
        onPointerMove={e => show(e, <TipRow label={p.label} value={`${p.value} · ${Math.round(pct)}%`} color={p.color} />)} onPointerLeave={hide} onFocus={e => show({ clientX: e.currentTarget.getBoundingClientRect().left + 10, clientY: e.currentTarget.getBoundingClientRect().top }, <TipRow label={p.label} value={`${p.value} · ${Math.round(pct)}%`} color={p.color} />)} onBlur={hide}>
        {pct >= 9 && <span className="chart-seg-label">{fmt(p.value, pct)}</span>}</button> })}
    </div>
    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-fg-2">{parts.map(p => <span key={p.key} className="flex items-center gap-1.5"><i className="chart-swatch" style={{ background: p.color }} />{p.label}<span className="num text-muted">{p.value}</span></span>)}</div>
    {Tip}
  </div>
}

export interface BarRow { key: string; label: ReactNode; text: string; value: number | null; compare?: number | null; sub?: ReactNode; href?: string; prefix?: ReactNode; tipExtra?: ReactNode }
/** Ranked horizontal bars on one baseline, one hue; an optional grey ghost bar shows the comparison cycle. Value printed at the tip. */
export function Bars({ rows, max = 100, color = 'var(--accent)', fmt = (v: number) => `${Math.round(v)}%`, compareLabel, thick = 12 }: { rows: BarRow[]; max?: number; color?: string; fmt?: (v: number) => string; compareLabel?: string; thick?: number }) {
  const { box, show, hide, Tip } = useTip()
  const tipFor = (r: BarRow) => <div className="flex flex-col gap-1"><div className="font-semibold">{r.text}</div>{r.value !== null && <TipRow label="" value={fmt(r.value)} color={color} />}{r.compare !== null && r.compare !== undefined && <TipRow label={compareLabel} value={fmt(r.compare)} color="var(--line-2)" />}{r.tipExtra}</div>
  return <div ref={box} className="relative flex flex-col gap-1.5">
    {compareLabel && rows.some(r => r.compare !== null && r.compare !== undefined) && <div className="flex items-center gap-2 text-xs text-muted mb-1"><span className="flex items-center gap-1.5"><i className="chart-swatch" style={{ background: color, width: 14, height: 8, borderRadius: 2 }} />{rows[0] ? '' : ''}</span><span className="flex items-center gap-1.5"><b className="chart-bar-cmp !static !h-3" aria-hidden="true" />{compareLabel}</span></div>}
    {rows.map(r => { const w = r.value === null ? 0 : Math.max(0, Math.min(100, r.value / max * 100)); const cw = r.compare === null || r.compare === undefined ? null : Math.max(0, Math.min(100, r.compare / max * 100))
      const inner = <>
        {r.prefix !== undefined && <span className="w-8 shrink-0">{r.prefix}</span>}
        <span className="chart-bar-label">{r.label}</span>
        <span className="chart-bar-track" style={{ height: thick + 6, ["--track-h" as string]: thick + "px" }}>
          <i className="chart-bar-fill" style={{ width: `${w}%`, height: thick, background: color }} />
          {cw !== null && <b className="chart-bar-cmp" style={{ insetInlineStart: `calc(${cw}% - 1px)`, height: thick + 8 }} aria-hidden="true" />}
        </span>
        <span className="chart-bar-value num">{r.value === null ? '—' : fmt(r.value)}{r.sub && <span className="block text-xs text-muted font-normal">{r.sub}</span>}</span></>
      const cls = 'chart-bar-row'
      return r.href ? <a key={r.key} href={r.href} className={cls + ' no-underline text-fg'} onPointerMove={e => show(e, tipFor(r))} onPointerLeave={hide} onFocus={e => show({ clientX: e.currentTarget.getBoundingClientRect().left + 40, clientY: e.currentTarget.getBoundingClientRect().top }, tipFor(r))} onBlur={hide}>{inner}</a>
        : <div key={r.key} className={cls} tabIndex={0} onPointerMove={e => show(e, tipFor(r))} onPointerLeave={hide} onFocus={e => show({ clientX: e.currentTarget.getBoundingClientRect().left + 40, clientY: e.currentTarget.getBoundingClientRect().top }, tipFor(r))} onBlur={hide}>{inner}</div> })}
    {Tip}
  </div>
}

/** Columns with values on the caps and a hairline grid. SVG, always LTR. */
export function Columns({ items, color = 'var(--accent)', height = 180, fmt = (v: number) => String(Math.round(v)), tip }: { items: { key: string; label: string; value: number; text?: string }[]; color?: string; height?: number; fmt?: (v: number) => string; tip?: (i: { key: string; label: string; value: number; text?: string }) => ReactNode }) {
  const { box, show, hide, Tip } = useTip()
  const w = 600, h = height, padL = 36, padR = 12, padT = 18, padB = 26
  const max = Math.max(1, ...items.map(i => i.value)); const step = niceStep(max); const top = Math.ceil(max / step) * step
  const n = items.length; const slot = (w - padL - padR) / Math.max(1, n); const bw = Math.min(24, slot * 0.55)
  const y = (v: number) => padT + (1 - v / top) * (h - padT - padB)
  return <div ref={box} className="relative"><svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" style={{ direction: 'ltr' }} role="img" aria-label={items.map(i => `${i.label}: ${fmt(i.value)}`).join(' · ')}>
    {Array.from({ length: Math.round(top / step) + 1 }, (_, k) => k * step).map(g => <g key={g}><line x1={padL} x2={w - padR} y1={y(g)} y2={y(g)} stroke="var(--line)" /><text x={padL - 6} y={y(g) + 3.5} fontSize="10" textAnchor="end" fill="var(--muted)">{fmtTick(g)}</text></g>)}
    {items.map((it, i) => { const x = padL + slot * i + (slot - bw) / 2; const yy = y(it.value); const hh = Math.max(0, y(0) - yy)
      return <g key={it.key} tabIndex={0} onPointerMove={e => show(e, tip ? tip(it) : <TipRow label={it.text || it.label} value={fmt(it.value)} color={color} />)} onPointerLeave={hide} onFocus={e => { const r = (e.currentTarget as SVGGElement).getBoundingClientRect(); show({ clientX: r.left + r.width / 2, clientY: r.top }, tip ? tip(it) : <TipRow label={it.text || it.label} value={fmt(it.value)} color={color} />) }} onBlur={hide} style={{ cursor: 'default', outline: 'none' }}>
        <rect x={padL + slot * i} y={padT} width={slot} height={h - padT - padB} fill="transparent" />
        <path d={roundTop(x, yy, bw, hh, 4)} fill={color} className="chart-col" />
        {it.value > 0 && <text x={x + bw / 2} y={yy - 5} fontSize="11" fontWeight="600" textAnchor="middle" fill="var(--fg)" className="num">{fmt(it.value)}</text>}
        <text x={x + bw / 2} y={h - 8} fontSize="11" textAnchor="middle" fill="var(--fg-2)">{it.label}</text></g> })}
  </svg>{Tip}</div>
}
const niceStep = (max: number) => { const raw = max / 4; const p = Math.pow(10, Math.floor(Math.log10(raw))); const m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p }
const fmtTick = (v: number) => v >= 1000 ? (v / 1000).toFixed(v % 1000 ? 1 : 0) + 'K' : String(v)
const roundTop = (x: number, y: number, w: number, h: number, r: number) => { if (h <= 0) return ''; const rr = Math.min(r, w / 2, h); return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z` }

/** 100%-stacked horizontal bars, one row per category, with a 2px surface gap between segments and a shared legend. */
export function Stacked({ rows, parts, height = 18, labelW }: { rows: { key: string; label: ReactNode; text: string; values: Record<string, number> }[]; parts: { key: string; label: string; color: string }[]; height?: number; labelW?: string }) {
  const { box, show, hide, Tip } = useTip()
  const tipFor = (r: typeof rows[number]) => { const tot = parts.reduce((a, p) => a + (r.values[p.key] || 0), 0); return <div className="flex flex-col gap-1"><div className="font-semibold">{r.text}</div>{parts.map(p => <TipRow key={p.key} label={p.label} value={`${r.values[p.key] || 0} · ${tot ? Math.round((r.values[p.key] || 0) / tot * 100) : 0}%`} color={p.color} />)}</div> }
  return <div ref={box} className="relative">
    <div className="flex flex-col gap-2">{rows.map(r => { const tot = parts.reduce((a, p) => a + (r.values[p.key] || 0), 0)
      return <div key={r.key} className="chart-bar-row" tabIndex={0} onPointerMove={e => show(e, tipFor(r))} onPointerLeave={hide} onFocus={e => show({ clientX: e.currentTarget.getBoundingClientRect().left + 40, clientY: e.currentTarget.getBoundingClientRect().top }, tipFor(r))} onBlur={hide}>
        <span className="chart-bar-label" style={labelW ? { flexBasis: labelW } : undefined}>{r.label}</span>
        <span className="flex-1 flex overflow-hidden rounded" style={{ height, gap: 2 }}>{tot === 0 ? <i className="flex-1" style={{ background: 'var(--surface-3)' }} /> : parts.filter(p => (r.values[p.key] || 0) > 0).map(p => { const pct = (r.values[p.key] || 0) / tot * 100; return <i key={p.key} className="chart-seg !rounded-none" style={{ width: `${pct}%`, background: p.color }}>{pct >= 12 && <span className="chart-seg-label text-[10px]">{Math.round(pct)}%</span>}</i> })}</span>
        <span className="chart-bar-value num text-muted text-xs">{tot}</span></div> })}</div>
    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-fg-2">{parts.map(p => <span key={p.key} className="flex items-center gap-1.5"><i className="chart-swatch" style={{ background: p.color }} />{p.label}</span>)}</div>
    {Tip}
  </div>
}

export interface HeatCell { key: string; label: string; value: number | null; sub?: string; href?: string }
/** Matrix heatmap: a row per group, a cell per item; the fill is a 3-bin semantic scale (low / medium / good) with the value printed. */
export function Heatmap({ rows, fill, fmt = (v: number | null) => v === null ? '—' : `${Math.round(v)}%`, tip }: { rows: { key: string; label: ReactNode; cells: HeatCell[] }[]; fill: (v: number | null) => string; fmt?: (v: number | null) => string; tip?: (c: HeatCell) => ReactNode }) {
  const { box, show, hide, Tip } = useTip()
  const cols = Math.max(...rows.map(r => r.cells.length))
  return <div ref={box} className="relative overflow-x-auto">
    <div className="grid gap-1" style={{ gridTemplateColumns: `minmax(120px, 1.3fr) repeat(${cols}, minmax(52px, 1fr))` }}>
      {rows.map(r => <div key={r.key} className="contents">
        <div className="text-sm pe-2 py-1 flex items-center min-w-0"><span className="truncate">{r.label}</span></div>
        {r.cells.map(c => { const node = tip ? tip(c) : <div className="flex flex-col gap-0.5"><div className="font-semibold">{c.label}</div><TipRow label={c.sub} value={fmt(c.value)} /></div>
          const common = { className: 'chart-cell', style: { background: fill(c.value) }, onPointerMove: (e: RPE<Element>) => show(e, node), onPointerLeave: hide, onFocus: (e: { currentTarget: Element }) => { const b = e.currentTarget.getBoundingClientRect(); show({ clientX: b.left + b.width / 2, clientY: b.top }, node) }, onBlur: hide, 'aria-label': `${c.label}: ${fmt(c.value)}` }
          const body = <><span className="code-id text-[10px]">{c.key}</span><span className="num font-semibold text-xs">{fmt(c.value)}</span></>
          return c.href ? <a key={c.key} href={c.href} {...common}>{body}</a> : <div key={c.key} tabIndex={0} {...common}>{body}</div> })}
        {Array.from({ length: cols - r.cells.length }).map((_, i) => <div key={'e' + i} />)}
      </div>)}
    </div>
    {Tip}
  </div>
}

/** Trend lines across cycles with a crosshair tooltip listing every series at that cycle, end labels and a legend. */
export function Trend({ series, labels, height = 180, fmt = (v: number) => `${Math.round(v)}%` }: { series: { name: string; color: string; values: (number | null)[] }[]; labels: string[]; height?: number; fmt?: (v: number) => string }) {
  const { box, show, hide, Tip } = useTip()
  const [hi, setHi] = useState<number | null>(null)
  const w = 600, h = height, padL = 36, padR = 56, padT = 14, padB = 26
  const n = labels.length; if (n === 0) return null
  const x = (i: number) => padL + (n === 1 ? (w - padL - padR) / 2 : (i / (n - 1)) * (w - padL - padR))
  const y = (v: number) => padT + (1 - v / 100) * (h - padT - padB)
  const area = (s: typeof series[number]) => { const pts = s.values.map((v, i) => v === null ? null : [x(i), y(v)] as [number, number]).filter(Boolean) as [number, number][]; if (pts.length < 2) return ''; return `M${pts[0][0]},${y(0)} ` + pts.map(p => `L${p[0]},${p[1]}`).join(' ') + ` L${pts[pts.length - 1][0]},${y(0)} Z` }
  const onMove = (e: RPE<SVGSVGElement>) => { const r = e.currentTarget.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width * w; let best = 0; for (let i = 1; i < n; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i; setHi(best); show(e, <div className="flex flex-col gap-1"><div className="font-semibold">{labels[best]}</div>{series.map(s => <TipRow key={s.name} label={s.name} value={s.values[best] === null ? '—' : fmt(s.values[best]!)} color={s.color} />)}</div>) }
  return <div ref={box} className="relative">
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" style={{ direction: 'ltr' }} role="img" aria-label={series.map(s => s.name).join(' · ')} onPointerMove={onMove} onPointerLeave={() => { setHi(null); hide() }}>
      {[0, 25, 50, 75, 100].map(g => <g key={g}><line x1={padL} x2={w - padR} y1={y(g)} y2={y(g)} stroke="var(--line)" /><text x={padL - 6} y={y(g) + 3.5} fontSize="10" textAnchor="end" fill="var(--muted)">{g}%</text></g>)}
      {labels.map((l, i) => <text key={l} x={x(i)} y={h - 8} fontSize="10" textAnchor="middle" fill={hi === i ? 'var(--fg)' : 'var(--muted)'} fontWeight={hi === i ? 600 : 400}>{l}</text>)}
      {hi !== null && <line x1={x(hi)} x2={x(hi)} y1={padT} y2={y(0)} stroke="var(--line-2)" />}
      {series.map((s, si) => { const pts = s.values.map((v, i) => v === null ? null : [x(i), y(v)] as [number, number]).filter(Boolean) as [number, number][]; const last = pts[pts.length - 1]
        return <g key={s.name}>{si === 0 && <path d={area(s)} fill={s.color} opacity="0.08" />}{pts.length > 1 && <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
          {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={hi === i ? 5 : 4} fill={s.color} stroke="var(--surface)" strokeWidth="2" />)}
          {last && <text x={last[0] + 8} y={last[1] + 3.5 + (si ? 10 : -4)} fontSize="11" fontWeight="600" fill="var(--fg)" className="num">{fmt(s.values.filter(v => v !== null).slice(-1)[0] as number)}</text>}</g> })}
    </svg>
    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-fg-2">{series.map(s => <span key={s.name} className="flex items-center gap-1.5"><i className="chart-key" style={{ background: s.color }} />{s.name}</span>)}</div>
    {Tip}
  </div>
}

/** Mini sparkline of a value series 0..100 */
export function Spark({ values, color = 'var(--accent)' }: { values: (number | null)[]; color?: string }) {
  const w = 80, h = 24; const pts = values.map((v, i) => v === null ? null : [(i / Math.max(1, values.length - 1)) * w, h - 2 - (v / 100) * (h - 4)] as [number, number]).filter(Boolean) as [number, number][]
  if (pts.length < 2) return <svg width={w} height={h} />
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ direction: 'ltr' }} aria-hidden="true"><polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" /><circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill={color} /></svg>
}

/** Horizontal bars (legacy layout kept for other pages). */
export function HBars({ rows }: { rows: { key: string; label: ReactNode; prefix?: ReactNode; value: number; max: number; right?: ReactNode; tone?: 'ok' | 'warn' | 'bad'; href?: string }[] }) {
  return <div className="flex flex-col gap-2">{rows.map(r => {
    const inner = <><span className="w-9 shrink-0">{r.prefix}</span><span className="flex-1 min-w-0 truncate text-sm">{r.label}</span><span className="w-40 shrink-0 hidden sm:block"><div className="bar"><i className={r.tone || ''} style={{ width: (r.max ? Math.round(r.value / r.max * 100) : 0) + '%' }} /></div></span><span className="w-20 shrink-0 text-end num text-sm">{r.right}</span></>
    return r.href ? <a key={r.key} href={r.href} className="flex items-center gap-3 no-underline text-fg rounded px-1 py-0.5 hover:bg-surface-2">{inner}</a> : <div key={r.key} className="flex items-center gap-3 px-1 py-0.5">{inner}</div>
  })}</div>
}

/** Rounded annular sector (ECharts-style borderRadius on a pie slice). Angles in radians, clockwise from 12 o'clock. */
function sector(cx: number, cy: number, rIn: number, rOut: number, a0: number, a1: number, rad: number): string {
  const span = a1 - a0; if (span <= 0) return ''
  const pt = (r: number, a: number): [number, number] => [cx + r * Math.sin(a), cy - r * Math.cos(a)]
  const rc = Math.min(rad, (rOut - rIn) / 2, (span * rIn) / 2.2)
  const dO = Math.asin(Math.min(1, rc / (rOut - rc))), dI = Math.asin(Math.min(1, rc / (rIn + rc)))
  if (span < 2 * Math.max(dO, dI) + 0.02) { // too thin to round: plain sector
    const [x0, y0] = pt(rOut, a0), [x1, y1] = pt(rOut, a1), [x2, y2] = pt(rIn, a1), [x3, y3] = pt(rIn, a0); const la = span > Math.PI ? 1 : 0
    return `M${x0},${y0} A${rOut},${rOut} 0 ${la} 1 ${x1},${y1} L${x2},${y2} A${rIn},${rIn} 0 ${la} 0 ${x3},${y3} Z`
  }
  const eO = Math.sqrt((rOut - rc) ** 2 - rc ** 2), eI = Math.sqrt((rIn + rc) ** 2 - rc ** 2)
  const la = (a1 - a0 - 2 * dO) > Math.PI ? 1 : 0, li = (a1 - a0 - 2 * dI) > Math.PI ? 1 : 0
  const P = [pt(eI, a0), pt(eO, a0), pt(rOut, a0 + dO), pt(rOut, a1 - dO), pt(eO, a1), pt(eI, a1), pt(rIn, a1 - dI), pt(rIn, a0 + dI)]
  const f = (q: [number, number]) => `${q[0].toFixed(2)},${q[1].toFixed(2)}`
  return `M${f(P[0])} L${f(P[1])} A${rc},${rc} 0 0 1 ${f(P[2])} A${rOut},${rOut} 0 ${la} 1 ${f(P[3])} A${rc},${rc} 0 0 1 ${f(P[4])} L${f(P[5])} A${rc},${rc} 0 0 1 ${f(P[6])} A${rIn},${rIn} 0 ${li} 0 ${f(P[7])} A${rc},${rc} 0 0 1 ${f(P[0])} Z`
}

/** Donut in the team dashboard's style: ring between 62% and 84% of the radius, slices with 6px rounded corners and a
 *  3px surface border, hover enlarges the slice, a headline figure in the centre, and a legend of name · count · share. */
export function Donut({ parts, total, center, size = 190, legend = true }: { parts: Part[]; total?: number; center: [string, string]; size?: number; legend?: boolean }) {
  const { box, show, hide, Tip } = useTip()
  const k = useProgress(800, parts.map(p => p.value).join(','))
  const sum = total ?? parts.reduce((a, p) => a + p.value, 0)
  const R = size / 2, rOut = R * 0.84, rIn = R * 0.62, TAU = Math.PI * 2
  let acc = 0
  const segs = parts.filter(p => p.value > 0).map(p => { const a0 = acc; const span = sum ? (p.value / sum) * TAU : 0; acc += span; return { ...p, a0, a1: a0 + span } })
  const node = (p: Part & { a0: number; a1: number }) => <TipRow label={p.label} value={`${p.value.toLocaleString('en')} · ${sum ? Math.round(p.value / sum * 100) : 0}%`} color={p.color} />
  return <div ref={box} className="relative donut-wrap">
    <div className="relative shrink-0 mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ direction: 'ltr', overflow: 'visible' }} role="img" aria-label={parts.map(p => `${p.label}: ${p.value}`).join(' · ')}>
        {sum === 0 && <path d={sector(R, R, rIn, rOut, 0, TAU - 0.0001, 0)} fill="var(--surface-3)" />}
        {segs.map(sg => { const end = Math.min(sg.a1, TAU * k); if (end <= sg.a0) return null
          return <path key={sg.key} className="donut-seg" tabIndex={0} d={sector(R, R, rIn, rOut, sg.a0, end, 6)} fill={sg.color} stroke="var(--glass-bg)" strokeWidth={3} strokeLinejoin="round" aria-label={`${sg.label}: ${sg.value}`}
            onPointerMove={e => show(e, node(sg))} onPointerLeave={hide} onFocus={() => { const b = box.current!.getBoundingClientRect(); show({ clientX: b.left + size / 2, clientY: b.top + 10 }, node(sg)) }} onBlur={hide} /> })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center pointer-events-none"><div><div className="num font-bold" style={{ fontSize: center[0].length > 5 ? 22 : 26, lineHeight: 1.1 }}>{center[0]}</div><div className="text-xs text-muted mt-0.5">{center[1]}</div></div></div>
    </div>
    {legend && <div className="legend">{parts.map(p => <div key={p.key} className="lg"><span className="dot" style={{ background: p.color }} /><span className="truncate">{p.label}</span><span className="cnt num">{p.value.toLocaleString('en')}</span><span className="pct num">{sum ? Math.round(p.value / sum * 100) : 0}%</span></div>)}</div>}
    {Tip}
  </div>
}
