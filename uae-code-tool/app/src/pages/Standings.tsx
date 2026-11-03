import { useMemo } from 'react'
import { useApp } from '../store/state'
import { standings, master, assigneeOf, rollup } from '../store/scoring'
import { Avatar, Bar, PageHeader, fmtPct, tone } from '../components/ui'
import { Icon } from '../components/icons'

export default function Standings() {
  const { t, lang, snap, user, cycleId } = useApp(); const cfg = snap!.config; const cy = cycleId!
  const table = useMemo(() => standings(snap!, cy), [snap, cy])
  const prevCycle = useMemo(() => cfg.cycles.filter(c => c.status === 'closed' && c.id !== cy).sort((a, b) => b.start.localeCompare(a.start))[0], [cfg, cy])
  const prev = useMemo(() => prevCycle ? standings(snap!, prevCycle.id) : [], [snap, prevCycle])
  const uname = (id: string) => { const u = cfg.users.find(x => x.id === id)!; return lang === 'ar' ? u.name_ar : u.name_en }
  const photo = (id: string) => cfg.users.find(x => x.id === id)?.photo
  const projectsOf = (id: string) => cfg.projects.filter(p => p.active && p.ownerId === id).length
  const top = [table[1], table[0], table[2]]
  return (
    <div>
      <PageHeader eyebrow={t('appName')} title={t('standings')} sub={t('standingsHint')} />
      {table.length === 0 ? <div className="card p-8 text-center text-muted">{t('noItems')}</div> : <>
        <section className="card p-5 mb-4"><h2 className="text-base font-semibold m-0 mb-4 flex items-center gap-2"><Icon name="trophy" className="text-accent-ink" />{t('podium')}</h2>
          <div className="podium max-w-2xl mx-auto">{top.map((s, i) => s ? <div key={s.userId} className={`step ${s.rank === 1 ? 'first' : ''}`} style={{ paddingTop: s.rank === 1 ? 28 : s.rank === 2 ? 18 : 10 }}>
            <div className="text-2xl">{['🥇', '🥈', '🥉'][s.rank - 1]}</div><div className="my-2 inline-block"><Avatar name={uname(s.userId)} photo={photo(s.userId)} size="xl" /></div><div className="font-semibold truncate">{uname(s.userId)}</div><div className="text-muted text-xs num">{s.approved}/{s.total} · {fmtPct(s.score)}</div><div className="display text-2xl font-bold num mt-1">{Math.round(s.points)}</div><div className="text-xs text-muted">{t('points')}</div></div> : <div key={i} />)}</div></section>
        <section className="card overflow-x-auto"><table className="tbl"><thead><tr><th>{t('rank')}</th><th>{t('evaluator')}</th><th>{t('projects')}</th><th>{t('codes')}</th><th>{t('progress')}</th><th>{t('approved')}</th><th>{t('compliance')}</th><th>{t('points')}</th>{prevCycle && <th>{prevCycle.id}</th>}</tr></thead><tbody>
          {table.map(s => { const p = prev.find(x => x.userId === s.userId); const mv = p ? p.rank - s.rank : null
            return <tr key={s.userId} className={s.userId === user!.id ? '!bg-accent-soft' : ''}><td className="num font-bold text-lg">{s.rank <= 3 ? ['🥇', '🥈', '🥉'][s.rank - 1] : s.rank}</td><td><div className="flex items-center gap-2"><Avatar name={uname(s.userId)} photo={photo(s.userId)} /><span className="font-medium">{uname(s.userId)}</span></div></td><td className="num">{projectsOf(s.userId)}</td><td className="num">{s.total}</td><td style={{ minWidth: 140 }}><Bar value={s.approved} max={s.total} thin /><span className="text-xs text-muted num">{s.answered} {t('answered')}</span></td><td className="num">{s.approved} <span className="text-muted">({Math.round(s.approvedPct)}%)</span></td><td className={`num font-semibold text-${tone(s.score)}-ink`}>{fmtPct(s.score)}</td><td className="num font-bold text-lg">{Math.round(s.points)}</td>{prevCycle && <td className="num text-sm">{mv === null ? '—' : mv > 0 ? <span className="text-ok-ink">▲ {mv}</span> : mv < 0 ? <span className="text-bad-ink">▼ {-mv}</span> : '='}</td>}</tr> })}</tbody></table></section>
        <p className="text-xs text-muted mt-3">{t('coreTeam')}: {cfg.settings.defaultAssigneeId ? uname(cfg.settings.defaultAssigneeId) : t('unassigned')} · {t('unmappedCodes')}: {master.codes.filter(c => !(cfg.mapping[c.id] || []).length).length} · {t('approvedOnly')}: {fmtPct((() => { const r = rollup(snap!, cy, master.codes.filter(c => assigneeOf(c.id, cy, cfg)), true); return r.score })())}</p>
      </>}
    </div>
  )
}
