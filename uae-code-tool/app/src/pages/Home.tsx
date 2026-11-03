import { useMemo } from 'react'
import { useApp } from '../store/state'
import { master, rollup, assigneeOf, standings, effective } from '../store/scoring'
import { pick } from '../i18n'
import { Bar, Ring, PageHeader, Avatar, fmtPct, tone, ringTone } from '../components/ui'
import { Icon } from '../components/icons'

export default function Home() {
  const { t, lang, snap, user, cycleId } = useApp(); const cfg = snap!.config; const cy = cycleId!
  const cycle = cfg.cycles.find(c => c.id === cy)
  const all = useMemo(() => rollup(snap!, cy, master.codes, true), [snap, cy])
  const mineCodes = useMemo(() => master.codes.filter(c => assigneeOf(c.id, cy, cfg) === user!.id), [cy, cfg, user])
  const mine = useMemo(() => rollup(snap!, cy, mineCodes, false), [snap, cy, mineCodes])
  const byPillar = useMemo(() => master.pillars.map(p => ({ p, r: rollup(snap!, cy, master.codes.filter(c => c.pillar === p.id), true), subs: master.subpillars.filter(s => s.pillar === p.id).length })), [snap, cy])
  const table = useMemo(() => standings(snap!, cy), [snap, cy])
  const acts = useMemo(() => { let returned = 0, drafts = 0, unanswered = 0, replies = 0
    for (const c of mineCodes) { const e = effective(snap!, cy, c.id); if (e.state === 'returned') returned++; else if (e.state === 'draft') drafts++; else if (e.state === 'none') unanswered++
      for (const r of c.requirements) { const it = e.answer?.items[String(r.n)]; if (it?.clarify?.flag && snap!.reviews.clarifications?.[cy]?.[c.id]?.[String(r.n)]) replies++ } }
    return { returned, drafts, unanswered, replies } }, [mineCodes, snap, cy])
  const daysLeft = cycle ? Math.ceil((new Date(cycle.due).getTime() - Date.now()) / 86400000) : null
  const total = cycle ? Math.max(1, (new Date(cycle.end).getTime() - new Date(cycle.start).getTime()) / 86400000) : 1
  const elapsed = cycle ? Math.min(100, Math.max(0, ((Date.now() - new Date(cycle.start).getTime()) / 86400000) / total * 100)) : 0
  const cname = cycle ? (lang === 'ar' ? cycle.name : (cycle.name_en || cycle.name)) : ''
  const uname = (id: string) => { const u = cfg.users.find(x => x.id === id)!; return lang === 'ar' ? u.name_ar : u.name_en }
  type Act = { n: number; label: string; href: string; icon: 'alert' | 'edit' | 'question' | 'tasks'; kind: 'bad' | 'warn' | 'flag' | 'muted' }
  const actions: Act[] = ([
    { n: acts.returned, label: t('returnedToYou'), href: '#/my?f=returned', icon: 'alert', kind: 'bad' }, { n: acts.replies, label: t('awaitingYourReply'), href: '#/my?f=clarify', icon: 'question', kind: 'flag' },
    { n: acts.drafts, label: t('continueDraft'), href: '#/my?f=draft', icon: 'edit', kind: 'warn' }, { n: acts.unanswered, label: t('unanswered'), href: '#/my?f=none', icon: 'tasks', kind: 'muted' }] as Act[]).filter(a => a.n > 0)
  return (
    <div>
      <PageHeader eyebrow={cname} title={`${t('welcome')}, ${lang === 'ar' ? user!.name_ar : user!.name_en}`} sub={t('appTagline')} actions={<a className="btn btn-primary no-underline" href="#/my"><Icon name="tasks" />{t('goToMyWork')} ({mine.total})</a>} />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <section className="card p-4">
            <div className="flex items-center justify-between mb-3"><h2 className="m-0 text-base font-semibold flex items-center gap-2"><Icon name="target" className="text-accent-ink" />{t('nextActions')}</h2><span className="text-sm text-muted num">{mine.answered}/{mine.total} {t('answered')}</span></div>
            {actions.length === 0 ? <div className="flex items-center gap-3 text-ok-ink bg-ok-soft rounded-lg px-4 py-3"><Icon name="checkCircle" />{t('allCaughtUp')}</div>
              : <div className="grid sm:grid-cols-2 gap-2">{actions.map(a => <a key={a.label} href={a.href} className={`no-underline text-fg flex items-center gap-3 rounded-lg border border-line px-3 py-2.5 hover:bg-surface-2`}><span className={`inline-grid place-items-center w-9 h-9 rounded-lg bg-${a.kind}-soft text-${a.kind}-ink`}><Icon name={a.icon} /></span><span className="flex-1 font-medium">{a.label}</span><span className="text-xl font-bold num">{a.n}</span><Icon name={lang === 'ar' ? 'chevronL' : 'chevronR'} className="text-muted" /></a>)}</div>}
          </section>
          <section className="card p-4">
            <div className="flex items-center justify-between mb-3"><h2 className="m-0 text-base font-semibold flex items-center gap-2"><Icon name="layers" className="text-accent-ink" />{t('thePillars')}</h2><span className="text-xs text-muted">{master.subpillars.length} {t('subpillarsCount')} · {master.codes.length} {t('codesCount')}</span></div>
            <div className="grid sm:grid-cols-2 gap-3">{byPillar.map(({ p, r, subs }) => <a key={p.id} href={'#/browse?p=' + p.id} className="no-underline text-fg rounded-lg border border-line p-3 flex gap-3 hover:bg-surface-2 transition-colors">
              <span className="display text-3xl font-bold text-accent-ink num leading-none w-8">{p.id}</span>
              <span className="flex-1 min-w-0"><span className="block font-semibold leading-tight">{pick(lang, p)}</span><span className="block text-xs text-muted mt-0.5 mb-2">{subs} {t('subpillarsCount')} · {r.total} {t('codesCount')}</span><Bar value={r.approved} max={r.total} thin /><span className="flex justify-between text-xs mt-1"><span className="text-muted num">{r.approved}/{r.total} {t('approved')}</span><span className={`num font-semibold text-${tone(r.score)}-ink`}>{fmtPct(r.score)}</span></span></span></a>)}</div>
          </section>
        </div>
        <div className="flex flex-col gap-4">
          <section className="card p-4">
            <div className="label">{t('currentCycle')}</div><div className="font-semibold text-lg leading-tight">{cname}</div>
            <div className="flex items-center gap-4 mt-3"><Ring value={elapsed} size={76} stroke={8} tone="info" label={<span className="num">{daysLeft !== null && daysLeft >= 0 ? daysLeft : 0}</span>} sub={t('days')} /><div className="text-sm"><div className="text-muted">{t('dueDate')}</div><div className="font-semibold">{cycle?.due}</div><div className={`mt-1 ${daysLeft !== null && daysLeft < 0 ? 'text-bad' : 'text-muted'}`}>{daysLeft !== null && daysLeft >= 0 ? `${daysLeft} ${t('daysLeft')}` : t('overdue')}</div></div></div>
          </section>
          <section className="card p-4 flex items-center justify-around">
            <Ring value={all.total ? (all.approved / all.total) * 100 : 0} tone="accent" sub={t('readiness')} />
            <Ring value={all.score} tone={ringTone(all.score)} sub={t('compliance')} />
          </section>
          <section className="card p-4">
            <div className="flex items-center justify-between mb-2"><h2 className="m-0 text-base font-semibold flex items-center gap-2"><Icon name="trophy" className="text-accent-ink" />{t('standings')}</h2><a href="#/standings" className="text-sm">{t('viewAll')}</a></div>
            {table.length === 0 ? <div className="text-sm text-muted">—</div> : <ol className="m-0 p-0 list-none flex flex-col gap-1">{table.slice(0, 5).map(s => <li key={s.userId} className={`flex items-center gap-2 text-sm rounded-lg px-2 py-1.5 ${s.userId === user!.id ? 'bg-accent-soft' : ''}`}><span className="num w-6 text-center font-bold">{s.rank <= 3 ? ['🥇', '🥈', '🥉'][s.rank - 1] : s.rank}</span><Avatar name={uname(s.userId)} /><span className="flex-1 min-w-0 truncate font-medium">{uname(s.userId)}</span><span className="num text-muted text-xs">{s.approved}/{s.total}</span><span className="num font-bold w-8 text-end">{Math.round(s.points)}</span></li>)}</ol>}
          </section>
        </div>
      </div>
    </div>
  )
}
