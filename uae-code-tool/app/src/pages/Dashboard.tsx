import { useMemo, useState } from 'react'
import { useApp } from '../store/state'
import { master, rollup, effective, codeScore, effectiveImpact, assigneeOf, sortIds } from '../store/scoring'
import { pick, pickDesc } from '../i18n'
import { Bar, ImpactPill, Tile, fmtPct } from '../components/ui'

const tone = (v: number | null) => v === null ? '' : v >= 80 ? 'text-ok' : v >= 50 ? 'text-warn' : 'text-bad'
const heat = (v: number | null) => v === null ? 'var(--surface-2)' : v >= 80 ? 'var(--ok-soft)' : v >= 50 ? 'var(--warn-soft)' : 'var(--bad-soft)'

export default function Dashboard() {
  const { t, lang, snap, cycleId } = useApp(); const cfg = snap!.config; const cy = cycleId!
  const [approvedOnly, setApprovedOnly] = useState(false)
  const [cmp, setCmp] = useState('')
  const all = useMemo(() => rollup(snap!, cy, master.codes, approvedOnly), [snap, cy, approvedOnly])
  const byPillar = useMemo(() => master.pillars.map(p => ({ p, r: rollup(snap!, cy, master.codes.filter(c => c.pillar === p.id), approvedOnly), c: cmp ? rollup(snap!, cmp, master.codes.filter(c => c.pillar === p.id), approvedOnly) : null })), [snap, cy, cmp, approvedOnly])
  const bySub = useMemo(() => master.subpillars.map(s => ({ s, r: rollup(snap!, cy, master.codes.filter(c => c.sub === s.id), approvedOnly) })), [snap, cy, approvedOnly])
  const byUser = useMemo(() => cfg.users.filter(u => u.active).map(u => ({ u, r: rollup(snap!, cy, master.codes.filter(c => assigneeOf(c.id, cy, cfg) === u.id), approvedOnly) })).filter(x => x.r.total), [snap, cy, cfg, approvedOnly])
  const byProject = useMemo(() => cfg.projects.filter(p => p.active).map(p => ({ p, r: rollup(snap!, cy, master.codes.filter(c => (cfg.mapping[c.id] || []).includes(p.id)), approvedOnly) })).filter(x => x.r.total).sort((a, b) => b.r.total - a.r.total), [snap, cy, cfg, approvedOnly])
  const gaps = useMemo(() => master.codes.map(c => ({ c, e: effective(snap!, cy, c.id) })).map(x => ({ ...x, s: codeScore(x.e.answer, x.c, cfg) })).filter(x => x.s !== null && x.s < 100 && (!approvedOnly || x.e.state === 'approved'))
    .sort((a, b) => { const w = cfg.settings.weights; const d = w[effectiveImpact(b.c, cfg)] - w[effectiveImpact(a.c, cfg)]; return d || (a.s! - b.s!) || sortIds(a.c.id, b.c.id) }), [snap, cy, cfg, approvedOnly])
  const cmpAll = cmp ? rollup(snap!, cmp, master.codes, approvedOnly) : null
  const delta = (a: number | null, b: number | null) => a === null || b === null ? '' : (a - b >= 0 ? '+' : '') + Math.round(a - b)
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold m-0">{t('dashboard')}</h1>
        <div className="seg ms-auto"><button aria-pressed={!approvedOnly} onClick={() => setApprovedOnly(false)}>{t('allAnswered')}</button><button aria-pressed={approvedOnly} onClick={() => setApprovedOnly(true)}>{t('approvedOnly')}</button></div>
        <select className="select !w-auto" value={cmp} onChange={e => setCmp(e.target.value)}><option value="">vs —</option>{cfg.cycles.filter(c => c.id !== cy).map(c => <option key={c.id} value={c.id}>vs {c.name}</option>)}</select>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label={t('readiness')} value={fmtPct(all.total ? (all.approved / all.total) * 100 : 0)} sub={`${t('approved')} ${all.approved} / ${all.total}${cmpAll ? ` · ${delta((all.approved / all.total) * 100, (cmpAll.approved / cmpAll.total) * 100)}` : ''}`} tone="accent" />
        <Tile label={t('answered')} value={fmtPct(all.total ? (all.answered / all.total) * 100 : 0)} sub={`${all.answered} ${t('of')} ${all.total} · ${t('submitted')} ${all.submitted}`} />
        <Tile label={t('compliance')} value={<span className={tone(all.score)}>{fmtPct(all.score)}</span>} sub={`${t('weightedScore')} · ${all.scored} ${t('codes')}${cmpAll ? ` · ${delta(all.score, cmpAll.score)}` : ''}`} />
        <Tile label={t('gaps')} value={all.gaps} sub={`${t('needsClarification')}: ${all.clarifications}`} tone={all.gaps ? 'warn' : 'ok'} />
      </div>
      <section className="card p-4"><h2 className="text-base font-semibold m-0 mb-3">{t('byPillar')}</h2>
        <div className="grid gap-2">{byPillar.map(({ p, r, c }) => <div key={p.id} className="grid grid-cols-[2.5rem_1fr_6rem_5rem_4rem] md:grid-cols-[2.5rem_1fr_10rem_6rem_6rem_5rem] items-center gap-2 text-sm">
          <span className="code-id">{p.id}</span><span className="truncate">{pick(lang, p)}</span><span className="hidden md:block"><Bar value={r.approved} max={r.total} /></span><span className="num text-muted">{r.approved}/{r.total}</span><span className={`num font-semibold ${tone(r.score)}`}>{fmtPct(r.score)}</span><span className="num text-muted text-xs">{c ? delta(r.score, c.score) : ''}</span></div>)}</div></section>
      <section className="card p-4"><h2 className="text-base font-semibold m-0 mb-3">{t('subpillar')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">{bySub.map(({ s, r }) => <div key={s.id} className="rounded p-2 text-xs" style={{ background: heat(r.score) }}><div className="flex justify-between"><span className="code-id">{s.id}</span><span className={`num font-semibold ${tone(r.score)}`}>{fmtPct(r.score)}</span></div><div className="truncate" title={pick(lang, s)}>{pick(lang, s)}</div><div className="text-muted num">{r.approved}/{r.total} {t('approved')}</div></div>)}</div></section>
      <div className="grid md:grid-cols-2 gap-4">
        <section className="card p-4"><h2 className="text-base font-semibold m-0 mb-2">{t('byEvaluator')}</h2><table className="tbl"><thead><tr><th></th><th>{t('codes')}</th><th>{t('answered')}</th><th>{t('approved')}</th><th>?</th><th>{t('compliance')}</th></tr></thead><tbody>
          {byUser.map(({ u, r }) => <tr key={u.id}><td>{lang === 'ar' ? u.name_ar : u.name_en}</td><td className="num">{r.total}</td><td className="num">{r.answered}</td><td className="num">{r.approved}</td><td className="num">{r.clarifications || ''}</td><td className={`num ${tone(r.score)}`}>{fmtPct(r.score)}</td></tr>)}</tbody></table></section>
        <section className="card p-4"><h2 className="text-base font-semibold m-0 mb-2">{t('byProject')}</h2><table className="tbl"><thead><tr><th></th><th>{t('codes')}</th><th>{t('approved')}</th><th>{t('compliance')}</th></tr></thead><tbody>
          {byProject.map(({ p, r }) => <tr key={p.id}><td>{pick(lang, p)}</td><td className="num">{r.total}</td><td className="num">{r.approved}</td><td className={`num ${tone(r.score)}`}>{fmtPct(r.score)}</td></tr>)}</tbody></table></section>
      </div>
      <section className="card p-4"><h2 className="text-base font-semibold m-0 mb-2">{t('gaps')} <span className="text-muted font-normal text-sm">({gaps.length})</span></h2>
        <table className="tbl"><thead><tr><th>{t('code')}</th><th>{t('requirement')}</th><th>{t('impact')}</th><th>{t('weightedScore')}</th></tr></thead><tbody>
          {gaps.slice(0, 100).map(({ c, s }) => <tr key={c.id}><td><a className="code-id no-underline" href={'#/code/' + c.id}>{c.id}</a></td><td>{pickDesc(lang, c).slice(0, 120)}</td><td><ImpactPill impact={effectiveImpact(c, cfg)} /></td><td className={`num ${tone(s)}`}>{fmtPct(s)}</td></tr>)}</tbody></table></section>
    </div>
  )
}
