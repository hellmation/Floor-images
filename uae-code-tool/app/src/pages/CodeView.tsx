import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../store/state'
import { codeById, subById, pillarById, assigneeOf, effective, effectiveImpact, master, sortIds, uid, now, departmentOf, supportDepartments, deptName, evPartsPending, evPartsAnswered } from '../store/scoring'
import { pick, pickDesc, pickText } from '../i18n'
import { ImpactPill, Pill, StatePill, StatusPill, Modal, Empty, useToast, fmtDate, errMsg, fmtDay } from '../components/ui'
import { Icon } from '../components/icons'
import { EvidenceRate } from '../components/EvidenceRate'
import { EvidencePartsEdit, EvidencePartsView, partsAnswered } from '../components/EvidenceParts'
import type { AnswerStatus, CodeAnswer, ItemAnswer, EvidenceStrength, ReviewsFile } from '../types'

const emptyItem = (): ItemAnswer => ({ status: null, evidence: [], clarify: { flag: false, question: '' } })

export default function CodeView({ id }: { id: string }) {
  const { t, lang, snap, user, isAdmin, cycleId, saveMyAnswer, saveMyNote, saveMyDepartment, saveConfig, saveReviews } = useApp()
  const toast = useToast()
  const code = codeById.get(id)
  const cfg = snap!.config; const cy = cycleId!
  const cycle = cfg.cycles.find(c => c.id === cy)
  const assignee = code ? assigneeOf(code.id, cy, cfg) : null
  const eff = code ? effective(snap!, cy, code.id) : null
  const myOwn = code ? snap!.answers[user!.id]?.cycles?.[cy]?.[code.id] : undefined
  const locked = eff?.state === 'submitted' || eff?.state === 'approved'
  const canEdit = !!code && (user!.id === assignee || isAdmin) && cycle?.status === 'open' && !locked
  const [items, setItems] = useState<Record<string, ItemAnswer>>({})
  const [carried, setCarried] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [deptConfirmed, setDeptConfirmed] = useState(false)
  /* Evidence questions answered after submission: the owner of a submitted or approved answer may still answer the three
   * questions where they are unanswered. Only that field is written; state, submittedAt and the review stay as they are. */
  const [late, setLate] = useState<Record<string, NonNullable<ItemAnswer['evidenceParts']>>>({})
  const canLate = !!code && locked && !!eff?.answer && eff.userId === user!.id && (cycle?.status === 'open' || cycle?.status === 'review')
  const latePending = Object.keys(late).length > 0
  /* Form initialisation. The form is (re)built from the stored answer only when the code or cycle changes, or when the
   * stored answer changes while there are NO unsaved edits. If it changes while the person is editing (someone else saved
   * this code, or a refresh brought a newer copy), their edits are kept and a banner offers to load the newer version. */
  const pageKey = `${code?.id}|${cy}`
  const storedKey = `${myOwn?.updatedAt || ''}|${eff?.answer?.updatedAt || ''}|${eff?.userId || ''}|${cycle?.prefillFrom || ''}|${eff?.edited?.at || ''}`
  const [stale, setStale] = useState(false)
  const seenStored = useRef(storedKey)
  const [initTick, setInitTick] = useState(0)
  useEffect(() => { seenStored.current = storedKey; setStale(false); setInitTick(t => t + 1) }, [pageKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const justSaved = useRef(false); const itemsRef = useRef(items); itemsRef.current = items
  useEffect(() => {
    if (storedKey === seenStored.current) return
    if (justSaved.current) { justSaved.current = false; seenStored.current = storedKey; return } // echo of my own save: keep the form as it is
    if (dirty) { setStale(true); return }
    seenStored.current = storedKey; setInitTick(t => t + 1)
  }, [storedKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const loadLatest = () => { seenStored.current = storedKey; setStale(false); setInitTick(t => t + 1) }
  useEffect(() => {
    if (!code) return
    const base = (eff?.userId === user!.id ? eff.answer : null) || myOwn || eff?.answer || null
    let src = base, carry: string | null = null
    if (!src && cycle?.prefillFrom) { const prev = effective(snap!, cycle.prefillFrom, code.id); if (prev.answer) { src = prev.answer; carry = cycle.prefillFrom } }
    const next: Record<string, ItemAnswer> = {}
    for (const r of code.requirements) { next[String(r.n)] = src?.items[String(r.n)] ? { ...emptyItem(), ...JSON.parse(JSON.stringify(src.items[String(r.n)])) } : emptyItem()
      if (carry) next[String(r.n)].clarify = { flag: false, question: '' } } // a carried answer never carries an open clarification
    setItems(next); setCarried(carry || base?.carriedFrom || null); setConfirm(false); setDirty(false); setLate({}); setDeptConfirmed(!!base?.deptConfirmed)
  }, [initTick]) // eslint-disable-line react-hooks/exhaustive-deps
  const ordered = useMemo(() => [...master.codes].sort((a, b) => sortIds(a.id, b.id)), [])
  // unsaved edits: warn before the tab closes and before any in-app navigation (App.useHash consults the guard)
  const dirtyRef = useRef(false); dirtyRef.current = dirty || latePending
  useEffect(() => {
    window.__leaveGuard = () => !dirtyRef.current || window.confirm(t('unsavedLeave'))
    const bu = (e: BeforeUnloadEvent) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = '' } }
    addEventListener('beforeunload', bu); return () => { removeEventListener('beforeunload', bu); window.__leaveGuard = undefined }
  }, [t])
  useEffect(() => { const f = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return; const idx = ordered.findIndex(c => c.id === id); const fwd = document.documentElement.dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight', back = fwd === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft'; if (e.altKey && e.key === fwd && ordered[idx + 1]) location.hash = '#/code/' + ordered[idx + 1].id; if (e.altKey && e.key === back && ordered[idx - 1]) location.hash = '#/code/' + ordered[idx - 1].id }; addEventListener('keydown', f); return () => removeEventListener('keydown', f) }, [id, ordered])
  if (!code) return <Empty icon="search" title={`${t('unknownCode')}: ${id}`}><a className="btn btn-sm no-underline mt-2" href="#/browse"><Icon name="book" />{t('backToBrowse')}</a></Empty>
  const idx = ordered.findIndex(c => c.id === code.id); const prev = ordered[idx - 1], next = ordered[idx + 1]
  const sub = subById.get(code.sub)!, pil = pillarById.get(code.pillar)!
  const paired = code.criteria.length === code.requirements.length
  const linked = (cfg.mapping[code.id] || []).map(p => cfg.projects.find(x => x.id === p)).filter(Boolean)
  const userName = (uidv: string | null) => { const u = cfg.users.find(x => x.id === uidv); return u ? (lang === 'ar' ? u.name_ar : u.name_en) : t('unassigned') }
  const clarAnswers = snap!.reviews.clarifications?.[cy]?.[code.id] || {}
  const upd = (n: number, patch: Partial<ItemAnswer>) => { setItems(s => ({ ...s, [n]: { ...s[n], ...patch } })); setDirty(true) }
  const vals = code.requirements.map(r => items[String(r.n)])
  const checks: [boolean, string][] = [
    [vals.every(v => v?.status), t('needAllStatuses')],
    [!cfg.settings.requireEvidence || vals.every(v => v?.status !== 'yes' || v.evidence.length > 0), t('needEvidence')],
    [vals.every(v => v?.status !== 'yes' || partsAnswered(v)), t('evPartsMissing')],
    [vals.every(v => v?.status !== 'na' || !!v.justification?.trim()), t('needJustification')],
    [!vals.some(v => v?.clarify?.flag), t('openClarification')],
    ...(cfg.deptConfirm?.[code.id] ? [[deptConfirmed, t('needDeptConfirm')] as [boolean, string]] : []),
  ]
  const ok = checks.every(c => c[0])
  const save = async (state: 'draft' | 'submitted') => {
    if (busy) return; setBusy(true)
    const snapshotItems = itemsRef.current
    const a: CodeAnswer = { state, updatedAt: now(), submittedAt: state === 'submitted' ? now() : myOwn?.submittedAt, items: snapshotItems, carriedFrom: carried, deptConfirmed }
    justSaved.current = true
    try {
      const stored = await saveMyAnswer(cy, code.id, a)
      setConfirm(false); setStale(false)
      // clicks made while the write was in flight stay unsaved (dirty) instead of being forgotten
      setDirty(itemsRef.current !== snapshotItems)
      if (stored && stored.updatedAt !== a.updatedAt) { justSaved.current = false; toast(t('savedSuperseded'), 'bad') }
      else toast(state === 'submitted' ? t('submitted') : t('saved'), 'ok')
    }
    catch (e) { justSaved.current = false; toast(errMsg(e, t), 'bad') } finally { setBusy(false) }
  }
  const lateNeeded = locked ? evPartsPending(eff?.answer) : 0
  /* Administrator evidence adjustment on a submitted or approved answer. Stored in reviews.json bound to that submission,
   * so the evaluator's file is never written by someone else and the code keeps its state and approval. */
  const [evEdit, setEvEdit] = useState<string | null>(null)
  const canAdminEv = isAdmin && locked && !!eff?.answer && (cycle?.status === 'open' || cycle?.status === 'review')
  const saveEvEdit = async (n: string, evidence: ItemAnswer['evidence'], parts: NonNullable<ItemAnswer['evidenceParts']>) => {
    if (busy || !canAdminEv) return; setBusy(true)
    const a = eff!.answer!; const bind = { userId: eff!.userId, submittedAt: a.submittedAt || a.updatedAt }
    const r = JSON.parse(JSON.stringify(snap!.reviews)) as ReviewsFile; r.evidenceEdits = r.evidenceEdits || {}; r.evidenceEdits[cy] = r.evidenceEdits[cy] || {}
    const cur = r.evidenceEdits[cy][code.id]; const same = cur && cur.userId === bind.userId && cur.submittedAt === bind.submittedAt
    const hasParts = (['doc', 'exec', 'monitor'] as const).some(k => typeof parts[k] === 'boolean')
    r.evidenceEdits[cy][code.id] = { ...bind, by: user!.id, at: now(), items: { ...(same ? cur.items : {}), [n]: { evidence, ...(hasParts ? { evidenceParts: parts } : {}), by: user!.id, at: now() } } }
    try { await saveReviews(r, `evidence-edit ${code.id}/${n}`); setEvEdit(null); toast(t('evidenceEditSaved'), 'ok') }
    catch (e) { toast(errMsg(e, t), 'bad') } finally { setBusy(false) }
  }
  const saveLate = async () => {
    if (busy || !canLate || !latePending) return; setBusy(true)
    const cur = eff!.answer!; const nextItems = { ...cur.items }
    for (const [n, parts] of Object.entries(late)) { const it = nextItems[n]; if (!it) continue; const merged = { ...(it.evidenceParts || {}) }
      for (const k of ['doc', 'exec', 'monitor'] as const) if (typeof merged[k] !== 'boolean' && typeof parts[k] === 'boolean') merged[k] = parts[k] // answered questions stay as they were
      nextItems[n] = { ...it, evidenceParts: merged } }
    try { await saveMyAnswer(cy, code.id, { ...cur, updatedAt: now(), items: nextItems }, 'evidence-questions'); setLate({}); toast(t('evLateSaved'), 'ok') }
    catch (e) { toast(errMsg(e, t), 'bad') } finally { setBusy(false) }
  }
  const override = async (uidv: string) => { const c = JSON.parse(JSON.stringify(cfg)); c.overrides[cy] = c.overrides[cy] || {}; if (uidv) c.overrides[cy][code.id] = uidv; else delete c.overrides[cy][code.id]; try { await saveConfig(c, `override ${code.id} -> ${uidv || 'auto'}`) } catch (e) { toast(errMsg(e, t), 'bad') } }
  const otherPending = !!myOwn && eff!.userId !== user!.id && (eff!.state === 'submitted' || eff!.state === 'approved')
  const codeDept = departmentOf(snap!, cy, code.id); const supports = supportDepartments(cfg, code.id); const depts = cfg.departments.filter(d => d.active)
  const canSetDept = cycle?.status === 'open' && (user!.id === assignee || isAdmin)
  /* The owner's choice is stored in their own file; an admin who is not the owner changes the configured default instead. */
  const setDept = async (id: string) => { try { if (user!.id === assignee) await saveMyDepartment(code.id, id || null)
      else { const c = JSON.parse(JSON.stringify(cfg)) as typeof cfg; c.deptMapping[code.id] = [id || cfg.deptMapping[code.id]?.[0] || '', ...supports].filter(Boolean); await saveConfig(c, `department ${code.id} -> ${id || 'default'}`) }
      toast(t('saved'), 'ok') } catch (e) { toast(errMsg(e, t), 'bad') } }
  const adminShadow = isAdmin && assignee !== user!.id && !locked && cycle?.status === 'open'
  const answered = vals.filter(v => v?.status).length
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted mb-3">
        <a href="#/my" className="btn btn-sm no-underline"><Icon name={lang === 'ar' ? 'arrowR' : 'arrowL'} />{t('backToMyWork')}</a>
        <a href="#/browse" className="no-underline">{t('browse')}</a><Icon name={lang === 'ar' ? 'chevronL' : 'chevronR'} /><a href={'#/browse?p=' + pil.id} className="no-underline">{pil.id} {pick(lang, pil)}</a><Icon name={lang === 'ar' ? 'chevronL' : 'chevronR'} /><span>{sub.id} {pick(lang, sub)}</span>
        <span className="ms-auto flex gap-1">{prev && <a className="btn btn-sm no-underline" href={'#/code/' + prev.id} title={t('prevCode')}><Icon name={lang === 'ar' ? 'chevronR' : 'chevronL'} />{prev.id}</a>}{next && <a className="btn btn-sm no-underline" href={'#/code/' + next.id} title={t('nextCode')}>{next.id}<Icon name={lang === 'ar' ? 'chevronL' : 'chevronR'} /></a>}</span>
      </div>
      <div className="grid lg:grid-cols-[1fr_300px] gap-4 items-start">
        <div className="flex flex-col gap-4 min-w-0">
          <div className="card card-raised p-5 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2"><span className="code-id text-lg !px-3">{code.id}</span><ImpactPill impact={effectiveImpact(code, cfg)} /><StatePill state={eff!.state} />{code.flags.map(f => <Pill key={f} kind="flag">{t(f === 'duplicate_id_in_pdf' ? 'flagDuplicate' : f === 'duplicate_item_in_pdf' ? 'flagDupItem' : f === 'criteria_mismatch_in_pdf' ? 'flagCriteria' : 'flagImpact')}</Pill>)}<span className="ms-auto text-xs text-muted">{t('pdfPage')} {code.pdf_page}</span></div>
            <p className="m-0 text-base leading-relaxed">{pickDesc(lang, code)}</p>
            {cycle && cycle.status !== 'open' && <div className="text-sm text-warn-ink bg-warn-soft rounded-lg px-3 py-2 flex items-center gap-2"><Icon name="clock" />{t(cycle.status === 'closed' ? 'cycleClosedNotice' : cycle.status === 'review' ? 'cycleReviewNotice' : 'cyclePlanningNotice')}</div>}
            {!canEdit && cycle?.status === 'open' && !locked && <div className="text-sm text-warn-ink bg-warn-soft rounded-lg px-3 py-2 flex items-center gap-2"><Icon name="eye" />{t('readOnly')} · {t('requestChange')}</div>}
            {stale && <div className="text-sm text-warn-ink bg-warn-soft rounded-lg px-3 py-2 flex flex-wrap items-center gap-2" role="alert"><Icon name="alert" className="shrink-0" /><span className="flex-1 min-w-48">{t('staleEdit')}</span><button className="btn btn-sm" onClick={() => setStale(false)}>{t('keepMine')}</button><button className="btn btn-sm" onClick={loadLatest}>{t('loadLatest')}</button></div>}
            {lateNeeded > 0 && (canLate
              ? <div className="text-sm text-warn-ink bg-warn-soft rounded-lg px-3 py-2 flex flex-wrap items-center gap-2" role="status"><Icon name="alert" className="shrink-0" /><span className="flex-1 min-w-48">{t('evLateBanner')}</span><button className="btn btn-sm btn-primary" disabled={!latePending || busy} onClick={saveLate}><Icon name="check" />{t('evLateSave')}</button></div>
              : <div className="text-sm text-muted bg-surface-2 rounded-lg px-3 py-2 flex items-center gap-2"><Icon name="clock" />{t('evLateWaiting')} ({userName(eff!.userId)})</div>)}
            {otherPending && <div className="text-sm text-info-ink bg-info-soft rounded-lg px-3 py-2 flex items-center gap-2"><Icon name="info" />{t('pendingOther')} ({userName(eff!.userId)})</div>}
            {adminShadow && <div className="text-sm text-info-ink bg-info-soft rounded-lg px-3 py-2 flex items-center gap-2"><Icon name="shield" />{t('adminShadow')}</div>}
            {carried && <div className="text-sm text-info-ink bg-info-soft rounded-lg px-3 py-2 flex items-center gap-2"><Icon name="clock" />{t('carried')} (<bdi dir="ltr">{carried}</bdi>)</div>}
            {eff!.review && (eff!.state === 'returned' || eff!.state === 'approved' || (eff!.state === 'draft' && eff!.review.state === 'returned' && (!eff!.review.userId || eff!.review.userId === eff!.userId))) && <div className={`text-sm rounded-lg px-3 py-2 ${eff!.state === 'approved' ? 'bg-ok-soft text-ok-ink' : 'bg-bad-soft text-bad-ink'}`}><b>{t('reviewerComment')}</b> ({userName(eff!.review.reviewedBy)}, {fmtDate(eff!.review.reviewedAt, lang)}): {eff!.review.comment === 'reopened' ? t('reopen') : (eff!.review.comment || '—')}</div>}
          </div>
          {code.requirements.map((r, i) => {
            const it = items[String(r.n)] || emptyItem(); const ca = clarAnswers[String(r.n)]
            const projOpts = [...linked.map(p => p!), ...cfg.projects.filter(p => p.active && !linked.some(l => l!.id === p.id))]
            return <section key={r.n} id={'req-' + r.n} className="card p-4 flex flex-col gap-3 scroll-mt-20">
              <div className="flex items-start gap-3"><span className={`inline-grid place-items-center w-7 h-7 rounded-full text-xs font-bold shrink-0 ${it.status ? ({ yes: 'bg-ok text-[var(--on-status)]', partial: 'bg-warn text-[var(--on-status)]', no: 'bg-bad text-[var(--on-status)]', na: 'bg-fg-2 text-surface' } as Record<string, string>)[it.status] : 'bg-surface-3 text-fg-2'}`}>{r.n}</span>
                <div className="flex-1 min-w-0"><div className="font-semibold leading-snug">{pickText(lang, r)}</div>{paired && code.criteria[i] && <div className="text-sm text-muted mt-1 flex gap-1.5"><Icon name="target" className="shrink-0 mt-0.5" style={{ width: 14, height: 14 }} /><span><span className="font-medium text-fg-2">{t('criterion')}:</span> {pickText(lang, code.criteria[i])}</span></div>}</div>{!canEdit && <StatusPill status={it.status} />}</div>
              {canEdit ? <>
                <div className="flex flex-wrap gap-3 items-center">
                  <div className="seg seg-status" role="group" aria-label={t('status')}>{(['yes', 'partial', 'no', 'na'] as AnswerStatus[]).map(s => <button key={s} data-v={s} aria-pressed={it.status === s} onClick={() => upd(r.n, s === 'na' ? { status: s } : { status: s, justification: '' })}>{t(s)}</button>)}</div>
                  <label className={`flex items-center gap-1.5 text-sm ms-auto cursor-pointer px-2 py-1 rounded-lg ${it.clarify?.flag ? 'bg-flag-soft text-flag-ink' : 'text-muted hover:text-fg'}`}><input type="checkbox" checked={!!it.clarify?.flag} onChange={e => upd(r.n, { clarify: { flag: e.target.checked, question: it.clarify?.question || '', raisedAt: e.target.checked ? now() : it.clarify?.raisedAt } })} /><Icon name="question" />{t('needsClarification')}</label>
                </div>
                {it.clarify?.flag && <div className="rounded-lg bg-flag-soft p-3 flex flex-col gap-1"><label className="label" htmlFor={`req-${r.n}-q`}>{t('clarificationQuestion')}</label><textarea id={`req-${r.n}-q`} className="textarea" rows={2} value={it.clarify.question} onChange={e => upd(r.n, { clarify: { ...it.clarify!, question: e.target.value } })} />{ca && <div className="text-sm mt-1"><b>{t('clarificationAnswer')}</b> ({fmtDate(ca.answeredAt, lang)}): {ca.answer} <button className="btn btn-sm ms-2" onClick={() => upd(r.n, { clarify: { flag: false, question: it.clarify!.question } })}><Icon name="check" />{t('clearFlag')}</button></div>}</div>}
                {!it.clarify?.flag && ca && <div className="text-sm text-muted"><b>{t('clarificationAnswer')}</b>: {ca.answer}</div>}
                {it.status === 'na' && <div className="field"><label className="label" htmlFor={`req-${r.n}-j`}>{t('justification')}</label><textarea id={`req-${r.n}-j`} className="textarea" rows={2} value={it.justification || ''} onChange={e => upd(r.n, { justification: e.target.value })} /></div>}
                <div><div className="label">{t('evidence')}</div>
                  <p className="text-xs text-muted m-0 mb-2 flex items-start gap-1.5"><Icon name="folder" className="shrink-0 mt-0.5" style={{ width: 13, height: 13 }} /><span>{t('evidenceHow')} {t('evOneLink')}</span></p>
                  {it.evidence.length > 0 && <ul className="m-0 mb-2 p-0 list-none flex flex-col gap-1">{it.evidence.map(ev => <li key={ev.id} className="flex items-center gap-2 text-sm panel px-2 py-1.5"><Icon name="link" className="text-muted" /><a href={ev.url} target="_blank" rel="noreferrer" className="truncate flex-1">{ev.title || ev.url}</a><select className="select !w-auto !py-0.5 text-xs" aria-label={t('evidenceStrength')} value={ev.strength || ''} onChange={e => upd(r.n, { evidence: it.evidence.map(x => x.id === ev.id ? { ...x, strength: (e.target.value || null) as EvidenceStrength | null } : x) })}><option value="">{t('strengthUnset')}</option><option value="conclusive">{t('strengthConclusive')}</option><option value="editable">{t('strengthEditable')}</option></select><button className="btn btn-ghost btn-sm" onClick={() => upd(r.n, { evidence: it.evidence.filter(x => x.id !== ev.id) })} aria-label={t('remove')}><Icon name="x" /></button></li>)}</ul>}
                  <EvidenceAdd onAdd={(title, url, strength) => upd(r.n, { evidence: [...it.evidence, { id: uid(), type: 'link', title, url, addedAt: now(), addedBy: user!.id, strength }] })} />
                  {(it.status === 'yes' || it.status === 'partial' || it.evidence.length > 0) && <EvidencePartsEdit idp={`req-${r.n}-ep`} it={it} onChange={p => upd(r.n, { evidenceParts: p })} />}
                </div>
                <div className="grid sm:grid-cols-4 gap-2">
                  <div className="field"><label className="label" htmlFor={`req-${r.n}-d`}>{t('reqDepartment')}</label><select id={`req-${r.n}-d`} className="select" value={it.departmentId || ''} onChange={e => upd(r.n, { departmentId: e.target.value || null })}><option value="">{t('inheritDept')} ({deptName(cfg, codeDept, lang) || '—'})</option>{depts.map(d => <option key={d.id} value={d.id}>{lang === 'ar' ? d.name_ar : d.name_en}</option>)}</select></div>
                  <div className="field"><label className="label" htmlFor={`req-${r.n}-p`}>{t('project')}</label><select id={`req-${r.n}-p`} className="select" value={it.projectId || ''} onChange={e => upd(r.n, { projectId: e.target.value || null })}><option value="">—</option>{projOpts.map(p => <option key={p.id} value={p.id}>{pick(lang, p)}</option>)}</select></div>
                  <div className="field"><label className="label" htmlFor={`req-${r.n}-s`}>{t('service')}</label><input id={`req-${r.n}-s`} className="input" value={it.service || ''} onChange={e => upd(r.n, { service: e.target.value })} /></div>
                  <div className="field"><label className="label" htmlFor={`req-${r.n}-n`}>{t('note')}</label><input id={`req-${r.n}-n`} className="input" value={it.note || ''} onChange={e => upd(r.n, { note: e.target.value })} /></div>
                </div>
              </> : evEdit === String(r.n) ? <AdminEvidenceEdit it={it} idp={`req-${r.n}-ae`} busy={busy} onCancel={() => setEvEdit(null)} onSave={(ev, parts) => saveEvEdit(String(r.n), ev, parts)} addedBy={user!.id} />
              : <ReadOnly onAdminEdit={canAdminEv ? () => setEvEdit(String(r.n)) : undefined} editedBy={eff?.edited?.items[String(r.n)] ? `${userName(eff.edited.items[String(r.n)].by)} · ${fmtDay(eff.edited.items[String(r.n)].at, lang)}` : undefined} codeId={code.id} it={it} ca={ca} late={canLate && (it.status === 'yes' || it.status === 'partial') && !evPartsAnswered(it) ? { value: { ...(it.evidenceParts || {}), ...(late[String(r.n)] || {}) }, onChange: p => setLate(s => ({ ...s, [String(r.n)]: p })), idp: `req-${r.n}-lp` } : undefined} projName={it.projectId ? pick(lang, cfg.projects.find(p => p.id === it.projectId) || { name_ar: it.projectId }) : ''} deptLabel={it.departmentId && it.departmentId !== codeDept ? deptName(cfg, it.departmentId, lang) : ''} />}
            </section>
          })}
          {!paired && code.criteria.length > 0 && <section className="card p-4"><div className="label">{t('criteria')}</div><ol className="m-0 ps-5">{code.criteria.map(c => <li key={c.n}>{pickText(lang, c)}</li>)}</ol></section>}
          <NoteCard key={code.id} codeId={code.id} value={snap!.answers[user!.id]?.notes?.[code.id]?.text || ''} onSave={saveMyNote} />
        </div>
        <aside className="flex flex-col gap-3 lg:sticky lg:top-20">
          <div className="card p-4 flex flex-col gap-3">
            <div><div className="label">{t('requirementsNav')}</div><div className="step-rail">{code.requirements.map(r => { const s = items[String(r.n)]?.status; return <a key={r.n} href={'#req-' + r.n} onClick={e => { e.preventDefault(); document.getElementById('req-' + r.n)?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }}><span className={`n ${s || ''}`}>{s ? '✓' : r.n}</span><span className="truncate">{pickText(lang, r)}</span></a> })}</div></div>
            <div className="divider" />
            <div className="text-sm"><div className="label">{t('assignedTo')}</div><div className="font-semibold">{userName(assignee)}</div>{isAdmin && <select className="select !py-1 text-xs mt-1" value={cfg.overrides[cy]?.[code.id] || ''} onChange={e => override(e.target.value)}><option value="">{t('auto')}</option>{cfg.users.filter(u => u.active).map(u => <option key={u.id} value={u.id}>{lang === 'ar' ? u.name_ar : u.name_en}</option>)}</select>}</div>
            <div className="text-sm"><div className="label">{t('department')}</div>
              {canSetDept ? <select className="select !py-1 text-sm" aria-label={t('department')} value={codeDept || ''} onChange={e => setDept(e.target.value)}>{depts.map(d => <option key={d.id} value={d.id}>{lang === 'ar' ? d.name_ar : d.name_en}</option>)}</select> : <div className="font-semibold">{deptName(cfg, codeDept, lang) || '—'}</div>}
              {supports.length > 0 && <div className="text-xs text-muted mt-1">{t('supportDepts')}: {supports.map(id => deptName(cfg, id, lang)).filter(Boolean).join(' · ')}</div>}
              {cfg.deptConfirm?.[code.id] && <div className="text-xs text-warn-ink bg-warn-soft rounded px-2 py-1 mt-1 flex items-center gap-1"><Icon name="alert" style={{ width: 13, height: 13 }} />{t('deptNeedsConfirm')}</div>}
              {cfg.deptConfirm?.[code.id] && canEdit && <label className="text-sm flex items-center gap-2 mt-1 cursor-pointer"><input type="checkbox" checked={deptConfirmed} onChange={e => { setDeptConfirmed(e.target.checked); setDirty(true) }} />{t('confirmDept')}</label>}
              {isAdmin && <label className="text-xs text-muted flex items-center gap-2 mt-1 cursor-pointer"><input type="checkbox" checked={!!cfg.deptConfirm?.[code.id]} onChange={async e => { const c = JSON.parse(JSON.stringify(cfg)) as typeof cfg; c.deptConfirm = c.deptConfirm || {}; if (e.target.checked) c.deptConfirm[code.id] = true; else delete c.deptConfirm[code.id]; try { await saveConfig(c, `deptConfirm ${code.id} ${e.target.checked}`) } catch (err) { toast(errMsg(err, t), 'bad') } }} />{t('markDeptConfirm')}</label>}
              <div className="text-xs text-muted mt-1">{isAdmin && user!.id !== assignee ? t('deptAdminHint') : t('deptHint')}</div></div>
            <div className="text-sm"><div className="label">{t('mappedProjects')}</div>{linked.length ? <div className="flex flex-wrap gap-1">{linked.map(p => <Pill key={p!.id} kind="accent">{pick(lang, p!)}</Pill>)}</div> : <span className="text-muted">—</span>}</div>
            {eff!.userId && <div className="text-xs text-muted">{t('submittedBy')}: {userName(eff!.userId)} · {fmtDate(eff!.answer?.updatedAt, lang)}</div>}
          </div>
          <details className="card p-4 text-sm group" open={canEdit}>
            <summary className="cursor-pointer list-none flex items-center gap-2 font-semibold select-none"><Icon name="info" className="text-accent-ink" />{t('whatIsEvidence')}<Icon name="chevronD" className="ms-auto text-muted transition-transform group-open:rotate-180" /></summary>
            <p className="m-0 mt-3 text-fg-2">{t('evidenceGuideIntro')}</p>
            <ol className="m-0 mt-2 ps-0 list-none flex flex-col gap-1.5">{([t('evGuideSop'), t('evGuideExec'), t('evGuideMonitor')]).map((x, i) => <li key={i} className="flex items-start gap-2"><span className="num inline-grid place-items-center w-5 h-5 rounded-full bg-accent-soft text-accent-ink text-xs font-bold shrink-0 mt-0.5">{i + 1}</span><span>{x}</span></li>)}</ol>
            <p className="m-0 mt-2 text-xs text-muted">{t('evGuideNot')}</p>
            <div className="panel px-3 py-2 mt-3 text-xs"><div className="font-semibold text-fg-2 mb-0.5 flex items-center gap-1.5"><Icon name="folder" style={{ width: 13, height: 13 }} />{t('evGuideWhere')}</div><span className="text-muted">{t('evGuideFolder')}</span></div>
          </details>
          {canEdit && <div className="card p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between"><div className="label !mb-0">{t('submitChecklist')}</div><span className="text-xs text-muted num">{answered}/{code.requirements.length}</span></div>
            <ul className="checklist m-0 p-0 list-none">{checks.map(([done, label]) => <li key={label} className={done ? 'done' : 'todo'}><Icon name={done ? 'checkCircle' : 'clock'} className="shrink-0 mt-0.5" style={{ width: 15, height: 15 }} />{label}</li>)}</ul>
            <button className="btn" disabled={busy} onClick={() => save('draft')}><Icon name="edit" />{t('saveDraft')}{dirty && <span className="dot bg-warn w-2 h-2 rounded-full inline-block" />}</button>
            <button className="btn btn-primary" disabled={!ok || busy} onClick={() => setConfirm(true)}><Icon name="send" />{t('submit')}</button>
            <div className="text-xs text-muted flex flex-wrap gap-2 items-center"><span className="kbd" dir="ltr">Alt {lang === 'ar' ? '→' : '←'}</span><span className="kbd" dir="ltr">Alt {lang === 'ar' ? '←' : '→'}</span>{t('prevCode')} / {t('nextCode')}</div>
          </div>}
        </aside>
      </div>
      <Modal open={confirm} onClose={() => setConfirm(false)} title={t('submit')} footer={<><button className="btn" onClick={() => setConfirm(false)}>{t('cancel')}</button><button className="btn btn-primary" onClick={() => save('submitted')}><Icon name="send" />{t('confirm')}</button></>}>
        <p className="m-0">{t('confirmSubmit')}</p>
        <div className="mt-3 flex flex-wrap gap-1">{code.requirements.map(r => <span key={r.n} className="flex items-center gap-1 text-sm"><span className="code-id">{r.n}</span><StatusPill status={items[String(r.n)]?.status ?? null} /></span>)}</div>
      </Modal>
    </div>
  )
}
export function NoteCard({ codeId, value, onSave, compact }: { codeId: string; value: string; onSave: (codeId: string, text: string) => Promise<void>; compact?: boolean }) {
  const { t } = useApp(); const toast = useToast()
  const [v, setV] = useState(value); const [saved, setSaved] = useState(true); const last = useRef(value)
  useEffect(() => { if (value !== last.current) { last.current = value; setV(value); setSaved(true) } }, [value])
  const commit = async () => { const text = v; if (text === last.current) { setSaved(true); return } await onSave(codeId, text); last.current = text; setSaved(true); if (!compact) toast(t('noteSaved'), 'ok') }
  const vRef = useRef(v); vRef.current = v
  useEffect(() => { if (v === last.current) return; setSaved(false); const id = setTimeout(commit, 1200); return () => clearTimeout(id) }, [v]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (vRef.current !== last.current) onSave(codeId, vRef.current).catch(() => undefined) }, []) // flush a pending note when leaving the page // eslint-disable-line react-hooks/exhaustive-deps
  if (compact) return <textarea className="textarea !py-1.5 text-sm" rows={2} placeholder={t('personalNote')} value={v} onChange={e => setV(e.target.value)} onBlur={commit} aria-label={t('personalNote')} />
  return <div className="card p-4 flex flex-col gap-2" id="personal-note">
    <div className="flex items-center justify-between"><div className="label !mb-0 flex items-center gap-1.5"><Icon name="edit" style={{ width: 14, height: 14 }} />{t('personalNote')}</div><span className={`text-xs ${saved ? 'text-muted' : 'text-warn-ink'}`}>{saved ? (v ? t('saved') : '') : '…'}</span></div>
    <textarea className="textarea" rows={4} value={v} onChange={e => setV(e.target.value)} onBlur={commit} placeholder={t('personalNote')} />
    <div className="text-xs text-muted">{t('personalNoteHint')}</div>
  </div>
}
/** Accepts http(s) links, file: links, UNC paths (\\\\server\\share\\…) and drive paths; UNC and drive paths are turned into file: links. */
export function normaliseUrl(raw: string): string | null {
  const u = raw.trim(); if (!u) return null
  if (/^https?:\/\//i.test(u) || /^file:/i.test(u)) { try { new URL(u); return u } catch { return null } }
  if (/^\\\\[^\\]+\\/.test(u)) return 'file://' + u.slice(2).replace(/\\/g, '/')
  if (/^[a-zA-Z]:\\/.test(u)) return 'file:///' + u.replace(/\\/g, '/')
  return null
}
function EvidenceAdd({ onAdd }: { onAdd: (title: string, url: string, strength: EvidenceStrength | null) => void }) {
  const { t } = useApp(); const toast = useToast(); const [title, setTitle] = useState(''); const [url, setUrl] = useState(''); const [strength, setStrength] = useState<EvidenceStrength | ''>('')
  const add = () => { const n = normaliseUrl(url); if (!n) { toast(t('invalidUrl'), 'bad'); return } onAdd(title.trim(), n, strength || null); setTitle(''); setUrl(''); setStrength('') }
  return <div className="flex flex-wrap gap-2"><input className="input flex-1 min-w-32" placeholder={t('evidenceTitle')} value={title} onChange={e => setTitle(e.target.value)} /><input className="input flex-[2] min-w-48" dir="ltr" placeholder={t('evidenceUrl')} value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && url.trim()) { e.preventDefault(); add() } }} />
    <select className="select !w-auto" aria-label={t('evidenceStrength')} value={strength} onChange={e => setStrength(e.target.value as EvidenceStrength | '')}><option value="">{t('evidenceStrength')}: {t('strengthUnset')}</option><option value="conclusive">{t('strengthConclusive')}</option><option value="editable">{t('strengthEditable')}</option></select>
    <button className="btn btn-sm" disabled={!url.trim()} onClick={add}><Icon name="plus" />{t('addLink')}</button></div>
}
function ReadOnly({ it, ca, projName, deptLabel, codeId, late, onAdminEdit, editedBy }: { it: ItemAnswer; ca?: { answer: string }; projName: string; deptLabel?: string; codeId: string; onAdminEdit?: () => void; editedBy?: string; late?: { value: NonNullable<ItemAnswer['evidenceParts']>; onChange: (p: NonNullable<ItemAnswer['evidenceParts']>) => void; idp: string } }) {
  const { t } = useApp()
  return <div className="text-sm flex flex-col gap-1">
    {deptLabel && <div className="text-muted"><span className="font-medium text-fg-2">{t('reqDepartment')}:</span> {deptLabel}</div>}
    {it.status === 'na' && it.justification && <div><span className="font-medium text-fg-2">{t('justification')}:</span> {it.justification}</div>}
    {it.evidence.length > 0 && <div className="flex flex-wrap gap-2 items-center">{it.evidence.map(e => <span key={e.id} className="inline-flex items-center gap-1"><a className={`pill ${e.strength === 'conclusive' ? 'pill-ok' : e.strength === 'editable' ? 'pill-warn' : 'pill-muted'} no-underline`} href={e.url} target="_blank" rel="noreferrer" title={e.strength ? t(e.strength === 'conclusive' ? 'strengthConclusive' : 'strengthEditable') : undefined}><Icon name="link" style={{ width: 12, height: 12 }} />{e.title || e.url}</a><EvidenceRate codeId={codeId} ev={e} /></span>)}</div>}
    {(onAdminEdit || editedBy) && <div className="flex flex-wrap items-center gap-2 text-xs">{onAdminEdit && <button type="button" className="btn btn-xs" onClick={onAdminEdit}><Icon name="edit" />{t('editEvidence')}</button>}{editedBy && <span className="text-info-ink">{t('evidenceEditedBy')}: {editedBy}</span>}</div>}
    {late ? <EvidencePartsEdit idp={late.idp} it={{ ...it, evidenceParts: late.value }} onChange={late.onChange} fixed={(['doc', 'exec', 'monitor'] as const).filter(k => typeof it.evidenceParts?.[k] === 'boolean')} /> : <EvidencePartsView it={it} />}
    {(projName || it.service || it.note) && <div className="text-muted">{projName && <span className="me-3">{t('project')}: {projName}</span>}{it.service && <span className="me-3">{t('service')}: {it.service}</span>}{it.note && <span>{t('note')}: {it.note}</span>}</div>}
    {it.clarify?.flag && <div className="text-flag-ink">? {t('needsClarification')}: {it.clarify.question}{ca && <span className="text-muted"> · {t('replied')}: {ca.answer}</span>}</div>}
  </div>
}

