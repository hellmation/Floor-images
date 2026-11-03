import { useMemo, useState } from 'react'
import { useApp } from '../store/state'
import { master, sortIds } from '../store/scoring'
import { pick, pickDesc } from '../i18n'
import { Avatar, PageHeader, Pill, Ring, useToast } from '../components/ui'
import { Icon } from '../components/icons'

export default function Mapping() {
  const { t, lang, snap, saveConfig } = useApp(); const cfg = snap!.config
  const toast = useToast()
  const [sel, setSel] = useState<string>(cfg.projects[0]?.id || '')
  const [p, setP] = useState(''); const [q, setQ] = useState(''); const [onlyUnmapped, setOnlyUnmapped] = useState(false)
  const unmapped = master.codes.filter(c => !(cfg.mapping[c.id] || []).length).length
  const list = useMemo(() => master.codes.filter(c => (!p || c.pillar === p) && (!onlyUnmapped || !(cfg.mapping[c.id] || []).length) && (!q || (c.id + ' ' + c.desc_ar + ' ' + c.desc_en).toLowerCase().includes(q.toLowerCase()))).sort((a, b) => sortIds(a.id, b.id)), [p, q, onlyUnmapped, cfg])
  const toggle = async (codeId: string) => {
    if (!sel) return
    const c = JSON.parse(JSON.stringify(cfg)); const cur: string[] = c.mapping[codeId] || []
    const on = cur.includes(sel); c.mapping[codeId] = on ? cur.filter((x: string) => x !== sel) : [...cur, sel]
    if (!c.mapping[codeId].length) delete c.mapping[codeId]
    await saveConfig(c, `map ${codeId} ${sel}`); toast(`${codeId} ${on ? '−' : '+'} ${pick(lang, selProj!)}`, 'ok')
  }
  const owners = cfg.users.filter(u => cfg.projects.some(pr => pr.ownerId === u.id))
  const selProj = cfg.projects.find(x => x.id === sel)
  const countFor = (pid: string) => Object.values(cfg.mapping).filter(v => v.includes(pid)).length
  const core = cfg.users.find(u => u.id === cfg.settings.defaultAssigneeId)
  return (
    <div>
      <PageHeader title={t('mapping')} sub={t('step1')} actions={<div className="flex items-center gap-3"><div className="text-end text-sm"><div className="text-muted">{t('unmappedCodes')}</div><div className="num font-semibold">{unmapped} / {master.codes.length}</div><div className="text-xs text-muted">{t('coreTeam')}: {core ? (lang === 'ar' ? core.name_ar : core.name_en) : t('unassigned')}</div></div><Ring value={(1 - unmapped / master.codes.length) * 100} size={64} stroke={7} /></div>} />
      <div className="grid lg:grid-cols-[320px_1fr] gap-4 items-start">
        <aside className="card p-2 lg:sticky lg:top-20 max-h-[75vh] overflow-y-auto">
          {owners.map(o => <div key={o.id} className="mb-1"><div className="flex items-center gap-2 px-2 py-2"><Avatar name={lang === 'ar' ? o.name_ar : o.name_en} /><span className="text-sm font-semibold">{lang === 'ar' ? o.name_ar : o.name_en}</span></div>
            {cfg.projects.filter(pr => pr.ownerId === o.id && pr.active).map(pr => <button key={pr.id} onClick={() => setSel(pr.id)} className={`w-full text-start px-3 py-1.5 rounded-lg text-sm flex gap-2 items-center ${sel === pr.id ? 'bg-accent-soft text-accent-ink font-semibold' : 'hover:bg-surface-2'}`}><span className="flex-1 min-w-0 truncate">{pick(lang, pr)}</span><span className={`num text-xs ${sel === pr.id ? '' : 'text-muted'}`}>{countFor(pr.id)}</span></button>)}
          </div>)}
          {cfg.projects.filter(pr => !pr.ownerId && pr.active).map(pr => <button key={pr.id} onClick={() => setSel(pr.id)} className={`w-full text-start px-3 py-1.5 rounded-lg text-sm ${sel === pr.id ? 'bg-accent-soft text-accent-ink font-semibold' : 'hover:bg-surface-2'}`}>{pick(lang, pr)}</button>)}
        </aside>
        <div className="flex flex-col gap-3 min-w-0">
          <div className="card p-3 flex flex-wrap gap-2 items-center">
            <span className="pill pill-accent"><Icon name="map" style={{ width: 13, height: 13 }} />{selProj ? pick(lang, selProj) : '—'} · {sel ? countFor(sel) : 0}</span>
            <select className="select !w-auto" value={p} onChange={e => setP(e.target.value)}><option value="">{t('pillar')}: {t('all')}</option>{master.pillars.map(x => <option key={x.id} value={x.id}>{x.id} · {pick(lang, x)}</option>)}</select>
            <input className="input flex-1 min-w-40" placeholder={t('search')} value={q} onChange={e => setQ(e.target.value)} />
            <label className="text-sm flex items-center gap-1.5"><input type="checkbox" checked={onlyUnmapped} onChange={e => setOnlyUnmapped(e.target.checked)} />{t('unmappedCodes')}</label>
          </div>
          <div className="card divide-y divide-line">
            {list.map(c => { const links = cfg.mapping[c.id] || []; const on = links.includes(sel)
              return <label key={c.id} className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors ${on ? 'bg-accent-soft/40' : 'hover:bg-surface-2'}`}>
                <input type="checkbox" className="mt-1.5 accent-[var(--accent)]" checked={on} onChange={() => toggle(c.id)} disabled={!sel} />
                <span className="code-id mt-0.5">{c.id}</span>
                <span className="flex-1 min-w-0 text-sm"><span className="block">{pickDesc(lang, c).slice(0, 150)}{pickDesc(lang, c).length > 150 ? '…' : ''}</span>
                  {links.length > 0 && <span className="flex flex-wrap gap-1 mt-1">{links.map(l => { const pr = cfg.projects.find(x => x.id === l); return pr ? <Pill key={l} kind={l === sel ? 'accent' : 'muted'}>{pick(lang, pr)}</Pill> : null })}</span>}</span>
              </label> })}
          </div>
        </div>
      </div>
    </div>
  )
}
