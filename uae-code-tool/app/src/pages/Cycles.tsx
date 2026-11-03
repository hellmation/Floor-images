import { useState } from 'react'
import { useApp } from '../store/state'
import type { Cycle, CycleStatus } from '../types'

export default function Cycles() {
  const { t, snap, saveConfig, setCycleId } = useApp(); const cfg = snap!.config
  const [draft, setDraft] = useState<Cycle | null>(null)
  const save = async (c: Cycle) => {
    const n = JSON.parse(JSON.stringify(cfg)); const i = n.cycles.findIndex((x: Cycle) => x.id === c.id)
    if (i >= 0) n.cycles[i] = c; else n.cycles.push(c)
    if (!n.currentCycleId) n.currentCycleId = c.id
    await saveConfig(n, `cycle ${c.id}`); setDraft(null)
  }
  const setCurrent = async (id: string) => { const n = { ...cfg, currentCycleId: id }; await saveConfig(n, `current ${id}`); setCycleId(id) }
  const statuses: CycleStatus[] = ['planning', 'open', 'review', 'closed']
  const sl = (s: CycleStatus) => t(s === 'open' ? 'open' : s === 'closed' ? 'closed' : s === 'review' ? 'inReview' : 'planning')
  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      <div className="flex items-center gap-2"><h1 className="text-xl font-semibold m-0">{t('cycles')}</h1>
        <button className="btn btn-primary btn-sm ms-auto" onClick={() => setDraft({ id: '', name: '', start: '', end: '', due: '', status: 'planning', prefillFrom: cfg.cycles[cfg.cycles.length - 1]?.id || null })}>{t('newCycle')}</button></div>
      <div className="card overflow-x-auto"><table className="tbl"><thead><tr><th>ID</th><th>{t('cycle')}</th><th>Start</th><th>End</th><th>{t('dueDate')}</th><th>{t('status')}</th><th>Prefill</th><th></th></tr></thead>
        <tbody>{cfg.cycles.map(c => <tr key={c.id}><td className="code-id">{c.id}</td><td>{c.name}{cfg.currentCycleId === c.id && <span className="pill pill-accent ms-2">{t('currentCycle')}</span>}</td><td>{c.start}</td><td>{c.end}</td><td>{c.due}</td>
          <td><select className="select !w-auto !py-1" value={c.status} onChange={e => save({ ...c, status: e.target.value as CycleStatus })}>{statuses.map(s => <option key={s} value={s}>{sl(s)}</option>)}</select></td>
          <td className="text-muted">{c.prefillFrom || '—'}</td>
          <td className="whitespace-nowrap"><button className="btn btn-sm" onClick={() => setDraft({ ...c })}>{t('edit')}</button> {cfg.currentCycleId !== c.id && <button className="btn btn-sm" onClick={() => setCurrent(c.id)}>{t('currentCycle')}</button>}</td></tr>)}</tbody></table></div>
      {draft && <form className="card p-4 grid sm:grid-cols-2 gap-3" onSubmit={e => { e.preventDefault(); save(draft) }}>
        <label>ID<input className="input" required value={draft.id} disabled={cfg.cycles.some(c => c.id === draft.id)} onChange={e => setDraft({ ...draft, id: e.target.value.trim() })} placeholder="2026-Q2" /></label>
        <label>{t('cycle')}<input className="input" required value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
        <label>Start<input type="date" className="input" required value={draft.start} onChange={e => setDraft({ ...draft, start: e.target.value })} /></label>
        <label>End<input type="date" className="input" required value={draft.end} onChange={e => setDraft({ ...draft, end: e.target.value })} /></label>
        <label>{t('dueDate')}<input type="date" className="input" required value={draft.due} onChange={e => setDraft({ ...draft, due: e.target.value })} /></label>
        <label>{t('status')}<select className="select" value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as CycleStatus })}>{statuses.map(s => <option key={s} value={s}>{sl(s)}</option>)}</select></label>
        <label>Prefill from<select className="select" value={draft.prefillFrom || ''} onChange={e => setDraft({ ...draft, prefillFrom: e.target.value || null })}><option value="">—</option>{cfg.cycles.filter(c => c.id !== draft.id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <div className="flex gap-2 items-end"><button className="btn btn-primary">{t('save')}</button><button type="button" className="btn" onClick={() => setDraft(null)}>{t('cancel')}</button></div>
      </form>}
    </div>
  )
}
