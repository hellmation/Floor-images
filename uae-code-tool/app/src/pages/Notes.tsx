import { useMemo, useState } from 'react'
import { useApp } from '../store/state'
import { master, assigneeOf, effective, sortIds } from '../store/scoring'
import { pick, pickDesc } from '../i18n'
import { Empty, PageHeader, StatePill } from '../components/ui'
import { Icon } from '../components/icons'
import { NoteCard } from './CodeView'

/** Personal follow-up notes: one optional private note per code, listed beside every code. */
export default function Notes() {
  const { t, lang, snap, user, cycleId, saveMyNote } = useApp(); const cfg = snap!.config; const cy = cycleId!
  const notes = snap!.answers[user!.id]?.notes || {}
  const n = Object.keys(notes).length
  const [only, setOnly] = useState(n > 0); const [p, setP] = useState(''); const [q, setQ] = useState(''); const [mine, setMine] = useState(false)
  const list = useMemo(() => master.codes.filter(c => (!p || c.pillar === p) && (!only || notes[c.id]) && (!mine || assigneeOf(c.id, cy, cfg) === user!.id)
    && (!q || (c.id + ' ' + c.desc_ar + ' ' + c.desc_en + ' ' + (notes[c.id]?.text || '')).toLowerCase().includes(q.toLowerCase())))
    .map(c => ({ c, e: effective(snap!, cy, c.id), note: notes[c.id] }))
    .sort((a, b) => sortIds(a.c.id, b.c.id)), [p, q, only, mine, notes, cfg, cy, snap, user])
  const userName = (id: string | null) => { const u = cfg.users.find(x => x.id === id); return u ? (lang === 'ar' ? u.name_ar : u.name_en) : t('unassigned') }
  return (
    <div>
      <PageHeader title={t('notes')} sub={`${n} ${t('notesCount')} · ${t('personalNoteHint')}`} />
      <div className="card p-3 mb-4 flex flex-wrap gap-2 items-center">
        <Icon name="filter" className="text-muted" />
        <button className={`btn btn-sm ${only ? 'btn-primary' : ''}`} onClick={() => setOnly(o => !o)}><Icon name="edit" />{t('withNotesOnly')}<span className={`num ${only ? 'opacity-80' : 'text-muted'}`}>{n}</span></button>
        <button className={`btn btn-sm ${mine ? 'btn-primary' : ''}`} onClick={() => setMine(m => !m)}><Icon name="tasks" />{t('myCodes')}</button>
        <select className="select !w-auto" value={p} onChange={e => setP(e.target.value)}><option value="">{t('pillar')}: {t('all')}</option>{master.pillars.map(x => <option key={x.id} value={x.id}>{x.id} · {pick(lang, x)}</option>)}</select>
        <div className="relative flex-1 min-w-48"><Icon name="search" className="absolute top-2.5 text-muted" style={{ insetInlineStart: 10 }} /><input className="input !ps-9" placeholder={t('search')} value={q} onChange={e => setQ(e.target.value)} /></div>
        <span className="text-sm text-muted num">{list.length} / {master.codes.length}</span>
      </div>
      {list.length === 0 && <Empty icon="edit" title={t('noNotesYet')} />}
      {list.length > 0 && <div className="card overflow-x-auto"><table className="tbl">
        <thead><tr><th>{t('code')}</th><th>{t('requirement')}</th><th>{t('status')}</th><th style={{ minWidth: 320 }}>{t('personalNote')}</th></tr></thead>
        <tbody>{list.map(({ c, e, note }) => <tr key={c.id}>
          <td className="align-top"><a className="code-id no-underline" href={'#/code/' + c.id}>{c.id}</a><div className="text-xs text-muted mt-1 whitespace-nowrap">{userName(assigneeOf(c.id, cy, cfg))}</div></td>
          <td className="max-w-xl align-top"><div className="line-clamp-3 text-sm">{pickDesc(lang, c)}</div></td>
          <td className="align-top"><StatePill state={e.state} /></td>
          <td className="align-top"><NoteCard key={c.id} codeId={c.id} value={note?.text || ''} onSave={saveMyNote} compact />{note && <div className="text-xs text-muted mt-1">{note.updatedAt.slice(0, 10)}</div>}</td>
        </tr>)}</tbody></table></div>}
    </div>
  )
}
