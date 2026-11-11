import { useMemo, useState } from 'react'
import { useApp } from '../store/state'
import { master, fulfilRows, fulfilSum, deptName, pillarById, type FulfilRow } from '../store/scoring'
import { pick } from '../i18n'
import { PageHeader, Ring, Stat, fmtPct, tone, ringTone, useToast } from '../components/ui'
import { Icon } from '../components/icons'

/** Fulfilment: the points-based UAE Code score at every level (overall, pillar, sub-pillar, evaluator, department). */
export default function Fulfil() {
  const { t, lang, snap, cycleId } = useApp(); const cfg = snap!.config; const cy = cycleId!; const toast = useToast()
  const [approvedOnly, setApprovedOnly] = useState(false)
  const rows = useMemo(() => fulfilRows(snap!, cy, approvedOnly), [snap, cy, approvedOnly])
  const all = fulfilSum(rows)
  const group = (key: (r: FulfilRow) => string | null) => { const m = new Map<string, FulfilRow[]>(); for (const r of rows) { const k = key(r) || '_none'; if (!m.has(k)) m.set(k, []); m.get(k)!.push(r) } return m }
  const byPillar = master.pillars.map(p => ({ id: p.id, label: pick(lang, p), f: fulfilSum(rows.filter(r => r.code.pillar === p.id)) }))
  const bySub = master.subpillars.map(s => ({ id: s.id, label: pick(lang, s), pillar: pick(lang, pillarById.get(s.pillar)!), f: fulfilSum(rows.filter(r => r.code.sub === s.id)) }))
  const uname = (id: string | null) => { const u = cfg.users.find(x => x.id === id); return u ? (lang === 'ar' ? u.name_ar : u.name_en) : t('unassigned') }
  const byUser = [...group(r => r.assignee).entries()].map(([k, rs]) => ({ id: k, label: k === '_none' ? t('unassigned') : uname(k), f: fulfilSum(rs) })).sort((a, b) => (b.f.pct ?? -1) - (a.f.pct ?? -1))
  const byDept = [...group(r => r.dept).entries()].map(([k, rs]) => ({ id: k, label: k === '_none' ? t('noDept') : deptName(cfg, k, lang), f: fulfilSum(rs) })).sort((a, b) => b.f.possible - a.f.possible)
  const P = cfg.settings.points || { high: 30, medium: 20, low: 10, none: 20 }
  type Row = { id: string; label: string; f: ReturnType<typeof fulfilSum>; pillar?: string }
  const cells = (f: ReturnType<typeof fulfilSum>) => [f.codes, f.counted, f.yes, f.partial, f.no, f.unanswered, f.na, Math.round(f.earned), f.possible, fmtPct(f.pct)]
  /** Copies a table with its formatting (HTML for Excel/Word/Outlook) plus a tab-separated fallback for plain editors. */
  const copyTable = async (rs: Row[], first: string, extra?: boolean) => {
    const head = [first, ...(extra ? [t('pillar')] : []), t('codes'), t('requirementsCounted'), t('yes'), t('partial'), t('no'), t('unanswered'), t('na'), t('earnedPoints'), t('possiblePoints'), t('fulfilment')]
    const body = rs.map(r => [(/^\d/.test(r.id) ? r.id + ' ' : '') + r.label, ...(extra ? [r.pillar || ''] : []), ...cells(r.f)])
    const foot = [t('total'), ...(extra ? [''] : []), ...cells(all)]
    const text = [head, ...body, foot].map(l => l.join('\t')).join('\n')
    const esc = (v: string | number) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    const nText = extra ? 2 : 1
    const colour = (i: number, pct?: number | null) => { const k = i - nText; if (k === 2) return '#1E7A3C'; if (k === 3) return '#9A6A00'; if (k === 4) return '#B42318'; if (k === 5 || k === 6) return '#6B6257'; if (k === 9 && pct !== null && pct !== undefined) return pct >= 80 ? '#1E7A3C' : pct >= 50 ? '#9A6A00' : '#B42318'; return '#1F2A2E' }
    const td = (v: string | number, i: number, pct: number | null, bold = false, bg = '') => `<td style="border:1px solid #D9D4CC;padding:4px 8px;font-family:Arial;font-size:10pt;color:${colour(i, pct)};text-align:${i < nText ? 'start' : 'end'};${bold ? 'font-weight:bold;' : ''}${bg ? `background:${bg};` : ''}">${esc(v)}</td>`
    const html = `<table dir="${lang === 'ar' ? 'rtl' : 'ltr'}" style="border-collapse:collapse"><thead><tr>${head.map(h => `<th style="border:1px solid #D9D4CC;padding:4px 8px;font-family:Arial;font-size:10pt;font-weight:bold;background:#EFEAE0;color:#1F2A2E;text-align:start">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rs.map((r, ri) => `<tr>${body[ri].map((v, i) => td(v, i, r.f.pct, i === 0)).join('')}</tr>`).join('')}</tbody><tfoot><tr>${foot.map((v, i) => td(v, i, all.pct, true, '#F4F1EB')).join('')}</tr></tfoot></table>`
    const done = () => toast(t('copied'), 'ok')
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) { await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]); done(); return }
    } catch { /* fall through to the copy-event route */ }
    const onCopy = (e: ClipboardEvent) => { e.preventDefault(); e.clipboardData?.setData('text/html', html); e.clipboardData?.setData('text/plain', text) }
    document.addEventListener('copy', onCopy, { once: true })
    const ok = document.execCommand('copy'); document.removeEventListener('copy', onCopy)
    if (ok) done(); else { try { await navigator.clipboard.writeText(text); done() } catch { toast(t('saveFailed'), 'bad') } }
  }
  const Table = ({ rows: rs, first, extra }: { rows: Row[]; first: string; extra?: boolean }) => (
    <div className="card overflow-x-auto"><table className="tbl"><thead><tr><th><span className="inline-flex items-center gap-2">{first}<button type="button" className="btn btn-ghost btn-xs" title={t('copyTable')} aria-label={t('copyTable')} onClick={() => copyTable(rs, first, extra)}><Icon name="copy" /></button></span></th>{extra && <th>{t('pillar')}</th>}<th>{t('codes')}</th><th>{t('requirementsCounted')}</th><th>{t('yes')}</th><th>{t('partial')}</th><th>{t('no')}</th><th>{t('unanswered')}</th><th>{t('na')}</th><th>{t('earnedPoints')}</th><th>{t('possiblePoints')}</th><th>{t('fulfilment')}</th></tr></thead>
      <tbody>{rs.map(r => <tr key={r.id}><td className="text-sm font-medium">{/^\d/.test(r.id) ? <span className="code-id me-2">{r.id}</span> : null}{r.label}</td>{extra && <td className="text-sm text-muted">{r.pillar}</td>}<td className="num">{r.f.codes}</td><td className="num">{r.f.counted}</td><td className="num text-ok-ink">{r.f.yes}</td><td className="num text-warn-ink">{r.f.partial}</td><td className="num text-bad-ink">{r.f.no}</td><td className="num text-muted">{r.f.unanswered}</td><td className="num text-muted">{r.f.na}</td><td className="num">{Math.round(r.f.earned)}</td><td className="num">{r.f.possible}</td><td className={`num font-bold text-${tone(r.f.pct)}-ink`}>{fmtPct(r.f.pct)}</td></tr>)}</tbody>
      <tfoot><tr><td className="text-sm">{t('total')}</td>{extra && <td />}<td className="num">{all.codes}</td><td className="num">{all.counted}</td><td className="num text-ok-ink">{all.yes}</td><td className="num text-warn-ink">{all.partial}</td><td className="num text-bad-ink">{all.no}</td><td className="num text-muted">{all.unanswered}</td><td className="num text-muted">{all.na}</td><td className="num">{Math.round(all.earned)}</td><td className="num">{all.possible}</td><td className={`num font-bold text-${tone(all.pct)}-ink`}>{fmtPct(all.pct)}</td></tr></tfoot></table></div>)
  return (
    <div>
      <PageHeader title={t('fulfilment')} sub={`${t('high')} ${P.high} · ${t('medium')} ${P.medium} · ${t('low')} ${P.low} — ${t('fulfilmentHint')}`}
        actions={<div className="seg" role="group" aria-label={t('status')}><button aria-pressed={!approvedOnly} onClick={() => setApprovedOnly(false)}>{t('allAnswered')}</button><button aria-pressed={approvedOnly} onClick={() => setApprovedOnly(true)}>{t('approvedOnly')}</button></div>} />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="card p-4 flex items-center gap-4"><Ring value={all.pct} size={84} stroke={9} tone={ringTone(all.pct)} /><div><div className="label">{t('overallScore')}</div><div className="text-sm text-muted">{Math.round(all.earned)} / {all.possible} {t('earnedPoints').split(' ')[0]}</div></div></div>
        <Stat label={t('requirementsCounted')} value={all.counted} sub={`${t('na')}: ${all.na}`} icon="layers" tone="info" />
        <Stat label={t('yes')} value={all.yes} sub={`${t('partial')}: ${all.partial} · ${t('no')}: ${all.no}`} icon="checkCircle" tone="ok" />
        <Stat label={t('unanswered')} value={all.unanswered} sub={t('notStarted')} icon="clock" tone={all.unanswered ? 'warn' : 'ok'} />
      </div>
      <h2 className="text-base font-semibold mt-6 mb-2 flex items-center gap-2"><Icon name="users" className="text-accent-ink" />{t('byEvaluator')}</h2>
      <Table rows={byUser} first={t('evaluator')} />
      <h2 className="text-base font-semibold mt-6 mb-2 flex items-center gap-2"><Icon name="map" className="text-accent-ink" />{t('byDepartment')}</h2>
      <Table rows={byDept} first={t('department')} />
      <h2 className="text-base font-semibold mt-6 mb-2 flex items-center gap-2"><Icon name="layers" className="text-accent-ink" />{t('byPillar')}</h2>
      <Table rows={byPillar} first={t('pillar')} />
      <h2 className="text-base font-semibold mt-6 mb-2 flex items-center gap-2"><Icon name="grid" className="text-accent-ink" />{t('bySubpillar')}</h2>
      <Table rows={bySub} first={t('subpillar')} extra />
    </div>
  )
}
