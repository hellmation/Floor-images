import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../store/state'
import { codeById, subById, pillarById, assigneeOf, effective, effectiveImpact, master, sortIds, uid, now } from '../store/scoring'
import { pick, pickDesc, pickText } from '../i18n'
import { ImpactPill, Pill, StatePill, StatusPill, Modal, useToast, fmtDate } from '../components/ui'
import { Icon } from '../components/icons'
import type { AnswerStatus, CodeAnswer, ItemAnswer } from '../types'

const emptyItem = (): ItemAnswer => ({ status: null, evidence: [], clarify: { flag: false, question: '' } })

export default function CodeView({ id }: { id: string }) {
  const { t, lang, snap, user, isAdmin, cycleId, saveMyAnswer, saveConfig } = useApp()
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
  useEffect(() => {
    if (!code) return
    const base = myOwn || eff?.answer || null
    let src = base, carry: string | null = null
    if (!src && cycle?.prefillFrom) { const prev = effective(snap!, cycle.prefillFrom, code.id); if (prev.answer) { src = prev.answer; carry = cycle.prefillFrom } }
    const next: Record<string, ItemAnswer> = {}
    for (const r of code.requirements) next[String(r.n)] = src?.items[String(r.n)] ? { ...emptyItem(), ...JSON.parse(JSON.stringify(src.items[String(r.n)])) } : emptyItem()
    setItems(next); setCarried(carry || base?.carriedFrom || null); setConfirm(false); setDirty(false)
  }, [code, cy, myOwn, eff?.answer, cycle?.prefillFrom, snap])
  const ordered = useMemo(() => [...master.codes].sort((a, b) => sortIds(a.id, b.id)), [])
  useEffect(() => { const f = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return; const idx = ordered.findIndex(c => c.id === id); if (e.altKey && e.key === 'ArrowRight' && ordered[idx + 1]) location.hash = '#/code/' + ordered[idx + 1].id; if (e.altKey && e.key === 'ArrowLeft' && ordered[idx - 1]) location.hash = '#/code/' + ordered[idx - 1].id }; addEventListener('keydown', f); return () => removeEventListener('keydown', f) }, [id, ordered])
  if (!code) return <div className="card p-6">{t('unknownCode')}: {id}</div>
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
    [!cfg.settings.requireEvidence || vals.every(v => !(v?.status === 'yes' || v?.status === 'partial') || v.evidence.length > 0), t('needEvidence')],
    [vals.every(v => v?.status !== 'na' || !!v.justification?.trim()), t('needJustification')],
    [!vals.some(v => v?.clarify?.flag), t('openClarification')],
  ]
  const ok = checks.every(c => c[0])
  const save = async (state: 'draft' | 'submitted') => {
    const a: CodeAnswer = { state, updatedAt: now(), submittedAt: state === 'submitted' ? now() : myOwn?.submittedAt, items, carriedFrom: carried }
    await saveMyAnswer(cy, code.id, a); setConfirm(false); setDirty(false); toast(state === 'submitted' ? t('submitted') : t('saved'), 'ok')
  }
  const override = async (uidv: string) => { const c = JSON.parse(JSON.stringify(cfg)); c.overrides[cy] = c.overrides[cy] || {}; if (uidv) c.overrides[cy][code.id] = uidv; else delete c.overrides[cy][code.id]; await saveConfig(c, `override ${code.id} -> ${uidv || 'auto'}`) }
  const answered = vals.filter(v => v?.status).length
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted mb-3">
        <a href="#/browse" className="no-underline">{t('browse')}</a><Icon name={lang === 'ar' ? 'chevronL' : 'chevronR'} /><a href={'#/browse?p=' + pil.id} className="no-underline">{pil.id} {pick(lang, pil)}</a><Icon name={lang === 'ar' ? 'chevronL' : 'chevronR'} /><span>{sub.id} {pick(lang, sub)}</span>
        <span className="ms-auto flex gap-1">{prev && <a className="btn btn-sm no-underline" href={'#/code/' + prev.id} title={t('prevCode')}><Icon name={lang === 'ar' ? 'chevronR' : 'chevronL'} />{prev.id}</a>}{next && <a className="btn btn-sm no-underline" href={'#/code/' + next.id} title={t('nextCode')}>{next.id}<Icon name={lang === 'ar' ? 'chevronL' : 'chevronR'} /></a>}</span>
      </div>
      <div className="grid lg:grid-cols-[1fr_300px] gap-4 items-start">
        <div className="flex flex-col gap-4 min-w-0">
          <div className="card card-raised p-5 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2"><span className="code-id text-lg !px-3">{code.id}</span><ImpactPill impact={effectiveImpact(code, cfg)} /><StatePill state={eff!.state} />{code.flags.map(f => <Pill key={f} kind="flag">{t(f === 'duplicate_id_in_pdf' ? 'flagDuplicate' : 'flagImpact')}</Pill>)}<span className="ms-auto text-xs text-muted">{t('pdfPage')} {code.pdf_page}</span></div>
            <p className="m-0 text-base leading-relaxed">{pickDesc(lang, code)}</p>
            {!canEdit && cycle?.status === 'open' && !locked && <div className="text-sm text-warn-ink bg-warn-soft rounded-lg px-3 py-2 flex items-center gap-2"><Icon name="eye" />{t('readOnly')} · {t('requestChange')}</div>}
            {carried && <div className="text-sm text-info-ink bg-info-soft rounded-lg px-3 py-2 flex items-center gap-2"><Icon name="clock" />{t('carried')} ({carried})</div>}
            {eff!.review && (eff!.state === 'returned' || eff!.state === 'approved') && <div className={`text-sm rounded-lg px-3 py-2 ${eff!.state === 'returned' ? 'bg-bad-soft text-bad-ink' : 'bg-ok-soft text-ok-ink'}`}><b>{t('reviewerComment')}</b> ({userName(eff!.review.reviewedBy)}, {fmtDate(eff!.review.reviewedAt, lang)}): {eff!.review.comment || '—'}</div>}
          </div>
          {code.requirements.map((r, i) => {
            const it = items[String(r.n)] || emptyItem(); const ca = clarAnswers[String(r.n)]
            const projOpts = [...linked.map(p => p!), ...cfg.projects.filter(p => p.active && !linked.some(l => l!.id === p.id))]
            return <section key={r.n} id={'req-' + r.n} className="card p-4 flex flex-col gap-3 scroll-mt-20">
              <div className="flex items-start gap-3"><span className={`inline-grid place-items-center w-7 h-7 rounded-full text-xs font-bold shrink-0 ${it.status ? ({ yes: 'bg-ok text-white', partial: 'bg-warn text-white', no: 'bg-bad text-white', na: 'bg-fg-2 text-surface' } as Record<string, string>)[it.status] : 'bg-surface-3 text-fg-2'}`}>{r.n}</span>
                <div className="flex-1 min-w-0"><div className="font-semibold leading-snug">{pickText(lang, r)}</div>{paired && code.criteria[i] && <div className="text-sm text-muted mt-1 flex gap-1.5"><Icon name="target" className="shrink-0 mt-0.5" style={{ width: 14, height: 14 }} /><span><span className="font-medium text-fg-2">{t('criterion')}:</span> {pickText(lang, code.criteria[i])}</span></div>}</div>{!canEdit && <StatusPill status={it.status} />}</div>
              {canEdit ? <>
                <div className="flex flex-wrap gap-3 items-center">
                  <div className="seg seg-status" role="group" aria-label={t('status')}>{(['yes', 'partial', 'no', 'na'] as AnswerStatus[]).map(s => <button key={s} data-v={s} aria-pressed={it.status === s} onClick={() => upd(r.n, { status: s })}>{t(s)}</button>)}</div>
                  <label className={`flex items-center gap-1.5 text-sm ms-auto cursor-pointer px-2 py-1 rounded-lg ${it.clarify?.flag ? 'bg-flag-soft text-flag-ink' : 'text-muted hover:text-fg'}`}><input type="checkbox" checked={!!it.clarify?.flag} onChange={e => upd(r.n, { clarify: { flag: e.target.checked, question: it.clarify?.question || '', raisedAt: e.target.checked ? now() : it.clarify?.raisedAt } })} /><Icon name="question" />{t('needsClarification')}</label>
                </div>
                {it.clarify?.flag && <div className="rounded-lg bg-flag-soft p-3 flex flex-col gap-1"><label className="label">{t('clarificationQuestion')}</label><textarea className="textarea" rows={2} value={it.clarify.question} onChange={e => upd(r.n, { clarify: { ...it.clarify!, question: e.target.value } })} />{ca && <div className="text-sm mt-1"><b>{t('clarificationAnswer')}</b> ({fmtDate(ca.answeredAt, lang)}): {ca.answer} <button className="btn btn-sm ms-2" onClick={() => upd(r.n, { clarify: { flag: false, question: it.clarify!.question } })}><Icon name="check" />{t('clearFlag')}</button></div>}</div>}
                {!it.clarify?.flag && ca && <div className="text-sm text-muted"><b>{t('clarificationAnswer')}</b>: {ca.answer}</div>}
                {it.status === 'na' && <div className="field"><label className="label">{t('justification')}</label><textarea className="textarea" rows={2} value={it.justification || ''} onChange={e => upd(r.n, { justification: e.target.value })} /></div>}
                <div><div className="label">{t('evidence')}</div>
                  {it.evidence.length > 0 && <ul className="m-0 mb-2 p-0 list-none flex flex-col gap-1">{it.evidence.map(ev => <li key={ev.id} className="flex items-center gap-2 text-sm panel px-2 py-1.5"><Icon name="link" className="text-muted" /><a href={ev.url} target="_blank" rel="noreferrer" className="truncate flex-1">{ev.title || ev.url}</a><button className="btn btn-ghost btn-sm" onClick={() => upd(r.n, { evidence: it.evidence.filter(x => x.id !== ev.id) })} aria-label={t('remove')}><Icon name="x" /></button></li>)}</ul>}
                  <EvidenceAdd onAdd={(title, url) => upd(r.n, { evidence: [...it.evidence, { id: uid(), type: 'link', title, url, addedAt: now(), addedBy: user!.id }] })} />
                </div>
                <div className="grid sm:grid-cols-3 gap-2">
                  <div className="field"><label className="label">{t('project')}</label><select className="select" value={it.projectId || ''} onChange={e => upd(r.n, { projectId: e.target.value || null })}><option value="">—</option>{projOpts.map(p => <option key={p.id} value={p.id}>{pick(lang, p)}</option>)}</select></div>
                  <div className="field"><label className="label">{t('service')}</label><input className="input" value={it.service || ''} onChange={e => upd(r.n, { service: e.target.value })} /></div>
                  <div className="field"><label className="label">{t('note')}</label><input className="input" value={it.note || ''} onChange={e => upd(r.n, { note: e.target.value })} /></div>
                </div>
              </> : <ReadOnly it={it} ca={ca} projName={it.projectId ? pick(lang, cfg.projects.find(p => p.id === it.projectId) || { name_ar: it.projectId }) : ''} />}
            </section>
          })}
          {!paired && code.criteria.length > 0 && <section className="card p-4"><div className="label">{t('criteria')}</div><ol className="m-0 ps-5">{code.criteria.map(c => <li key={c.n}>{pickText(lang, c)}</li>)}</ol></section>}
        </div>
        <aside className="flex flex-col gap-3 lg:sticky lg:top-20">
          <div className="card p-4 flex flex-col gap-3">
            <div><div className="label">{t('requirementsNav')}</div><div className="step-rail">{code.requirements.map(r => { const s = items[String(r.n)]?.status; return <a key={r.n} href={'#req-' + r.n} onClick={e => { e.preventDefault(); document.getElementById('req-' + r.n)?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }}><span className={`n ${s || ''}`}>{s ? '✓' : r.n}</span><span className="truncate">{pickText(lang, r)}</span></a> })}</div></div>
            <div className="divider" />
            <div className="text-sm"><div className="label">{t('assignedTo')}</div><div className="font-semibold">{userName(assignee)}</div>{isAdmin && <select className="select !py-1 text-xs mt-1" value={cfg.overrides[cy]?.[code.id] || ''} onChange={e => override(e.target.value)}><option value="">{t('auto')}</option>{cfg.users.filter(u => u.active).map(u => <option key={u.id} value={u.id}>{lang === 'ar' ? u.name_ar : u.name_en}</option>)}</select>}</div>
            <div className="text-sm"><div className="label">{t('mappedProjects')}</div>{linked.length ? <div className="flex flex-wrap gap-1">{linked.map(p => <Pill key={p!.id} kind="accent">{pick(lang, p!)}</Pill>)}</div> : <span className="text-muted">—</span>}</div>
            {eff!.userId && <div className="text-xs text-muted">{t('submittedBy')}: {userName(eff!.userId)} · {fmtDate(eff!.answer?.updatedAt, lang)}</div>}
          </div>
          {canEdit && <div className="card p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between"><div className="label !mb-0">{t('submitChecklist')}</div><span className="text-xs text-muted num">{answered}/{code.requirements.length}</span></div>
            <ul className="checklist m-0 p-0 list-none">{checks.map(([done, label]) => <li key={label} className={done ? 'done' : 'todo'}><Icon name={done ? 'checkCircle' : 'clock'} className="shrink-0 mt-0.5" style={{ width: 15, height: 15 }} />{label}</li>)}</ul>
            <button className="btn" onClick={() => save('draft')}><Icon name="edit" />{t('saveDraft')}{dirty && <span className="dot bg-warn w-2 h-2 rounded-full inline-block" />}</button>
            <button className="btn btn-primary" disabled={!ok} onClick={() => setConfirm(true)}><Icon name="send" />{t('submit')}</button>
            <div className="text-xs text-muted flex flex-wrap gap-2 items-center"><span className="kbd">Alt ←</span><span className="kbd">Alt →</span>{t('prevCode')} / {t('nextCode')}</div>
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
function EvidenceAdd({ onAdd }: { onAdd: (title: string, url: string) => void }) {
  const { t } = useApp(); const [title, setTitle] = useState(''); const [url, setUrl] = useState('')
  return <div className="flex flex-wrap gap-2"><input className="input flex-1 min-w-32" placeholder={t('evidenceTitle')} value={title} onChange={e => setTitle(e.target.value)} /><input className="input flex-[2] min-w-48" dir="ltr" placeholder={t('evidenceUrl')} value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && url.trim()) { onAdd(title.trim(), url.trim()); setTitle(''); setUrl('') } }} />
    <button className="btn btn-sm" disabled={!url.trim()} onClick={() => { onAdd(title.trim(), url.trim()); setTitle(''); setUrl('') }}><Icon name="plus" />{t('addLink')}</button></div>
}
function ReadOnly({ it, ca, projName }: { it: ItemAnswer; ca?: { answer: string }; projName: string }) {
  const { t } = useApp()
  return <div className="text-sm flex flex-col gap-1">
    {it.status === 'na' && it.justification && <div><span className="font-medium text-fg-2">{t('justification')}:</span> {it.justification}</div>}
    {it.evidence.length > 0 && <div className="flex flex-wrap gap-2">{it.evidence.map(e => <a key={e.id} className="pill pill-muted no-underline" href={e.url} target="_blank" rel="noreferrer"><Icon name="link" style={{ width: 12, height: 12 }} />{e.title || e.url}</a>)}</div>}
    {(projName || it.service || it.note) && <div className="text-muted">{projName && <span className="me-3">{t('project')}: {projName}</span>}{it.service && <span className="me-3">{t('service')}: {it.service}</span>}{it.note && <span>{t('note')}: {it.note}</span>}</div>}
    {it.clarify?.flag && <div className="text-flag-ink">? {t('needsClarification')}: {it.clarify.question}{ca && <span className="text-muted"> · {t('replied')}: {ca.answer}</span>}</div>}
  </div>
}
