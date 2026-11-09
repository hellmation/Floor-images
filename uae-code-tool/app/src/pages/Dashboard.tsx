import { useMemo, useState } from 'react'
import { useApp } from '../store/state'
import { master, rollup, effective, codeScore, effectiveImpact, sortIds, isComplete, departmentOf } from '../store/scoring'
import { pick, pickDesc } from '../i18n'
import { ImpactPill, PageHeader, Ring, Stat, fmtPct, tone, ringTone } from '../components/ui'
import { HBars, Trend } from '../components/charts'
import { Icon } from '../components/icons'

const heat = (v: number | null) => v === null ? 'var(--surface-2)' : v >= 80 ? 'var(--ok-soft)' : v >= 50 ? 'var(--warn-soft)' : 'var(--bad-soft)'

export default function Dashboard() {
  const { t, lang, snap, cycleId } = useApp(); const cfg = snap!.config; const cy = cycleId!
  const [approvedOnly, setApprovedOnly] = useState(false)
  const [cmp, setCmp] = useState('')
  const all = useMemo(() => rollup(snap!, cy, master.codes, approvedOnly), [snap, cy, approvedOnly])
  const cmpAll = useMemo(() => cmp ? rollup(snap!, cmp, master.codes, approvedOnly) : null, [snap, cmp, approvedOnly])
  const byPillar = useMemo(() => master.pillars.map(p => ({ p, r: rollup(snap!, cy, master.codes.filter(c => c.pillar === p.id), approvedOnly), c: cmp ? rollup(snap!, cmp, master.codes.filter(c => c.pillar === p.id), approvedOnly) : null })), [snap, cy, cmp, approvedOnly])
  const bySub = useMemo(() => master.subpillars.map(s => ({ s, r: rollup(snap!, cy, master.codes.filter(c => c.sub === s.id), approvedOnly) })), [snap, cy, approvedOnly])
  const byProject = useMemo(() => cfg.projects.filter(p => p.active).map(p => ({ p, r: rollup(snap!, cy, master.codes.filter(c => (cfg.mapping[c.id] || []).includes(p.id)), approvedOnly) })).filter(x => x.r.total).sort((a, b) => b.r.total - a.r.total), [snap, cy, cfg, approvedOnly])
  const byDept = useMemo(() => cfg.departments.filter(d => d.active).map(d => ({ d, r: rollup(snap!, cy, master.codes.filter(c => departmentOf(snap!, cy, c.id) === d.id), approvedOnly) })).filter(x => x.r.total > 0).sort((a, b) => b.r.total - a.r.total), [cfg, cy, snap, approvedOnly])
  const gaps = useMemo(() => master.codes.map(c => ({ c, e: effective(snap!, cy, c.id) })).map(x => ({ ...x, s: codeScore(x.e.answer, x.c, cfg) })).filter(x => x.s !== null && x.s < 100 && (approvedOnly ? x.e.state === 'approved' : isComplete(x.e.answer, x.c)))
    .sort((a, b) => { const w = cfg.settings.weights; return (w[effectiveImpact(b.c, cfg)] - w[effectiveImpact(a.c, cfg)]) || (a.s! - b.s!) || sortIds(a.c.id, b.c.id) }), [snap, cy, cfg, approvedOnly])
  const trendCycles = useMemo(() => cfg.cycles.filter(c => c.status === 'closed' || c.id === cy).sort((a, b) => a.start.localeCompare(b.start)), [cfg, cy])
  const trend = useMemo(() => trendCycles.map(c => { const r = rollup(snap!, c.id, master.codes, true); return { readiness: r.total ? r.approved / r.total * 100 : 0, score: r.score } }), [trendCycles, snap])
  const delta = (a: number | null, b: number | null) => a === null || b === null ? '' : '\u200e' + (a - b >= 0 ? '+' : '') + Math.round(a - b)
  const cname = (c: { name: string; name_en?: string }) => lang === 'ar' ? c.name : (c.name_en || c.name)
  const readiness = all.total ? (all.approved / all.total) * 100 : 0
  return (
    <div>
      <PageHeader title={t('dashboard')} sub={t('overview')} actions={<>
        <div className="seg"><button aria-pressed={!approvedOnly} onClick={() => setApprovedOnly(false)}>{t('allAnswered')}</button><button aria-pressed={approvedOnly} onClick={() => setApprovedOnly(true)}>{t('approvedOnly')}</button></div>
        <label className="flex items-center gap-1 text-sm"><span className="text-muted">{t('compareWith')}</span><select className="select !w-auto" value={cmp} onChange={e => setCmp(e.target.value)}><option value="">{t('none')}</option>{cfg.cycles.filter(c => c.id !== cy).map(c => <option key={c.id} value={c.id}>{cname(c)}</option>)}</select></label></>} />
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        <div className="card p-4 flex items-center gap-4"><Ring value={readiness} size={84} stroke={9} tone="accent" /><div><div className="label">{t('readiness')}</div><div className="text-sm">{t('approved')} <b className="num">{all.approved}</b> {t('of')} <b className="num">{all.total}</b></div>{cmpAll && <div className="text-xs text-muted num">{delta(readiness, cmpAll.total ? cmpAll.approved / cmpAll.total * 100 : 0)} {t('compareWith')} {cname(cfg.cycles.find(c => c.id === cmp) || { name: cmp })}</div>}</div></div>
        <div className="card p-4 flex items-center gap-4"><Ring value={all.score} size={84} stroke={9} tone={ringTone(all.score)} /><div><div className="label">{t('compliance')}</div><div className="text-sm">{t('weightedScore')} · <b className="num">{all.scored}</b> {t('codesCount')}</div>{cmpAll && <div className="text-xs text-muted num">{delta(all.score, cmpAll.score)}</div>}</div></div>
        <Stat label={t('answered')} value={fmtPct(all.total ? (all.answered / all.total) * 100 : 0)} sub={`${all.answered} ${t('of')} ${all.total} · ${t('submitted')} ${all.submitted}`} icon="tasks" tone="info" />
        <Stat label={t('gaps')} value={all.gaps} sub={`${t('needsClarification')}: ${all.clarifications}`} icon="alert" tone={all.gaps ? 'warn' : 'ok'} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <section className="card p-4"><h2 className="text-base font-semibold m-0 mb-3 flex items-center gap-2"><Icon name="layers" className="text-accent-ink" />{t('byPillar')}</h2>
          <HBars rows={byPillar.map(({ p, r, c }) => ({ key: p.id, prefix: <span className="code-id">{p.id}</span>, label: pick(lang, p), value: r.approved, max: r.total, right: (<><b className={`text-${tone(r.score)}-ink`}>{fmtPct(r.score)}</b><span className="text-muted text-xs block">{r.approved}/{r.total}{c ? ` · ${delta(r.score, c.score)}` : ''}</span></>), href: '#/browse?p=' + p.id }))} /></section>
        <section className="card p-4"><h2 className="text-base font-semibold m-0 mb-1 flex items-center gap-2"><Icon name="chart" className="text-accent-ink" />{t('trend')}</h2>
          {trendCycles.length < 2 ? <p className="text-sm text-muted m-0 mb-2">{t('noClosedCycles')}</p> : null}
          <Trend labels={trendCycles.map(c => c.id)} series={[{ name: t('readiness'), color: 'var(--accent)', values: trend.map(x => x.readiness) }, { name: t('compliance'), color: 'var(--ok)', values: trend.map(x => x.score) }]} />
          <div className="flex gap-4 text-xs text-muted mt-1"><span className="flex items-center gap-1"><i className="inline-block w-3 h-1 rounded bg-accent" />{t('readiness')}</span><span className="flex items-center gap-1"><i className="inline-block w-3 h-1 rounded bg-ok" />{t('compliance')}</span></div></section>
      </div>
      <section className="card p-4 mb-4"><h2 className="text-base font-semibold m-0 mb-1 flex items-center gap-2"><Icon name="grid" className="text-accent-ink" />{t('subpillar')}</h2><p className="text-xs text-muted m-0 mb-3">{t('scoreLegend')}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-2">{bySub.map(({ s, r }) => <a key={s.id} href={'#/browse?p=' + s.pillar} className="heat text-xs" style={{ background: heat(r.score) }}><div className="flex justify-between items-center"><span className="code-id">{s.id}</span><span className={`num font-bold text-${tone(r.score)}-ink`}>{fmtPct(r.score)}</span></div><div className="truncate mt-1" title={pick(lang, s)}>{pick(lang, s)}</div><div className="text-muted num">{r.approved}/{r.total}</div></a>)}</div></section>
      <div className="grid lg:grid-cols-2 gap-4">
        <section className="card p-4"><h2 className="text-base font-semibold m-0 mb-2 flex items-center gap-2"><Icon name="users" className="text-accent-ink" />{t('byDepartment')}</h2>
          <HBars rows={byDept.map(({ d, r }) => ({ key: d.id, label: lang === 'ar' ? d.name_ar : d.name_en, value: r.approved, max: r.total, right: (<><b className={`text-${tone(r.score)}-ink`}>{fmtPct(r.score)}</b><span className="text-muted text-xs block">{r.approved}/{r.total}</span></>) }))} /></section>
        <section className="card p-4"><h2 className="text-base font-semibold m-0 mb-2 flex items-center gap-2"><Icon name="map" className="text-accent-ink" />{t('byProject')}</h2>
          {byProject.length === 0 ? <p className="text-sm text-muted m-0">{t('noItems')}</p> : <HBars rows={byProject.map(({ p, r }) => ({ key: p.id, label: pick(lang, p), value: r.approved, max: r.total, right: (<><b className={`text-${tone(r.score)}-ink`}>{fmtPct(r.score)}</b><span className="text-muted text-xs block">{r.approved}/{r.total}</span></>) }))} />}</section>
        <section className="card p-4 overflow-x-auto"><h2 className="text-base font-semibold m-0 mb-2 flex items-center gap-2"><Icon name="alert" className="text-warn-ink" />{t('gaps')} <span className="text-muted font-normal text-sm num">({gaps.length})</span></h2>
          {gaps.length === 0 ? <p className="text-sm text-muted m-0">{t('noItems')}</p> : <table className="tbl"><thead><tr><th>{t('code')}</th><th>{t('codeText')}</th><th>{t('impact')}</th><th>{t('score')}</th></tr></thead><tbody>
            {gaps.slice(0, 60).map(({ c, s }) => <tr key={c.id}><td><a className="code-id no-underline" href={'#/code/' + c.id}>{c.id}</a></td><td className="text-sm"><span className="line-clamp-2" title={pickDesc(lang, c)}>{pickDesc(lang, c)}</span></td><td><ImpactPill impact={effectiveImpact(c, cfg)} short /></td><td className={`num font-semibold text-${tone(s)}-ink`}>{fmtPct(s)}</td></tr>)}</tbody></table>}</section>
      </div>
    </div>
  )
}