/** Administrator editor for the evidence of one requirement on a submitted or approved code: links, their type, and the three questions. */
function AdminEvidenceEdit({ it, idp, busy, onCancel, onSave, addedBy }: { it: ItemAnswer; idp: string; busy: boolean; onCancel: () => void; onSave: (evidence: ItemAnswer['evidence'], parts: NonNullable<ItemAnswer['evidenceParts']>) => void; addedBy: string }) {
  const { t } = useApp()
  const [ev, setEv] = useState<ItemAnswer['evidence']>(() => it.evidence.map(e => ({ ...e })))
  const [parts, setParts] = useState<NonNullable<ItemAnswer['evidenceParts']>>(() => ({ ...(it.evidenceParts || {}) }))
  return <div className="panel p-3 flex flex-col gap-2 text-sm border border-info/40">
    <div className="text-xs text-info-ink flex items-start gap-1.5"><Icon name="shield" className="shrink-0 mt-0.5" style={{ width: 13, height: 13 }} /><span>{t('evidenceEditHint')}</span></div>
    {ev.length > 0 && <ul className="m-0 p-0 list-none flex flex-col gap-1">{ev.map(e => <li key={e.id} className="flex flex-wrap items-center gap-2 bg-surface rounded px-2 py-1.5"><Icon name="link" className="text-muted" /><input className="input !py-1 flex-1 min-w-32" aria-label={t('evidenceTitle')} placeholder={t('evidenceTitle')} value={e.title} onChange={x => setEv(l => l.map(y => y.id === e.id ? { ...y, title: x.target.value } : y))} /><input className="input !py-1 flex-[2] min-w-48" dir="ltr" aria-label={t('evidenceUrl')} value={e.url} onChange={x => setEv(l => l.map(y => y.id === e.id ? { ...y, url: x.target.value } : y))} />
      <select className="select !w-auto !py-1 text-xs" aria-label={t('evidenceStrength')} value={e.strength || ''} onChange={x => setEv(l => l.map(y => y.id === e.id ? { ...y, strength: (x.target.value || null) as EvidenceStrength | null } : y))}><option value="">{t('strengthUnset')}</option><option value="conclusive">{t('strengthConclusive')}</option><option value="editable">{t('strengthEditable')}</option></select>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEv(l => l.filter(y => y.id !== e.id))} aria-label={t('remove')}><Icon name="x" /></button></li>)}</ul>}
    <EvidenceAdd onAdd={(title, url, strength) => setEv(l => [...l, { id: uid(), type: 'link', title, url, addedAt: now(), addedBy, strength }])} />
    <EvidencePartsEdit idp={idp} it={{ ...it, evidence: ev, evidenceParts: parts }} onChange={setParts} />
    <div className="flex gap-2 justify-end"><button type="button" className="btn btn-sm" onClick={onCancel}>{t('cancel')}</button><button type="button" className="btn btn-sm btn-primary" disabled={busy || ev.some(e => !normaliseUrl(e.url))} onClick={() => onSave(ev.map(e => ({ ...e, url: normaliseUrl(e.url) || e.url, title: e.title.trim() })), parts)}><Icon name="check" />{t('save')}</button></div>
  </div>
}
