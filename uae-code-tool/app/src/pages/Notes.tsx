import { useMemo } from 'react'
import { FilterBar, FilterChip, FilterSearch, FilterToggle } from '../components/filters'
import { useViewState } from '../store/viewState'
import { useApp } from '../store/state'
import { master, assigneeOf, effective, sortIds } from '../store/scoring'
import { pick, pickDesc } from '../i18n'
import { Empty, PageHeader, StatePill, fmtDay } from '../components/ui'
import { norm } from '../components/Shell'
import { NoteCard } from './CodeView'

/** Personal follow-up notes: one optional private note per code, listed beside every code. */
export default function Notes() {
  const { t, lang, snap, user, cycleId, saveMyNote } = useApp(); const cfg = snap!.config; const cy = cycleId!
  const notes = Object.fromEntries(Object.entries(snap!.answers[user!.id]?.notes || {}).filter(([, v]) => v.text.trim()))
  const n = Object.keys(notes).length
  const [vs, setVs] = useViewState('notes', { only: n > 0, p: '', q: '', mine: false }); const { only, p, q, mine } = vs
  const setOnly = (v: boolean) => setVs({ only: v }), setP = (v: string) => setVs({ p: v }), setQ = (v: string) => setVs({ q: v }), setMine = (v: boolean) => setVs({ mine: v })
  const list = useMemo(() => master.codes.filter(c => (!p || c.pillar === p) && (!only || notes[c.id]) && (!mine || assigneeOf(c.id, cy, cfg) === user!.id)
    && (!q || norm(c.id + ' ' + c.desc_ar + ' ' + c.desc_en + ' ' + (notes[c.id]?.text || '')).includes(norm(q))))
    .map(c => ({ c, e: effective(snap!, cy, c.id), note: notes[c.id] }))
    .sort((a, b) => sortIds(a.c.id, b.c.id)), [p, q, only, mine, notes, cfg, cy, snap, user])
  const userName = (id: string | null) => { const u = cfg.users.find(x => x.id === id); return u ? (lang === 'ar' ? u.name_ar : u.name_en) : t('unassigned') }
  return (
    <div>
      <PageHeader eyebrow={t('work')} title={t('notes')} sub={`${n} ${t('notesCount')} · ${t('personalNoteHint')}`} />
      <FilterBar shown={list.length} total={master.codes.length} active={[only, mine, p, q].filter(Boolean).length} onClear={() => setVs({ only: false, mine: false, p: '', q: '' })}>
        <FilterToggle pressed={only} onChange={setOnly} icon="edit" count={n}>{t('withNotesOnly')}</FilterToggle>
        <FilterToggle pressed={mine} onChange={setMine} icon="tasks">{t('myCodes')}</FilterToggle>
        <FilterChip label={t('pillar')} icon="layers" value={p} onChange={setP}><option value="">{t('all')}</option>{master.pillars.map(x => <option key={x.id} value={x.id}>{x.id} · {pick(lang, x)}</option>)}</FilterChip>
        <FilterSearch value={q} onChange={setQ} />
      </FilterBar>
      {list.length === 0 && (n === 0 ? <Empty icon="edit" title={t('noNotesYet')} /> : <Empty icon="search" title={t('noMatches')}><button className="btn btn-sm mt-2" onClick={() => { setP(''); setQ(''); setOnly(false); setMine(false) }}>{t('clearFilters')}</button></Empty>)}
      {list.length > 0 && <div className="card overflow-x-auto"><table className="tbl">
        <thead><tr><th>{t('code')}</th><th>{t('codeText')}</th><th>{t('status')}</th><th style={{ minWidth: 320 }}>{t('personalNote')}</th></tr></thead>
        <tbody>{list.map(({ c, e, note }) => <tr key={c.id}>
          <td className="align-top"><a className="code-id no-underline" href={'#/code/' + c.id}>{c.id}</a><div className="text-xs text-muted mt-1 whitespace-nowrap">{userName(assigneeOf(c.id, cy, cfg))}</div></td>
          <td className="max-w-xl align-top"><div className="line-clamp-3 text-sm">{pickDesc(lang, c)}</div></td>
          <td className="align-top"><StatePill state={e.state} /></td>
          <td className="align-top"><NoteCard key={c.id} codeId={c.id} value={note?.text || ''} onSave={saveMyNote} compact />{note && note.text.trim() && <div className="text-xs text-muted mt-1">{fmtDay(note.updatedAt, lang)}</div>}</td>
        </tr>)}</tbody></table></div>}
    </div>
  )
}
