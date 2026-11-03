import { useState } from 'react'
import { useApp } from '../store/state'
import { Modal, PageHeader, Pill, useToast } from '../components/ui'
import { Icon } from '../components/icons'
import type { Cycle, CycleStatus } from '../types'

export default function Cycles() {
  const { t, lang, snap, saveConfig, setCycleId } = useApp(); const cfg = snap!.config
  const toast = useToast()
  const [draft, setDraft] = useState<Cycle | null>(null)
  const save = async (c: Cycle) => {
    const n = JSON.parse(JSON.stringify(cfg)); const i = n.cycles.findIndex((x: Cycle) => x.id === c.id)
    if (i >= 0) n.cycles[i] = c; else n.cycles.push(c)
    if (!n.currentCycleId) n.currentCycleId = c.id
    await saveConfig(n, `cycle ${c.id}`); setDraft(null); toast(t('saved'), 'ok')
  }
  const setCurrent = async (id: string) => { await saveConfig({ ...cfg, currentCycleId: id }, `current ${id}`); setCycleId(id) }
  const statuses: CycleStatus[] = ['planning', 'open', 'review', 'closed']
  const sl = (s: CycleStatus) => t(s === 'open' ? 'open' : s === 'closed' ? 'closed' : s === 'review' ? 'inReview' : 'planning')
  const kind = (s: CycleStatus) => s === 'open' ? 'ok' : s === 'closed' ? 'muted' : s === 'review' ? 'info' : 'warn'
  const cname = (c: Cycle) => lang === 'ar' ? c.name : (c.name_en || c.name)
  const sorted = [...cfg.cycles].sort((a, b) => a.start.localeCompare(b.start))
  return (
    <div>
      <PageHeader title={t('cycles')} sub={t('step4')} actions={<button className="btn btn-primary" onClick={() => setDraft({ id: '', name: '', name_en: '', start: '', end: '', due: '', status: 'planning', prefillFrom: sorted[sorted.length - 1]?.id || null })}><Icon name="plus" />{t('newCycle')}</button>} />
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{sorted.map(c => <div key={c.id} className={`card p-4 flex flex-col gap-2 ${cfg.currentCycleId === c.id ? 'ring-2 ring-[var(--accent)]' : ''}`}>
        <div className="flex items-center gap-2"><span className="code-id">{c.id}</span><Pill kind={kind(c.status)} dot>{sl(c.status)}</Pill>{cfg.currentCycleId === c.id && <Pill kind="accent">{t('currentCycle')}</Pill>}</div>
        <div className="font-semibold text-lg leading-tight">{cname(c)}</div>
        <div className="text-sm text-muted grid grid-cols-3 gap-2"><span><span className="block text-xs">{t('startDate')}</span>{c.start}</span><span><span className="block text-xs">{t('endDate')}</span>{c.end}</span><span><span className="block text-xs">{t('dueDate')}</span><b className="text-fg">{c.due}</b></span></div>
        {c.prefillFrom && <div className="text-xs text-muted"><Icon name="refresh" style={{ width: 12, height: 12 }} /> {t('prefillFrom')}: {c.prefillFrom}</div>}
        <div className="flex flex-wrap gap-2 mt-auto pt-2"><select className="select !w-auto !py-1 text-sm" value={c.status} onChange={e => save({ ...c, status: e.target.value as CycleStatus })}>{statuses.map(s => <option key={s} value={s}>{sl(s)}</option>)}</select><button className="btn btn-sm" onClick={() => setDraft({ ...c })}><Icon name="edit" />{t('edit')}</button>{cfg.currentCycleId !== c.id && <button className="btn btn-sm" onClick={() => setCurrent(c.id)}><Icon name="check" />{t('currentCycle')}</button>}</div>
      </div>)}</div>
      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft && cfg.cycles.some(c => c.id === draft.id) ? t('edit') : t('newCycle')} footer={<><button className="btn" onClick={() => setDraft(null)}>{t('cancel')}</button><button className="btn btn-primary" form="cycle-form">{t('save')}</button></>}>
        {draft && <form id="cycle-form" className="grid sm:grid-cols-2 gap-3" onSubmit={e => { e.preventDefault(); save(draft) }}>
          <div className="field"><label className="label">{t('id')}</label><input className="input" required dir="ltr" value={draft.id} disabled={cfg.cycles.some(c => c.id === draft.id)} onChange={e => setDraft({ ...draft, id: e.target.value.trim() })} placeholder="2027-Q1" /></div>
          <div className="field"><label className="label">{t('status')}</label><select className="select" value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as CycleStatus })}>{statuses.map(s => <option key={s} value={s}>{sl(s)}</option>)}</select></div>
          <div className="field"><label className="label">{t('nameAr')}</label><input className="input" required value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></div>
          <div className="field"><label className="label">{t('nameEn')}</label><input className="input" value={draft.name_en || ''} onChange={e => setDraft({ ...draft, name_en: e.target.value })} /></div>
          <div className="field"><label className="label">{t('startDate')}</label><input type="date" className="input" required value={draft.start} onChange={e => setDraft({ ...draft, start: e.target.value })} /></div>
          <div className="field"><label className="label">{t('endDate')}</label><input type="date" className="input" required value={draft.end} onChange={e => setDraft({ ...draft, end: e.target.value })} /></div>
          <div className="field"><label className="label">{t('dueDate')}</label><input type="date" className="input" required value={draft.due} onChange={e => setDraft({ ...draft, due: e.target.value })} /></div>
          <div className="field"><label className="label">{t('prefillFrom')}</label><select className="select" value={draft.prefillFrom || ''} onChange={e => setDraft({ ...draft, prefillFrom: e.target.value || null })}><option value="">{t('none')}</option>{cfg.cycles.filter(c => c.id !== draft.id).map(c => <option key={c.id} value={c.id}>{cname(c)}</option>)}</select></div>
        </form>}
      </Modal>
    </div>
  )
}
