import { useMemo } from 'react'
import { useApp } from '../store/state'
import { master, rollup, assigneeOf, standings } from '../store/scoring'
import { pick } from '../i18n'
import { Bar, Tile, fmtPct } from '../components/ui'

export default function Home() {
  const { t, lang, snap, user, isAdmin, cycleId } = useApp(); const cfg = snap!.config; const cy = cycleId!
  const cycle = cfg.cycles.find(c => c.id === cy)
  const all = useMemo(() => rollup(snap!, cy, master.codes, true), [snap, cy])
  const mine = useMemo(() => rollup(snap!, cy, master.codes.filter(c => assigneeOf(c.id, cy, cfg) === user!.id), false), [snap, cy, cfg, user])
  const byPillar = useMemo(() => master.pillars.map(p => ({ p, r: rollup(snap!, cy, master.codes.filter(c => c.pillar === p.id), true), subs: master.subpillars.filter(s => s.pillar === p.id).length })), [snap, cy])
  const table = useMemo(() => standings(snap!, cy), [snap, cy])
  const daysLeft = cycle ? Math.ceil((new Date(cycle.due).getTime() - Date.now()) / 86400000) : null
  const cycleName = cycle ? (lang === 'ar' ? cycle.name : (cycle.name_en || cycle.name)) : ''
  const links: [string, string][] = [['my', t('myWork')], ['browse', t('browse')], ['dashboard', t('dashboard')], ...(isAdmin ? [['review', t('review')], ['mapping', t('mapping')], ['cycles', t('cycles')], ['admin', t('admin')]] as [string, string][] : [])]
  return (
    <div className="flex flex-col gap-6">
      <section className="card p-6 md:p-8 flex flex-col gap-3" style={{ background: 'linear-gradient(135deg, var(--accent-soft), var(--surface))' }}>
        <div className="text-sm text-accent font-semibold">{t('entity') === 'entity' ? '' : (lang === 'ar' ? cfg.entity.name_ar : cfg.entity.name_en)}</div>
        <h1 className="m-0 text-3xl md:text-4xl font-bold" style={{ textWrap: 'balance' }}>{t('appName')}</h1>
        <p className="m-0 text-lg text-muted" style={{ textWrap: 'balance' }}>{t('appTagline')}</p>
        <p className="m-0 max-w-3xl leading-relaxed">{t('homeIntro')}</p>
        <div className="flex flex-wrap gap-2 mt-2">
          <a className="btn btn-primary no-underline" href="#/my">{t('goToMyWork')} ({mine.total})</a>
          <a className="btn no-underline" href="#/browse">{t('browse')}</a>
          <a className="btn no-underline" href="#/dashboard">{t('dashboard')}</a>
        </div>
      </section>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label={t('currentCycle')} value={<span className="text-xl">{cycleName}</span>} sub={cycle && (daysLeft !== null && daysLeft >= 0 ? `${t('dueDate')}: ${cycle.due} · ${t('dueIn')} ${daysLeft} ${t('days')}` : `${t('dueDate')}: ${cycle.due} · ${t('overdue')}`)} />
        <Tile label={t('readiness')} value={fmtPct(all.total ? (all.approved / all.total) * 100 : 0)} sub={`${t('approved')} ${all.approved} ${t('of')} ${all.total}`} tone="accent" />
        <Tile label={t('compliance')} value={fmtPct(all.score)} sub={t('approvedOnly')} />
        <Tile label={t('yourRole')} value={<span className="text-xl">{t(user!.role === 'admin' ? 'adminRole' : user!.role === 'viewer' ? 'viewerRole' : 'evaluatorRole')}</span>} sub={<><span className="num">{mine.answered}/{mine.total}</span> {t('answered')}</>} />
      </div>
      <section className="card p-4">
        <h2 className="m-0 mb-3 text-base font-semibold">{t('thePillars')} <span className="text-muted font-normal text-sm">· {master.subpillars.length} {t('subpillarsCount')} · {master.codes.length} {t('codesCount')}</span></h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {byPillar.map(({ p, r, subs }) => <a key={p.id} href={'#/browse'} className="no-underline text-fg rounded-lg border border-line p-3 flex flex-col gap-2 hover:bg-surface-2">
            <div className="flex items-baseline gap-2"><span className="text-2xl font-bold text-accent num">{p.id}</span><span className="font-semibold leading-tight">{pick(lang, p)}</span></div>
            <div className="text-xs text-muted">{subs} {t('subpillarsCount')} · {r.total} {t('codesCount')}</div>
            <Bar value={r.approved} max={r.total} />
            <div className="flex justify-between text-xs"><span className="text-muted num">{r.approved}/{r.total} {t('approved')}</span><span className="num font-semibold">{fmtPct(r.score)}</span></div>
          </a>)}
        </div>
      </section>
      <div className="grid md:grid-cols-[2fr_1fr] gap-4">
        <section className="card p-4"><h2 className="m-0 mb-3 text-base font-semibold">{t('howItWorks')}</h2>
          <ol className="m-0 ps-5 flex flex-col gap-2 leading-relaxed">{(['step1', 'step2', 'step3', 'step4'] as const).map(k => <li key={k}>{t(k)}</li>)}</ol></section>
        <div className="flex flex-col gap-4">
          <section className="card p-4"><h2 className="m-0 mb-2 text-base font-semibold">🏆 {t('standings')}</h2>
            {table.length === 0 ? <p className="m-0 text-sm text-muted">—</p> : <ol className="m-0 p-0 list-none flex flex-col gap-1">{table.slice(0, 6).map(s => { const u = cfg.users.find(x => x.id === s.userId)!; const me = s.userId === user!.id
              return <li key={s.userId} className={`flex items-center gap-2 text-sm rounded px-2 py-1 ${me ? 'bg-accent-soft' : ''}`}><span className="num w-6 text-center font-semibold">{s.rank <= 3 ? ['🥇', '🥈', '🥉'][s.rank - 1] : s.rank}</span><span className="flex-1 min-w-0 truncate">{lang === 'ar' ? u.name_ar : u.name_en}</span><span className="num text-muted">{s.approved}/{s.total}</span><span className="num font-semibold w-10 text-end">{Math.round(s.points)}</span></li> })}</ol>}
            <a href="#/dashboard" className="text-xs text-muted">{t('standingsHint')}</a></section>
          <section className="card p-4"><h2 className="m-0 mb-3 text-base font-semibold">{t('quickLinks')}</h2>
            <div className="nav flex flex-col gap-1">{links.map(([k, l]) => <a key={k} href={'#/' + k}>{l}</a>)}</div></section>
        </div>
      </div>
    </div>
  )
}
