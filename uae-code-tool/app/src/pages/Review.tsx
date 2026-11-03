import { useMemo, useState } from 'react'
import { useApp } from '../store/state'
import { master, effective, codeScore, sortIds, now } from '../store/scoring'
import { pickDesc, pickText } from '../i18n'
import { Avatar, Empty, PageHeader, StatePill, StatusPill, useToast, fmtDate, fmtPct, tone } from '../components/ui'
import { Icon } from '../components/icons'

export default function Review() {
  const { t, lang, snap, user, cycleId, saveReviews } = useApp(); const cfg = snap!.config; const cy = cycleId!
  const toast = useToast()
  const [tab, setTab] = useState<'queue' | 'clar' | 'approved'>('queue')
  const [open, setOpen] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [reply, setReply] = useState<Record<string, string>>({})
  const userName = (id: string | null) => { const u = cfg.users.find(x => x.id === id); return u ? (lang === 'ar' ? u.name_ar : u.name_en) : '—' }
  const rows = useMemo(() => master.codes.map(c => ({ c, e: effective(snap!, cy, c.id) })).sort((a, b) => sortIds(a.c.id, b.c.id)), [snap, cy])
  const queue = rows.filter(r => r.e.state === 'submitted'), approved = rows.filter(r => r.e.state === 'approved')
  const clars = rows.flatMap(r => Object.entries(r.e.answer?.items || {}).filter(([, it]) => it.clarify?.flag).map(([n, it]) => ({ ...r, n, it, ans: snap!.reviews.clarifications?.[cy]?.[r.c.id]?.[n] })))
  const decide = async (codeId: string, state: 'approved' | 'returned', verified: boolean) => {
    const r = JSON.parse(JSON.stringify(snap!.reviews)); r.cycles[cy] = r.cycles[cy] || {}
    r.cycles[cy][codeId] = { state, comment, reviewedBy: user!.id, reviewedAt: now(), evidenceVerified: verified }
    await saveReviews(r, `${state} ${codeId}`); setOpen(null); setComment(''); toast(state === 'approved' ? t('approved') : t('returned'), state === 'approved' ? 'ok' : 'bad')
  }
  const answer = async (codeId: string, n: string) => {
    const r = JSON.parse(JSON.stringify(snap!.reviews)); r.clarifications[cy] = r.clarifications[cy] || {}; r.clarifications[cy][codeId] = r.clarifications[cy][codeId] || {}
    r.clarifications[cy][codeId][n] = { answer: reply[codeId + n] || '', answeredBy: user!.id, answeredAt: now() }
    await saveReviews(r, `clarify ${codeId}/${n}`); setReply(s => ({ ...s, [codeId + n]: '' })); toast(t('replied'), 'ok')
  }
  return (
    <div>
      <PageHeader title={t('review')} sub={`${queue.length} ${t('pending')} · ${clars.length} ${t('clarificationQueue')}`} actions={<div className="seg"><button aria-pressed={tab === 'queue'} onClick={() => setTab('queue')}><Icon name="shield" />{t('pending')} <span className="num">{queue.length}</span></button><button aria-pressed={tab === 'clar'} onClick={() => setTab('clar')}><Icon name="question" />{t('clarificationQueue')} <span className="num">{clars.length}</span></button><button aria-pressed={tab === 'approved'} onClick={() => setTab('approved')}><Icon name="checkCircle" />{t('approved')} <span className="num">{approved.length}</span></button></div>} />
      <div className="flex flex-col gap-3">
        {tab === 'queue' && (queue.length === 0 ? <Empty icon="shield" /> : queue.map(({ c, e }) => <div key={c.id} className="card p-4 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3"><a className="code-id no-underline" href={'#/code/' + c.id}>{c.id}</a><span className="flex-1 min-w-0 text-sm truncate">{pickDesc(lang, c)}</span><span className="flex items-center gap-2 text-xs text-muted"><Avatar name={userName(e.userId)} />{userName(e.userId)} · {fmtDate(e.answer?.submittedAt, lang)}</span><span className={`num font-semibold text-${tone(codeScore(e.answer, c, cfg))}-ink`}>{fmtPct(codeScore(e.answer, c, cfg))}</span>
            <button className="btn btn-sm" onClick={() => { setOpen(open === c.id ? null : c.id); setComment('') }}><Icon name={open === c.id ? 'chevronD' : 'eye'} />{open === c.id ? t('cancel') : t('view')}</button></div>
          {open === c.id && <div className="flex flex-col gap-2 border-t border-line pt-3">
            {c.requirements.map(r => { const it = e.answer!.items[String(r.n)]; return <div key={r.n} className="text-sm panel p-2 flex flex-col gap-1"><div className="flex items-start gap-2"><span className="code-id">{r.n}</span><span className="flex-1">{pickText(lang, r)}</span><StatusPill status={it?.status ?? null} /></div>
              {it?.justification && <div className="text-muted ps-8">{t('justification')}: {it.justification}</div>}
              {it?.evidence?.length ? <div className="ps-8 flex flex-wrap gap-2">{it.evidence.map(ev => <a key={ev.id} className="pill pill-muted no-underline" href={ev.url} target="_blank" rel="noreferrer"><Icon name="link" style={{ width: 12, height: 12 }} />{ev.title || ev.url}</a>)}</div> : null}
              {it?.note && <div className="text-muted ps-8">{t('note')}: {it.note}</div>}</div> })}
            <textarea className="textarea" rows={2} placeholder={t('reviewerComment')} value={comment} onChange={e2 => setComment(e2.target.value)} />
            <div className="flex flex-wrap gap-2 items-center"><button className="btn btn-ok btn-sm" onClick={() => decide(c.id, 'approved', true)}><Icon name="checkCircle" />{t('approve')} · {t('evidenceVerified')}</button><button className="btn btn-sm" onClick={() => decide(c.id, 'approved', false)}><Icon name="check" />{t('approve')}</button><button className="btn btn-danger btn-sm" disabled={!comment.trim()} onClick={() => decide(c.id, 'returned', false)}><Icon name="arrowL" />{t('return')}</button></div>
          </div>}
        </div>))}
        {tab === 'clar' && (clars.length === 0 ? <Empty icon="question" /> : clars.map(({ c, e, n, it, ans }) => <div key={c.id + n} className="card p-4 flex flex-col gap-2 text-sm">
          <div className="flex flex-wrap items-center gap-2"><a className="code-id no-underline" href={'#/code/' + c.id}>{c.id}</a><span className="code-id">{n}</span><span className="flex-1 min-w-0">{pickText(lang, c.requirements.find(r => String(r.n) === n)!)}</span><span className="text-xs text-muted">{userName(e.userId)} · {fmtDate(it.clarify?.raisedAt, lang)}</span>{ans && <span className="pill pill-ok">{t('replied')}</span>}</div>
          <div className="rounded-lg bg-flag-soft text-flag-ink p-3"><b>{t('needsClarification')}:</b> {it.clarify?.question || '—'}</div>
          {ans && <div className="text-muted"><b>{t('clarificationAnswer')}</b> ({fmtDate(ans.answeredAt, lang)}): {ans.answer}</div>}
          <div className="flex gap-2"><input className="input" placeholder={t('reply')} value={reply[c.id + n] || ''} onChange={e2 => setReply(s => ({ ...s, [c.id + n]: e2.target.value }))} onKeyDown={e2 => { if (e2.key === 'Enter' && (reply[c.id + n] || '').trim()) answer(c.id, n) }} /><button className="btn btn-sm" disabled={!(reply[c.id + n] || '').trim()} onClick={() => answer(c.id, n)}><Icon name="send" />{t('reply')}</button></div>
        </div>))}
        {tab === 'approved' && (approved.length === 0 ? <Empty icon="checkCircle" /> : <div className="card overflow-x-auto"><table className="tbl"><thead><tr><th>{t('code')}</th><th>{t('requirement')}</th><th>{t('submittedBy')}</th><th>{t('score')}</th><th>{t('status')}</th><th></th></tr></thead><tbody>
          {approved.map(({ c, e }) => <tr key={c.id}><td><a className="code-id no-underline" href={'#/code/' + c.id}>{c.id}</a></td><td className="text-sm">{pickDesc(lang, c).slice(0, 120)}</td><td>{userName(e.userId)}</td><td className={`num font-semibold text-${tone(codeScore(e.answer, c, cfg))}-ink`}>{fmtPct(codeScore(e.answer, c, cfg))}</td><td><StatePill state={e.state} /></td><td><button className="btn btn-sm" onClick={() => { setComment(t('reopen')); decide(c.id, 'returned', false) }}><Icon name="refresh" />{t('reopen')}</button></td></tr>)}</tbody></table></div>)}
      </div>
    </div>
  )
}
