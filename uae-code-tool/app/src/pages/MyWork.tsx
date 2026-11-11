import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../store/state'
import { master, assigneeOf, effective, effectiveImpact, isComplete, sortIds, departmentOf, deptName } from '../store/scoring'
import { pick, pickDesc } from '../i18n'
import { Empty, PageHeader, Ring, StatePill, Pill, ImpactPill, fmtDay } from '../components/ui'
import { Icon } from '../components/icons'
import { norm } from '../components/Shell'
import type { WorkState } from '../types'

type Sort = 'code' | 'impact' | 'dept' | 'status' | 'project'
const IMP_RANK: Record<string, number> = { high: 0, medium: 1, low: 2, none: 3 }
const STATE_RANK: Record<WorkState, number> = { returned: 0, draft: 1, none: 2, submitted: 3, approved: 4 }
const KEY = 'mywork:filters'

/** The evaluator's own list: status tabs, labelled filters (impact, department, project), a sort and a search.
 *  Filters are remembered for the tab so coming back from a code page lands on the same list. */
export default function MyWork() {
  const { t, lang, snap, user, cycleId } = useApp(); const cfg = snap!.config; const cy = cycleId!
  const saved = (() => { try { return JSON.parse(sessionStorage.getItem(KEY) || '{}') } catch { return {} } })() as Partial<{ f: string; imp: string; dep: string; prj: string; sort: Sort; q: string }>
  const fromUrl = new URLSearchParams(location.hash.split('?')[1] || '').get('f')
  const [f, setF] = useState(fromUrl ?? saved.f ?? '')
  const [imp, setImp] = useState(saved.imp || '')
  const [dep, setDep] = useState(saved.dep || '')
  const [prj, setPrj] = useState(saved.prj || '')
  const [sort, setSort] = useState<Sort>(saved.sort || 'code')
  const [q, setQ] = useState(saved.q || '')
  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify({ f, imp, dep, prj, sort, q })) } catch { /* ignore */ } }, [f, imp, dep, prj, sort, q])

  const mine = useMemo(() => master.codes.filter(c => assigneeOf(c.id, cy, cfg) === user!.id).sort((a, b) => sortIds(a.id, b.id)), [cfg, cy, user])
  const cycle = cfg.cycles.find(c => c.id === cy)
  const rows = useMemo(() => mine.map(c => {
    const e = effective(snap!, cy, c.id); const links = cfg.mapping[c.id] || []
    const pid = links.find(p => cfg.projects.find(x => x.id === p)?.ownerId === user!.id) || links[0] || ''
    return { c, e, imp: effectiveImpact(c, cfg), dept: departmentOf(snap!, cy, c.id), pid, flag: !!cfg.deptConfirm?.[c.id], complete: isComplete(e.answer, c), clar: Object.values(e.answer?.items || {}).some(i => i.clarify?.flag) }
  }), [mine, snap, cy, cfg, user])
  const count = (s: WorkState) => rows.filter(r => r.e.state === s).length
  const done = count('approved'), sub = count('submitted')
  const tabs: [string, string, number][] = [['', t('all'), rows.length], ['none', t('notStarted'), count('none')], ['draft', t('draft'), count('draft')], ['returned', t('returned'), count('returned')], ['clarify', t('needsClarification'), rows.filter(r => r.clar).length], ['submitted', t('submitted'), sub], ['approved', t('approved'), done]]
  const byTab = rows.filter(r => !f || (f === 'clarify' ? r.clar : r.e.state === f))
  const filtered = byTab.filter(r => (!imp || r.imp === imp) && (!dep || (dep === '_none' ? !r.dept : r.dept === dep)) && (!prj || (prj === '_none' ? !r.pid : r.pid === prj)) && (!q || norm(r.c.id + ' ' + r.c.desc_ar + ' ' + r.c.desc_en).includes(norm(q))))
  const pname = (id: string) => { const p = cfg.projects.find(x => x.id === id); return p ? pick(lang, p) : t('coreTeam') }
  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case 'impact': return (IMP_RANK[a.imp] - IMP_RANK[b.imp]) || sortIds(a.c.id, b.c.id)
      case 'dept': return (deptName(cfg, a.dept, lang) || '￿').localeCompare(deptName(cfg, b.dept, lang) || '￿') || sortIds(a.c.id, b.c.id)
      case 'status': return (STATE_RANK[a.e.state] - STATE_RANK[b.e.state]) || sortIds(a.c.id, b.c.id)
      case 'project': return pname(a.pid).localeCompare(pname(b.pid)) || sortIds(a.c.id, b.c.id)
      default: return sortIds(a.c.id, b.c.id)
    }
  })
  const opts = (key: (r: typeof rows[number]) => string, label: (k: string) => string) => { const m = new Map<string, number>(); for (const r of byTab) m.set(key(r), (m.get(key(r)) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ k, label: label(k), n })) }
  const deptOpts = opts(r => r.dept || '_none', k => k === '_none' ? t('noDept') : deptName(cfg, k, lang))
  const prjOpts = opts(r => r.pid || '_none', k => k === '_none' ? t('coreTeam') : pname(k))
  const active = !!(imp || dep || prj || q)
  const reset = () => { setImp(''); setDep(''); setPrj(''); setQ(''); setSort('code') }
  const daysLeft = cycle ? Math.ceil((new Date(cycle.due).getTime() - Date.now()) / 86400000) : null
  const Sel = ({ label, value, onChange, children, id }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode; id: string }) => (
    <div className="field min-w-0"><label className="label" htmlFor={id}>{label}</label><select id={id} className="select !py-1.5 text-sm" value={value} onChange={e => onChange(e.target.value)}>{children}</select></div>)
  return (
    <div>
      <PageHeader title={t('myWork')} sub={cycle && `${lang === 'ar' ? cycle.name : (cycle.name_en || cycle.name)} · ${t('dueDate')}: ${fmtDay(cycle.due, lang)}${daysLeft !== null ? ` · ${daysLeft >= 0 ? `${daysLeft} ${t('daysLeft')}` : t('overdue')}` : ''}`}
        actions={<div className="flex items-center gap-3"><div className="text-end text-sm"><div className="text-muted">{t('progress')}</div><div className="num font-semibold">{done + sub} / {rows.length}</div></div><Ring value={rows.length ? ((done + sub) / rows.length) * 100 : 0} size={64} stroke={7} /></div>} />
      <div className="card p-3 mb-4 flex flex-col gap-3">
        <div className="seg flex-wrap" role="group" aria-label={t('status')}>{tabs.map(([k, l, n]) => <button key={k} aria-pressed={f === k} onClick={() => setF(k)}>{l}<span className={`num text-xs ${f === k ? '' : 'text-muted'}`}>{n}</span></button>)}</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2 items-end">
          <Sel id="mw-imp" label={t('impact')} value={imp} onChange={setImp}><option value="">{t('all')}</option>{(['high', 'medium', 'low'] as const).map(k => <option key={k} value={k}>{t(k)} ({byTab.filter(r => r.imp === k).length})</option>)}</Sel>
          <Sel id="mw-dep" label={t('department')} value={dep} onChange={setDep}><option value="">{t('all')}</option>{deptOpts.map(o => <option key={o.k} value={o.k}>{o.label} ({o.n})</option>)}</Sel>
          <Sel id="mw-prj" label={t('project')} value={prj} onChange={setPrj}><option value="">{t('all')}</option>{prjOpts.map(o => <option key={o.k} value={o.k}>{o.label} ({o.n})</option>)}</Sel>
          <Sel id="mw-sort" label={t('sortBy')} value={sort} onChange={v => setSort(v as Sort)}><option value="code">{t('sortCode')}</option><option value="impact">{t('sortImpact')}</option><option value="dept">{t('department')}</option><option value="project">{t('project')}</option><option value="status">{t('status')}</option></Sel>
          <div className="field min-w-0"><label className="label" htmlFor="mw-q">{t('search')}</label><div className="relative"><Icon name="search" className="absolute top-2.5 text-muted" style={{ insetInlineStart: 10 }} /><input id="mw-q" className="input !ps-9 !py-1.5 text-sm" placeholder={t('search')} value={q} onChange={e => setQ(e.target.value)} /></div></div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted"><span className="num">{sorted.length} / {rows.length}</span>{active && <button className="btn btn-ghost btn-sm" onClick={reset}><Icon name="x" />{t('clearFilters')}</button>}</div>
      </div>
      {sorted.length === 0 && <Empty icon={rows.length === 0 ? 'checkCircle' : 'search'} title={rows.length === 0 ? t('noItems') : active || f ? t('noMatches') : t('allCaughtUp')}>{(active || f) && <button className="btn btn-sm mt-2" onClick={() => { reset(); setF('') }}>{t('clearFilters')}</button>}</Empty>}
      {sorted.length > 0 && <div className="card overflow-hidden"><ul className="m-0 p-0 list-none divide-y divide-line">{sorted.map(({ c, e, imp: ci, dept, pid, flag, complete, clar }) => <li key={c.id}>
        <a href={'#/code/' + c.id + '?from=my'} className="flex items-center gap-3 px-4 py-2.5 no-underline text-fg hover:bg-surface-2">
          <span className="code-id">{c.id}</span>
          <span className="flex-1 min-w-0 text-sm"><span className="block truncate" title={pickDesc(lang, c)}>{pickDesc(lang, c)}</span><span className="block text-xs text-muted truncate"><Icon name="map" style={{ width: 11, height: 11 }} className="inline me-1" />{pname(pid)} · {deptName(cfg, dept, lang) || t('noDept')}{flag && <span className="text-warn-ink"> · ⚠ {t('markDeptConfirm')}</span>}</span></span>
          <span className="flex gap-1 shrink-0 items-center"><ImpactPill impact={ci} short />{clar && <Pill kind="flag"><span aria-label={t('needsClarification')} title={t('needsClarification')}>?</span></Pill>}{e.state === 'draft' && !complete && <Pill kind="muted">{t('unanswered')}</Pill>}<StatePill state={e.state} /></span>
          <Icon name={lang === 'ar' ? 'chevronL' : 'chevronR'} className="text-muted shrink-0" />
        </a></li>)}</ul></div>}
    </div>
  )
}
