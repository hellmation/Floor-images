import { useMemo, useState } from 'react'
import { useApp } from '../store/state'
import { master, effective, codeScore, sortIds, now, evPartsPending } from '../store/scoring'
import { pickDesc, pickText } from '../i18n'
import { Avatar, Empty, PageHeader, StatusPill, useToast, fmtDate, fmtPct, tone, Modal, RefreshButton, Opt } from '../components/ui'
import { Icon } from '../components/icons'
import { EvidenceRate } from '../components/EvidenceRate'
import { EvidencePartsView, partsCount } from '../components/EvidenceParts'

export default function Review() {
  const { t, lang, snap, user, cycleId, saveReviews } = useApp(); const cfg = snap!.config; const cy = cycleId!
  const toast = useToast()
  const [tab, setTab] = useState<'queue' | 'clar' | 'approved'>((new URLSearchParams(location.hash.split('?')[1] || '').get('tab') as 'queue' | 'clar' | 'approved') || 'queue')
  const [open, setOpen] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [reply, setReply] = useState<Record<string, string>>({})
  const [evFilter, setEvFilter] = useState<'any' | 'none' | 'weak' | 'unrated' | 'editable' | 'notStrong' | 'missAny' | 'missDoc' | 'missExec' | 'missMonitor'>('any')
  const [whoF, setWhoF] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [bulk, setBulk] = useState(false); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false)
  const userName = (id: string | null) => { const u = cfg.users.find(x => x.id === id); return u ? (lang === 'ar' ? u.name_ar : u.name_en) : t('unassigned') }
  const photo = (id: string | null) => cfg.users.find(x => x.id === id)?.photo
  const rows = useMemo(() => master.codes.map(c => ({ c, e: effective(snap!, cy, c.id) })).sort((a, b) => sortIds(a.c.id, b.c.id)), [snap, cy])
  const cycle = cfg.cycles.find(c => c.id === cy); const canReview = cycle?.status === 'open' || cycle?.status === 'review'
  const queue = rows.filter(r => r.e.state === 'submitted'), approved = rows.filter(r => r.e.state === 'approved')
  const clars = rows.flatMap(r => r.c.requirements.map(rq => String(rq.n)).filter(n => r.e.answer?.items[n]?.clarify?.flag).map(n => ({ ...r, n, it: r.e.answer!.items[n], ans: snap!.reviews.clarifications?.[cy]?.[r.c.id]?.[n] })))
  const key = (codeId: string, n: string) => `${codeId}/${n}`
  /** Evidence picture of one approved code: answered requirements with / without evidence, and the reviewer verdicts on its links. */
  const evInfo = (codeId: string, a: NonNullable<typeof rows[number]['e']['answer']>) => { const ratings = snap!.reviews.evidenceRatings?.[cy]?.[codeId] || {}; let withEv = 0, without = 0, strong = 0, weak = 0, unrated = 0, editable = 0, missDoc = 0, missExec = 0, missMonitor = 0, complete = 0
    for (const it of Object.values(a.items)) { if (!it.status || it.status === 'na') continue; if (it.evidence.length) withEv++; else without++; if (it.status === 'yes') { if (it.evidenceParts?.doc !== true) missDoc++; if (it.evidenceParts?.exec !== true) missExec++; if (it.evidenceParts?.monitor !== true) missMonitor++; if (partsCount(it) === 3) complete++ } for (const ev of it.evidence) { const v = ratings[ev.id]?.rating; if (v === 'strong') strong++; else if (v === 'weak') weak++; else unrated++; if (ev.strength === 'editable') editable++ } }
    return { withEv, without, strong, weak, unrated, editable, missDoc, missExec, missMonitor, complete } }
  const approvedRows = useMemo(() => approved.map(r => ({ ...r, ev: evInfo(r.c.id, r.e.answer!) })).filter(r => (!whoF || r.e.userId === whoF) && (evFilter === 'any' || (evFilter === 'none' && r.ev.without > 0) || (evFilter === 'weak' && r.ev.weak > 0) || (evFilter === 'unrated' && r.ev.unrated > 0) || (evFilter === 'editable' && r.ev.editable > 0) || (evFilter === 'notStrong' && r.ev.strong === 0) || (evFilter === 'missAny' && (r.ev.missDoc + r.ev.missExec + r.ev.missMonitor) > 0) || (evFilter === 'missDoc' && r.ev.missDoc > 0) || (evFilter === 'missExec' && r.ev.missExec > 0) || (evFilter === 'missMonitor' && r.ev.missMonitor > 0))), [approved, whoF, evFilter, snap]) // eslint-disable-line react-hooks/exhaustive-deps
  const allSel = approvedRows.length > 0 && approvedRows.every(r => sel.has(r.c.id))
  const toggleAll = () => setSel(allSel ? new Set() : new Set(approvedRows.map(r => r.c.id)))
  const bulkReopen = async () => {
    const ids = approvedRows.filter(r => sel.has(r.c.id)); if (!ids.length) return; setBusy(true)
    const r = JSON.parse(JSON.stringify(snap!.reviews)); r.cycles[cy] = r.cycles[cy] || {}
    for (const row of ids) r.cycles[cy][row.c.id] = { state: 'returned', comment: reason.trim() || 'reopened', reviewedBy: user!.id, reviewedAt: now(), evidenceVerified: false, userId: row.e.userId, submittedAt: row.e.answer!.submittedAt || row.e.answer!.updatedAt }
    try { await saveReviews(r, `bulk reopen ${ids.length}`); toast(`${t('reopenedN')} ${ids.length}`, 'ok'); setSel(new Set()); setBulk(false); setReason('') } catch (e) { toast(String((e as Error).message || t('saveFailed')), 'bad') } finally { setBusy(false) }
  }
  const decide = async (codeId: string, state: 'approved' | 'returned', verified: boolean, text = comment) => {
    const row = rows.find(r => r.c.id === codeId); if (!row?.e.answer) return
    const r = JSON.parse(JSON.stringify(snap!.reviews)); r.cycles[cy] = r.cycles[cy] || {}
    // the review is bound to this exact submission (who + when), so it can never attach to a later or someone else's answer
    r.cycles[cy][codeId] = { state, comment: text, reviewedBy: user!.id, reviewedAt: now(), evidenceVerified: verified, userId: row.e.userId, submittedAt: row.e.answer.submittedAt || row.e.answer.updatedAt }
    try { await saveReviews(r, `${state} ${codeId}`); setOpen(null); setComment(''); toast(state === 'approved' ? t('approved') : t('returned'), state === 'approved' ? 'ok' : 'bad') }
    catch (e) { toast(String((e as Error).message || t('saveFailed')), 'bad') }
  }
  const answer = async (codeId: string, n: string) => {
    const r = JSON.parse(JSON.stringify(snap!.reviews)); r.clarifications[cy] = r.clarifications[cy] || {}; r.clarifications[cy][codeId] = r.clarifications[cy][codeId] || {}
    r.clarifications[cy][codeId][n] = { answer: reply[key(codeId, n)] || '', answeredBy: user!.id, answeredAt: now() }
    try { await saveReviews(r, `clarify ${codeId}/${n}`); setReply(s => ({ ...s, [key(codeId, n)]: '' })); toast(t('replied'), 'ok') } catch (e) { toast(String((e as Error).message || t('saveFailed')), 'bad') }
  }
  return (
    <div>
      <PageHeader title={t('review')} sub={`${queue.length} ${t('pending')} · ${clars.length} ${t('clarificationQueue')}`} actions={<><RefreshButton /><div className="seg"><button aria-pressed={tab === 'queue'} onClick={() => setTab('queue')}><Icon name="shield" />{t('pending')} <span className="num">{queue.length}</span></button><button aria-pressed={tab === 'clar'} onClick={() => setTab('clar')}><Icon name="question" />{t('clarificationQueue')} <span className="num">{clars.length}</span></button><button aria-pressed={tab === 'approved'} onClick={() => setTab('approved')}><Icon name="checkCircle" />{t('approved')} <span className="num">{approved.length}</span></button></div></>} />
      <div className="flex flex-col gap-3">
        {!canReview && <div className="text-sm text-warn-ink bg-warn-soft rounded-lg px-3 py-2">{t(cycle?.status === 'closed' ? 'cycleClosedNotice' : 'cyclePlanningNotice')}</div>}
        {tab === 'queue' && (queue.length === 0 ? <Empty icon="shield" title={t('allCaughtUp')} /> : queue.map(({ c, e }) => <div key={c.id} className="card p-4 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3"><a className="code-id no-underline" href={'#/code/' + c.id}>{c.id}</a><span className="flex-1 min-w-0 text-sm truncate">{pickDesc(lang, c)}</span>{evPartsPending(e.answer) > 0 && <span className="pill pill-warn" title={t('evLateWaiting')}>{t('evQNeeded')}</span>}<span className="flex items-center gap-2 text-xs text-muted"><Avatar name={userName(e.userId)} photo={photo(e.userId)} />{userName(e.userId)} · {fmtDate(e.answer?.submittedAt, lang)}</span><span className={`num font-semibold text-${tone(codeScore(e.answer, c, cfg))}-ink`}>{fmtPct(codeScore(e.answer, c, cfg))}</span>
            <button className="btn btn-sm" onClick={() => { setOpen(open === c.id ? null : c.id); setComment('') }}><Icon name={open === c.id ? 'chevronD' : 'eye'} />{open === c.id ? t('cancel') : t('view')}</button></div>
          {open === c.id && <div className="flex flex-col gap-2 border-t border-line pt-3">
            {c.requirements.map(r => { const it = e.answer!.items[String(r.n)]; return <div key={r.n} className="text-sm panel p-2 flex flex-col gap-1"><div className="flex items-start gap-2"><span className="code-id">{r.n}</span><span className="flex-1">{pickText(lang, r)}</span><StatusPill status={it?.status ?? null} /></div>
              {it?.justification && <div className="text-muted ps-8">{t('justification')}: {it.justification}</div>}
              {it?.evidence?.length ? <div className="ps-8 flex flex-wrap gap-2 items-center">{it.evidence.map(ev => <span key={ev.id} className="inline-flex items-center gap-1"><a className={`pill ${ev.strength === 'conclusive' ? 'pill-ok' : ev.strength === 'editable' ? 'pill-warn' : 'pill-muted'} no-underline`} href={ev.url} target="_blank" rel="noreferrer" title={ev.strength ? t(ev.strength === 'conclusive' ? 'strengthConclusive' : 'strengthEditable') : undefined}><Icon name="link" style={{ width: 12, height: 12 }} />{ev.title || ev.url}</a><EvidenceRate codeId={c.id} ev={ev} /></span>)}</div> : null}
              {it?.evidenceParts && <div className="ps-8"><EvidencePartsView it={it} /></div>}
              {it?.note && <div className="text-muted ps-8">{t('note')}: {it.note}</div>}</div> })}
            <textarea className="textarea" rows={2} placeholder={t('reviewerComment')} value={comment} onChange={e2 => setComment(e2.target.value)} />
            <div className="flex flex-wrap gap-2 items-center"><button className="btn btn-ok btn-sm" disabled={!canReview} onClick={() => decide(c.id, 'approved', true)}><Icon name="checkCircle" />{t('approve')} · {t('evidenceVerified')}</button><button className="btn btn-sm" disabled={!canReview} onClick={() => decide(c.id, 'approved', false)}><Icon name="check" />{t('approve')}</button><button className="btn btn-danger btn-sm" disabled={!comment.trim() || !canReview} onClick={() => decide(c.id, 'returned', false)}><Icon name={lang === 'ar' ? 'arrowR' : 'arrowL'} />{t('return')}</button></div>
          </div>}
        </div>))}
        {tab === 'clar' && (clars.length === 0 ? <Empty icon="question" /> : clars.map(({ c, e, n, it, ans }) => <div key={key(c.id, n)} className="card p-4 flex flex-col gap-2 text-sm">
          <div className="flex flex-wrap items-center gap-2"><a className="code-id no-underline" href={'#/code/' + c.id}>{c.id}</a><span className="code-id">{n}</span><span className="flex-1 min-w-0">{pickText(lang, c.requirements.find(r => String(r.n) === n) || { text_ar: n, text_en: n })}</span><span className="text-xs text-muted">{userName(e.userId)} · {fmtDate(it.clarify?.raisedAt, lang)}</span>{ans && <span className="pill pill-ok">{t('replied')}</span>}</div>
          <div className="rounded-lg bg-flag-soft text-flag-ink p-3"><b>{t('needsClarification')}:</b> {it.clarify?.question || '—'}</div>
          {ans && <div className="text-muted"><b>{t('clarificationAnswer')}</b> ({fmtDate(ans.answeredAt, lang)}): {ans.answer}</div>}
          <div className="flex gap-2"><input className="input" placeholder={t('reply')} value={reply[key(c.id, n)] || ''} onChange={e2 => setReply(s => ({ ...s, [key(c.id, n)]: e2.target.value }))} onKeyDown={e2 => { if (e2.key === 'Enter' && (reply[key(c.id, n)] || '').trim()) answer(c.id, n) }} /><button className="btn btn-sm" disabled={!(reply[key(c.id, n)] || '').trim()} onClick={() => answer(c.id, n)}><Icon name="send" />{t('reply')}</button></div>
        </div>))}
        {tab === 'approved' && (approved.length === 0 ? <Empty icon="checkCircle" /> : <>
          <div className="card p-3 flex flex-wrap items-end gap-3">
            <div className="field min-w-0"><label className="label" htmlFor="rv-ev">{t('evidenceFilter')}</label><select id="rv-ev" className="select !py-1.5 text-sm" value={evFilter} onChange={e => { setEvFilter(e.target.value as typeof evFilter); setSel(new Set()) }}><option value="any">{t('evAny')}</option><option value="none">{t('evNone')}</option><option value="missAny">{t('evMissingAny')}</option><option value="missDoc">{t('evMissDoc')}</option><option value="missExec">{t('evMissExec')}</option><option value="missMonitor">{t('evMissMonitor')}</option><option value="weak">{t('evWeak')}</option><option value="unrated">{t('evUnrated')}</option><option value="notStrong">{t('evNotStrong')}</option><option value="editable">{t('evEditable')}</option></select></div>
            <div className="field min-w-0"><label className="label" htmlFor="rv-who">{t('evaluator')}</label><select id="rv-who" className="select !py-1.5 text-sm" value={whoF} onChange={e => { setWhoF(e.target.value); setSel(new Set()) }}><option value="">{t('all')}</option>{cfg.users.filter(u => u.active).map(u => <option key={u.id} value={u.id}>{lang === 'ar' ? u.name_ar : u.name_en}</option>)}</select></div>
            <span className="text-sm text-muted num">{approvedRows.length} / {approved.length}</span>
            <span className="ms-auto flex items-center gap-2"><span className="text-sm text-muted num">{sel.size} {t('selectedN')}</span><button className="btn btn-sm" disabled={!canReview || sel.size === 0} onClick={() => setBulk(true)}><Icon name="refresh" />{t('reopenSelected')} {sel.size ? <span className="num">({sel.size})</span> : null}</button></span>
          </div>
          <div className="card overflow-x-auto"><table className="tbl"><thead><tr><th><input type="checkbox" aria-label={t('selectAll')} checked={allSel} onChange={toggleAll} /></th><th>{t('code')}</th><th>{t('codeText')}</th><th>{t('submittedBy')}</th><th>{t('score')}</th><th title={t('evCols')}>{t('evidence')}</th><th>{t('reviewerVerdict')}</th><th></th></tr></thead><tbody>
            {approvedRows.map(({ c, e, ev }) => <tr key={c.id} className={sel.has(c.id) ? 'bg-accent-soft/40' : ''}><td><input type="checkbox" aria-label={c.id} checked={sel.has(c.id)} onChange={() => setSel(s => { const n = new Set(s); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n })} /></td><td><a className="code-id no-underline" href={'#/code/' + c.id}>{c.id}</a></td><td className="text-sm"><span className="line-clamp-2" title={pickDesc(lang, c)}>{pickDesc(lang, c)}</span></td><td>{userName(e.userId)}</td><td className={`num font-semibold text-${tone(codeScore(e.answer, c, cfg))}-ink`}>{fmtPct(codeScore(e.answer, c, cfg))}</td>
              <td className="num text-sm whitespace-nowrap"><span className="text-ok-ink">{ev.withEv}</span> / <span className={ev.without ? 'text-bad-ink font-semibold' : 'text-muted'}>{ev.without}</span>{ev.editable ? <span className="text-warn-ink text-xs ms-2">({t('strengthEditableShort')} {ev.editable})</span> : null}{(ev.missDoc + ev.missExec + ev.missMonitor) > 0 && <span className="block text-xs text-bad-ink font-normal" title={`${t('evDocShort')} / ${t('evExecShort')} / ${t('evMonitorShort')}`}>{t('evMissingAny')}: {ev.missDoc} / {ev.missExec} / {ev.missMonitor}</span>}</td>
              <td className="num text-sm whitespace-nowrap"><span className="text-ok-ink">{ev.strong}</span> / <span className={ev.weak ? 'text-bad-ink font-semibold' : 'text-muted'}>{ev.weak}</span> / <span className="text-muted">{ev.unrated}</span></td>
              <td><button className="btn btn-sm" disabled={!canReview} onClick={() => { if (confirm(t('confirmReopen'))) decide(c.id, 'returned', false, 'reopened') }}><Icon name="refresh" />{t('reopen')}</button></td></tr>)}</tbody></table></div>
          <Modal open={bulk} onClose={() => setBulk(false)} title={`${t('reopenSelected')} (${sel.size})`} footer={<><button className="btn" onClick={() => setBulk(false)}>{t('cancel')}</button><button className="btn btn-primary" disabled={busy} onClick={bulkReopen}><Icon name="refresh" />{t('reopenSelected')}</button></>}>
            <p className="text-sm m-0 mb-3">{t('confirmBulkReopen')}</p>
            <div className="field"><label className="label" htmlFor="rv-reason">{t('reopenReason')}<Opt /></label><textarea id="rv-reason" className="textarea" rows={3} value={reason} onChange={e => setReason(e.target.value)} /></div>
            <ul className="m-0 mt-3 p-0 list-none flex flex-wrap gap-1 max-h-32 overflow-auto">{approvedRows.filter(r => sel.has(r.c.id)).map(r => <li key={r.c.id}><span className="code-id">{r.c.id}</span></li>)}</ul>
          </Modal>
        </>)}
      </div>
    </div>
  )
}
