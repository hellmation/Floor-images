import { useMemo } from 'react'
import { useApp } from '../store/state'
import { master, assigneeOf, effective, isComplete, sortIds } from '../store/scoring'
import { pick, pickDesc } from '../i18n'
import { Bar, Empty, StatePill, Tile } from '../components/ui'
import type { Code } from '../types'

export default function MyWork() {
  const { t, lang, snap, user, cycleId } = useApp()
  const cfg = snap!.config; const cy = cycleId!
  const mine = useMemo(() => master.codes.filter(c => assigneeOf(c.id, cy, cfg) === user!.id).sort((a, b) => sortIds(a.id, b.id)), [cfg, cy, user])
  const cycle = cfg.cycles.find(c => c.id === cy)
  const rows = mine.map(c => ({ c, e: effective(snap!, cy, c.id) }))
  const done = rows.filter(r => r.e.state === 'approved').length
  const sub = rows.filter(r => r.e.state === 'submitted').length
  const ret = rows.filter(r => r.e.state === 'returned').length
  const drafts = rows.filter(r => r.e.state === 'draft').length
  const clar = rows.reduce((n, r) => n + Object.values(r.e.answer?.items || {}).filter(i => i.clarify?.flag).length, 0)
  const daysLeft = cycle ? Math.ceil((new Date(cycle.due).getTime() - Date.now()) / 86400000) : null

  // group by project (first linked project owned by me), else core team
  const groups = new Map<string, { label: string; rows: typeof rows }>()
  for (const r of rows) {
    const pid = (cfg.mapping[r.c.id] || []).find(p => cfg.projects.find(x => x.id === p)?.ownerId === user!.id) || (cfg.mapping[r.c.id] || [])[0]
    const p = pid ? cfg.projects.find(x => x.id === pid) : null
    const key = p ? p.id : '_core'
    if (!groups.has(key)) groups.set(key, { label: p ? pick(lang, p) : t('coreTeam'), rows: [] })
    groups.get(key)!.rows.push(r)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h1 className="text-xl font-semibold m-0">{t('welcome')}, {lang === 'ar' ? user!.name_ar : user!.name_en}</h1>
          <div className="text-sm text-muted">{cycle && (lang === 'ar' ? cycle.name : (cycle.name_en || cycle.name))} · {t('dueDate')}: {cycle?.due} {daysLeft !== null && (daysLeft >= 0 ? `· ${t('dueIn')} ${daysLeft} ${t('days')}` : `· ${t('overdue')}`)}</div></div>
        <div className="w-full sm:w-72"><div className="flex justify-between text-sm"><span>{t('progress')}</span><span className="num">{done + sub} / {rows.length}</span></div><Bar value={done + sub} max={rows.length} /></div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Tile label={t('myCodes')} value={rows.length} />
        <Tile label={t('returned')} value={ret} tone={ret ? 'bad' : undefined} />
        <Tile label={t('draft')} value={drafts} tone={drafts ? 'warn' : undefined} />
        <Tile label={t('submitted')} value={sub} />
        <Tile label={t('needsClarification')} value={clar} tone={clar ? 'warn' : undefined} />
      </div>
      {rows.length === 0 && <Empty>{t('noItems')}</Empty>}
      {[...groups.entries()].map(([k, g]) => (
        <section key={k} className="card">
          <h2 className="text-base font-semibold m-0 px-4 py-3 border-b border-line">{g.label} <span className="text-muted font-normal text-sm num">· {g.rows.filter(r => r.e.state === 'approved' || r.e.state === 'submitted').length}/{g.rows.length}</span></h2>
          <ul className="m-0 p-0 list-none divide-y divide-line">
            {g.rows.sort((a, b) => (a.e.state === 'returned' ? -1 : b.e.state === 'returned' ? 1 : 0)).map(({ c, e }) => <Row key={c.id} c={c} state={e.state} complete={isComplete(e.answer, c)} clar={Object.values(e.answer?.items || {}).some(i => i.clarify?.flag)} />)}
          </ul>
        </section>
      ))}
    </div>
  )
}
function Row({ c, state, complete, clar }: { c: Code; state: ReturnType<typeof effective>['state']; complete: boolean; clar: boolean }) {
  const { lang, t } = useApp()
  return <li><a href={'#/code/' + c.id} className="flex items-start gap-3 px-4 py-2.5 no-underline text-fg hover:bg-surface-2">
    <span className="code-id">{c.id}</span>
    <span className="flex-1 min-w-0 text-sm">{pickDesc(lang, c).slice(0, 160)}{pickDesc(lang, c).length > 160 ? '…' : ''}</span>
    <span className="flex gap-1 shrink-0">{clar && <span className="pill pill-flag">?</span>}{state === 'draft' && !complete && <span className="pill pill-muted">{t('unanswered')}</span>}<StatePill state={state} /></span>
  </a></li>
}
