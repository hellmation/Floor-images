import { useMemo, useState, type ReactNode } from 'react'
import { useApp } from '../store/state'
import { master, rollup, effective, codeScore, effectiveImpact, sortIds, isComplete, departmentOf, fulfilRows, type FulfilRow } from '../store/scoring'
import { pick, pickDesc } from '../i18n'
import { ImpactPill, PageHeader, Ring, Stat, fmtPct, tone, ringTone } from '../components/ui'
import { Bars, Columns, Heatmap, Segmented, Stacked, Trend, TipRow } from '../components/charts'
import { Icon, type IconName } from '../components/icons'
import type { WorkState } from '../types'

const heat = (v: number | null) => v === null ? 'var(--surface-2)' : v >= 80 ? 'var(--ok-soft)' : v >= 50 ? 'var(--warn-soft)' : 'var(--bad-soft)'
const STATE_COLOR: Record<WorkState, string> = { approved: 'var(--ok)', submitted: 'var(--info)', returned: 'var(--warn)', draft: 'var(--accent)', none: 'var(--line-2)' }
const ANSWER_COLOR = { yes: 'var(--ok)', partial: 'var(--warn)', no: 'var(--bad)', unanswered: 'var(--line-2)', na: 'color-mix(in srgb, var(--muted) 45%, var(--surface))' }

/** A dashboard card: icon, title, one-line hint, then the chart. */
function Card({ icon, title, hint, right, children, className = '' }: { icon: IconName; title: ReactNode; hint?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`card p-4 flex flex-col ${className}`}>
    <div className="flex items-start justify-between gap-3 mb-3"><div className="min-w-0"><h2 className="text-base font-semibold m-0 flex items-center gap-2"><Icon name={icon} className="text-accent-ink" />{title}</h2>{hint && <p className="text-xs text-muted m-0 mt-0.5">{hint}</p>}</div>{right}</div>
    <div className="flex-1 min-w-0">{children}</div>
  </section>
}

