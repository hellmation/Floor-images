import { useMemo, type ReactNode } from 'react'
import { FilterChip } from '../components/filters'
import { useViewState } from '../store/viewState'
import { useApp } from '../store/state'
import { master, rollup, effective, codeScore, effectiveImpact, sortIds, isComplete, departmentOf, resolveDept, clarStatus, workdaysUntil, fulfilRows, fulfilSum, assigneeOf, evPartsPending, type FulfilRow } from '../store/scoring'
import { pick, pickDesc } from '../i18n'
import { ImpactPill, PageHeader, fmtPct, tone, PrintHeader, Avatar, fmtDay, Pill, CountUp, RefreshButton } from '../components/ui'
import { Bars, Columns, Donut, Heatmap, Stacked, Trend, TipRow, STATE_COLOR, Ring } from '../components/charts'
import { Icon, type IconName } from '../components/icons'
import type { WorkState, EvidenceStrength, Code } from '../types'

const heat = (v: number | null) => v === null ? 'var(--surface-2)' : v >= 80 ? 'var(--ok-soft)' : v >= 50 ? 'var(--warn-soft)' : 'var(--bad-soft)'
const EV_COLOR: Record<string, string> = { conclusive: 'var(--ok)', editable: 'var(--warn)', unspecified: 'var(--info)', none: 'var(--bad)' }
const ANSWER_COLOR = { yes: 'var(--ok)', partial: 'var(--warn)', no: 'var(--bad)', unanswered: 'var(--line-2)', na: 'color-mix(in srgb, var(--muted) 45%, var(--surface))' }

