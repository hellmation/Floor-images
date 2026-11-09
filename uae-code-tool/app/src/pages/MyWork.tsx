import { useMemo, useState } from 'react'
import { useApp } from '../store/state'
import { master, assigneeOf, effective, effectiveImpact, isComplete, sortIds, departmentOf, deptName } from '../store/scoring'
import { pick, pickDesc } from '../i18n'
import { Bar, Empty, PageHeader, Ring, StatePill, Pill, ImpactPill, fmtDay } from '../components/ui'
import { Icon } from '../components/icons'
import type { WorkState } from '../types'

export default function MyWork() {
  const { t, lang, snap, user, cycleId } = useApp(); const cfg = snap!.config; const cy = cycleId!
  const initial = new URLSearchParams(location.hash.split('?')[1] || '').get('f') || ''
  const [f, setF] = useState(initial)
  const [imp, setImp] = useState<'' | 'high' | 'medium' | 'low'>('')
  const [dep, setDep] = useState('')
  const IMP_RANK: Record<string, number> = { high: 0, medium: 1, low: 2, none: 3 }
  const mine = useMemo(() => master.codes.filter(c => assigneeOf(c.id, cy, cfg) === user!.id).sort((a, b) => sortIds(a.id, b.id)), [cfg, cy, user])
  const cycle = cfg.cycles.find(c => c.id === cy)
  const rows = mine.map(c => { const e = effective(snap!, cy, c.id); return { c, e, imp: effectiveImpact(c, cfg), dept: departmentOf(snap!, cy, c.id), flag: !!cfg.deptConfirm?.[c.id], complete: isComplete(e.answer, c), clar: Object.values(e.answer?.items || {}).some(i => i.clarify?.flag) } })
  const count = (s: WorkState) => rows.filter(r => r.e.state === s).length
  const done = count('approved'), sub = count('submitted')
  const chips: [string, string, number][] = [['', t('all'), rows.length], ['returned', t('returned'), count('returned')], ['draft', t('draft'), count('draft')], ['none', t('notStarted'), count('none')], ['clarify', t('needsClarification'), rows.filter(r => r.clar).length], ['submitted', t('submitted'), sub], ['approved', t('approved'), done]]
  const filtered = rows.filter(r => (!f || (f === 'clarify' ? r.clar : r.e.state === f)) && (!imp || r.imp === imp) && (!dep || (dep === '_none' ? !r.dept : r.dept === dep)))
  const myDepts = [...new Set(rows.map(r => r.dept || '_none'))]
  const impCount = (k: string) => rows.filter(r => r.imp === k && (!f || (f === 'clarify' ? r.clar : r.e.state === f))).length
  const groups = new Map<string, { label: string; rows: typeof rows }>()
  for (const r of filtered) { const pid = (cfg.mapping[r.c.id] || []).find(p => cfg.projects.find(x => x.id === p)?.ownerId === user!.id) || (cfg.mapping[r.c.id] || [])[0]; const p = pid ? cfg.projects.find(x => x.id === pid) : null; const key = p ? p.id : '_core'
    if (!groups.has(key)) groups.set(key, { label: p ? pick(lang, p) : t('coreTeam'), rows: [] }); groups.get(key)!.rows.push(r) }
  const daysLeft = cycle ? Math.ceil((new Date(cycle.due).getTime() - Date.now()) / 86400000) : null
  return (
    <div>
      <PageHeader title={t('myWork')} sub={cycle && `${lang === 'ar' ? cycle.name : (cycle.name_en || cycle.name)} · ${t('dueDate')}: ${fmtDay(cycle.due, lang)}${daysLeft !== null ? ` · ${daysLeft >= 0 ? `${daysLeft} ${t('daysLeft')}` : t('overdue')}` : ''}`}
        actions={<div className="flex items-center gap-3"><div className="text-end text-sm"><div className="text-muted">{t('progress')}</div><div className="num font-semibold">{done + sub} / {rows.length}</div></div><Ring value={rows.length ? ((done + sub) / rows.length) * 100 : 0} size={64} stroke={7} /></div>} />
      <div className="flex flex-wrap gap-2 mb-2">{chips.map(([k, l, n]) => <button key={k} aria-pressed={f === k} className={`btn btn-sm ${f === k ? 'btn-primary' : ''}`} onClick={() => setF(k)}>{l}<span className={`num ${f === k ? 'opacity-80' : 'text-muted'}`}>{n}</span></button>)}</div>
      <div className="flex flex-wrap gap-2 mb-4 items-center" role="group" aria-label={t('impact')}><span className="text-sm text-muted">{t('impact')}:</span>{([['', t('all')], ['high', t('high')], ['medium', t('medium')], ['low', t('low')]] as const).map(([k, l]) => <button key={k} aria-pressed={imp === k} className={`btn btn-sm ${imp === k ? 'btn-primary' : ''}`} onClick={() => setImp(k)}>{l}<span className={`num ${imp === k ? 'opacity-80' : 'text-muted'}`}>{k ? impCount(k) : filtered.length}</span></button>)}<span className="text-xs text-muted">{t('impactSortHint')}</span>
        <select className="select !w-auto !py-1 text-sm ms-auto" aria-label={t('department')} value={dep} onChange={e => setDep(e.target.value)}><option value="">{t('department')}: {t('all')}</option>{myDepts.map(id => <option key={id} value={id}>{id === '_none' ? t('noDept') : deptName(cfg, id, lang)} ({rows.filter(r => (r.dept || '_none') === id).length})</option>)}</select></div>
      {filtered.length === 0 && <Empty icon="checkCircle" title={rows.length === 0 ? t('noItems') : t('allCaughtUp')} />}
      <div className="flex flex-col gap-4">{[...groups.entries()].map(([k, g]) => { const d = g.rows.filter(r => r.e.state === 'approved' || r.e.state === 'submitted').length
        return <section key={k} className="card overflow-hidden"><div className="px-4 py-3 border-b border-line flex items-center gap-3"><Icon name={k === '_core' ? 'users' : 'map'} className="text-accent-ink" /><h2 className="text-base font-semibold m-0 flex-1 truncate">{g.label}</h2><span className="w-32 hidden sm:block"><Bar value={d} max={g.rows.length} thin /></span><span className="text-muted text-sm num">{d}/{g.rows.length}</span></div>
          <ul className="m-0 p-0 list-none divide-y divide-line">{g.rows.sort((a, b) => (a.e.state === 'returned' ? -1 : b.e.state === 'returned' ? 1 : 0) || (IMP_RANK[a.imp] - IMP_RANK[b.imp]) || sortIds(a.c.id, b.c.id)).map(({ c, e, imp: ci, dept, flag, complete, clar }) => <li key={c.id}><a href={'#/code/' + c.id} className="flex items-center gap-3 px-4 py-2.5 no-underline text-fg hover:bg-surface-2"><span className="code-id">{c.id}</span><span className="flex-1 min-w-0 text-sm truncate" title={pickDesc(lang, c)}>{pickDesc(lang, c)}<span className="block text-xs text-muted truncate">{deptName(cfg, dept, lang) || t('noDept')}{flag && <span className="text-warn-ink"> · ⚠ {t('markDeptConfirm')}</span>}</span></span><span className="flex gap-1 shrink-0"><ImpactPill impact={ci} short />{clar && <Pill kind="flag"><span aria-label={t('needsClarification')} title={t('needsClarification')}>?</span></Pill>}{e.state === 'draft' && !complete && <Pill kind="muted">{t('unanswered')}</Pill>}<StatePill state={e.state} /></span><Icon name={lang === 'ar' ? 'chevronL' : 'chevronR'} className="text-muted" /></a></li>)}</ul></section> })}</div>
    </div>
  )
}
