import { useMemo, useState } from 'react'
import { useViewState } from '../store/viewState'
import { useApp } from '../store/state'
import { master, assigneeOf, effective, effectiveImpact, sortIds, departmentOf, deptName } from '../store/scoring'
import { pick, pickDesc } from '../i18n'
import { ImpactPill, PageHeader, StatePill, Empty, Modal, useToast, errMsg } from '../components/ui'
import { Icon } from '../components/icons'
import { norm } from '../components/Shell'

export default function Browse() {
  const { t, lang, snap, cycleId, user, isAdmin, saveConfig } = useApp(); const cfg = snap!.config; const cy = cycleId!; const toast = useToast()
  const qs = new URLSearchParams(location.hash.split('?')[1] || '')
  const [vs, setVs] = useViewState('browse', { p: '', q: '', who: '', st: '', imp: '', dep: '' }, { p: qs.get('p') ?? undefined, who: qs.get('who') ?? undefined, st: qs.get('st') ?? undefined, imp: qs.get('imp') ?? undefined })
  const { p, q, who, st, imp, dep } = vs
  const list = useMemo(() => master.codes.filter(c => (!p || c.pillar === p)).map(c => ({ c, a: assigneeOf(c.id, cy, cfg), e: effective(snap!, cy, c.id), i: effectiveImpact(c, cfg) }))
    .filter(r => (!who || r.a === who) && (!st || r.e.state === st) && (!imp || r.i === imp) && (!dep || departmentOf(snap!, cy, r.c.id) === dep) && (!q || norm(r.c.id + ' ' + r.c.desc_ar + ' ' + r.c.desc_en).includes(norm(q))))
    .sort((a, b) => sortIds(a.c.id, b.c.id)), [p, q, who, st, imp, dep, cfg, cy, snap])
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
  const cols = isAdmin ? 7 : 6
  let lastSub = ''
  return (
    <div>
      <PageHeader eyebrow={t('work')} title={t('browse')} sub={`${master.pillars.length} ${t('pillarsCount')} · ${master.subpillars.length} ${t('subpillarsCount')} · ${master.codes.length} ${t('codesCount')}`} />
      <div className="card p-3 mb-4 flex flex-wrap gap-2 items-center">
        <Icon name="filter" className="text-muted" />
        <select className="select !w-auto" value={p} onChange={e => setVs({ p: e.target.value })}><option value="">{t('pillar')}: {t('all')}</option>{master.pillars.map(x => <option key={x.id} value={x.id}>{x.id} · {pick(lang, x)}</option>)}</select>
        <select className="select !w-auto" value={who} onChange={e => setVs({ who: e.target.value })}><option value="">{t('assignedTo')}: {t('all')}</option><option value={user!.id}>{t('myCodes')}</option>{cfg.users.filter(u => u.id !== user!.id).map(u => <option key={u.id} value={u.id}>{lang === 'ar' ? u.name_ar : u.name_en}</option>)}</select>
        <select className="select !w-auto" value={st} onChange={e => setVs({ st: e.target.value })}><option value="">{t('status')}: {t('all')}</option>{(['none', 'draft', 'submitted', 'returned', 'approved'] as const).map(s => <option key={s} value={s}>{t(s === 'none' ? 'notStarted' : s)}</option>)}</select>
        <select className="select !w-auto" value={dep} onChange={e => setVs({ dep: e.target.value })} aria-label={t('department')}><option value="">{t('department')}: {t('all')}</option>{depts.map(d => <option key={d.id} value={d.id}>{lang === 'ar' ? d.name_ar : d.name_en}</option>)}</select>
        <select className="select !w-auto" value={imp} onChange={e => setVs({ imp: e.target.value })}><option value="">{t('impact')}: {t('all')}</option><option value="high">{t('high')}</option><option value="medium">{t('medium')}</option><option value="low">{t('low')}</option></select>
        <div className="relative flex-1 min-w-48"><Icon name="search" className="absolute top-2.5 text-muted" style={{ insetInlineStart: 10 }} /><input className="input !ps-9" placeholder={t('search')} aria-label={t('search')} value={q} onChange={e => setVs({ q: e.target.value })} /></div>
        <span className="text-sm text-muted num">{list.length} / {master.codes.length}</span>
        {(p || q || who || st || imp || dep) && <button className="btn btn-sm" onClick={() => setVs({ p: '', q: '', who: '', st: '', imp: '', dep: '' })}><Icon name="x" />{t('clearFilters')}</button>}
      </div>
      {isAdmin && <div className="card p-3 mb-4 flex flex-wrap gap-x-4 gap-y-2 items-center bulk-bar" data-on={sel.size > 0 || undefined}>
        <span className="flex items-center gap-2 font-semibold"><Icon name="tasks" className="text-accent-ink" />{t('bulkControl')}</span>
        <span className="text-sm num"><b>{sel.size}</b> {t('selectedN')}</span>
        <button className="btn btn-sm" disabled={!shown.length} onClick={() => toggle(shown, !allShown)}>{allShown ? t('clearShown') : `${t('selectShown')} (${shown.length})`}</button>
        {sel.size > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setSel(new Set())}><Icon name="x" />{t('clearSelection')}</button>}
        <span className="flex flex-wrap items-center gap-2 ms-auto">
          <select className="select !w-auto !py-1.5 text-sm" aria-label={t('bulkDept')} value={bDept} onChange={e => setBDept(e.target.value)}><option value="">{t('bulkDept')}…</option>{depts.map(d => <option key={d.id} value={d.id}>{lang === 'ar' ? d.name_ar : d.name_en}</option>)}</select>
          <button className="btn btn-primary btn-sm" disabled={!sel.size || !bDept} onClick={() => setAsk('dept')}><Icon name="check" />{t('apply')}</button>
          <span className="w-px self-stretch bg-line mx-1" />
          <select className="select !w-auto !py-1.5 text-sm" aria-label={t('bulkAssign')} value={bWho} onChange={e => setBWho(e.target.value)}><option value="__keep">{t('bulkAssign')}…</option><option value="">{t('auto')}</option>{cfg.users.filter(u => u.active).map(u => <option key={u.id} value={u.id}>{lang === 'ar' ? u.name_ar : u.name_en}</option>)}</select>
          <button className="btn btn-primary btn-sm" disabled={!sel.size || bWho === '__keep'} onClick={() => setAsk('who')}><Icon name="check" />{t('apply')}</button>
        </span>
      </div>}
      {list.length === 0 && <Empty icon="search" title={t('noMatches')}><button className="btn btn-sm mt-2" onClick={() => setVs({ p: '', q: '', who: '', st: '', imp: '', dep: '' })}>{t('clearFilters')}</button></Empty>}
      {list.length > 0 && <div className="card overflow-x-auto"><table className="tbl">
        <thead><tr>{isAdmin && <th className="w-8"><input type="checkbox" aria-label={t('selectShown')} checked={allShown} onChange={e => toggle(shown, e.target.checked)} /></th>}<th>{t('code')}</th><th>{t('codeText')}</th><th>{t('impact')}</th><th>{t('department')}</th><th>{t('assignedTo')}</th><th>{t('status')}</th></tr></thead>
        <tbody>{list.map(({ c, a, e, i }) => { const sub = master.subpillars.find(s => s.id === c.sub)!; const showSub = sub.id !== lastSub; lastSub = sub.id
          const subIds = showSub && isAdmin ? list.filter(r => r.c.sub === sub.id).map(r => r.c.id) : []
          return [showSub && <tr key={'s' + sub.id}>{isAdmin && <td className="!bg-surface-2 !py-2"><input type="checkbox" aria-label={`${t('selectAll')} ${sub.id}`} checked={subIds.every(id => sel.has(id))} onChange={ev => toggle(subIds, ev.target.checked)} /></td>}<td colSpan={cols - (isAdmin ? 1 : 0)} className="!bg-surface-2 font-semibold text-accent-ink !py-2">{sub.id} {pick(lang, sub)}</td></tr>,
            <tr key={c.id} className={sel.has(c.id) ? 'bg-accent-soft/40' : ''}>{isAdmin && <td><input type="checkbox" aria-label={c.id} checked={sel.has(c.id)} onChange={ev => toggle([c.id], ev.target.checked)} /></td>}<td><a className="code-id no-underline" href={'#/code/' + c.id}>{c.id}</a></td><td className="max-w-2xl">{pickDesc(lang, c)}</td><td><ImpactPill impact={i} short /></td><td className="text-sm">{deptName(cfg, departmentOf(snap!, cy, c.id), lang) || '—'}</td><td className="whitespace-nowrap">{userName(a)}</td><td><StatePill state={e.state} /></td></tr>] })}</tbody></table></div>}
      <Modal open={!!ask} onClose={() => setAsk(null)} title={`${t(ask === 'who' ? 'bulkAssign' : 'bulkDept')} (${sel.size})`} footer={<><button className="btn" onClick={() => setAsk(null)}>{t('cancel')}</button><button className="btn btn-primary" disabled={busy} onClick={applyBulk}><Icon name="check" />{t('confirm')}</button></>}>
        <p className="text-sm m-0 mb-2">{ask === 'who' ? t('bulkAssignConfirm') : t('bulkDeptConfirm')} <b>{ask === 'who' ? (bWho ? userName(bWho) : t('auto')) : deptName(cfg, bDept, lang)}</b></p>
        {ask === 'dept' && <p className="text-xs text-muted m-0 mb-2">{t('bulkDeptNote')}</p>}
        <ul className="m-0 p-0 list-none flex flex-wrap gap-1 max-h-40 overflow-auto">{[...sel].sort(sortIds).map(id => <li key={id}><span className="code-id">{id}</span></li>)}</ul>
      </Modal>
    </div>
  )
}
