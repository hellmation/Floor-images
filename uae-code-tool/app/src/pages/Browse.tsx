import { useMemo, useState } from 'react'
import { FilterBar, FilterChip, FilterSearch } from '../components/filters'
import { useViewState } from '../store/viewState'
import { useApp } from '../store/state'
import { master, assigneeOf, effective, effectiveImpact, sortIds, departmentOf, deptName, pillarById } from '../store/scoring'
import { DEFAULT_EVIDENCE_ROOT, evidenceSupported, linkEvidenceRoot, saveEvidenceFiles, type DirCache } from '../store/evidenceFolder'
import { pick, pickDesc, pickText } from '../i18n'
import { ImpactPill, PageHeader, StatePill, Empty, Modal, useToast, errMsg, PrintHeader } from '../components/ui'
import type { Key } from '../i18n'
import { Icon } from '../components/icons'
import { norm } from '../components/Shell'

/* The printed report (PDF): which columns and parts of each code it carries. Kept per browser; printing with Ctrl+P uses the same choice. */
type RK = 'no' | 'imp' | 'dept' | 'who' | 'st' | 'upd' | 'rev' | 'ev' | 'notes' | 'reqs' | 'crit' | 'reqst' | 'proj' | 'subs' | 'summary'
const RPT_COLS: [RK, Key][] = [['no', 'rptNo'], ['imp', 'impact'], ['dept', 'department'], ['who', 'assignedTo'], ['st', 'status'], ['upd', 'rptUpd'], ['rev', 'rptRev'], ['ev', 'rptEv'], ['notes', 'rptNotes']]
const RPT_PARTS: [RK, Key][] = [['reqs', 'requirements'], ['crit', 'criteria'], ['reqst', 'rptReqSt'], ['proj', 'rptProj'], ['subs', 'rptSubRows'], ['summary', 'rptSummary']]
const RPT_ALL: RK[] = [...RPT_COLS, ...RPT_PARTS].map(x => x[0])
const RPT_DEFAULT: RK[] = ['no', 'imp', 'dept', 'who', 'st', 'notes', 'reqs', 'crit', 'subs']
const RPT_STORE = 'uae-code-tool:report-cols'
const loadRpt = (): Set<RK> => { try { const v = JSON.parse(localStorage.getItem(RPT_STORE) || 'null'); if (Array.isArray(v)) return new Set(v.filter((k: RK) => RPT_ALL.includes(k))) } catch { /* storage unavailable */ } return new Set(RPT_DEFAULT) }
const saveRpt = (s: Set<RK>) => { try { localStorage.setItem(RPT_STORE, JSON.stringify([...s])) } catch { /* storage unavailable */ } }

