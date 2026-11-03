import { useMemo, useState } from 'react'
import { useApp } from '../store/state'
import { master, effective, codeScore, sortIds, now } from '../store/scoring'
import { pick, pickDesc, pickText } from '../i18n'
import { Empty, StatePill, StatusPill, fmtDate, fmtPct } from '../components/ui'

export default function Review() {
  const { t, lang, snap, user, cycleId, saveReviews } = useApp(); const cfg = snap!.config; const cy = cycleId!
  const [tab, setTab] = useState<'queue' | 'clar' | 'approved'>('queue')
  const [open, setOpen] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [reply, setReply] = useState<Record<string, string>>({})
  const userName = (id: string | null) => { const u = cfg.users.find(x => x.id === id); return u ? (lang === 'ar' ? u.name_ar : u.name_en) : '—' }
  const rows = useMemo(() => master.codes.map(c => ({ c, e: effective(snap!, cy, c.id) })).sort((a, b) => sortIds(a.c.id, b.c.id)), [snap, cy])
  const queue = rows.filter(r => r.e.state === 'submitted')
  const approved = rows.filter(r => r.e.state === 'approved')
  const clars = rows.flatMap(r => Object.entries(r.e.answer?.items || {}).filter(([, it]) => it.clarify?.flag).map(([n, it]) => ({ ...r, n, it, ans: snap!.reviews.clarifications?.[cy]?.[r.c.id]?.[n] })))

  const decide = async (codeId: string, state: 'approved' | 'returned', verified: boolean) => {
    const r = JSON.parse(JSON.stringify(snap!.reviews)); r.cycles[cy] = r.cycles[cy] || {}
    r.cycles[cy][codeId] = { state, comment, reviewedBy: user!.id, reviewedAt: now(), evidenceVerified: verified }
    await saveReviews(r, `${state} ${codeId}`); setOpen(null); setComment('')
  }
  const answer = async (codeId: string, n: string) => {
    const r = JSON.parse(JSON.stringify(snap!.reviews)); r.clarifications[cy] = r.clarifications[cy] || {}; r.clarifications[cy][codeId] = r.clarifications[cy][codeId] || {}
    r.clarifications[cy][codeId][n] = { answer: reply[codeId + n] || '', answeredBy: user!.id, answeredAt: now() }
    await saveReviews(r, `clarify ${codeId}/${n}`); setReply(s => ({ ...s, [codeId + n]: '' }))
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="seg"><button aria-pressed={tab === 'queue'} onClick={() => setTab('queue')}>{t('pending')} ({queue.length})</button><button aria-pressed={tab === 'clar'} onClick={() => setTab('clar')}>{t('clarificationQueue')} ({clars.length})</button><button aria-pressed={tab === 'approved'} onClick={() => setTab('approved')}>{t('approved')} ({approved.length})</button></div>
      {tab === 'queue' && (queue.length === 0 ? <Empty /> : queue.map(({ c, e }) => (
        <div key={c.id} className="card p-4 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2"><a className="code-id no-underline" href={'#/code/' + c.id}>{c.id}</a><span className="flex-1 min-w-0 text-sm">{pickDesc(lang, c).slice(0, 180)}</span><span className="text-xs text-muted">{userName(e.userId)} · {fmtDate(e.answer?.submittedAt)}</span><span className="num text-sm">{fmtPct(codeScore(e.answer, c, cfg))}</span>
            <button className="btn btn-sm" onClick={() => { setOpen(open === c.id ? null : c.id); setComment('') }}>{open === c.id ? '▴' : '▾'}</button></div>
          {open === c.id && <div className="flex flex-col gap-2 border-t border-line pt-2">
            {c.requirements.map(r => { const it = e.answer!.items[String(r.n)]; return <div key={r.n} className="text-sm flex flex-col gap-0.5"><div className="flex items-start gap-2"><span className="code-id">{r.n}</span><span className="flex-1">{pickText(lang, r)}</span><StatusPill status={it?.status ?? null} /></div>
              {it?.justification && <div className="text-muted ps-8">{t('justification')}: {it.justification}</div>}
              {it?.evidence?.length ? <div className="ps-8">{it.evidence.map(ev => <a key={ev.id} className="me-3" href={ev.url} target="_blank" rel="noreferrer">{ev.title || ev.url}</a>)}</div> : null}
              {it?.note && <div className="text-muted ps-8">{t('note')}: {it.note}</div>}</div> })}
            <textarea className="textarea" rows={2} placeholder={t('reviewerComment')} value={comment} onChange={e2 => setComment(e2.target.value)} />
            <div className="flex gap-2 items-center"><button className="btn btn-primary btn-sm" onClick={() => decide(c.id, 'approved', true)}>{t('approve')} ✓ {t('evidenceVerified')}</button><button className="btn btn-sm" onClick={() => decide(c.id, 'approved', false)}>{t('approve')}</button><button className="btn btn-sm text-bad" disabled={!comment.trim()} onClick={() => decide(c.id, 'returned', false)}>{t('return')}</button></div>
          </div>}
        </div>)))}
      {tab === 'clar' && (clars.length === 0 ? <Empty /> : clars.map(({ c, e, n, it, ans }) => (
        <div key={c.id + n} className="card p-4 flex flex-col gap-2 text-sm">
          <div className="flex flex-wrap items-center gap-2"><a className="code-id no-underline" href={'#/code/' + c.id}>{c.id}</a><span className="code-id">{n}</span><span className="flex-1 min-w-0">{pickText(lang, c.requirements.find(r => String(r.n) === n)!)}</span><span className="text-xs text-muted">{userName(e.userId)} · {fmtDate(it.clarify?.raisedAt)}</span>{ans && <span className="pill pill-ok">{t('replied')}</span>}</div>
          <div className="rounded bg-flag-soft p-2"><b>{t('needsClarification')}:</b> {it.clarify?.question || '—'}</div>
          {ans && <div className="text-muted"><b>{t('clarificationAnswer')}</b> ({fmtDate(ans.answeredAt)}): {ans.answer}</div>}
          <div className="flex gap-2"><input className="input" placeholder={t('reply')} value={reply[c.id + n] || ''} onChange={e2 => setReply(s => ({ ...s, [c.id + n]: e2.target.value }))} /><button className="btn btn-sm" disabled={!(reply[c.id + n] || '').trim()} onClick={() => answer(c.id, n)}>{t('reply')}</button></div>
        </div>)))}
      {tab === 'approved' && (approved.length === 0 ? <Empty /> : <div className="card overflow-x-auto"><table className="tbl"><thead><tr><th>{t('code')}</th><th>{t('requirement')}</th><th>{t('submittedBy')}</th><th>{t('weightedScore')}</th><th>{t('status')}</th><th></th></tr></thead><tbody>
        {approved.map(({ c, e }) => <tr key={c.id}><td><a className="code-id no-underline" href={'#/code/' + c.id}>{c.id}</a></td><td>{pickDesc(lang, c).slice(0, 120)}</td><td>{userName(e.userId)}</td><td className="num">{fmtPct(codeScore(e.answer, c, cfg))}</td><td><StatePill state={e.state} /></td><td><button className="btn btn-sm" onClick={() => { setComment(t('reopen')); decide(c.id, 'returned', false) }}>{t('reopen')}</button></td></tr>)}</tbody></table></div>)}
      <p className="text-xs text-muted m-0">{t('pillar')}: {master.pillars.map(p => p.id + ' ' + pick(lang, p)).join(' · ')}</p>
    </div>
  )
}
