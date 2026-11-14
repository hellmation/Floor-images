import { useState } from 'react'
import { useApp } from '../store/state'
import { Modal, PageHeader, Pill, useToast, fmtDay, Opt } from '../components/ui'
import { Icon } from '../components/icons'
import type { Cycle, CycleStatus } from '../types'
import { freezeAssignments } from '../store/scoring'

export default function Cycles() {
  const { t, lang, snap, saveConfig, setCycleId } = useApp(); const cfg = snap!.config
  const toast = useToast()
  const [draft, setDraft] = useState<(Cycle & { isNew?: boolean }) | null>(null)
  const save = async (c: Cycle & { isNew?: boolean }) => {
    const { isNew, ...cycle } = c; cycle.id = cycle.id.trim().replace(/[\s/\\]+/g, '-')
    if (isNew && cfg.cycles.some(x => x.id === cycle.id)) { toast(t('duplicateCycle'), 'bad'); return }
    // the assessed period (start–end) may end before the submission deadline (due)
    if (!(cycle.start <= cycle.end && cycle.start <= cycle.due)) { toast(t('badDates'), 'bad'); return }
    const n = JSON.parse(JSON.stringify(cfg)) as typeof cfg; const i = n.cycles.findIndex(x => x.id === cycle.id)
    const was = i >= 0 ? n.cycles[i].status : null
    // closing freezes who owns each code so later mapping edits never rewrite history; reopening lifts the freeze
    if (cycle.status === 'closed' && was !== 'closed') cycle.assignments = freezeAssignments(cycle.id, cfg)
    if (cycle.status !== 'closed') delete cycle.assignments
    if (i >= 0) n.cycles[i] = cycle; else n.cycles.push(cycle)
    if (!n.currentCycleId) n.currentCycleId = cycle.id
    try { await saveConfig(n, `cycle ${cycle.id}`); setDraft(null); toast(cycle.status === 'closed' && was !== 'closed' ? t('frozenNote') : t('saved'), 'ok') } catch (e) { toast(String((e as Error).message || t('saveFailed')), 'bad') }
  }
  const setCurrent = async (id: string) => { try { await saveConfig({ ...cfg, currentCycleId: id }, `current ${id}`); setCycleId(id) } catch (e) { toast(String((e as Error).message || t('saveFailed')), 'bad') } }
  const statuses: CycleStatus[] = ['planning', 'open', 'review', 'closed']
  const sl = (s: CycleStatus) => t(s === 'open' ? 'open' : s === 'closed' ? 'closed' : s === 'review' ? 'inReview' : 'planning')
  const kind = (s: CycleStatus) => s === 'open' ? 'ok' : s === 'closed' ? 'muted' : s === 'review' ? 'info' : 'warn'
  const cname = (c: Cycle) => lang === 'ar' ? c.name : (c.name_en || c.name)
  const sorted = [...cfg.cycles].sort((a, b) => a.start.localeCompare(b.start))
  return (
    <div>
      <PageHeader title={t('cycles')} sub={t('step4')} actions={<button className="btn btn-primary" onClick={() => setDraft({ id: '', name: '', name_en: '', start: '', end: '', due: '', status: 'planning', prefillFrom: sorted[sorted.length - 1]?.id || null, isNew: true })}><Icon name="plus" />{t('newCycle')}</button>} />
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{sorted.map(c => <div key={c.id} className={`card p-4 flex flex-col gap-2 ${cfg.currentCycleId === c.id ? 'ring-2 ring-[var(--accent)]' : ''}`}>
        <div className="flex items-center gap-2"><span className="code-id">{c.id}</span><Pill kind={kind(c.status)} dot>{sl(c.status)}</Pill>{cfg.currentCycleId === c.id && <Pill kind="accent">{t('currentCycle')}</Pill>}</div>
        <div className="font-semibold text-lg leading-tight">{cname(c)}</div>
        <div className="text-sm text-muted grid grid-cols-3 gap-2"><span><span className="block text-xs">{t('startDate')}</span>{fmtDay(c.start, lang)}</span><span><span className="block text-xs">{t('endDate')}</span>{fmtDay(c.end, lang)}</span><span><span className="block text-xs">{t('dueDate')}</span><b className="text-fg">{fmtDay(c.due, lang)}</b></span></div>
        {c.prefillFrom && <div className="text-xs text-muted"><Icon name="refresh" style={{ width: 12, height: 12 }} /> {t('prefillFrom')}: <bdi dir="ltr">{c.prefillFrom}</bdi></div>}
        <div className="flex flex-wrap gap-2 mt-auto pt-2"><select className="select !w-auto !py-1 text-sm" aria-label={t('status')} value={c.status} onChange={e => { const st = e.target.value as CycleStatus; if (st === 'closed' && !confirm(t('confirmCloseCycle'))) return; save({ ...c, status: st }) }}>{statuses.map(s => <option key={s} value={s}>{sl(s)}</option>)}</select><button className="btn btn-sm" onClick={() => setDraft({ ...c })}><Icon name="edit" />{t('edit')}</button>{cfg.currentCycleId !== c.id && <button className="btn btn-sm" onClick={() => setCurrent(c.id)}><Icon name="check" />{t('currentCycle')}</button>}</div>
      </div>)}</div>
      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft && !draft.isNew ? t('edit') : t('newCycle')} footer={<><button className="btn" onClick={() => setDraft(null)}>{t('cancel')}</button><button className="btn btn-primary" form="cycle-form">{t('save')}</button></>}>
        {draft && <form id="cycle-form" className="grid sm:grid-cols-2 gap-3" onSubmit={e => { e.preventDefault(); save(draft) }}>
          <div className="field"><label className="label" htmlFor="cy-id">{t('id')}</label><input id="cy-id" className="input" required dir="ltr" value={draft.id} disabled={!draft.isNew} onChange={e => setDraft({ ...draft, id: e.target.value })} placeholder="2027-Q1" /></div>
          <div className="field"><label className="label" htmlFor="cy-status">{t('status')}</label><select id="cy-status" required className="select" value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as CycleStatus })}>{statuses.map(s => <option key={s} value={s}>{sl(s)}</option>)}</select></div>
          <div className="field"><label className="label" htmlFor="cy-name">{t('nameAr')}</label><input id="cy-name" className="input" required value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></div>
          <div className="field"><label className="label" htmlFor="cy-name_en">{t('nameEn')}<Opt /></label><input id="cy-name_en" className="input" value={draft.name_en || ''} onChange={e => setDraft({ ...draft, name_en: e.target.value })} /></div>
          <div className="field"><label className="label" htmlFor="cy-start">{t('startDate')}</label><input id="cy-start" type="date" className="input" required value={draft.start} onChange={e => setDraft({ ...draft, start: e.target.value })} /></div>
          <div className="field"><label className="label" htmlFor="cy-end">{t('endDate')}</label><input id="cy-end" type="date" className="input" required value={draft.end} onChange={e => setDraft({ ...draft, end: e.target.value })} /></div>
          <div className="field"><label className="label" htmlFor="cy-due">{t('dueDate')}</label><input id="cy-due" type="date" className="input" required value={draft.due} onChange={e => setDraft({ ...draft, due: e.target.value })} /></div>
          <div className="field"><label className="label" htmlFor="cy-prefillFrom">{t('prefillFrom')}<Opt /></label><select id="cy-prefillFrom" className="select" value={draft.prefillFrom || ''} onChange={e => setDraft({ ...draft, prefillFrom: e.target.value || null })}><option value="">{t('none')}</option>{cfg.cycles.filter(c => c.id !== draft.id).map(c => <option key={c.id} value={c.id}>{cname(c)}</option>)}</select></div>
        </form>}
      </Modal>
    </div>
  )
}
