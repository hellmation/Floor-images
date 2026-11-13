import { useMemo, useState, type ReactNode } from 'react'
import { useApp } from '../store/state'
import { master, rollup, effective, codeScore, effectiveImpact, sortIds, isComplete, departmentOf, fulfilRows, assigneeOf, evPartsPending, type FulfilRow } from '../store/scoring'
import { pick, pickDesc } from '../i18n'
import { ImpactPill, PageHeader, Ring, fmtPct, tone, ringTone, PrintHeader, Avatar, fmtDay, Pill, CountUp } from '../components/ui'
import { Bars, Columns, Donut, Heatmap, Stacked, Trend, TipRow } from '../components/charts'
import { Icon, type IconName } from '../components/icons'
import type { WorkState, EvidenceStrength } from '../types'

const heat = (v: number | null) => v === null ? 'var(--surface-2)' : v >= 80 ? 'var(--ok-soft)' : v >= 50 ? 'var(--warn-soft)' : 'var(--bad-soft)'
const STATE_COLOR: Record<WorkState, string> = { approved: 'var(--ok)', submitted: 'var(--info)', returned: 'var(--warn)', draft: 'var(--accent)', none: 'var(--line-2)' }
const EV_COLOR: Record<string, string> = { conclusive: 'var(--ok)', editable: 'var(--warn)', unspecified: 'var(--info)', none: 'var(--bad)' }
const ANSWER_COLOR = { yes: 'var(--ok)', partial: 'var(--warn)', no: 'var(--bad)', unanswered: 'var(--line-2)', na: 'color-mix(in srgb, var(--muted) 45%, var(--surface))' }

