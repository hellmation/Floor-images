import { useMemo, useState } from 'react'
import { useApp } from '../store/state'
import { master, assigneeOf, effective, effectiveImpact, sortIds } from '../store/scoring'
import { pick, pickDesc } from '../i18n'
import { ImpactPill, PageHeader, StatePill } from '../components/ui'
import { Icon } from '../components/icons'

export default function Browse() {
  const { t, lang, snap, cycleId, user } = useApp(); const cfg = snap!.config; const cy = cycleId!
  const qs = new URLSearchParams(location.hash.split('?')[1] || '')
  const [p, setP] = useState(qs.get('p') || ''); const [q, setQ] = useState(''); const [who, setWho] = useState(''); const [st, setSt] = useState(''); const [imp, setImp] = useState('')
  const list = useMemo(() => master.codes.filter(c => (!p || c.pillar === p)).map(c => ({ c, a: assigneeOf(c.id, cy, cfg), e: effective(snap!, cy, c.id), i: effectiveImpact(c, cfg) }))
    .filter(r => (!who || r.a === who) && (!st || r.e.state === st) && (!imp || r.i === imp) && (!q || (r.c.id + ' ' + r.c.desc_ar + ' ' + r.c.desc_en).toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => sortIds(a.c.id, b.c.id)), [p, q, who, st, imp, cfg, cy, snap])
  const userName = (id: string | null) => { const u = cfg.users.find(x => x.id === id); return u ? (lang === 'ar' ? u.name_ar : u.name_en) : t('unassigned') }
  let lastSub = ''
  return (
    <div>
      <PageHeader title={t('browse')} sub={`${master.pillars.length} ${t('pillars')} · ${master.subpillars.length} ${t('subpillarsCount')} · ${master.codes.length} ${t('codesCount')}`} />
      <div className="card p-3 mb-4 flex flex-wrap gap-2 items-center">
        <Icon name="filter" className="text-muted" />
        <select className="select !w-auto" value={p} onChange={e => setP(e.target.value)}><option value="">{t('pillar')}: {t('all')}</option>{master.pillars.map(x => <option key={x.id} value={x.id}>{x.id} · {pick(lang, x)}</option>)}</select>
        <select className="select !w-auto" value={who} onChange={e => setWho(e.target.value)}><option value="">{t('assignedTo')}: {t('all')}</option><option value={user!.id}>{t('myCodes')}</option>{cfg.users.filter(u => u.id !== user!.id).map(u => <option key={u.id} value={u.id}>{lang === 'ar' ? u.name_ar : u.name_en}</option>)}</select>
        <select className="select !w-auto" value={st} onChange={e => setSt(e.target.value)}><option value="">{t('status')}: {t('all')}</option>{(['none', 'draft', 'submitted', 'returned', 'approved'] as const).map(s => <option key={s} value={s}>{t(s === 'none' ? 'notStarted' : s)}</option>)}</select>
        <select className="select !w-auto" value={imp} onChange={e => setImp(e.target.value)}><option value="">{t('impact')}: {t('all')}</option><option value="high">{t('high')}</option><option value="medium">{t('medium')}</option><option value="low">{t('low')}</option></select>
        <div className="relative flex-1 min-w-48"><Icon name="search" className="absolute top-2.5 text-muted" style={{ insetInlineStart: 10 }} /><input className="input !ps-9" placeholder={t('search')} value={q} onChange={e => setQ(e.target.value)} /></div>
        <span className="text-sm text-muted num">{list.length} / {master.codes.length}</span>
      </div>
      <div className="card overflow-x-auto"><table className="tbl">
        <thead><tr><th>{t('code')}</th><th>{t('requirement')}</th><th>{t('impact')}</th><th>{t('assignedTo')}</th><th>{t('status')}</th></tr></thead>
        <tbody>{list.map(({ c, a, e, i }) => { const sub = master.subpillars.find(s => s.id === c.sub)!; const showSub = sub.id !== lastSub; lastSub = sub.id
          return [showSub && <tr key={'s' + sub.id}><td colSpan={5} className="!bg-surface-2 font-semibold text-accent-ink !py-2">{sub.id} {pick(lang, sub)}</td></tr>,
            <tr key={c.id}><td><a className="code-id no-underline" href={'#/code/' + c.id}>{c.id}</a></td><td className="max-w-2xl">{pickDesc(lang, c)}</td><td><ImpactPill impact={i} short /></td><td className="whitespace-nowrap">{userName(a)}</td><td><StatePill state={e.state} /></td></tr>] })}</tbody></table></div>
    </div>
  )
}
