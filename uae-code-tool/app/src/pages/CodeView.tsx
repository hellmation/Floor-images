import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../store/state'
import { codeById, subById, pillarById, assigneeOf, effective, effectiveImpact, master, sortIds, uid, now } from '../store/scoring'
import { pick, pickDesc, pickText } from '../i18n'
import { ImpactPill, Pill, StatePill, StatusPill, fmtDate } from '../components/ui'
import type { AnswerStatus, CodeAnswer, ItemAnswer } from '../types'

const emptyItem = (): ItemAnswer => ({ status: null, evidence: [], clarify: { flag: false, question: '' } })

export default function CodeView({ id }: { id: string }) {
  const { t, lang, snap, user, isAdmin, cycleId, saveMyAnswer, saveConfig } = useApp()
  const code = codeById.get(id)
  const cfg = snap!.config; const cy = cycleId!
  const cycle = cfg.cycles.find(c => c.id === cy)
  const assignee = code ? assigneeOf(code.id, cy, cfg) : null
  const eff = code ? effective(snap!, cy, code.id) : null
  const myOwn = code ? snap!.answers[user!.id]?.cycles?.[cy]?.[code.id] : undefined
  const locked = eff?.state === 'submitted' || eff?.state === 'approved'
  const canEdit = !!code && (user!.id === assignee || isAdmin) && cycle?.status === 'open' && !locked

  // form state
  const [items, setItems] = useState<Record<string, ItemAnswer>>({})
  const [carried, setCarried] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  useEffect(() => {
    if (!code) return
    const base = myOwn || eff?.answer || null
    let src = base, carry: string | null = null
    if (!src && cycle?.prefillFrom) { const prev = effective(snap!, cycle.prefillFrom, code.id); if (prev.answer) { src = prev.answer; carry = cycle.prefillFrom } }
    const next: Record<string, ItemAnswer> = {}
    for (const r of code.requirements) next[String(r.n)] = src?.items[String(r.n)] ? { ...emptyItem(), ...JSON.parse(JSON.stringify(src.items[String(r.n)])) } : emptyItem()
    setItems(next); setCarried(carry || base?.carriedFrom || null); setMsg(null); setConfirm(false)
  }, [code, cy, myOwn, eff?.answer, cycle?.prefillFrom, snap])

  const ordered = useMemo(() => [...master.codes].sort((a, b) => sortIds(a.id, b.id)), [])
  if (!code) return <div className="card p-6">Unknown code {id}</div>
  const idx = ordered.findIndex(c => c.id === code.id)
  const prev = ordered[idx - 1], next = ordered[idx + 1]
  const sub = subById.get(code.sub)!, pil = pillarById.get(code.pillar)!
  const paired = code.criteria.length === code.requirements.length
  const linked = (cfg.mapping[code.id] || []).map(p => cfg.projects.find(x => x.id === p)).filter(Boolean)
  const userName = (uid: string | null) => { const u = cfg.users.find(x => x.id === uid); return u ? (lang === 'ar' ? u.name_ar : u.name_en) : t('unassigned') }
  const clarAnswers = snap!.reviews.clarifications?.[cy]?.[code.id] || {}

  const upd = (n: number, patch: Partial<ItemAnswer>) => setItems(s => ({ ...s, [n]: { ...s[n], ...patch } }))
  const blockers = (): string[] => {
    const b: string[] = []
    const vals = code.requirements.map(r => items[String(r.n)])
    if (vals.some(v => !v?.status)) b.push(t('needAllStatuses'))
    if (cfg.settings.requireEvidence && vals.some(v => (v?.status === 'yes' || v?.status === 'partial') && !v.evidence.length)) b.push(t('needEvidence'))
    if (vals.some(v => v?.status === 'na' && !v.justification?.trim())) b.push(t('needJustification'))
    if (vals.some(v => v?.clarify?.flag)) b.push(t('openClarification'))
    return b
  }
  const save = async (state: 'draft' | 'submitted') => {
    const a: CodeAnswer = { state, updatedAt: now(), submittedAt: state === 'submitted' ? now() : myOwn?.submittedAt, items, carriedFrom: carried }
    await saveMyAnswer(cy, code.id, a); setMsg(t('saved')); setConfirm(false); setTimeout(() => setMsg(null), 2500)
  }
  const override = async (uidv: string) => {
    const c = JSON.parse(JSON.stringify(cfg)); c.overrides[cy] = c.overrides[cy] || {}
    if (uidv) c.overrides[cy][code.id] = uidv; else delete c.overrides[cy][code.id]
    await saveConfig(c, `override ${code.id} -> ${uidv || 'auto'}`)
  }
  const bl = canEdit ? blockers() : []

  return (
    <div className="flex flex-col gap-4 max-w-5xl">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <a href="#/browse" className="no-underline">{t('browse')}</a><span>›</span><span>{pil.id} {pick(lang, pil)}</span><span>›</span><span>{sub.id} {pick(lang, sub)}</span>
        <span className="ms-auto flex gap-1">{prev && <a className="btn btn-sm" href={'#/code/' + prev.id}>‹ {prev.id}</a>}{next && <a className="btn btn-sm" href={'#/code/' + next.id}>{next.id} ›</a>}</span>
      </div>
      <div className="card p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="code-id text-lg">{code.id}</span><ImpactPill impact={effectiveImpact(code, cfg)} /><StatePill state={eff!.state} />
          {code.flags.map(f => <Pill key={f} kind="flag">{t(f === 'duplicate_id_in_pdf' ? 'flagDuplicate' : 'flagImpact')}</Pill>)}
          <span className="ms-auto text-xs text-muted">{t('pdfPage')} {code.pdf_page}</span>
        </div>
        <p className="m-0 text-base leading-relaxed">{pickDesc(lang, code)}</p>
        <p className="m-0 text-sm text-muted leading-relaxed" dir={lang === 'ar' ? 'ltr' : 'rtl'}>{lang === 'ar' ? code.desc_en : code.desc_ar}</p>
        <div className="flex flex-wrap gap-3 text-sm items-center">
          <span><span className="text-muted">{t('assignedTo')}:</span> <b>{userName(assignee)}</b>{cfg.overrides[cy]?.[code.id] && <span className="text-muted"> ({t('overrideAssignee')})</span>}</span>
          {isAdmin && <select className="select !w-auto !py-1 text-xs" value={cfg.overrides[cy]?.[code.id] || ''} onChange={e => override(e.target.value)}><option value="">auto</option>{cfg.users.filter(u => u.active).map(u => <option key={u.id} value={u.id}>{lang === 'ar' ? u.name_ar : u.name_en}</option>)}</select>}
          <span><span className="text-muted">{t('mappedProjects')}:</span> {linked.length ? linked.map(p => <span key={p!.id} className="pill pill-accent me-1">{pick(lang, p!)}</span>) : <span className="text-muted">—</span>}</span>
          {eff!.userId && <span className="text-muted">{t('submittedBy')}: {userName(eff!.userId)} · {fmtDate(eff!.answer?.updatedAt)}</span>}
        </div>
        {!canEdit && cycle?.status === 'open' && !locked && <div className="text-sm text-warn">{t('readOnly')} · {t('requestChange')}</div>}
        {carried && <div className="text-sm px-3 py-2 rounded bg-warn-soft text-warn">{t('carried')} ({carried})</div>}
        {eff!.review && (eff!.state === 'returned' || eff!.state === 'approved') && <div className={`text-sm px-3 py-2 rounded ${eff!.state === 'returned' ? 'bg-bad-soft text-bad' : 'bg-ok-soft text-ok'}`}><b>{t('reviewerComment')}</b> ({userName(eff!.review.reviewedBy)}, {fmtDate(eff!.review.reviewedAt)}): {eff!.review.comment || '—'}</div>}
      </div>

      {code.requirements.map((r, i) => {
        const it = items[String(r.n)] || emptyItem(); const ca = clarAnswers[String(r.n)]
        const projOpts = [...linked.map(p => p!), ...cfg.projects.filter(p => p.active && !linked.some(l => l!.id === p.id))]
        return (
          <section key={r.n} className="card p-4 flex flex-col gap-3">
            <div className="flex items-start gap-3"><span className="code-id">{r.n}</span><div className="flex-1 min-w-0">
              <div className="font-medium">{pickText(lang, r)}</div>
              <div className="text-sm text-muted" dir={lang === 'ar' ? 'ltr' : 'rtl'}>{lang === 'ar' ? r.text_en : r.text_ar}</div>
              {paired && code.criteria[i] && <div className="text-sm mt-1"><span className="label">{t('criterion')}:</span> {pickText(lang, code.criteria[i])}</div>}
            </div>{!canEdit && <StatusPill status={it.status} />}</div>
            {canEdit ? (
              <>
                <div className="flex flex-wrap gap-3 items-center">
                  <div className="seg" role="group" aria-label={t('status')}>{(['yes', 'partial', 'no', 'na'] as AnswerStatus[]).map(s => <button key={s} aria-pressed={it.status === s} onClick={() => upd(r.n, { status: s })}>{t(s)}</button>)}</div>
                  <label className="flex items-center gap-1 text-sm ms-auto"><input type="checkbox" checked={!!it.clarify?.flag} onChange={e => upd(r.n, { clarify: { flag: e.target.checked, question: it.clarify?.question || '', raisedAt: e.target.checked ? now() : it.clarify?.raisedAt } })} /> <span className="text-flag font-medium">{t('needsClarification')}</span></label>
                </div>
                {it.clarify?.flag && <div className="rounded bg-flag-soft p-2 flex flex-col gap-1"><label className="label">{t('clarificationQuestion')}</label><textarea className="textarea" rows={2} value={it.clarify.question} onChange={e => upd(r.n, { clarify: { ...it.clarify!, question: e.target.value } })} />{ca && <div className="text-sm"><b>{t('clarificationAnswer')}</b> ({fmtDate(ca.answeredAt)}): {ca.answer} <button className="btn btn-sm ms-2" onClick={() => upd(r.n, { clarify: { flag: false, question: it.clarify!.question } })}>{t('clearFlag')}</button></div>}</div>}
                {!it.clarify?.flag && ca && <div className="text-sm text-muted"><b>{t('clarificationAnswer')}</b>: {ca.answer}</div>}
                {it.status === 'na' && <div><label className="label">{t('justification')}</label><textarea className="textarea" rows={2} value={it.justification || ''} onChange={e => upd(r.n, { justification: e.target.value })} /></div>}
                <div><div className="label">{t('evidence')}</div>
                  <ul className="m-0 p-0 list-none flex flex-col gap-1">{it.evidence.map(ev => <li key={ev.id} className="flex items-center gap-2 text-sm"><a href={ev.url} target="_blank" rel="noreferrer" className="truncate">{ev.title || ev.url}</a><button className="btn btn-sm ms-auto" onClick={() => upd(r.n, { evidence: it.evidence.filter(x => x.id !== ev.id) })}>×</button></li>)}</ul>
                  <EvidenceAdd onAdd={(title, url) => upd(r.n, { evidence: [...it.evidence, { id: uid(), type: 'link', title, url, addedAt: now(), addedBy: user!.id }] })} />
                </div>
                <div className="grid sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-1"><label className="label">{t('project')}</label><select className="select" value={it.projectId || ''} onChange={e => upd(r.n, { projectId: e.target.value || null })}><option value="">—</option>{projOpts.map(p => <option key={p.id} value={p.id}>{pick(lang, p)}</option>)}</select></div>
                  <div><label className="label">{t('service')}</label><input className="input" value={it.service || ''} onChange={e => upd(r.n, { service: e.target.value })} /></div>
                  <div><label className="label">{t('note')}</label><input className="input" value={it.note || ''} onChange={e => upd(r.n, { note: e.target.value })} /></div>
                </div>
              </>
            ) : (
              <ReadOnly it={it} ca={ca} projName={it.projectId ? pick(lang, cfg.projects.find(p => p.id === it.projectId) || { name_ar: it.projectId }) : ''} />
            )}
          </section>
        )
      })}
      {!paired && code.criteria.length > 0 && <section className="card p-4"><div className="label mb-1">{t('criteria')}</div><ol className="m-0 ps-5">{code.criteria.map(c => <li key={c.n}>{pickText(lang, c)}</li>)}</ol></section>}

      {canEdit && (
        <div className="card p-4 flex flex-wrap items-center gap-3 sticky bottom-0">
          <button className="btn" onClick={() => save('draft')}>{t('saveDraft')}</button>
          {!confirm ? <button className="btn btn-primary" disabled={bl.length > 0} onClick={() => setConfirm(true)}>{t('submit')}</button>
            : <span className="flex items-center gap-2 text-sm"><span>{t('confirmSubmit')}</span><button className="btn btn-primary btn-sm" onClick={() => save('submitted')}>{t('confirm')}</button><button className="btn btn-sm" onClick={() => setConfirm(false)}>{t('cancel')}</button></span>}
          {msg && <span className="text-ok text-sm">{msg}</span>}
          {bl.length > 0 && <ul className="m-0 ps-5 text-sm text-muted">{bl.map(b => <li key={b}>{b}</li>)}</ul>}
        </div>
      )}
    </div>
  )
}