/** A dashboard card: icon, title, one-line hint, then the chart. */
let cardSeq = 0
function Card({ icon, title, hint, right, children, className = '' }: { icon: IconName; title: ReactNode; hint?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  const delay = Math.min(cardSeq++ % 12, 10) * 50
  return <section className={`card p-5 flex flex-col fade-up ${className}`} style={{ animationDelay: `${delay}ms` }}>
    <div className="flex items-start justify-between gap-3 mb-4"><div className="min-w-0"><h2 className="text-base font-semibold m-0 flex items-center gap-2"><Icon name={icon} className="text-accent-ink" />{title}</h2>{hint && <p className="text-xs text-muted m-0 mt-0.5">{hint}</p>}</div>{right}</div>
    <div className="flex-1 min-w-0">{children}</div>
  </section>
}

export default function Dashboard() {
  const { t, lang, snap, cycleId } = useApp(); const cfg = snap!.config; const cy = cycleId!
  const [approvedOnly, setApprovedOnly] = useState(false)
  const [cmp, setCmp] = useState('')
  const [allGaps, setAllGaps] = useState(false)
  const [mode, setMode] = useState<'count' | 'pct'>('count')
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
  /** Evidence facts per answered requirement (same basis as the fulfilment rows): status, evidence present, strongest evidence type, department. */
  const evFacts = useMemo(() => { const out: { code: string; dept: string | null; status: string | null; hasEv: boolean; strength: EvidenceStrength | 'unspecified' | null }[] = []
    for (const c of master.codes) { const e = effective(snap!, cy, c.id); const a = approvedOnly && e.state !== 'approved' ? null : e.answer; const cd = departmentOf(snap!, cy, c.id)
      for (const r of c.requirements) { const it = a?.items[String(r.n)]; const ev = it?.evidence || []; const st: EvidenceStrength | 'unspecified' | null = ev.length === 0 ? null : ev.some(x => x.strength === 'conclusive') ? 'conclusive' : ev.some(x => x.strength === 'editable') ? 'editable' : 'unspecified'
        out.push({ code: c.id, dept: it?.departmentId || cd, status: it?.status ?? null, hasEv: ev.length > 0, strength: st }) } }
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
  const delta = (a: number | null, b: number | null) => a === null || b === null ? '' : '‎' + (a - b >= 0 ? '+' : '') + Math.round(a - b)
  const cname = (c: { name: string; name_en?: string }) => lang === 'ar' ? c.name : (c.name_en || c.name)
  const cmpName = cmp ? cname(cfg.cycles.find(c => c.id === cmp) || { name: cmp }) : ''
  const readiness = all.total ? (all.approved / all.total) * 100 : 0
  const legend = <span className="flex items-center gap-3 text-xs text-muted shrink-0"><span className="flex items-center gap-1"><i className="chart-swatch" style={{ background: 'var(--ok-soft)' }} />≥80</span><span className="flex items-center gap-1"><i className="chart-swatch" style={{ background: 'var(--warn-soft)' }} />50–79</span><span className="flex items-center gap-1"><i className="chart-swatch" style={{ background: 'var(--bad-soft)' }} />&lt;50</span></span>

  /* ---------- project-manager view: time, actions, people, risks ---------- */
  const DAY = 86400000, now = Date.now()
  const cycle = cfg.cycles.find(c => c.id === cy)
  const effs = useMemo(() => master.codes.map(c => ({ c, e: effective(snap!, cy, c.id), who: assigneeOf(c.id, cy, cfg), imp: effectiveImpact(c, cfg) })), [snap, cy, cfg])
  const daysLeft = cycle ? Math.ceil((new Date(cycle.due).getTime() - now) / DAY) : null
  const workdaysLeft = useMemo(() => { if (!cycle) return 0; let n = 0; const d = new Date(); d.setHours(12, 0, 0, 0); const due = new Date(cycle.due); for (let i = 0; i < 400; i++) { d.setDate(d.getDate() + 1); if (d > due) break; const wd = d.getDay(); if (wd !== 5 && wd !== 6) n++ } return n }, [cycle])
  const remaining = effs.filter(x => x.e.state !== 'approved').length
  const needPerDay = workdaysLeft > 0 ? remaining / workdaysLeft : remaining
  const recent7 = effs.filter(x => x.e.answer && x.e.state !== 'none' && x.e.state !== 'draft' && new Date(x.e.answer.submittedAt || x.e.answer.updatedAt).getTime() > now - 7 * DAY).length
  const recentPerDay = recent7 / 5
  const paceTone: 'ok' | 'warn' | 'bad' = remaining === 0 ? 'ok' : daysLeft !== null && daysLeft < 0 ? 'bad' : recentPerDay >= needPerDay * 0.9 ? 'ok' : recentPerDay >= needPerDay * 0.5 ? 'warn' : 'bad'
  const ageDays = (iso?: string | null) => iso ? Math.max(0, Math.floor((now - new Date(iso).getTime()) / DAY)) : 0
  const awaiting = effs.filter(x => x.e.state === 'submitted').map(x => ({ ...x, age: ageDays(x.e.answer?.submittedAt || x.e.answer?.updatedAt) }))
  const returnedP = effs.filter(x => x.e.state === 'returned').map(x => ({ ...x, age: ageDays(x.e.review?.reviewedAt) }))
  const openClar = effs.reduce((n, x) => n + Object.entries(x.e.answer?.items || {}).filter(([k, it]) => it.clarify?.flag && !snap!.reviews.clarifications?.[cy]?.[x.c.id]?.[k]?.answer).length, 0)
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
      <PageHeader title={t('dashboard')} sub={t('overview')} actions={<>
        <button className="btn btn-sm" onClick={() => window.print()}><Icon name="download" />{t('printReport')}</button>
        <div className="seg"><button aria-pressed={!approvedOnly} onClick={() => setApprovedOnly(false)}>{t('allAnswered')}</button><button aria-pressed={approvedOnly} onClick={() => setApprovedOnly(true)}>{t('approvedOnly')}</button></div>
        <label className="flex items-center gap-1 text-sm"><span className="text-muted">{t('compareWith')}</span><select className="select !w-auto" value={cmp} onChange={e => setCmp(e.target.value)}><option value="">{t('none')}</option>{cfg.cycles.filter(c => c.id !== cy).map(c => <option key={c.id} value={c.id}>{cname(c)}</option>)}</select></label></>} />

      {/* 1. Where we stand */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        <div className="card p-5 flex items-center gap-4 fade-up"><Ring value={readiness} size={84} stroke={9} tone="accent" /><div className="min-w-0"><div className="label">{t('readiness')}</div><div className="text-sm">{t('approved')} <b className="num">{all.approved}</b> {t('of')} <b className="num">{all.total}</b></div><div className="text-xs text-muted num">{t('submitted')} {all.submitted - all.approved} · {t('remaining')} {remaining}{cmpAll ? ` · ${delta(readiness, cmpAll.total ? cmpAll.approved / cmpAll.total * 100 : 0)} ${cmpName}` : ''}</div></div></div>
        <div className="card p-5 flex items-center gap-4 fade-up" style={{ animationDelay: '50ms' }}><Ring value={all.score} size={84} stroke={9} tone={ringTone(all.score)} /><div className="min-w-0"><div className="label">{t('compliance')}</div><div className="text-sm">{t('weightedScore')} · <b className="num">{all.scored}</b> {t('codesCount')}</div><div className="text-xs text-muted num">{t('gaps')} {all.gaps}{cmpAll ? ` · ${delta(all.score, cmpAll.score)} ${cmpName}` : ''}</div></div></div>
        <div className="card p-5 flex items-start gap-3 fade-up" style={{ animationDelay: '100ms' }}><span className={`inline-grid place-items-center w-10 h-10 rounded-lg shrink-0 bg-${paceTone}-soft text-${paceTone}-ink`}><Icon name="clock" /></span>
          <div className="min-w-0 flex-1"><div className="label !mb-0">{t('timeline')}</div><div className="kpi-value num leading-tight">{daysLeft === null ? '—' : daysLeft < 0 ? t('overdue') : <><CountUp value={daysLeft} /> <span className="text-sm font-normal text-muted">{t('daysUnit')}</span></>}</div>
            <div className="text-xs text-muted mt-0.5">{cycle && <>{t('dueOn')} {fmtDay(cycle.due, lang)} · {workdaysLeft} {t('workdayUnit')}</>}</div>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs"><span className="shrink-0"><Pill kind={paceTone}>{remaining === 0 ? t('allCaughtUp') : paceTone === 'ok' ? t('onTrack') : paceTone === 'warn' ? t('atRisk') : t('behind')}</Pill></span><span className="text-muted num">{t('neededPerDay')} {needPerDay.toFixed(1)} · {t('last7')} {recent7}</span></div></div></div>
        <div className="card p-5 fade-up" style={{ animationDelay: '150ms' }}><div className="label">{t('actionRequired')}</div>
          <div className="flex flex-col gap-1.5 mt-1">
            {[{ n: awaiting.length, label: t('awaitingReview'), sub: awaiting.length ? `${t('oldestWaiting')} ${oldest(awaiting)} ${t('daysUnit')}` : '', href: '#/review', k: 'info' as const }, { n: openClar, label: t('openClarifications'), sub: '', href: '#/review?tab=clar', k: 'flag' as const }, { n: returnedP.length, label: t('returnedPending'), sub: returnedP.length ? `${t('oldestWaiting')} ${oldest(returnedP)} ${t('daysUnit')}` : '', href: '#/browse?st=returned', k: 'warn' as const }].map(a =>
              <a key={a.label} href={a.href} className={`flex items-center gap-3 no-underline rounded-lg px-2 py-1.5 -mx-2 hover:bg-surface-2 ${a.n ? 'text-fg' : 'text-muted'}`}><span className={`num text-xl font-bold w-10 text-center rounded-md ${a.n ? `bg-${a.k}-soft text-${a.k}-ink` : 'bg-surface-2'}`}>{a.n}</span><span className="min-w-0 flex-1"><span className="block text-sm font-medium truncate">{a.label}</span>{a.sub && <span className="block text-xs text-muted">{a.sub}</span>}</span><Icon name={lang === 'ar' ? 'chevronL' : 'chevronR'} className="text-muted shrink-0" /></a>)}
            {awaiting.length + openClar + returnedP.length === 0 && <div className="text-xs text-ok-ink">{t('nothingPending')}</div>}
          </div></div>
      </div>

      {/* 2. Performance per department */}
        <Card icon="users" title={t('perfByDept')} hint={t('scoreHint')} className="mb-4">
          <Bars rows={byDept.map(({ d, r }) => ({ key: d.id, label: lang === 'ar' ? d.name_ar : d.name_en, text: lang === 'ar' ? d.name_ar : d.name_en, value: r.score, sub: `${r.approved}/${r.total}`, tipExtra: <TipRow label={`${t('approved')} / ${t('codes')}`} value={`${r.approved} / ${r.total}`} /> }))} />
        </Card>
      {/* 3. Performance per evaluator */}
      <Card icon="users" title={t('perfByEvaluator')} hint={t('teamHint')} className="mb-4 overflow-x-auto">
        <table className="tbl"><thead><tr><th>{t('evaluator')}</th><th>{t('codes')}</th><th>{t('score')}</th><th>{t('notStarted')}</th><th>{t('draft')}</th><th>{t('returned')}</th><th>{t('awaitingReview')}</th><th>{t('approved')}</th><th>{t('evQTab')}</th><th className="min-w-44">{t('progress')}</th><th>{t('lastActivity')}</th></tr></thead>
          <tbody>{team.map(r => { const done = r.submitted + r.approved; const pct = r.assigned ? done / r.assigned * 100 : 0
            return <tr key={r.u.id}><td><a href={'#/browse?who=' + r.u.id} className="flex items-center gap-2 no-underline text-fg font-medium"><Avatar name={uname(r.u)} photo={r.u.photo} />{uname(r.u)}</a></td><td className="num">{r.assigned}</td><td className={`num font-bold text-${tone(r.score)}-ink`}>{fmtPct(r.score)}</td><td className="num text-muted">{r.none}</td><td className="num text-accent-ink">{r.draft}</td><td className={`num ${r.returned ? 'text-warn-ink font-semibold' : 'text-muted'}`}>{r.returned}</td><td className={`num ${r.submitted ? 'text-info-ink font-semibold' : 'text-muted'}`}>{r.submitted}</td><td className="num text-ok-ink font-semibold">{r.approved}</td><td className={`num ${r.evq ? 'text-warn-ink font-semibold' : 'text-muted'}`}>{r.evq}</td>
              <td><span className="flex items-center gap-2"><span className="flex flex-1 h-2 rounded overflow-hidden bg-surface-3" style={{ gap: 1 }}>{(['approved', 'submitted', 'returned', 'draft'] as WorkState[]).map(k => r[k] > 0 && <i key={k} style={{ width: `${r[k] / r.assigned * 100}%`, background: STATE_COLOR[k] }} />)}</span><b className={`num text-sm text-${tone(pct)}-ink`}>{fmtPct(pct)}</b></span></td>
              <td className="text-xs text-muted whitespace-nowrap">{r.last ? `${fmtDay(r.last, lang)} · ${ageDays(r.last)} ${t('daysUnit')}` : '—'}</td></tr> })}</tbody></table>
      </Card>

      {/* 4. Everything else */}
      <div className="grid lg:grid-cols-5 gap-4 mb-4">
        <Card icon="tasks" title={t('codePipeline')} hint={t('pipelineHint')} className="lg:col-span-2">
          <Donut parts={(['approved', 'submitted', 'returned', 'draft', 'none'] as WorkState[]).map(k => ({ key: k, label: k === 'none' ? t('notStarted') : t(k), value: states[k], color: STATE_COLOR[k] }))} total={master.codes.length} center={[fmtPct(readiness), t('readiness')]} />
        </Card>
        <Card icon="layers" title={t('scoreByPillar')} hint={t('scoreHint')} className="lg:col-span-3">
          <Bars compareLabel={cmpName} rows={byPillar.map(({ p, r, c }) => ({ key: p.id, prefix: <span className="code-id">{p.id}</span>, label: pick(lang, p), text: `${p.id}. ${pick(lang, p)}`, value: r.score, compare: c ? c.score : null, sub: `${r.approved}/${r.total}`, href: '#/browse?p=' + p.id, tipExtra: <TipRow label={`${t('approved')} / ${t('codes')}`} value={`${r.approved} / ${r.total}`} /> }))} />
        </Card>
      </div>
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
      <details className="card p-5 mt-6 group">
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
          <Card icon="alert" title={<>{t('topGaps')} <span className="text-muted font-normal text-sm num">({gaps.length})</span></>} hint={t('gapsHint')} right={gaps.length > 20 ? <button className="btn btn-ghost btn-sm shrink-0" onClick={() => setAllGaps(v => !v)}>{allGaps ? `${t('showingTop')} 20` : t('viewAll')}</button> : undefined} className="overflow-x-auto">
            {gaps.length === 0 ? <p className="text-sm text-muted m-0">{t('noItems')}</p> : <table className="tbl"><thead><tr><th>{t('code')}</th><th>{t('codeText')}</th><th>{t('impact')}</th><th>{t('score')}</th></tr></thead><tbody>
              {gaps.slice(0, allGaps ? gaps.length : 20).map(({ c, s }) => <tr key={c.id}><td><a className="code-id no-underline" href={'#/code/' + c.id}>{c.id}</a></td><td className="text-sm"><span className="line-clamp-2" title={pickDesc(lang, c)}>{pickDesc(lang, c)}</span></td><td><ImpactPill impact={effectiveImpact(c, cfg)} short /></td><td><span className="flex items-center gap-2"><span className="bar thin w-16"><i className={tone(s) === 'muted' ? '' : tone(s)} style={{ width: `${s}%` }} /></span><span className={`num font-semibold text-${tone(s)}-ink`}>{fmtPct(s)}</span></span></td></tr>)}</tbody></table>}
          </Card>
        </div>
      </details>
    </div>
  )
}