export default function Browse() {
  const { t, lang, snap, cycleId, user, isAdmin, saveConfig } = useApp(); const cfg = snap!.config; const cy = cycleId!; const toast = useToast()
  const qs = new URLSearchParams(location.hash.split('?')[1] || '')
  const [vs, setVs] = useViewState('browse', { p: '', q: '', who: '', st: '', imp: '', dep: '', prj: '' }, { prj: qs.get('prj') ?? undefined, p: qs.get('p') ?? undefined, who: qs.get('who') ?? undefined, st: qs.get('st') ?? undefined, imp: qs.get('imp') ?? undefined, dep: qs.get('dep') ?? undefined })
  const { p, q, who, st, imp, dep, prj } = vs
  /* projects: the code's linked projects (mapping); '_none' = codes not linked to any project */
  const projName = (id: string) => { const x = cfg.projects.find(y => y.id === id); return x ? (lang === 'ar' ? x.name_ar : (x.name_en || x.name_ar)) : id }
  const projOpts = useMemo(() => { const n = new Map<string, number>(); let none = 0
    for (const c of master.codes) { const ps = cfg.mapping[c.id] || []; if (!ps.length) none++; for (const id of ps) n.set(id, (n.get(id) || 0) + 1) }
    const owner = (id: string) => { const o = cfg.users.find(u => u.id === cfg.projects.find(x => x.id === id)?.ownerId); return o ? (lang === 'ar' ? o.name_ar : o.name_en) : '' }
    const groups = new Map<string, { id: string; n: number }[]>()
    for (const pr of cfg.projects) { const k = n.get(pr.id); if (!k) continue; const g = owner(pr.id) || t('unassigned'); groups.set(g, [...(groups.get(g) || []), { id: pr.id, n: k }]) }
    return { groups: [...groups.entries()], none } }, [cfg, lang, t])
  const list = useMemo(() => master.codes.filter(c => (!p || c.pillar === p)).map(c => ({ c, a: assigneeOf(c.id, cy, cfg), e: effective(snap!, cy, c.id), i: effectiveImpact(c, cfg) }))
    .filter(r => (!who || r.a === who) && (!st || r.e.state === st) && (!imp || r.i === imp) && (!dep || departmentOf(snap!, cy, r.c.id) === dep) && (!prj || (prj === '_none' ? !(cfg.mapping[r.c.id] || []).length : (cfg.mapping[r.c.id] || []).includes(prj))) && (!q || norm(r.c.id + ' ' + r.c.desc_ar + ' ' + r.c.desc_en).includes(norm(q))))
    .sort((a, b) => sortIds(a.c.id, b.c.id)), [p, q, who, st, imp, dep, prj, cfg, cy, snap])
  const userName = (id: string | null) => { const u = cfg.users.find(x => x.id === id); return u ? (lang === 'ar' ? u.name_ar : u.name_en) : t('unassigned') }
  /* Bulk control (administrator): tick codes, then set their responsible department or their assignee in one step. */
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [bDept, setBDept] = useState(''); const [bWho, setBWho] = useState('__keep'); const [ask, setAsk] = useState<'dept' | 'who' | null>(null); const [busy, setBusy] = useState(false)
  const shown = list.map(r => r.c.id); const allShown = shown.length > 0 && shown.every(id => sel.has(id))
  const toggle = (ids: string[], on: boolean) => setSel(s => { const n = new Set(s); for (const id of ids) { if (on) n.add(id); else n.delete(id) } return n })
  const depts = cfg.departments.filter(d => d.active)
  const applyBulk = async () => {
    const ids = [...sel]; if (!ids.length || !ask) return; setBusy(true)
    try {
      const c = JSON.parse(JSON.stringify(cfg)) as typeof cfg
      if (ask === 'dept') {
        c.deptLocked = { ...(c.deptLocked || {}) }
        for (const id of ids) { c.deptMapping[id] = [bDept, ...(c.deptMapping[id] || []).slice(1).filter(x => x !== bDept)]; c.deptLocked[id] = true }
        await saveConfig(c, `bulk department -> ${bDept} (${ids.length} codes: ${ids.slice(0, 40).join(', ')}${ids.length > 40 ? ', …' : ''})`)
      } else {
        c.overrides[cy] = { ...(c.overrides[cy] || {}) }
        for (const id of ids) { if (bWho) c.overrides[cy][id] = bWho; else delete c.overrides[cy][id] }
        await saveConfig(c, `bulk assignee -> ${bWho || 'auto'} (${ids.length} codes: ${ids.slice(0, 40).join(', ')}${ids.length > 40 ? ', …' : ''})`)
      }
      toast(`${t('bulkDone')} (${ids.length})`, 'ok'); setSel(new Set()); setAsk(null)
    } catch (e) { toast(errMsg(e, t), 'bad') } finally { setBusy(false) }
  }
  /* Evidence folders for the ticked codes: each code gets its folder under its pillar in the evidence root (existing ones are left as they are). */
  const makeFolders = async () => {
    const ids = [...sel].sort(sortIds); if (!ids.length) return
    if (!evidenceSupported()) { toast(t('bulkFoldersUnsupported'), 'bad'); return }
    setBusy(true)
    try {
      const root = await linkEvidenceRoot(); if (!root) return
      const expected = (cfg.settings.evidenceRoot || DEFAULT_EVIDENCE_ROOT).replace(/[\\/]+$/, '').split(/[\\/]/).pop() || ''
      if (expected && root.name !== expected && !window.confirm(`${t('dropWrongFolder')}\n\n${root.name}\n≠ ${expected}`)) return
      const cache: DirCache = new Map(); let created = 0, existing = 0, failed = 0
      for (const id of ids) { const c = master.codes.find(x => x.id === id); const pil = c && pillarById.get(c.pillar); if (!c || !pil) { failed++; continue }
        try { const r = await saveEvidenceFiles(root, { id: pil.id, name: pil.name_ar }, c.sub, c.id, [], cache); if (r.createdCode) created++; else existing++ } catch (e) { console.error(id, e); failed++ } }
      toast(`${t('bulkFoldersDone')} ${created} · ${t('bulkFoldersExisting')} ${existing}${failed ? ` · ${t('bulkFoldersFailed')} ${failed}` : ''}`, failed ? 'bad' : 'ok')
    } catch (e) { if ((e as DOMException)?.name !== 'AbortError') toast(errMsg(e, t), 'bad') } finally { setBusy(false) }
  }
  const cols = isAdmin ? 7 : 6
  const [rpt, setRptRaw] = useState<Set<RK>>(loadRpt); const [rptOpen, setRptOpen] = useState(false); const [rptName, setRptName] = useState('')
  const setRpt = (n: Set<RK>) => { setRptRaw(n); saveRpt(n) }
  const flip = (k: RK) => { const n = new Set(rpt); if (n.has(k)) n.delete(k); else n.add(k); setRpt(n) }
  const printCols = 2 + (['no', 'imp', 'dept', 'who', 'st', 'upd', 'rev', 'ev', 'notes'] as RK[]).filter(k => rpt.has(k)).length
  const offCls = RPT_ALL.filter(k => !rpt.has(k)).map(k => 'off-' + k).join(' ')
  const makeReport = () => { setRptOpen(false); setTimeout(() => window.print(), 120) }
  const dayFmt = (iso?: string) => iso ? new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-AE-u-nu-latn' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
  const STATES = ['none', 'draft', 'submitted', 'returned', 'approved'] as const
  const stLabel = (s: string) => t(s === 'none' ? 'notStarted' : s as 'draft')
  const ansLabel: Record<string, string> = { yes: t('yes'), partial: t('partial'), no: t('no'), na: t('na') }
  let lastSub = ''
  return (
    <div className={`checklist-page ${offCls}`}>
      <PrintHeader title={rptName.trim() || t('checklistTitle')} sub={[
        p && `${t('pillar')}: ${p} · ${pick(lang, master.pillars.find(x => x.id === p) || { name_ar: p, name_en: p })}`,
        dep && `${t('department')}: ${deptName(cfg, dep, lang)}`, prj && `${t('project')}: ${prj === '_none' ? t('noProject') : projName(prj)}`,
        who && `${t('assignedTo')}: ${userName(who)}`, st && `${t('status')}: ${t(st === 'none' ? 'notStarted' : st as 'draft')}`, imp && `${t('impact')}: ${t(imp as 'high')}`, q && `${t('search')}: ${q}`,
        `${list.length} ${t('codesCount')}`].filter(Boolean).join(' · ')} />
      <PageHeader eyebrow={t('work')} title={t('browse')} sub={`${master.pillars.length} ${t('pillarsCount')} · ${master.subpillars.length} ${t('subpillarsCount')} · ${master.codes.length} ${t('codesCount')}`}
        actions={<button className="btn btn-sm" disabled={!list.length} onClick={() => setRptOpen(true)} title={t('printChecklistHint')}><Icon name="download" />{t('rptBtn')} <span className="num">({list.length})</span></button>} />
      <Modal open={rptOpen} onClose={() => setRptOpen(false)} title={t('rptTitle')} footer={<><button className="btn" onClick={() => setRptOpen(false)}>{t('cancel')}</button><button className="btn btn-primary" onClick={makeReport}><Icon name="download" />{t('rptGo')} <span className="num">({list.length})</span></button></>}>
        <div className="space-y-4 rpt-dlg">
          <label className="block"><span className="label">{t('rptName')}</span><input className="input" value={rptName} placeholder={t('checklistTitle')} onChange={e => setRptName(e.target.value)} /></label>
          {([['rptCols', RPT_COLS], ['rptContent', RPT_PARTS]] as const).map(([h, keys]) => <fieldset key={h}><legend className="label">{t(h)}</legend>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-1">{keys.map(([k, l]) => <label key={k} className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" data-rpt={k} checked={rpt.has(k)} onChange={() => flip(k)} />{t(l)}</label>)}</div></fieldset>)}
          <div className="flex flex-wrap gap-2"><button className="btn btn-sm" onClick={() => setRpt(new Set(RPT_ALL))}>{t('rptAllOn')}</button><button className="btn btn-ghost btn-sm" onClick={() => setRpt(new Set(RPT_DEFAULT))}>{t('rptDefault')}</button></div>
          <p className="text-xs text-muted">{t('rptHint')}</p>
        </div>
      </Modal>
      <FilterBar shown={list.length} total={master.codes.length} active={[p, q, who, st, imp, dep, prj].filter(Boolean).length} onClear={() => setVs({ p: '', q: '', who: '', st: '', imp: '', dep: '', prj: '' })}>
        <FilterChip label={t('pillar')} icon="layers" value={p} onChange={v => setVs({ p: v })}><option value="">{t('all')}</option>{master.pillars.map(x => <option key={x.id} value={x.id}>{x.id} · {pick(lang, x)}</option>)}</FilterChip>
        <FilterChip label={t('assignedTo')} icon="user" value={who} onChange={v => setVs({ who: v })}><option value="">{t('all')}</option><option value={user!.id}>{t('myCodes')}</option>{cfg.users.filter(u => u.id !== user!.id).map(u => <option key={u.id} value={u.id}>{lang === 'ar' ? u.name_ar : u.name_en}</option>)}</FilterChip>
        <FilterChip label={t('status')} icon="checkCircle" value={st} onChange={v => setVs({ st: v })}><option value="">{t('all')}</option>{(['none', 'draft', 'submitted', 'returned', 'approved'] as const).map(s => <option key={s} value={s}>{t(s === 'none' ? 'notStarted' : s)}</option>)}</FilterChip>
        <FilterChip label={t('department')} icon="users" value={dep} onChange={v => setVs({ dep: v })}><option value="">{t('all')}</option>{depts.map(d => <option key={d.id} value={d.id}>{lang === 'ar' ? d.name_ar : d.name_en}</option>)}</FilterChip>
        <FilterChip label={t('project')} icon="map" value={prj} onChange={v => setVs({ prj: v })}><option value="">{t('all')}</option>{projOpts.groups.map(([g, ps]) => <optgroup key={g} label={g}>{ps.map(x => <option key={x.id} value={x.id}>{projName(x.id)} ({x.n})</option>)}</optgroup>)}{projOpts.none > 0 && <option value="_none">{t('noProject')} ({projOpts.none})</option>}</FilterChip>
        <FilterChip label={t('impact')} icon="target" value={imp} onChange={v => setVs({ imp: v })}><option value="">{t('all')}</option><option value="high">{t('high')}</option><option value="medium">{t('medium')}</option><option value="low">{t('low')}</option></FilterChip>
        <FilterSearch value={q} onChange={v => setVs({ q: v })} />
      </FilterBar>
      {isAdmin && <div className="card p-3 mb-4 flex flex-wrap gap-x-4 gap-y-2 items-center bulk-bar no-print" data-on={sel.size > 0 || undefined}>
        <span className="flex items-center gap-2 font-semibold"><Icon name="tasks" className="text-accent-ink" />{t('bulkControl')}</span>
        <span className="text-sm num"><b>{sel.size}</b> {t('selectedN')}</span>
        <button className="btn btn-sm" disabled={!shown.length} onClick={() => toggle(shown, !allShown)}>{allShown ? t('clearShown') : `${t('selectShown')} (${shown.length})`}</button>
        {sel.size > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setSel(new Set())}><Icon name="x" />{t('clearSelection')}</button>}
        <span className="flex flex-wrap items-center gap-2 ms-auto min-w-0 max-w-full">
          <select className="select !w-auto !py-1.5 text-sm max-w-full min-w-0" aria-label={t('bulkDept')} value={bDept} onChange={e => setBDept(e.target.value)}><option value="">{t('bulkDept')}…</option>{depts.map(d => <option key={d.id} value={d.id}>{lang === 'ar' ? d.name_ar : d.name_en}</option>)}</select>
          <button className="btn btn-primary btn-sm" disabled={!sel.size || !bDept} onClick={() => setAsk('dept')}><Icon name="check" />{t('apply')}</button>
          <span className="w-px self-stretch bg-line mx-1" />
          <select className="select !w-auto !py-1.5 text-sm max-w-full min-w-0" aria-label={t('bulkAssign')} value={bWho} onChange={e => setBWho(e.target.value)}><option value="__keep">{t('bulkAssign')}…</option><option value="">{t('auto')}</option>{cfg.users.filter(u => u.active).map(u => <option key={u.id} value={u.id}>{lang === 'ar' ? u.name_ar : u.name_en}</option>)}</select>
          <button className="btn btn-primary btn-sm" disabled={!sel.size || bWho === '__keep'} onClick={() => setAsk('who')}><Icon name="check" />{t('apply')}</button>
          <span className="w-px self-stretch bg-line mx-1" />
          <button className="btn btn-sm" disabled={!sel.size || busy} onClick={makeFolders}><Icon name="folder" />{t('bulkFolders')}</button>
        </span>
      </div>}
      {list.length === 0 && <Empty icon="search" title={t('noMatches')}><button className="btn btn-sm mt-2" onClick={() => setVs({ p: '', q: '', who: '', st: '', imp: '', dep: '', prj: '' })}>{t('clearFilters')}</button></Empty>}
      {list.length > 0 && <div className="print-block rpt-summary">{STATES.map(s => { const n = list.filter(r => r.e.state === s).length; return <span key={s}><b className="num">{n}</b> {stLabel(s)}</span> })}<span><b className="num">{list.length}</b> {t('rptCodes')}</span></div>}
      {list.length > 0 && <div className="card overflow-x-auto print-cklist"><table className="tbl">
        <thead><tr><th className="print-only no-col col-no">#</th>{isAdmin && <th className="w-8 no-print"><input type="checkbox" aria-label={t('selectShown')} checked={allShown} onChange={e => toggle(shown, e.target.checked)} /></th>}<th>{t('code')}</th><th>{t('codeText')}</th><th className="col-imp">{t('impact')}</th><th className="col-dept">{t('department')}</th><th className="col-who">{t('assignedTo')}</th><th className="col-st">{t('status')}</th><th className="print-only col-upd">{t('rptUpd')}</th><th className="print-only col-rev">{t('rptRev')}</th><th className="print-only col-ev">{t('rptEv')}</th><th className="print-only notes-col col-notes">{t('checklistNotes')}</th></tr></thead>
        <tbody>{list.map(({ c, a, e, i }, rowNo) => { const sub = master.subpillars.find(s => s.id === c.sub)!; const showSub = sub.id !== lastSub; lastSub = sub.id
          const subIds = showSub && isAdmin ? list.filter(r => r.c.sub === sub.id).map(r => r.c.id) : []
          return [showSub && <tr key={'s' + sub.id} className="sub-row">{isAdmin && <td className="!bg-surface-2 py-2 no-print"><input type="checkbox" aria-label={`${t('selectAll')} ${sub.id}`} checked={subIds.every(id => sel.has(id))} onChange={ev => toggle(subIds, ev.target.checked)} /></td>}<td colSpan={cols - (isAdmin ? 1 : 0)} className="!bg-surface-2 font-semibold text-accent-ink py-2 no-print">{sub.id} {pick(lang, sub)}</td><td colSpan={printCols} className="print-only !bg-surface-2 font-semibold">{sub.id} {pick(lang, sub)}</td></tr>,
            <tr key={c.id} className={sel.has(c.id) ? 'bg-accent-soft/40' : ''}><td className="print-only no-col col-no num">{rowNo + 1}</td>{isAdmin && <td className="no-print"><input type="checkbox" aria-label={c.id} checked={sel.has(c.id)} onChange={ev => toggle([c.id], ev.target.checked)} /></td>}<td><a className="code-id no-underline" href={'#/code/' + c.id}>{c.id}</a></td><td className="max-w-2xl"><span className="code-txt">{pickDesc(lang, c)}</span><ol className="print-block print-reqs">{c.requirements.map((r, ri) => <li key={r.n}><b className="num">{c.id}.{r.n}</b> {pickText(lang, r)}<span className={`req-st print-inline st-${e.answer?.items[r.n]?.status || 'x'}`}>{ansLabel[e.answer?.items[r.n]?.status || ''] || '—'}</span>{c.criteria.length === c.requirements.length && c.criteria[ri] && <span className="crit"><i>{t('criterion')}:</i> {pickText(lang, c.criteria[ri])}</span>}</li>)}</ol>{c.criteria.length > 0 && c.criteria.length !== c.requirements.length && <div className="print-block print-crit"><i>{t('criteria')}:</i> {c.criteria.map((x, xi) => <span key={x.n}>{xi ? ' · ' : ''}{x.n}. {pickText(lang, x)}</span>)}</div>}{(cfg.mapping[c.id] || []).length > 0 && <span className="flex flex-wrap gap-1 mt-1 proj-tags">{(cfg.mapping[c.id] || []).map(id => <button type="button" key={id} className={`pill tag-pill ${id === prj ? 'pill-accent' : 'pill-muted'}`} title={t('project')} onClick={() => setVs({ prj: id })}><Icon name="map" style={{ width: 11, height: 11 }} />{projName(id)}</button>)}</span>}</td><td className="col-imp"><ImpactPill impact={i} short /></td><td className="text-sm col-dept">{deptName(cfg, departmentOf(snap!, cy, c.id), lang) || '—'}</td><td className="whitespace-nowrap col-who">{userName(a)}</td><td className="col-st"><StatePill state={e.state} /></td>{(() => {
              const items = Object.values(e.answer?.items || {}); const withEv = c.requirements.filter(r => (e.answer?.items[r.n]?.evidence || []).length > 0).length
              const upd = [e.answer && { at: e.answer.updatedAt, by: e.userId }, e.review && { at: e.review.reviewedAt, by: e.review.reviewedBy }].filter(Boolean).sort((x, y) => (y!.at > x!.at ? 1 : -1))[0]
              const asks = items.filter(x => x.clarify?.flag && x.clarify.question).map(x => x.clarify!.question)
              return <><td className="print-only col-upd">{upd ? <>{dayFmt(upd.at)}<br /><span className="muted">{userName(upd.by)}</span></> : '—'}</td>
                <td className="print-only col-rev">{e.review?.comment ? <>{e.review.state === 'returned' ? '↩ ' : ''}{e.review.comment}</> : ''}{asks.map((q, k) => <div key={k}>؟ {q}</div>)}{!e.review?.comment && !asks.length && '—'}</td>
                <td className="print-only col-ev num">{e.answer ? `${withEv}/${c.requirements.length}` : '—'}</td></>
            })()}<td className="print-only notes-col col-notes" /></tr>] })}</tbody></table></div>}
      <Modal open={!!ask} onClose={() => setAsk(null)} title={`${t(ask === 'who' ? 'bulkAssign' : 'bulkDept')} (${sel.size})`} footer={<><button className="btn" onClick={() => setAsk(null)}>{t('cancel')}</button><button className="btn btn-primary" disabled={busy} onClick={applyBulk}><Icon name="check" />{t('confirm')}</button></>}>
        <p className="text-sm m-0 mb-2">{ask === 'who' ? t('bulkAssignConfirm') : t('bulkDeptConfirm')} <b>{ask === 'who' ? (bWho ? userName(bWho) : t('auto')) : deptName(cfg, bDept, lang)}</b></p>
        {ask === 'dept' && <p className="text-xs text-muted m-0 mb-2">{t('bulkDeptNote')}</p>}
        <ul className="m-0 p-0 list-none flex flex-wrap gap-1 max-h-40 overflow-auto">{[...sel].sort(sortIds).map(id => <li key={id}><span className="code-id">{id}</span></li>)}</ul>
      </Modal>
    </div>
  )
}