export default function Dashboard() {
  const { t, lang, snap, cycleId } = useApp(); const cfg = snap!.config; const cy = cycleId!
  const [approvedOnly, setApprovedOnly] = useState(false)
  const [cmp, setCmp] = useState('')
  const [allGaps, setAllGaps] = useState(false)
  const all = useMemo(() => rollup(snap!, cy, master.codes, approvedOnly), [snap, cy, approvedOnly])
  const cmpAll = useMemo(() => cmp ? rollup(snap!, cmp, master.codes, approvedOnly) : null, [snap, cmp, approvedOnly])
  const rows = useMemo(() => fulfilRows(snap!, cy, approvedOnly), [snap, cy, approvedOnly])
  const states = useMemo(() => { const m: Record<WorkState, number> = { approved: 0, submitted: 0, returned: 0, draft: 0, none: 0 }; for (const c of master.codes) m[effective(snap!, cy, c.id).state]++; return m }, [snap, cy])
  const answers = useMemo(() => { const m = { yes: 0, partial: 0, no: 0, unanswered: 0, na: 0 }; for (const r of rows) { if (r.status === 'na') m.na++; else if (r.status) m[r.status]++; else m.unanswered++ } return m }, [rows])
  const byPillar = useMemo(() => master.pillars.map(p => ({ p, r: rollup(snap!, cy, master.codes.filter(c => c.pillar === p.id), approvedOnly), c: cmp ? rollup(snap!, cmp, master.codes.filter(c => c.pillar === p.id), approvedOnly) : null })), [snap, cy, cmp, approvedOnly])
  const lostByPillar = useMemo(() => master.pillars.map(p => ({ p, lost: rows.filter(r => r.code.pillar === p.id && (r.status === 'no' || r.status === 'partial')).reduce((a, r) => a + (r.pts - r.earned), 0) })), [rows])
  const bySub = useMemo(() => master.subpillars.map(s => ({ s, r: rollup(snap!, cy, master.codes.filter(c => c.sub === s.id), approvedOnly) })), [snap, cy, approvedOnly])
  const byProject = useMemo(() => cfg.projects.filter(p => p.active).map(p => ({ p, r: rollup(snap!, cy, master.codes.filter(c => (cfg.mapping[c.id] || []).includes(p.id)), approvedOnly) })).filter(x => x.r.total).sort((a, b) => (b.r.score ?? -1) - (a.r.score ?? -1) || b.r.total - a.r.total), [snap, cy, cfg, approvedOnly])
  const byDept = useMemo(() => cfg.departments.filter(d => d.active).map(d => ({ d, r: rollup(snap!, cy, master.codes.filter(c => departmentOf(snap!, cy, c.id) === d.id), approvedOnly) })).filter(x => x.r.total > 0).sort((a, b) => (b.r.score ?? -1) - (a.r.score ?? -1) || b.r.total - a.r.total), [cfg, cy, snap, approvedOnly])
  const byImpact = useMemo(() => (['high', 'medium', 'low'] as const).map(k => { const rs = rows.filter(r => effectiveImpact(r.code, cfg) === k); const v = (f: (r: FulfilRow) => boolean) => rs.filter(f).length; return { key: k, label: t(k), text: `${t(k)} · ${rs.length} ${t('requirements')}`, values: { yes: v(r => r.status === 'yes'), partial: v(r => r.status === 'partial'), no: v(r => r.status === 'no'), unanswered: v(r => !r.status), na: v(r => r.status === 'na') } } }), [rows, cfg, t])
  const gaps = useMemo(() => master.codes.map(c => ({ c, e: effective(snap!, cy, c.id) })).map(x => ({ ...x, s: codeScore(x.e.answer, x.c, cfg) })).filter(x => x.s !== null && x.s < 100 && (approvedOnly ? x.e.state === 'approved' : isComplete(x.e.answer, x.c)))
    .sort((a, b) => { const w = cfg.settings.weights; return (w[effectiveImpact(b.c, cfg)] - w[effectiveImpact(a.c, cfg)]) || (a.s! - b.s!) || sortIds(a.c.id, b.c.id) }), [snap, cy, cfg, approvedOnly])
  const trendCycles = useMemo(() => cfg.cycles.filter(c => c.status === 'closed' || c.id === cy).sort((a, b) => a.start.localeCompare(b.start)), [cfg, cy])
  const trend = useMemo(() => trendCycles.map(c => { const r = rollup(snap!, c.id, master.codes, true); return { readiness: r.total ? r.approved / r.total * 100 : 0, score: r.score } }), [trendCycles, snap])
  const delta = (a: number | null, b: number | null) => a === null || b === null ? '' : '‎' + (a - b >= 0 ? '+' : '') + Math.round(a - b)
  const cname = (c: { name: string; name_en?: string }) => lang === 'ar' ? c.name : (c.name_en || c.name)
  const cmpName = cmp ? cname(cfg.cycles.find(c => c.id === cmp) || { name: cmp }) : ''
  const readiness = all.total ? (all.approved / all.total) * 100 : 0
  const legend = <span className="flex items-center gap-3 text-xs text-muted shrink-0"><span className="flex items-center gap-1"><i className="chart-swatch" style={{ background: 'var(--ok-soft)' }} />≥80</span><span className="flex items-center gap-1"><i className="chart-swatch" style={{ background: 'var(--warn-soft)' }} />50–79</span><span className="flex items-center gap-1"><i className="chart-swatch" style={{ background: 'var(--bad-soft)' }} />&lt;50</span></span>
  return (
    <div>
      <PageHeader title={t('dashboard')} sub={t('overview')} actions={<>
        <div className="seg"><button aria-pressed={!approvedOnly} onClick={() => setApprovedOnly(false)}>{t('allAnswered')}</button><button aria-pressed={approvedOnly} onClick={() => setApprovedOnly(true)}>{t('approvedOnly')}</button></div>
        <label className="flex items-center gap-1 text-sm"><span className="text-muted">{t('compareWith')}</span><select className="select !w-auto" value={cmp} onChange={e => setCmp(e.target.value)}><option value="">{t('none')}</option>{cfg.cycles.filter(c => c.id !== cy).map(c => <option key={c.id} value={c.id}>{cname(c)}</option>)}</select></label></>} />

      {/* KPI row */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        <div className="card p-4 flex items-center gap-4"><Ring value={readiness} size={84} stroke={9} tone="accent" /><div className="min-w-0"><div className="label">{t('readiness')}</div><div className="text-sm">{t('approved')} <b className="num">{all.approved}</b> {t('of')} <b className="num">{all.total}</b></div>{cmpAll && <div className="text-xs text-muted num">{delta(readiness, cmpAll.total ? cmpAll.approved / cmpAll.total * 100 : 0)} · {cmpName}</div>}</div></div>
        <div className="card p-4 flex items-center gap-4"><Ring value={all.score} size={84} stroke={9} tone={ringTone(all.score)} /><div className="min-w-0"><div className="label">{t('compliance')}</div><div className="text-sm">{t('weightedScore')} · <b className="num">{all.scored}</b> {t('codesCount')}</div>{cmpAll && <div className="text-xs text-muted num">{delta(all.score, cmpAll.score)} · {cmpName}</div>}</div></div>
        <Stat label={t('answered')} value={fmtPct(all.total ? (all.answered / all.total) * 100 : 0)} sub={`${all.answered} ${t('of')} ${all.total} · ${t('submitted')} ${all.submitted}`} icon="tasks" tone="info" />
        <Stat label={t('gaps')} value={all.gaps} sub={`${t('needsClarification')}: ${all.clarifications}`} icon="alert" tone={all.gaps ? 'warn' : 'ok'} />
      </div>

      {/* Pipeline + answers | Trend */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card icon="tasks" title={t('codePipeline')} hint={t('pipelineHint')}>
          <Segmented parts={(['approved', 'submitted', 'returned', 'draft', 'none'] as WorkState[]).map(k => ({ key: k, label: k === 'none' ? t('notStarted') : t(k), value: states[k], color: STATE_COLOR[k] }))} total={master.codes.length} />
          <h3 className="text-sm font-semibold mt-5 mb-2 m-0">{t('answerMix')} <span className="text-muted font-normal num">({rows.length} {t('requirements')})</span></h3>
          <Segmented parts={(['yes', 'partial', 'no', 'unanswered', 'na'] as const).map(k => ({ key: k, label: t(k), value: answers[k], color: ANSWER_COLOR[k] }))} />
        </Card>
        <Card icon="chart" title={t('trend')} hint={trendCycles.length < 2 ? t('noClosedCycles') : undefined}>
          <Trend labels={trendCycles.map(c => c.id)} series={[{ name: t('readiness'), color: 'var(--accent)', values: trend.map(x => x.readiness) }, { name: t('compliance'), color: 'var(--ok)', values: trend.map(x => x.score) }]} />
        </Card>
      </div>

      {/* Score by pillar | Points lost by pillar */}
      <div className="grid lg:grid-cols-5 gap-4 mb-4">
        <Card icon="layers" title={t('scoreByPillar')} hint={t('scoreHint')} className="lg:col-span-3">
          <Bars compareLabel={cmpName} rows={byPillar.map(({ p, r, c }) => ({ key: p.id, prefix: <span className="code-id">{p.id}</span>, label: pick(lang, p), text: `${p.id}. ${pick(lang, p)}`, value: r.score, compare: c ? c.score : null, sub: `${r.approved}/${r.total}`, href: '#/browse?p=' + p.id, tipExtra: <TipRow label={`${t('approved')} / ${t('codes')}`} value={`${r.approved} / ${r.total}`} /> }))} />
        </Card>
        <Card icon="alert" title={t('pointsLost')} hint={t('pointsLostHint')} className="lg:col-span-2">
          <Columns color="var(--info)" height={240} items={lostByPillar.map(({ p, lost }) => ({ key: p.id, label: p.id, value: Math.round(lost), text: `${p.id}. ${pick(lang, p)}` }))} />
        </Card>
      </div>

      {/* Sub-pillar heatmap */}
      <Card icon="grid" title={t('subpillar')} hint={t('heatHint')} right={legend} className="mb-4">
        <Heatmap fill={heat} rows={master.pillars.map(p => ({ key: p.id, label: <><span className="code-id me-2">{p.id}</span>{pick(lang, p)}</>, cells: bySub.filter(x => x.s.pillar === p.id).map(({ s, r }) => ({ key: s.id, label: pick(lang, s), value: r.score, sub: `${r.approved}/${r.total} ${t('approved')}`, href: '#/browse?p=' + p.id })) }))} />
      </Card>

      {/* Department | Project */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card icon="users" title={t('byDepartment')} hint={t('scoreHint')}>
          <Bars rows={byDept.map(({ d, r }) => ({ key: d.id, label: lang === 'ar' ? d.name_ar : d.name_en, text: lang === 'ar' ? d.name_ar : d.name_en, value: r.score, sub: `${r.approved}/${r.total}`, tipExtra: <TipRow label={`${t('approved')} / ${t('codes')}`} value={`${r.approved} / ${r.total}`} /> }))} />
        </Card>
        <Card icon="map" title={t('byProject')} hint={t('scoreHint')}>
          {byProject.length === 0 ? <p className="text-sm text-muted m-0">{t('noItems')}</p> : <Bars rows={byProject.map(({ p, r }) => ({ key: p.id, label: pick(lang, p), text: pick(lang, p), value: r.score, sub: `${r.approved}/${r.total}`, tipExtra: <TipRow label={`${t('approved')} / ${t('codes')}`} value={`${r.approved} / ${r.total}`} /> }))} />}
        </Card>
      </div>

      {/* Impact | Gaps */}
      <div className="grid lg:grid-cols-5 gap-4">
        <Card icon="target" title={t('byImpact')} hint={t('answerMix')} className="lg:col-span-2">
          <Stacked labelW="22%" rows={byImpact} parts={[{ key: 'yes', label: t('yes'), color: ANSWER_COLOR.yes }, { key: 'partial', label: t('partial'), color: ANSWER_COLOR.partial }, { key: 'no', label: t('no'), color: ANSWER_COLOR.no }, { key: 'unanswered', label: t('unanswered'), color: ANSWER_COLOR.unanswered }, { key: 'na', label: t('na'), color: ANSWER_COLOR.na }]} />
        </Card>
        <Card icon="alert" title={<>{t('topGaps')} <span className="text-muted font-normal text-sm num">({gaps.length})</span></>} hint={t('gapsHint')} right={gaps.length > 20 ? <button className="btn btn-ghost btn-sm shrink-0" onClick={() => setAllGaps(v => !v)}>{allGaps ? `${t('showingTop')} 20` : t('viewAll')}</button> : undefined} className="lg:col-span-3 overflow-x-auto">
          {gaps.length === 0 ? <p className="text-sm text-muted m-0">{t('noItems')}</p> : <table className="tbl"><thead><tr><th>{t('code')}</th><th>{t('codeText')}</th><th>{t('impact')}</th><th>{t('score')}</th></tr></thead><tbody>
            {gaps.slice(0, allGaps ? gaps.length : 20).map(({ c, s }) => <tr key={c.id}><td><a className="code-id no-underline" href={'#/code/' + c.id}>{c.id}</a></td><td className="text-sm"><span className="line-clamp-2" title={pickDesc(lang, c)}>{pickDesc(lang, c)}</span></td><td><ImpactPill impact={effectiveImpact(c, cfg)} short /></td><td><span className="flex items-center gap-2"><span className="bar thin w-16"><i className={tone(s) === 'muted' ? '' : tone(s)} style={{ width: `${s}%` }} /></span><span className={`num font-semibold text-${tone(s)}-ink`}>{fmtPct(s)}</span></span></td></tr>)}</tbody></table>}
        </Card>
      </div>
    </div>
  )
}