/** A dashboard card: icon, title, one-line hint, then the chart. */
let cardSeq = 0
function Card({ icon, title, hint, right, children, className = '' }: { icon: IconName; title: ReactNode; hint?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  const delay = Math.min(cardSeq++ % 12, 10) * 50
  return <section className={`card pad flex flex-col fade-up ${className}`} style={{ animationDelay: `${delay}ms` }}>
    <div className="flex items-start justify-between gap-3 mb-4"><div className="min-w-0"><h2 className="card-title"><Icon name={icon} className="text-accent-ink" />{title}</h2>{hint && <p className="card-hint">{hint}</p>}</div>{right}</div>
    <div className="flex-1 min-w-0">{children}</div>
  </section>
}

export default function Dashboard() {
  const { t, lang, snap, cycleId, isAdmin } = useApp(); const cfg = snap!.config; const cy = cycleId!
  const [vs, setVs] = useViewState('dashboard', { approvedOnly: false, cmp: '', allGaps: false, mode: 'count' as 'count' | 'pct', more: false }); const { approvedOnly, cmp, allGaps, mode } = vs
  const setApprovedOnly = (v: boolean) => setVs({ approvedOnly: v }), setCmp = (v: string) => setVs({ cmp: v }), setAllGaps = (v: boolean) => setVs({ allGaps: v }), setMode = (v: 'count' | 'pct') => setVs({ mode: v })
  const all = useMemo(() => rollup(snap!, cy, master.codes, approvedOnly), [snap, cy, approvedOnly])
  const cmpAll = useMemo(() => cmp ? rollup(snap!, cmp, master.codes, approvedOnly) : null, [snap, cmp, approvedOnly])
  const rows = useMemo(() => fulfilRows(snap!, cy, approvedOnly), [snap, cy, approvedOnly])
  const states = useMemo(() => { const m: Record<WorkState, number> = { approved: 0, submitted: 0, returned: 0, draft: 0, none: 0 }; for (const c of master.codes) m[effective(snap!, cy, c.id).state]++; return m }, [snap, cy])
  const answers = useMemo(() => { const m = { yes: 0, partial: 0, no: 0, unanswered: 0, na: 0 }; for (const r of rows) { if (r.status === 'na') m.na++; else if (r.status) m[r.status]++; else m.unanswered++ } return m }, [rows])
  const byPillar = useMemo(() => master.pillars.map(p => ({ p, r: rollup(snap!, cy, master.codes.filter(c => c.pillar === p.id), approvedOnly), c: cmp ? rollup(snap!, cmp, master.codes.filter(c => c.pillar === p.id), approvedOnly) : null })), [snap, cy, cmp, approvedOnly])
  const lostByPillar = useMemo(() => master.pillars.map(p => ({ p, lost: rows.filter(r => r.code.pillar === p.id && (r.status === 'no' || r.status === 'partial')).reduce((a, r) => a + (r.pts - r.earned), 0) })), [rows])
  const bySub = useMemo(() => master.subpillars.map(s => ({ s, r: rollup(snap!, cy, master.codes.filter(c => c.sub === s.id), approvedOnly) })), [snap, cy, approvedOnly])
  const byProject = useMemo(() => cfg.projects.filter(p => p.active).map(p => ({ p, r: rollup(snap!, cy, master.codes.filter(c => (cfg.mapping[c.id] || []).includes(p.id)), approvedOnly) })).filter(x => x.r.total).sort((a, b) => (b.r.score ?? -1) - (a.r.score ?? -1) || b.r.total - a.r.total), [snap, cy, cfg, approvedOnly])
  const byImpact = useMemo(() => (['high', 'medium', 'low'] as const).map(k => { const rs = rows.filter(r => effectiveImpact(r.code, cfg) === k); const v = (f: (r: FulfilRow) => boolean) => rs.filter(f).length; return { key: k, label: t(k), text: `${t(k)} · ${rs.length} ${t('requirements')}`, values: { yes: v(r => r.status === 'yes'), partial: v(r => r.status === 'partial'), no: v(r => r.status === 'no'), unanswered: v(r => !r.status), na: v(r => r.status === 'na') } } }), [rows, cfg, t])
  /** Evidence facts per answered requirement (same basis as the fulfilment rows): status, evidence present, strongest evidence type, department. */
  const evFacts = useMemo(() => { const out: { code: string; dept: string | null; status: string | null; hasEv: boolean; strength: EvidenceStrength | 'unspecified' | null }[] = []
    for (const c of master.codes) { const e = effective(snap!, cy, c.id); const a = approvedOnly && e.state !== 'approved' ? null : e.answer; const cd = departmentOf(snap!, cy, c.id)
      for (const r of c.requirements) { const it = a?.items[String(r.n)]; const ev = it?.evidence || []; const st: EvidenceStrength | 'unspecified' | null = ev.length === 0 ? null : ev.some(x => x.strength === 'conclusive') ? 'conclusive' : ev.some(x => x.strength === 'editable') ? 'editable' : 'unspecified'
        out.push({ code: c.id, dept: resolveDept(cfg, it?.departmentId) || cd, status: it?.status ?? null, hasEv: ev.length > 0, strength: st }) } }
    return out }, [snap, cy, approvedOnly])
  const answered = evFacts.filter(f => f.status && f.status !== 'na')
  const evMix = { conclusive: answered.filter(f => f.strength === 'conclusive').length, editable: answered.filter(f => f.strength === 'editable').length, unspecified: answered.filter(f => f.strength === 'unspecified').length, none: answered.filter(f => !f.hasEv).length }
  const codeEv = useMemo(() => { const m = new Map<string, { dept: string | null; answered: boolean; hasEv: boolean }>(); for (const f of evFacts) { const x = m.get(f.code) || { dept: departmentOf(snap!, cy, f.code), answered: false, hasEv: false }; if (f.status) x.answered = true; if (f.hasEv) x.hasEv = true; m.set(f.code, x) } return [...m.values()] }, [evFacts, snap, cy])
  const codesAnswered = codeEv.filter(x => x.answered), codesWithEv = codesAnswered.filter(x => x.hasEv)
  const deptName2 = (id: string | null) => { const d = cfg.departments.find(x => x.id === id); return d ? (lang === 'ar' ? d.name_ar : d.name_en) : t('noDept') }
  const deptAnswers = useMemo(() => { const m = new Map<string, { codes: Set<string>; yes: number; partial: number; no: number; na: number; unanswered: number }>()
    for (const r of rows) { const k = r.dept || '_none'; const x = m.get(k) || { codes: new Set<string>(), yes: 0, partial: 0, no: 0, na: 0, unanswered: 0 }; x.codes.add(r.code.id); if (r.status === 'na') x.na++; else if (r.status) x[r.status]++; else x.unanswered++; m.set(k, x) }
    return [...m.entries()].map(([k, x]) => ({ key: k, label: `${deptName2(k === '_none' ? null : k)} · ${x.codes.size} ${t('codesN')}`, text: `${deptName2(k === '_none' ? null : k)} · ${x.codes.size} ${t('codesN')}`, values: { yes: x.yes, partial: x.partial, no: x.no, unanswered: x.unanswered, na: x.na } })).sort((a, b) => Object.values(b.values).reduce((p, q) => p + q, 0) - Object.values(a.values).reduce((p, q) => p + q, 0)) }, [rows, cfg, lang, t]) // eslint-disable-line react-hooks/exhaustive-deps
  const deptEvidence = useMemo(() => { const m = new Map<string, { with: number; without: number }>(); for (const x of codesAnswered) { const k = x.dept || '_none'; const y = m.get(k) || { with: 0, without: 0 }; if (x.hasEv) y.with++; else y.without++; m.set(k, y) }
    return [...m.entries()].map(([k, y]) => ({ key: k, label: deptName2(k === '_none' ? null : k), text: deptName2(k === '_none' ? null : k), values: { with: y.with, without: y.without } })).sort((a, b) => (b.values.with + b.values.without) - (a.values.with + a.values.without)) }, [codesAnswered, cfg, lang]) // eslint-disable-line react-hooks/exhaustive-deps
  const gaps = useMemo(() => master.codes.map(c => ({ c, e: effective(snap!, cy, c.id) })).map(x => ({ ...x, s: codeScore(x.e.answer, x.c, cfg) })).filter(x => x.s !== null && x.s < 100 && (approvedOnly ? x.e.state === 'approved' : isComplete(x.e.answer, x.c)))
    .sort((a, b) => { const w = cfg.settings.weights; return (w[effectiveImpact(b.c, cfg)] - w[effectiveImpact(a.c, cfg)]) || (a.s! - b.s!) || sortIds(a.c.id, b.c.id) }), [snap, cy, cfg, approvedOnly])
  const trendCycles = useMemo(() => cfg.cycles.filter(c => c.status === 'closed' || c.id === cy).sort((a, b) => a.start.localeCompare(b.start)), [cfg, cy])
  const trend = useMemo(() => trendCycles.map(c => { const r = rollup(snap!, c.id, master.codes, true); return { readiness: r.total ? r.approved / r.total * 100 : 0, score: r.score } }), [trendCycles, snap])
  const cname = (c: { name: string; name_en?: string }) => lang === 'ar' ? c.name : (c.name_en || c.name)
  const cmpName = cmp ? cname(cfg.cycles.find(c => c.id === cmp) || { name: cmp }) : ''
  const readiness = all.total ? (all.approved / all.total) * 100 : 0
  /* ---------- results: the whole Code first, then by department, then by pillar ----------
     "overall" = over every code (an approved code counts with its result, any other code as zero);
     "assessed" = over what has been assessed so far, following the all-answered / approved-only switch. */
  const assessedF = (rs: FulfilRow[]) => { let e = 0, p = 0; for (const r of rs) if (r.status && r.status !== 'na') { e += r.earned; p += r.pts } return p ? e / p * 100 : null }
  const fOverall = useMemo(() => fulfilSum(fulfilRows(snap!, cy, true)), [snap, cy])
  const fCmp = useMemo(() => cmp ? fulfilSum(fulfilRows(snap!, cmp, true)) : null, [snap, cmp])
  const fAssessed = assessedF(rows)
  /* where the 371 codes stand, with their requirements: done = approved; in progress = draft, submitted or returned; not started */
  const stage = useMemo(() => { const z = () => ({ codes: 0, reqs: 0 }); const m = { done: z(), progress: z(), pending: z() }
    for (const c of master.codes) { const st = effective(snap!, cy, c.id).state; const g = st === 'approved' ? m.done : st === 'none' ? m.pending : m.progress; g.codes++; g.reqs += c.requirements.length }
    return m }, [snap, cy])
  const ptsLost = rows.reduce((n, r) => n + (r.status === 'no' || r.status === 'partial' ? r.pts - r.earned : 0), 0)
  const resultOf = (codes: Code[]) => ({ r: rollup(snap!, cy, codes, approvedOnly), fo: fulfilSum(fulfilRows(snap!, cy, true, codes)).pct, fa: assessedF(fulfilRows(snap!, cy, approvedOnly, codes)) })
  const deptResults = useMemo(() => { const g = new Map<string, Code[]>(); for (const c of master.codes) { const k = departmentOf(snap!, cy, c.id) || '_none'; g.set(k, [...(g.get(k) || []), c]) }
    return [...g.entries()].map(([k, codes]) => ({ key: k, label: deptName2(k === '_none' ? null : k), ...resultOf(codes) }))
      .sort((a, b) => (a.key === '_none' ? 1 : 0) - (b.key === '_none' ? 1 : 0) || (b.r.overall ?? -1) - (a.r.overall ?? -1) || b.r.total - a.r.total) }, [snap, cy, approvedOnly, cfg, lang]) // eslint-disable-line react-hooks/exhaustive-deps
  const pillarResults = useMemo(() => byPillar.map(x => ({ ...x, ...resultOf(master.codes.filter(c => c.pillar === x.p.id)), r: x.r })), [byPillar, snap, cy, approvedOnly]) // eslint-disable-line react-hooks/exhaustive-deps
  const vs2 = (a: number | null, b: number | null | undefined) => b === null || b === undefined || a === null ? null : <span className={`delta num ${a - b >= 0 ? 'up' : 'down'}`} title={cmpName}>{a - b >= 0 ? '▲' : '▼'} {Math.abs(Math.round(a - b))}</span>
  const MiniBar = ({ v, k = 'accent', label }: { v: number | null; k?: string; label?: string }) => <span className="mbar-cell"><span className="mbar"><i style={{ width: `${Math.max(0, Math.min(100, v ?? 0))}%`, background: `var(--${k})` }} /></span><b className="num" dir="ltr">{label ?? fmtPct(v)}</b></span>
  const legend = <span className="flex items-center gap-3 text-xs text-muted shrink-0"><span className="flex items-center gap-1"><i className="chart-swatch" style={{ background: 'var(--ok-soft)' }} />≥80</span><span className="flex items-center gap-1"><i className="chart-swatch" style={{ background: 'var(--warn-soft)' }} />50–79</span><span className="flex items-center gap-1"><i className="chart-swatch" style={{ background: 'var(--bad-soft)' }} />&lt;50</span></span>

  /* ---------- project-manager view: time, actions, people, risks ---------- */
  const DAY = 86400000, now = Date.now()
  const cycle = cfg.cycles.find(c => c.id === cy)
  const effs = useMemo(() => master.codes.map(c => ({ c, e: effective(snap!, cy, c.id), who: assigneeOf(c.id, cy, cfg), imp: effectiveImpact(c, cfg) })), [snap, cy, cfg])
  const daysLeft = cycle ? Math.ceil((new Date(cycle.due).getTime() - now) / DAY) : null
  const workdaysLeft = useMemo(() => cycle ? workdaysUntil(cycle.due, cfg) : 0, [cycle, cfg])
  const remaining = effs.filter(x => x.e.state !== 'approved').length
  const needPerDay = workdaysLeft > 0 ? remaining / workdaysLeft : remaining
  const recent7 = effs.filter(x => x.e.answer && x.e.state !== 'none' && x.e.state !== 'draft' && new Date(x.e.answer.submittedAt || x.e.answer.updatedAt).getTime() > now - 7 * DAY).length
  const recentPerDay = recent7 / 5
  const paceTone: 'ok' | 'warn' | 'bad' = remaining === 0 ? 'ok' : daysLeft !== null && daysLeft < 0 ? 'bad' : recentPerDay >= needPerDay * 0.9 ? 'ok' : recentPerDay >= needPerDay * 0.5 ? 'warn' : 'bad'
  const ageDays = (iso?: string | null) => iso ? Math.max(0, Math.floor((now - new Date(iso).getTime()) / DAY)) : 0
  const awaiting = effs.filter(x => x.e.state === 'submitted').map(x => ({ ...x, age: ageDays(x.e.answer?.submittedAt || x.e.answer?.updatedAt) }))
  const returnedP = effs.filter(x => x.e.state === 'returned').map(x => ({ ...x, age: ageDays(x.e.review?.reviewedAt) }))
  const openClar = effs.reduce((n, x) => n + Object.entries(x.e.answer?.items || {}).filter(([k, it]) => clarStatus(it, snap!.reviews.clarifications?.[cy]?.[x.c.id]?.[k]) === 'pending').length, 0)
  const oldest = (xs: { age: number }[]) => xs.length ? Math.max(...xs.map(x => x.age)) : 0
  const team = useMemo(() => cfg.users.filter(u => u.active).map(u => { const mine = effs.filter(x => x.who === u.id); const n = (st: WorkState) => mine.filter(x => x.e.state === st).length
    const last = mine.reduce((m, x) => x.e.answer && x.e.answer.updatedAt > m ? x.e.answer.updatedAt : m, ''); return { u, assigned: mine.length, none: n('none'), draft: n('draft'), returned: n('returned'), submitted: n('submitted'), approved: n('approved'), score: rollup(snap!, cy, mine.map(x => x.c), approvedOnly).score, evq: mine.filter(x => x.e.state !== 'none' && evPartsPending(x.e.answer) > 0).length, last } })
    .filter(r => r.assigned > 0).sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.assigned - a.assigned), [cfg, effs, snap, cy, approvedOnly])
  const risks = [
    { key: 'high', label: t('riskHighNotStarted'), n: effs.filter(x => x.e.state === 'none' && x.imp === 'high').length, href: '#/browse?st=none&imp=high', tone: 'bad' as const },
    { key: 'evq', label: t('riskEvQ'), n: effs.filter(x => x.e.state !== 'none' && evPartsPending(x.e.answer) > 0).length, href: '#/browse', tone: 'warn' as const },
    { key: 'review', label: t('riskOldReview'), n: awaiting.filter(x => x.age > 3).length, href: '#/review', tone: 'warn' as const },
    { key: 'stale', label: t('riskStale'), n: effs.filter(x => x.e.state === 'draft' && ageDays(x.e.answer?.updatedAt) >= 14).length, href: '#/browse?st=draft', tone: 'warn' as const },
    { key: 'yesnoev', label: t('riskYesNoEv'), n: effs.filter(x => x.e.state === 'draft' || x.e.state === 'returned').reduce((n, x) => n + Object.values(x.e.answer?.items || {}).filter(it => it.status === 'yes' && it.evidence.length === 0).length, 0), href: '#/browse?st=draft', tone: 'warn' as const },
    { key: 'dept', label: t('riskDeptConfirm'), n: effs.filter(x => cfg.deptConfirm?.[x.c.id] && !x.e.answer?.deptConfirmed && x.e.state !== 'approved').length, href: '#/browse', tone: 'info' as const },
  ]
  const uname = (u: { name_ar: string; name_en: string }) => lang === 'ar' ? u.name_ar : u.name_en
  return (
    <div>
      <PrintHeader title={`${t('reportOf')}: ${t('dashboard')}`} sub={cname(cfg.cycles.find(c => c.id === cy) || { name: cy })} />
      <PageHeader eyebrow={t('insights')} title={t('dashboard')} sub={t('overview')} actions={<>
        <RefreshButton /><button className="btn btn-sm" onClick={() => window.print()}><Icon name="download" />{t('printReport')}</button>
        <div className="seg ftabs"><button aria-pressed={!approvedOnly} onClick={() => setApprovedOnly(false)}>{t('allAnswered')}</button><button aria-pressed={approvedOnly} onClick={() => setApprovedOnly(true)}>{t('approvedOnly')}</button></div>
        <FilterChip label={t('compareWith')} icon="calendar" value={cmp} onChange={setCmp}><option value="">{t('none')}</option>{cfg.cycles.filter(c => c.id !== cy).map(c => <option key={c.id} value={c.id}>{cname(c)}</option>)}</FilterChip></>} />

      {/* 1. The whole Code: overall compliance and fulfilment, then their breakdown */}
      <section className="card results-hero fade-up mb-4" aria-labelledby="res-title">
        <div className="results-head"><div className="min-w-0"><div className="eyebrow">{t('resultsEyebrow')}</div><h2 id="res-title" className="sec-title !m-0">{t('resultsTitle')}</h2><p className="card-hint measure">{t('resultsHint')}</p></div>{cmp && <span className="pill pill-muted shrink-0"><Icon name="calendar" style={{ width: 12, height: 12 }} />{t('compareWith')}: {cmpName}</span>}</div>
        <div className="results-grid">
          <div className="hero-kpi"><Ring value={all.overall} size={136} tone="accent" sub={t('overallShort')} />
            <div className="min-w-0"><div className="hero-label">{t('overallCompliance')} {vs2(all.overall, cmpAll?.overall)}</div><div className="hero-sub">{t('overallOn')} <b className="num">{all.total}</b> {t('codesCount')}</div>
              <dl className="hero-dl"><div><dt>{t('evaluatedScore')}</dt><dd className={`num text-${tone(all.score)}-ink`}>{fmtPct(all.score)}</dd></div><div><dt>{t('codesAssessed')}</dt><dd className="num">{all.scored}</dd></div><div><dt>{t('gaps')}</dt><dd className="num">{all.gaps}</dd></div></dl></div></div>
          <div className="hero-kpi"><Ring value={fOverall.pct} size={136} tone="info" sub={t('overallShort')} />
            <div className="min-w-0"><div className="hero-label">{t('overallFulfilment')} {vs2(fOverall.pct, fCmp?.pct)}</div><div className="hero-sub">{t('pointsEarned')} <bdi dir="ltr" className="num"><b>{Math.round(fOverall.earned).toLocaleString('en')}</b> / {Math.round(fOverall.possible).toLocaleString('en')}</bdi></div>
              <dl className="hero-dl"><div><dt>{t('fulfilAssessed')}</dt><dd className={`num text-${tone(fAssessed)}-ink`}>{fmtPct(fAssessed)}</dd></div><div><dt>{t('pointsLostShort')}</dt><dd className="num">{Math.round(ptsLost).toLocaleString('en')}</dd></div><div><dt>{t('requirements')}</dt><dd className="num">{fOverall.counted.toLocaleString('en')}</dd></div></dl></div>
            <div className="hero-status">{([['done', 'ok', '#/browse?st=approved', t('stDone'), t('approved')], ['progress', 'info', '#/browse', t('stInProgress'), `${t('draft')} ${states.draft} · ${t('submitted')} ${states.submitted} · ${t('returned')} ${states.returned}`], ['pending', 'muted', '#/browse?st=none', t('stNotStarted'), t('notStarted')]] as const).map(([k, tn, href, label, sub2]) =>
              <a key={k} href={href} className={`hs hs-${tn}`} title={sub2}><span className="hs-label">{label}</span><span className="hs-n"><span className="num"><CountUp value={stage[k].codes} /></span> <small>{t('codesCount')}</small></span><span className="hs-sub"><span className="num">{stage[k].reqs}</span> {t('reqUnit')}</span><span className="hs-bar"><i style={{ width: `${stage[k].codes / master.codes.length * 100}%` }} /></span></a>)}</div></div>
          <div className="results-side">
            <div><div className="side-row"><span>{t('readiness')}</span><b className="num">{fmtPct(readiness)}</b></div><MiniBar v={readiness} k="ok" label={`${all.approved} / ${all.total}`} /><div className="text-xs text-muted num mt-1">{t('submitted')} {all.submitted - all.approved} · {t('remaining')} {remaining}</div></div>
            <div><div className="side-row"><span>{t('reqAnswers')}</span><b className="num" dir="ltr">{(answers.yes + answers.partial + answers.no + answers.na).toLocaleString('en')} / {(answers.yes + answers.partial + answers.no + answers.na + answers.unanswered).toLocaleString('en')}</b></div>
              <span className="stackbar" aria-hidden="true">{(['yes', 'partial', 'no', 'na', 'unanswered'] as const).map(k => answers[k] > 0 && <i key={k} style={{ flex: answers[k], background: ANSWER_COLOR[k] }} />)}</span>
              <span className="stack-legend">{(['yes', 'partial', 'no', 'na', 'unanswered'] as const).map(k => <span key={k}><i style={{ background: ANSWER_COLOR[k] }} />{t(k)} <b className="num">{answers[k].toLocaleString('en')}</b></span>)}</span></div>
          </div>
        </div>
      </section>

      {/* 2. Results by department */}
      <Card icon="users" title={t('resultsByDept')} hint={t('resultsByDeptHint')} className="mb-4 overflow-x-auto">
        <table className="tbl res-tbl"><thead><tr><th>{t('department')}</th><th className="num">{t('codes')}</th><th>{t('approved')}</th><th>{t('overallCompliance')}</th><th>{t('evaluatedScore')}</th><th>{t('overallFulfilment')}</th></tr></thead>
          <tbody>{deptResults.map(({ key, label, r, fo }) => <tr key={key}><td>{key === '_none' ? <span className="text-muted">{label}</span> : <a className="no-underline text-fg font-medium" href={'#/browse?dep=' + key}>{label}</a>}</td><td className="num">{r.total}</td><td><MiniBar v={r.total ? r.approved / r.total * 100 : 0} k="ok" label={`${r.approved}/${r.total}`} /></td><td><MiniBar v={r.overall} /></td><td className={`num font-semibold text-${tone(r.score)}-ink`}>{fmtPct(r.score)}</td><td><MiniBar v={fo} k="info" /></td></tr>)}</tbody>
          <tfoot><tr><td>{t('total')}</td><td className="num">{all.total}</td><td><MiniBar v={readiness} k="ok" label={`${all.approved}/${all.total}`} /></td><td><MiniBar v={all.overall} /></td><td className={`num text-${tone(all.score)}-ink`}>{fmtPct(all.score)}</td><td><MiniBar v={fOverall.pct} k="info" /></td></tr></tfoot></table>
      </Card>

      {/* 3. Compliance by pillar (the Code's eight sections) */}
      <Card icon="layers" title={t('resultsByPillar')} hint={t('resultsByPillarHint')} className="mb-6">
        <div className="ptiles">{pillarResults.map(({ p, r, c, fo }) => <a key={p.id} href={'#/browse?p=' + p.id} className="ptile">
          <div className="ptile-head"><span className="code-id">{p.id}</span><span className="ptile-name">{pick(lang, p)}</span>{c && vs2(r.overall, c.overall)}</div>
          <div className="ptile-body"><Ring value={r.overall} size={88} tone="accent" sub={t('overallShort')} />
            <dl className="ptile-dl"><div><dt>{t('evaluatedScore')}</dt><dd className={`num text-${tone(r.score)}-ink`}>{fmtPct(r.score)}</dd></div><div><dt>{t('overallFulfilment')}</dt><dd className="num text-info-ink">{fmtPct(fo)}</dd></div><div><dt>{t('approved')}</dt><dd className="num" dir="ltr">{r.approved}/{r.total}</dd></div></dl></div>
          <span className="mbar"><i style={{ width: `${r.total ? r.approved / r.total * 100 : 0}%`, background: 'var(--ok)' }} /></span>
        </a>)}</div>
      </Card>

      {/* 4. How the work is going: pipeline, timeline, actions */}
      <h2 className="sec-title mb-3">{t('workProgress')}</h2>
      <div className="grid lg:grid-cols-3 gap-3 mb-4 items-stretch">
        <Card icon="tasks" title={t('codePipeline')} hint={t('pipelineHint')}>
          <Donut size={150} parts={(['approved', 'submitted', 'returned', 'draft', 'none'] as WorkState[]).map(k => ({ key: k, label: k === 'none' ? t('notStarted') : t(k), value: states[k], color: STATE_COLOR[k] }))} total={master.codes.length} center={[fmtPct(readiness), t('readiness')]} />
        </Card>
        <div className="card p-5 flex items-start gap-3 fade-up" style={{ animationDelay: '100ms' }}><span className={`inline-grid place-items-center w-10 h-10 rounded-lg shrink-0 bg-${paceTone}-soft text-${paceTone}-ink`}><Icon name="clock" /></span>
          <div className="min-w-0 flex-1"><div className="label !mb-0 flex items-center gap-2">{t('timeline')}{isAdmin && <a href="#/admin?tab=settings" className="ms-auto text-xs font-normal normal-case tracking-normal no-print" title={t('timelineEdit')}><Icon name="edit" style={{ width: 12, height: 12 }} /> {t('edit')}</a>}</div><div className="kpi-value num leading-tight">{daysLeft === null ? '—' : daysLeft < 0 ? t('overdue') : <><CountUp value={daysLeft} /> <span className="text-sm font-normal text-muted">{t('daysUnit')}</span></>}</div>
            <div className="text-xs text-muted mt-0.5">{cycle && <>{t('dueOn')} {fmtDay(cycle.due, lang)} · {workdaysLeft} {t('workdayUnit')}</>}</div>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs"><span className="shrink-0"><Pill kind={paceTone}>{remaining === 0 ? t('allCaughtUp') : paceTone === 'ok' ? t('onTrack') : paceTone === 'warn' ? t('atRisk') : t('behind')}</Pill></span><span className="text-muted num">{t('neededPerDay')} {needPerDay.toFixed(1)} · {t('last7')} {recent7}</span></div></div></div>
        <div className="card p-5 fade-up" style={{ animationDelay: '150ms' }}><div className="label">{t('actionRequired')}</div>
          <div className="flex flex-col gap-1.5 mt-1">
            {[{ n: awaiting.length, label: t('awaitingReview'), sub: awaiting.length ? `${t('oldestWaiting')} ${oldest(awaiting)} ${t('daysUnit')}` : '', href: '#/review', k: 'info' as const }, { n: openClar, label: t('openClarifications'), sub: '', href: '#/review?tab=clar', k: 'flag' as const }, { n: returnedP.length, label: t('returnedPending'), sub: returnedP.length ? `${t('oldestWaiting')} ${oldest(returnedP)} ${t('daysUnit')}` : '', href: '#/browse?st=returned', k: 'warn' as const }].map(a =>
              <a key={a.label} href={a.href} className={`flex items-center gap-3 no-underline rounded-lg px-2 py-1.5 -mx-2 hover:bg-surface-2 ${a.n ? 'text-fg' : 'text-muted'}`}><span className={`num text-xl font-bold w-10 text-center rounded-md ${a.n ? `bg-${a.k}-soft text-${a.k}-ink` : 'bg-surface-2'}`}>{a.n}</span><span className="min-w-0 flex-1"><span className="block text-sm font-medium truncate">{a.label}</span>{a.sub && <span className="block text-xs text-muted">{a.sub}</span>}</span><Icon name={lang === 'ar' ? 'chevronL' : 'chevronR'} className="text-muted shrink-0" /></a>)}
            {awaiting.length + openClar + returnedP.length === 0 && <div className="text-xs text-ok-ink">{t('nothingPending')}</div>}
          </div></div>
      </div>

      {/* 5. Performance per evaluator */}
      <Card icon="users" title={t('perfByEvaluator')} hint={t('teamHint')} className="mb-4 overflow-x-auto">
        <table className="tbl"><thead><tr><th>{t('evaluator')}</th><th>{t('codes')}</th><th>{t('score')}</th><th>{t('notStarted')}</th><th>{t('draft')}</th><th>{t('returned')}</th><th>{t('awaitingReview')}</th><th>{t('approved')}</th><th>{t('evQTab')}</th><th className="min-w-44">{t('progress')}</th><th>{t('lastActivity')}</th></tr></thead>
          <tbody>{team.map(r => { const done = r.submitted + r.approved; const pct = r.assigned ? done / r.assigned * 100 : 0
            return <tr key={r.u.id}><td><a href={'#/browse?who=' + r.u.id} className="flex items-center gap-2 no-underline text-fg font-medium"><Avatar name={uname(r.u)} photo={r.u.photo} />{uname(r.u)}</a></td><td className="num">{r.assigned}</td><td className={`num font-bold text-${tone(r.score)}-ink`}>{fmtPct(r.score)}</td><td className="num text-muted">{r.none}</td><td className="num text-accent-ink">{r.draft}</td><td className={`num ${r.returned ? 'text-warn-ink font-semibold' : 'text-muted'}`}>{r.returned}</td><td className={`num ${r.submitted ? 'text-info-ink font-semibold' : 'text-muted'}`}>{r.submitted}</td><td className="num text-ok-ink font-semibold">{r.approved}</td><td className={`num ${r.evq ? 'text-warn-ink font-semibold' : 'text-muted'}`}>{r.evq}</td>
              <td><span className="flex items-center gap-2"><span className="flex flex-1 h-2 rounded overflow-hidden bg-surface-3" style={{ gap: 1 }}>{(['approved', 'submitted', 'returned', 'draft'] as WorkState[]).map(k => r[k] > 0 && <i key={k} style={{ width: `${r[k] / r.assigned * 100}%`, background: STATE_COLOR[k] }} />)}</span><b className={`num text-sm text-${tone(pct)}-ink`}>{fmtPct(pct)}</b></span></td>
              <td className="text-xs text-muted whitespace-nowrap">{r.last ? `${fmtDay(r.last, lang)} · ${ageDays(r.last)} ${t('daysUnit')}` : '—'}</td></tr> })}</tbody></table>
      </Card>

      {/* 6. Everything else */}
      <div className="grid lg:grid-cols-5 gap-4 mb-4">
        <Card icon="alert" title={t('risks')} hint={t('risksHint')} className="lg:col-span-2">
          <div className="flex flex-col gap-1">{risks.map(r => <a key={r.key} href={r.href} className={`flex items-center gap-3 no-underline rounded-lg px-2 py-2 -mx-2 hover:bg-surface-2 ${r.n ? 'text-fg' : 'text-muted'}`}><span className={`num text-lg font-bold w-10 text-center rounded-md ${r.n ? `bg-${r.tone}-soft text-${r.tone}-ink` : 'bg-surface-2'}`}>{r.n}</span><span className="text-sm flex-1 min-w-0">{r.label}</span><Icon name={lang === 'ar' ? 'chevronL' : 'chevronR'} className="text-muted shrink-0" /></a>)}</div>
        </Card>
        <Card icon="alert" title={t('pointsLost')} hint={t('pointsLostHint')} className="lg:col-span-3">
          <Columns color="var(--info)" height={220} items={lostByPillar.map(({ p, lost }) => ({ key: p.id, label: p.id, value: Math.round(lost), text: `${p.id}. ${pick(lang, p)}` }))} />
        </Card>
      </div>
      <Card icon="grid" title={t('subpillar')} hint={t('heatHint')} right={legend} className="mb-4">
        <Heatmap fill={heat} rows={master.pillars.map(p => ({ key: p.id, label: <><span className="code-id me-2">{p.id}</span>{pick(lang, p)}</>, cells: bySub.filter(x => x.s.pillar === p.id).map(({ s, r }) => ({ key: s.id, label: pick(lang, s), value: r.score, sub: `${r.approved}/${r.total} ${t('approved')}`, href: '#/browse?p=' + p.id })) }))} />
      </Card>

      {/* 5. More analytics, collapsed by default */}
      <details className="card pad mt-10 group" open={vs.more} onToggle={e => { const o = (e.currentTarget as HTMLDetailsElement).open; if (o !== vs.more) setVs({ more: o }) }}>
        <summary className="cursor-pointer list-none flex items-center gap-2 select-none"><Icon name="chart" className="text-accent-ink" /><span className="font-semibold">{t('moreAnalytics')}</span><span className="text-xs text-muted hidden sm:inline">· {t('moreAnalyticsHint')}</span><span className="seg ms-auto text-xs" onClick={e => e.preventDefault()}><button aria-pressed={mode === 'count'} onClick={() => setMode('count')}>{t('showCounts')}</button><button aria-pressed={mode === 'pct'} onClick={() => setMode('pct')}>{t('showPct')}</button></span><Icon name="chevronD" className="text-muted transition-transform group-open:rotate-180" /></summary>
        <div className="mt-5 flex flex-col gap-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card icon="chart" title={t('trend')} hint={trendCycles.length < 2 ? t('noClosedCycles') : undefined}>
              <Trend labels={trendCycles.map(c => c.id)} series={[{ name: t('readiness'), color: 'var(--accent)', values: trend.map(x => x.readiness) }, { name: t('compliance'), color: 'var(--ok)', values: trend.map(x => x.score) }]} />
            </Card>
            <Card icon="target" title={t('byImpact')} hint={t('answerMix')}>
              <Stacked mode={mode} labelW="22%" rows={byImpact} parts={[{ key: 'yes', label: t('yes'), color: ANSWER_COLOR.yes }, { key: 'partial', label: t('partial'), color: ANSWER_COLOR.partial }, { key: 'no', label: t('no'), color: ANSWER_COLOR.no }, { key: 'unanswered', label: t('unanswered'), color: ANSWER_COLOR.unanswered }, { key: 'na', label: t('na'), color: ANSWER_COLOR.na }]} />
              <h3 className="text-sm font-semibold mt-5 mb-2 m-0">{t('answerMix')} <span className="text-muted font-normal num">({rows.length} {t('requirements')})</span></h3>
              <Donut size={150} parts={(['yes', 'partial', 'no', 'unanswered', 'na'] as const).map(k => ({ key: k, label: t(k), value: answers[k], color: ANSWER_COLOR[k] }))} center={[String(rows.length), t('requirements')]} />
            </Card>
          </div>
          <Card icon="map" title={t('byProject')} hint={t('scoreHint')}>
            {byProject.length === 0 ? <p className="text-sm text-muted m-0">{t('noItems')}</p> : <Bars rows={byProject.map(({ p, r }) => ({ key: p.id, label: pick(lang, p), text: pick(lang, p), value: r.score, sub: `${r.approved}/${r.total}`, tipExtra: <TipRow label={`${t('approved')} / ${t('codes')}`} value={`${r.approved} / ${r.total}`} /> }))} />}
          </Card>
          <div className="grid lg:grid-cols-5 gap-4">
            <Card icon="users" title={t('answersByDept')} hint={t('answersByDeptHint')} className="lg:col-span-3">
              <Stacked mode={mode} labelW="34%" rows={deptAnswers} parts={[{ key: 'yes', label: t('yes'), color: ANSWER_COLOR.yes }, { key: 'partial', label: t('partial'), color: ANSWER_COLOR.partial }, { key: 'no', label: t('no'), color: ANSWER_COLOR.no }, { key: 'unanswered', label: t('unanswered'), color: ANSWER_COLOR.unanswered }, { key: 'na', label: t('na'), color: ANSWER_COLOR.na }]} />
            </Card>
            <Card icon="link" title={t('evidenceCoverage')} hint={t('evidenceCoverageHint')} className="lg:col-span-2">
              <Donut parts={[{ key: 'conclusive', label: t('strengthConclusiveShort'), value: evMix.conclusive, color: EV_COLOR.conclusive }, { key: 'editable', label: t('strengthEditableShort'), value: evMix.editable, color: EV_COLOR.editable }, { key: 'unspecified', label: t('evUnspecified'), value: evMix.unspecified, color: EV_COLOR.unspecified }, { key: 'none', label: t('withoutEvidence'), value: evMix.none, color: EV_COLOR.none }]} center={[fmtPct(answered.length ? (answered.length - evMix.none) / answered.length * 100 : null), t('withEvidence')]} />
              <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                <div className="panel px-3 py-2"><div className="text-muted text-xs">{t('reqsWithEvidence')}</div><div className="num font-bold text-lg">{answered.length - evMix.none} <span className="text-muted text-sm font-normal">/ {answered.length}</span></div></div>
                <div className="panel px-3 py-2"><div className="text-muted text-xs">{t('codesWithEvidence')}</div><div className="num font-bold text-lg">{codesWithEv.length} <span className="text-muted text-sm font-normal">/ {codesAnswered.length}</span></div></div>
              </div>
            </Card>
          </div>
          <Card icon="link" title={t('evidenceByDept')} hint={t('evidenceByDeptHint')}>
            <Stacked mode={mode} labelW="34%" rows={deptEvidence} parts={[{ key: 'with', label: t('withEvidence'), color: 'var(--ok)' }, { key: 'without', label: t('withoutEvidence'), color: 'var(--bad)' }]} />
          </Card>
          <Card icon="alert" title={<>{t('topGaps')} <span className="text-muted font-normal text-sm num">({gaps.length})</span></>} hint={t('gapsHint')} right={gaps.length > 20 ? <button className="btn btn-ghost btn-sm shrink-0" onClick={() => setAllGaps(!allGaps)}>{allGaps ? `${t('showingTop')} 20` : t('viewAll')}</button> : undefined} className="overflow-x-auto">
            {gaps.length === 0 ? <p className="text-sm text-muted m-0">{t('noItems')}</p> : <table className="tbl"><thead><tr><th>{t('code')}</th><th>{t('codeText')}</th><th>{t('impact')}</th><th>{t('score')}</th></tr></thead><tbody>
              {gaps.slice(0, allGaps ? gaps.length : 20).map(({ c, s }) => <tr key={c.id}><td><a className="code-id no-underline" href={'#/code/' + c.id}>{c.id}</a></td><td className="text-sm"><span className="line-clamp-2" title={pickDesc(lang, c)}>{pickDesc(lang, c)}</span></td><td><ImpactPill impact={effectiveImpact(c, cfg)} short /></td><td><span className="flex items-center gap-2"><span className="bar thin w-16"><i className={tone(s) === 'muted' ? '' : tone(s)} style={{ width: `${s}%` }} /></span><span className={`num font-semibold text-${tone(s)}-ink`}>{fmtPct(s)}</span></span></td></tr>)}</tbody></table>}
          </Card>
        </div>
      </details>
    </div>
  )
}