function EvidenceAdd({ onAdd }: { onAdd: (title: string, url: string) => void }) {
  const { t } = useApp(); const [title, setTitle] = useState(''); const [url, setUrl] = useState('')
  return <div className="flex flex-wrap gap-2 mt-1"><input className="input flex-1 min-w-32" placeholder="Title / العنوان" value={title} onChange={e => setTitle(e.target.value)} /><input className="input flex-[2] min-w-48" placeholder="https:// or \\\\server\\share\\…" value={url} onChange={e => setUrl(e.target.value)} />
    <button className="btn btn-sm" disabled={!url.trim()} onClick={() => { onAdd(title.trim(), url.trim()); setTitle(''); setUrl('') }}>{t('addLink')}</button></div>
}
function ReadOnly({ it, ca, projName }: { it: ItemAnswer; ca?: { answer: string }; projName: string }) {
  const { t } = useApp()
  return <div className="text-sm flex flex-col gap-1">
    {it.status === 'na' && it.justification && <div><span className="label">{t('justification')}:</span> {it.justification}</div>}
    {it.evidence.length > 0 && <div><span className="label">{t('evidence')}:</span> {it.evidence.map(e => <a key={e.id} className="me-2" href={e.url} target="_blank" rel="noreferrer">{e.title || e.url}</a>)}</div>}
    {(projName || it.service || it.note) && <div className="text-muted">{projName && <span className="me-3">{t('project')}: {projName}</span>}{it.service && <span className="me-3">{t('service')}: {it.service}</span>}{it.note && <span>{t('note')}: {it.note}</span>}</div>}
    {it.clarify?.flag && <div className="text-flag">? {t('needsClarification')}: {it.clarify.question}{ca && <span className="text-muted"> · {t('replied')}: {ca.answer}</span>}</div>}
  </div>
}
