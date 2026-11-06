import type { ReactNode } from 'react'
/** Horizontal bars: label | bar (approved / total) | value. Pure SVG-free layout with CSS bars. */
export function HBars({ rows }: { rows: { key: string; label: ReactNode; prefix?: ReactNode; value: number; max: number; right?: ReactNode; tone?: 'ok' | 'warn' | 'bad'; href?: string }[] }) {
  return <div className="flex flex-col gap-2">{rows.map(r => {
    const inner = <><span className="w-9 shrink-0">{r.prefix}</span><span className="flex-1 min-w-0 truncate text-sm">{r.label}</span><span className="w-40 shrink-0 hidden sm:block"><div className="bar"><i className={r.tone || ''} style={{ width: (r.max ? Math.round(r.value / r.max * 100) : 0) + '%' }} /></div></span><span className="w-20 shrink-0 text-end num text-sm">{r.right}</span></>
    return r.href ? <a key={r.key} href={r.href} className="flex items-center gap-3 no-underline text-fg rounded px-1 py-0.5 hover:bg-surface-2">{inner}</a> : <div key={r.key} className="flex items-center gap-3 px-1 py-0.5">{inner}</div>
  })}</div>
}
/** Trend line across cycles (SVG, to scale). */
export function Trend({ series, labels, height = 140 }: { series: { name: string; color: string; values: (number | null)[] }[]; labels: string[]; height?: number }) {
  const w = 600, h = height, padL = 34, padR = 12, padT = 12, padB = 26
  const n = labels.length; if (n === 0) return null
  const x = (i: number) => padL + (n === 1 ? (w - padL - padR) / 2 : (i / (n - 1)) * (w - padL - padR))
  const y = (v: number) => padT + (1 - v / 100) * (h - padT - padB)
  return <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" style={{ maxHeight: h, direction: 'ltr' }} role="img" aria-label={series.map(s => s.name).join(' · ')}><title>{series.map(s => s.name).join(' · ')}</title>
    {[0, 25, 50, 75, 100].map(g => <g key={g}><line x1={padL} x2={w - padR} y1={y(g)} y2={y(g)} stroke="var(--line)" strokeDasharray={g ? '2 4' : undefined} /><text x={padL - 6} y={y(g) + 4} fontSize="10" textAnchor="end" fill="var(--muted)">{g}%</text></g>)}
    {labels.map((l, i) => <text key={l} x={x(i)} y={h - 8} fontSize="10" textAnchor="middle" fill="var(--muted)">{l}</text>)}
    {series.map(s => { const pts = s.values.map((v, i) => v === null ? null : [x(i), y(v)] as [number, number]).filter(Boolean) as [number, number][]
      return <g key={s.name}>{pts.length > 1 && <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" />}{pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="4" fill={s.color} stroke="var(--surface)" strokeWidth="2" />)}</g> })}
  </svg>
}
/** Mini sparkline of a value series 0..100 */
export function Spark({ values, color = 'var(--accent)' }: { values: (number | null)[]; color?: string }) {
  const w = 80, h = 24; const pts = values.map((v, i) => v === null ? null : [(i / Math.max(1, values.length - 1)) * w, h - 2 - (v / 100) * (h - 4)] as [number, number]).filter(Boolean) as [number, number][]
  if (pts.length < 2) return <svg width={w} height={h} />
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ direction: 'ltr' }} aria-hidden="true"><polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" /><circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill={color} /></svg>
}
