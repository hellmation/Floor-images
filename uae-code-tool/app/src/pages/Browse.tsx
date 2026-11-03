import { useMemo, useState } from 'react'
import { useApp } from '../store/state'
import { master, assigneeOf, effective, effectiveImpact, sortIds } from '../store/scoring'
import { pick, pickDesc } from '../i18n'
import { ImpactPill, StatePill } from '../components/ui'

export default function Browse() {
  const { t, lang, snap, cycleId } = useApp(); const cfg = snap!.config; const cy = cycleId!
  const [p, setP] = useState(''); const [q, setQ] = useState(''); const [who, setWho] = useState(''); const [st, setSt] = useState('')
  const list = useMemo(() => master.codes.filter(c => (!p || c.pillar === p)).map(c => ({ c, a: assigneeOf(c.id, cy, cfg), e: effective(snap!, cy, c.id) }))
    .filter(r => (!who || r.a === who) && (!st || r.e.state === st) && (!q || (r.c.id + ' ' + r.c.desc_ar + ' ' + r.c.desc_en).toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => sortIds(a.c.id, b.c.id)), [p, q, who, st, cfg, cy, snap])
  const userName = (id: string | null) => { const u = cfg.users.find(x => x.id === id); return u ? (lang === 'ar' ? u.name_ar : u.name_en) : t('unassigned') }
  let lastSub = ''
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 items-center">
        <select className="select !w-auto" value={p} onChange={e => setP(e.target.value)}><option value="">{t('pillar')}: {t('all')}</option>{master.pillars.map(x => <option key={x.id} value={x.id}>{x.id} · {pick(lang, x)}</option>)}</select>
        <select className="select !w-auto" value={who} onChange={e => setWho(e.target.value)}><option value="">{t('assignedTo')}: {t('all')}</option>{cfg.users.map(u => <option key={u.id} value={u.id}>{lang === 'ar' ? u.name_ar : u.name_en}</option>)}</select>
        <select className="select !w-auto" value={st} onChange={e => setSt(e.target.value)}><option value="">{t('status')}: {t('all')}</option>{(['none', 'draft', 'submitted', 'returned', 'approved'] as const).map(s => <option key={s} value={s}>{t(s === 'none' ? 'notStarted' : s)}</option>)}</select>
        <input className="input flex-1 min-w-48" placeholder={t('search')} value={q} onChange={e => setQ(e.target.value)} />
        <span className="text-sm text-muted num">{list.length} / {master.codes.length}</span>
      </div>
      <div className="card overflow-x-auto"><table className="tbl">
        <thead><tr><th>{t('code')}</th><th>{t('requirement')}</th><th>{t('impact')}</th><th>{t('assignedTo')}</th><th>{t('status')}</th></tr></thead>
        <tbody>{list.map(({ c, a, e }) => {
          const sub = master.subpillars.find(s => s.id === c.sub)!; const showSub = sub.id !== lastSub; lastSub = sub.id
          return [showSub && <tr key={'s' + sub.id}><td colSpan={5} className="bg-surface-2 font-semibold text-accent">{sub.id} {pick(lang, sub)}</td></tr>,
            <tr key={c.id}><td><a className="code-id no-underline" href={'#/code/' + c.id}>{c.id}</a></td><td className="max-w-xl">{pickDesc(lang, c)}</td><td><ImpactPill impact={effectiveImpact(c, cfg)} /></td><td className="whitespace-nowrap">{userName(a)}</td><td><StatePill state={e.state} /></td></tr>]
        })}</tbody></table></div>
    </div>
  )
}
