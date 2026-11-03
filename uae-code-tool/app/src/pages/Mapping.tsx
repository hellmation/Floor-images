import { useMemo, useState } from 'react'
import { useApp } from '../store/state'
import { master, sortIds } from '../store/scoring'
import { pick, pickDesc } from '../i18n'
import { Pill, Tile } from '../components/ui'

export default function Mapping() {
  const { t, lang, snap, saveConfig } = useApp(); const cfg = snap!.config
  const [sel, setSel] = useState<string>(cfg.projects[0]?.id || '')
  const [p, setP] = useState(''); const [q, setQ] = useState(''); const [onlyUnmapped, setOnlyUnmapped] = useState(false)
  const unmapped = master.codes.filter(c => !(cfg.mapping[c.id] || []).length).length
  const list = useMemo(() => master.codes.filter(c => (!p || c.pillar === p) && (!onlyUnmapped || !(cfg.mapping[c.id] || []).length) && (!q || (c.id + ' ' + c.desc_ar + ' ' + c.desc_en).toLowerCase().includes(q.toLowerCase()))).sort((a, b) => sortIds(a.id, b.id)), [p, q, onlyUnmapped, cfg])
  const toggle = async (codeId: string) => {
    if (!sel) return
    const c = JSON.parse(JSON.stringify(cfg)); const cur: string[] = c.mapping[codeId] || []
    c.mapping[codeId] = cur.includes(sel) ? cur.filter((x: string) => x !== sel) : [...cur, sel]
    if (!c.mapping[codeId].length) delete c.mapping[codeId]
    await saveConfig(c, `map ${codeId} ${sel}`)
  }
  const owners = cfg.users.filter(u => cfg.projects.some(pr => pr.ownerId === u.id))
  const selProj = cfg.projects.find(x => x.id === sel)
  const countFor = (pid: string) => Object.values(cfg.mapping).filter(v => v.includes(pid)).length
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label={t('projects')} value={cfg.projects.filter(x => x.active).length} />
        <Tile label={t('unmappedCodes')} value={unmapped} sub={`${t('coreTeam')}: ${cfg.settings.defaultAssigneeId ? (cfg.users.find(u => u.id === cfg.settings.defaultAssigneeId)?.[lang === 'ar' ? 'name_ar' : 'name_en']) : t('unassigned')}`} tone={unmapped ? 'warn' : 'ok'} />
        <Tile label={t('codes')} value={master.codes.length} />
        <Tile label={selProj ? pick(lang, selProj) : '—'} value={sel ? countFor(sel) : 0} sub={t('codes')} tone="accent" />
      </div>
      <div className="grid md:grid-cols-[320px_1fr] gap-4 items-start">
        <aside className="card p-2 md:sticky md:top-24 max-h-[75vh] overflow-y-auto">
          {owners.map(o => <div key={o.id} className="mb-2"><div className="label px-2 py-1">{lang === 'ar' ? o.name_ar : o.name_en}</div>
            {cfg.projects.filter(pr => pr.ownerId === o.id && pr.active).map(pr => <button key={pr.id} onClick={() => setSel(pr.id)} className={`w-full text-start px-2 py-1.5 rounded text-sm flex gap-2 ${sel === pr.id ? 'bg-accent-soft text-accent font-semibold' : 'hover:bg-surface-2'}`}><span className="flex-1 min-w-0">{pick(lang, pr)}</span><span className="num text-muted">{countFor(pr.id)}</span></button>)}
          </div>)}
          {cfg.projects.filter(pr => !pr.ownerId && pr.active).map(pr => <button key={pr.id} onClick={() => setSel(pr.id)} className={`w-full text-start px-2 py-1.5 rounded text-sm ${sel === pr.id ? 'bg-accent-soft text-accent font-semibold' : 'hover:bg-surface-2'}`}>{pick(lang, pr)}</button>)}
        </aside>
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex flex-wrap gap-2 items-center">
            <select className="select !w-auto" value={p} onChange={e => setP(e.target.value)}><option value="">{t('pillar')}: {t('all')}</option>{master.pillars.map(x => <option key={x.id} value={x.id}>{x.id} · {pick(lang, x)}</option>)}</select>
            <input className="input flex-1 min-w-40" placeholder={t('search')} value={q} onChange={e => setQ(e.target.value)} />
            <label className="text-sm flex items-center gap-1"><input type="checkbox" checked={onlyUnmapped} onChange={e => setOnlyUnmapped(e.target.checked)} />{t('unmappedCodes')}</label>
          </div>
          <div className="card divide-y divide-line">
            {list.map(c => { const links = cfg.mapping[c.id] || []; const on = links.includes(sel)
              return <label key={c.id} className="flex items-start gap-3 px-3 py-2 cursor-pointer hover:bg-surface-2">
                <input type="checkbox" className="mt-1" checked={on} onChange={() => toggle(c.id)} disabled={!sel} />
                <span className="code-id">{c.id}</span>
                <span className="flex-1 min-w-0 text-sm">{pickDesc(lang, c).slice(0, 140)}{pickDesc(lang, c).length > 140 ? '…' : ''}
                  <span className="block mt-0.5">{links.map(l => { const pr = cfg.projects.find(x => x.id === l); return pr ? <Pill key={l} kind={l === sel ? 'accent' : 'muted'}>{pick(lang, pr)}</Pill> : null })}</span></span>
              </label> })}
          </div>
        </div>
      </div>
    </div>
  )
}
