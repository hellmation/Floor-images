import { useMemo, useState, type ReactNode } from 'react'
import { useApp } from '../store/state'
import { master, fulfilRows, fulfilSum, deptName, pillarById, effective, assigneeOf, departmentOf, evidenceFacts, type FulfilRow, type EvidenceFact } from '../store/scoring'
import { pick } from '../i18n'
import { PageHeader, Ring, Stat, fmtPct, tone, ringTone, useToast, PrintHeader } from '../components/ui'
import { Stacked } from '../components/charts'
import { Icon, type IconName } from '../components/icons'
import type { WorkState } from '../types'

type Kind = 'text' | 'num' | 'pct'
type Col = { key: string; h: string; kind?: Kind; tone?: 'ok' | 'warn' | 'bad' | 'muted' | 'info' | 'pct' }
type GRow = { id: string; label: string; extra?: string; v: Record<string, number | string | null> }
const HEX = { ok: '#1E7A3C', warn: '#9A6A00', bad: '#B42318', muted: '#6B6257', info: '#24496D', text: '#1F2A2E' }
const STATE_COLOR: Record<string, string> = { approved: 'var(--ok)', submitted: 'var(--info)', prep: 'var(--accent)', none: 'var(--line-2)' }

/** Fulfilment: what is done, what is in preparation, what has evidence and how strong it is, then the points-based score at every level. */
export default function Fulfil() {
  const { t, lang, snap, cycleId } = useApp(); const cfg = snap!.config; const cy = cycleId!; const toast = useToast()
  const [approvedOnly, setApprovedOnly] = useState(false)
  const rows = useMemo(() => fulfilRows(snap!, cy, approvedOnly), [snap, cy, approvedOnly])
  const all = fulfilSum(rows)
  const uname = (id: string | null) => { const u = cfg.users.find(x => x.id === id); return u ? (lang === 'ar' ? u.name_ar : u.name_en) : t('unassigned') }
  const dname = (id: string | null) => id ? deptName(cfg, id, lang) : t('noDept')
  const P = cfg.settings.points || { high: 30, medium: 20, low: 10, none: 20 }

  /* ---------- generic table with totals and a formatted copy ---------- */
  const fmtCell = (c: Col, v: number | string | null) => v === null || v === undefined ? '—' : c.kind === 'pct' ? fmtPct(v as number) : c.kind === 'num' ? String(Math.round(v as number)) : String(v)
  const cellCls = (c: Col, v: number | string | null) => c.tone === 'pct' ? `num font-bold text-${tone(v as number | null)}-ink` : c.tone ? `num text-${c.tone}-ink` : c.kind === 'text' ? 'text-sm' : 'num'
  const cellHex = (c: Col, v: number | string | null) => c.tone === 'pct' ? (v === null ? HEX.text : (v as number) >= 80 ? HEX.ok : (v as number) >= 50 ? HEX.warn : HEX.bad) : c.tone ? HEX[c.tone] : HEX.text
  const copyTable = async (first: string, extraH: string | undefined, cols: Col[], rs: GRow[], total: GRow) => {
    const head = [first, ...(extraH ? [extraH] : []), ...cols.map(c => c.h)]
    const line = (r: GRow) => [(/^\d/.test(r.id) ? r.id + ' ' : '') + r.label, ...(extraH ? [r.extra || ''] : []), ...cols.map(c => fmtCell(c, r.v[c.key]))]
    const body = rs.map(line), foot = line(total)
    const text = [head, ...body, foot].map(l => l.join('\t')).join('\n')
    const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    const nText = extraH ? 2 : 1
    const td = (v: string, i: number, r: GRow, bold = false, bg = '') => { const c = cols[i - nText]; const col = i < nText ? HEX.text : cellHex(c, r.v[c.key]); return `<td style="border:1px solid #D9D4CC;padding:4px 8px;font-family:Arial;font-size:10pt;color:${col};text-align:${i < nText ? 'start' : 'end'};${bold ? 'font-weight:bold;' : ''}${bg ? `background:${bg};` : ''}">${esc(v)}</td>` }
    const html = `<table dir="${lang === 'ar' ? 'rtl' : 'ltr'}" style="border-collapse:collapse"><thead><tr>${head.map(h => `<th style="border:1px solid #D9D4CC;padding:4px 8px;font-family:Arial;font-size:10pt;font-weight:bold;background:#EFEAE0;color:#1F2A2E;text-align:start">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rs.map((r, ri) => `<tr>${body[ri].map((v, i) => td(v, i, r, i === 0)).join('')}</tr>`).join('')}</tbody><tfoot><tr>${foot.map((v, i) => td(v, i, total, true, '#F4F1EB')).join('')}</tr></tfoot></table>`
    const done = () => toast(t('copied'), 'ok')
    try { if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) { await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]); done(); return } } catch { /* fall through */ }
    const onCopy = (e: ClipboardEvent) => { e.preventDefault(); e.clipboardData?.setData('text/html', html); e.clipboardData?.setData('text/plain', text) }
    document.addEventListener('copy', onCopy, { once: true }); const ok = document.execCommand('copy'); document.removeEventListener('copy', onCopy)
    if (ok) done(); else { try { await navigator.clipboard.writeText(text); done() } catch { toast(t('saveFailed'), 'bad') } }
  }
  const GTable = ({ first, extraH, cols, rows: rs, total }: { first: string; extraH?: string; cols: Col[]; rows: GRow[]; total: GRow }) => (
    <div className="card overflow-x-auto"><table className="tbl"><thead><tr><th><span className="inline-flex items-center gap-2">{first}<button type="button" className="btn btn-ghost btn-xs" title={t('copyTable')} aria-label={t('copyTable')} onClick={() => copyTable(first, extraH, cols, rs, total)}><Icon name="copy" /></button></span></th>{extraH && <th>{extraH}</th>}{cols.map(c => <th key={c.key}>{c.h}</th>)}</tr></thead>
      <tbody>{rs.map(r => <tr key={r.id}><td className="text-sm font-medium">{/^\d/.test(r.id) ? <span className="code-id me-2">{r.id}</span> : null}{r.label}</td>{extraH && <td className="text-sm text-muted">{r.extra}</td>}{cols.map(c => <td key={c.key} className={cellCls(c, r.v[c.key])}>{fmtCell(c, r.v[c.key])}</td>)}</tr>)}</tbody>
      <tfoot><tr><td className="text-sm">{t('total')}</td>{extraH && <td />}{cols.map(c => <td key={c.key} className={cellCls(c, total.v[c.key])}>{fmtCell(c, total.v[c.key])}</td>)}</tr></tfoot></table></div>)
  const H2 = ({ icon, children }: { icon: IconName; children: ReactNode }) => <h2 className="text-base font-semibold mt-6 mb-2 flex items-center gap-2"><Icon name={icon} className="text-accent-ink" />{children}</h2>
  const Section = ({ icon, title, hint, children }: { icon: IconName; title: string; hint: string; children: ReactNode }) => <section className="mt-8"><div className="flex items-center gap-2 mb-1"><Icon name={icon} className="text-accent-ink" /><h2 className="text-lg font-bold m-0">{title}</h2></div><p className="text-sm text-muted m-0 mb-3">{hint}</p>{children}</section>

  /* ---------- 1. code status: done / submitted / in preparation / not started ---------- */
  const codeFacts = useMemo(() => master.codes.map(c => ({ c, state: effective(snap!, cy, c.id).state, who: assigneeOf(c.id, cy, cfg), dept: departmentOf(snap!, cy, c.id) })), [snap, cy, cfg])
  const statusCols: Col[] = [{ key: 'codes', h: t('codes'), kind: 'num' }, { key: 'none', h: t('notStarted'), kind: 'num', tone: 'muted' }, { key: 'prep', h: t('inPreparation'), kind: 'num', tone: 'warn' }, { key: 'submitted', h: t('awaitingReview'), kind: 'num', tone: 'info' }, { key: 'approved', h: t('approved'), kind: 'num', tone: 'ok' }, { key: 'rate', h: t('approvalRate'), kind: 'pct', tone: 'pct' }]
  const statusRow = (id: string, label: string, xs: typeof codeFacts, extra?: string): GRow => { const n = (f: (s: WorkState) => boolean) => xs.filter(x => f(x.state)).length; const approved = n(s => s === 'approved'); return { id, label, extra, v: { codes: xs.length, none: n(s => s === 'none'), prep: n(s => s === 'draft' || s === 'returned'), submitted: n(s => s === 'submitted'), approved, rate: xs.length ? approved / xs.length * 100 : null } } }
  const groupBy = <T,>(xs: T[], key: (x: T) => string) => { const m = new Map<string, T[]>(); for (const x of xs) { const k = key(x); if (!m.has(k)) m.set(k, []); m.get(k)!.push(x) } return m }
  const stPillar = master.pillars.map(p => statusRow(p.id, pick(lang, p), codeFacts.filter(x => x.c.pillar === p.id)))
  const stUser = [...groupBy(codeFacts, x => x.who || '_none').entries()].map(([k, xs]) => statusRow(k, k === '_none' ? t('unassigned') : uname(k), xs)).sort((a, b) => (b.v.codes as number) - (a.v.codes as number))
  const stDept = [...groupBy(codeFacts, x => x.dept || '_none').entries()].map(([k, xs]) => statusRow(k, k === '_none' ? t('noDept') : dname(k), xs)).sort((a, b) => (b.v.codes as number) - (a.v.codes as number))
  const stTotal = statusRow('all', t('total'), codeFacts)
  const stParts = [{ key: 'approved', label: t('approved'), color: STATE_COLOR.approved }, { key: 'submitted', label: t('awaitingReview'), color: STATE_COLOR.submitted }, { key: 'prep', label: t('inPreparation'), color: STATE_COLOR.prep }, { key: 'none', label: t('notStarted'), color: STATE_COLOR.none }]

  /* ---------- 2. evidence: coverage, evaluator type, reviewer verdict ---------- */
  const ef = useMemo(() => evidenceFacts(snap!, cy, approvedOnly), [snap, cy, approvedOnly])
  const evCols: Col[] = [{ key: 'answered', h: t('answeredReqs'), kind: 'num' }, { key: 'with', h: t('withEvidence'), kind: 'num', tone: 'ok' }, { key: 'without', h: t('withoutEvidence'), kind: 'num', tone: 'bad' }, { key: 'cov', h: t('coverage'), kind: 'pct', tone: 'pct' }, { key: 'doc', h: t('evDocShort'), kind: 'num', tone: 'ok' }, { key: 'exec', h: t('evExecShort'), kind: 'num', tone: 'ok' }, { key: 'monitor', h: t('evMonitorShort'), kind: 'num', tone: 'ok' }, { key: 'complete', h: t('evComplete'), kind: 'num', tone: 'ok' }, { key: 'conclusive', h: t('strengthConclusiveShort'), kind: 'num', tone: 'ok' }, { key: 'editable', h: t('strengthEditableShort'), kind: 'num', tone: 'warn' }, { key: 'unspecified', h: t('evUnspecified'), kind: 'num', tone: 'muted' }, { key: 'strong', h: `${t('reviewerVerdict')}: ${t('rateStrong')}`, kind: 'num', tone: 'ok' }, { key: 'weak', h: `${t('reviewerVerdict')}: ${t('rateWeak')}`, kind: 'num', tone: 'bad' }, { key: 'unrated', h: t('unrated'), kind: 'num', tone: 'muted' }]
  const evRow = (id: string, label: string, xs: EvidenceFact[], extra?: string): GRow => { const a = xs.filter(x => x.status && x.status !== 'na'); const w = a.filter(x => x.hasEv); return { id, label, extra, v: { answered: a.length, with: w.length, without: a.length - w.length, cov: a.length ? w.length / a.length * 100 : null, doc: a.filter(x => x.doc).length, exec: a.filter(x => x.exec).length, monitor: a.filter(x => x.monitor).length, complete: a.filter(x => x.doc && x.exec && x.monitor).length, conclusive: w.filter(x => x.evType === 'conclusive').length, editable: w.filter(x => x.evType === 'editable').length, unspecified: w.filter(x => x.evType === 'unspecified').length, strong: w.filter(x => x.verdict === 'strong').length, weak: w.filter(x => x.verdict === 'weak').length, unrated: w.filter(x => !x.verdict).length } } }
  const evPillar = master.pillars.map(p => evRow(p.id, pick(lang, p), ef.filter(x => x.code.pillar === p.id)))
  const evUser = [...groupBy(ef, x => x.assignee || '_none').entries()].map(([k, xs]) => evRow(k, k === '_none' ? t('unassigned') : uname(k), xs)).sort((a, b) => (b.v.answered as number) - (a.v.answered as number))
  const evDept = [...groupBy(ef, x => x.dept || '_none').entries()].map(([k, xs]) => evRow(k, k === '_none' ? t('noDept') : dname(k), xs)).sort((a, b) => (b.v.answered as number) - (a.v.answered as number))
  const evTotal = evRow('all', t('total'), ef)
  const evParts = [{ key: 'with', label: t('withEvidence'), color: 'var(--ok)' }, { key: 'without', label: t('withoutEvidence'), color: 'var(--bad)' }]

  /* ---------- 3. points ---------- */
  const group = (key: (r: FulfilRow) => string | null) => groupBy(rows, r => key(r) || '_none')
  const ptCols: Col[] = [{ key: 'codes', h: t('codes'), kind: 'num' }, { key: 'counted', h: t('requirementsCounted'), kind: 'num' }, { key: 'yes', h: t('yes'), kind: 'num', tone: 'ok' }, { key: 'partial', h: t('partial'), kind: 'num', tone: 'warn' }, { key: 'no', h: t('no'), kind: 'num', tone: 'bad' }, { key: 'unanswered', h: t('unanswered'), kind: 'num', tone: 'muted' }, { key: 'na', h: t('na'), kind: 'num', tone: 'muted' }, { key: 'earned', h: t('earnedPoints'), kind: 'num' }, { key: 'possible', h: t('possiblePoints'), kind: 'num' }, { key: 'pct', h: t('fulfilment'), kind: 'pct', tone: 'pct' }]
  const ptRow = (id: string, label: string, rs: FulfilRow[], extra?: string): GRow => { const f = fulfilSum(rs); return { id, label, extra, v: { codes: f.codes, counted: f.counted, yes: f.yes, partial: f.partial, no: f.no, unanswered: f.unanswered, na: f.na, earned: f.earned, possible: f.possible, pct: f.pct } } }
  const ptPillar = master.pillars.map(p => ptRow(p.id, pick(lang, p), rows.filter(r => r.code.pillar === p.id)))
  const ptSub = master.subpillars.map(s => ptRow(s.id, pick(lang, s), rows.filter(r => r.code.sub === s.id), pick(lang, pillarById.get(s.pillar)!)))
  const ptUser = [...group(r => r.assignee).entries()].map(([k, rs]) => ptRow(k, k === '_none' ? t('unassigned') : uname(k), rs)).sort((a, b) => ((b.v.pct as number) ?? -1) - ((a.v.pct as number) ?? -1))
  const ptDept = [...group(r => r.dept).entries()].map(([k, rs]) => ptRow(k, k === '_none' ? t('noDept') : dname(k), rs)).sort((a, b) => (b.v.possible as number) - (a.v.possible as number))
  const ptTotal = ptRow('all', t('total'), rows)

  const cycle = cfg.cycles.find(c => c.id === cy)
  return (
    <div>
      <PrintHeader title={`${t('reportOf')}: ${t('fulfilment')}`} sub={`${lang === 'ar' ? (cycle?.name || cy) : (cycle?.name_en || cy)} · ${approvedOnly ? t('approvedOnly') : t('allAnswered')}`} />
      <PageHeader title={t('fulfilment')} sub={`${t('high')} ${P.high} · ${t('medium')} ${P.medium} · ${t('low')} ${P.low} — ${t('fulfilmentHint')}`}
        actions={<><button className="btn btn-sm" onClick={() => window.print()}><Icon name="download" />{t('printReport')}</button><div className="seg" role="group" aria-label={t('status')}><button aria-pressed={!approvedOnly} onClick={() => setApprovedOnly(false)}>{t('allAnswered')}</button><button aria-pressed={approvedOnly} onClick={() => setApprovedOnly(true)}>{t('approvedOnly')}</button></div></>} />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="card p-5 flex items-center gap-4 fade-up"><Ring value={all.pct} size={84} stroke={9} tone={ringTone(all.pct)} /><div><div className="label">{t('overallScore')}</div><div className="text-sm text-muted">{Math.round(all.earned)} / {all.possible} {t('earnedPoints').split(' ')[0]}</div></div></div>
        <Stat label={t('approved')} value={stTotal.v.approved as number} sub={`${t('awaitingReview')}: ${stTotal.v.submitted} · ${t('inPreparation')}: ${stTotal.v.prep} · ${t('notStarted')}: ${stTotal.v.none}`} icon="checkCircle" tone="ok" />
        <Stat label={t('withEvidence')} value={fmtPct(evTotal.v.cov as number | null)} sub={`${evTotal.v.with} / ${evTotal.v.answered} ${t('answeredReqs')}`} icon="link" tone="info" />
        <Stat label={t('reviewerVerdict')} value={`${evTotal.v.strong} / ${evTotal.v.weak}`} sub={`${t('rateStrong')} / ${t('rateWeak')} · ${t('unrated')}: ${evTotal.v.unrated}`} icon="shield" tone={(evTotal.v.weak as number) ? 'warn' : 'ok'} />
      </div>

      <Section icon="tasks" title={t('codeStatus')} hint={t('codeStatusHint')}>
        <div className="card p-5 mb-3"><Stacked mode="count" labelW="30%" rows={stPillar.map(r => ({ key: r.id, label: `${r.id}. ${r.label}`, text: `${r.id}. ${r.label}`, values: { approved: r.v.approved as number, submitted: r.v.submitted as number, prep: r.v.prep as number, none: r.v.none as number } }))} parts={stParts} /></div>
        <H2 icon="users">{t('byEvaluator')}</H2><GTable first={t('evaluator')} cols={statusCols} rows={stUser} total={stTotal} />
        <H2 icon="map">{t('byDepartment')}</H2><GTable first={t('department')} cols={statusCols} rows={stDept} total={stTotal} />
        <H2 icon="layers">{t('byPillar')}</H2><GTable first={t('pillar')} cols={statusCols} rows={stPillar} total={stTotal} />
      </Section>

      <Section icon="link" title={t('evidenceSection')} hint={t('evidenceSectionHint')}>
        <div className="card p-5 mb-3"><Stacked mode="count" labelW="30%" rows={evPillar.map(r => ({ key: r.id, label: `${r.id}. ${r.label}`, text: `${r.id}. ${r.label}`, values: { with: r.v.with as number, without: r.v.without as number } }))} parts={evParts} /></div>
        <H2 icon="users">{t('byEvaluator')}</H2><GTable first={t('evaluator')} cols={evCols} rows={evUser} total={evTotal} />
        <H2 icon="map">{t('byDepartment')}</H2><GTable first={t('department')} cols={evCols} rows={evDept} total={evTotal} />
        <H2 icon="layers">{t('byPillar')}</H2><GTable first={t('pillar')} cols={evCols} rows={evPillar} total={evTotal} />
      </Section>

      <Section icon="target" title={t('pointsSection')} hint={t('fulfilmentHint')}>
        <H2 icon="users">{t('byEvaluator')}</H2><GTable first={t('evaluator')} cols={ptCols} rows={ptUser} total={ptTotal} />
        <H2 icon="map">{t('byDepartment')}</H2><GTable first={t('department')} cols={ptCols} rows={ptDept} total={ptTotal} />
        <H2 icon="layers">{t('byPillar')}</H2><GTable first={t('pillar')} cols={ptCols} rows={ptPillar} total={ptTotal} />
        <H2 icon="grid">{t('bySubpillar')}</H2><GTable first={t('subpillar')} extraH={t('pillar')} cols={ptCols} rows={ptSub} total={ptTotal} />
      </Section>
    </div>
  )
}
