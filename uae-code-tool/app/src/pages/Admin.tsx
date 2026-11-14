import { useEffect, useRef, useState } from 'react'
import type React from 'react'
import { useApp } from '../store/state'
import { master, uid, assigneeOf } from '../store/scoring'
import { pick } from '../i18n'
import { Avatar, PageHeader, fmtDate, useToast, errMsg, Empty, Modal } from '../components/ui'
import { makePassword } from '../store/password'
import { Icon } from '../components/icons'
import type { Department, Impact, Project, Role, User } from '../types'

function toDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => { const img = new Image(); const url = URL.createObjectURL(file)
    img.onload = () => { const s = 192, c = document.createElement('canvas'); c.width = s; c.height = s; const x = c.getContext('2d')!; const m = Math.min(img.width, img.height)
      x.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, s, s); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.82)) }
    img.onerror = rej; img.src = url })
}
/** Text input that keeps a local draft and commits on blur or Enter, so typing never floods the shared file. */
function DraftInput({ value, onCommit, number, min, ...rest }: { value: string | number; onCommit: (v: string) => void; number?: boolean; min?: number } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [v, setV] = useState(String(value)); const last = useRef(String(value))
  useEffect(() => { if (String(value) !== last.current) { last.current = String(value); setV(String(value)) } }, [value])
  const commit = () => { let out = v.trim(); if (number) { const n = Number(out); if (out === '' || Number.isNaN(n) || (min !== undefined && n < min)) { setV(last.current); return } out = String(n) } if (out !== last.current) { last.current = out; onCommit(out) } else setV(out) }
  return <input className="input" {...rest} type={number ? 'number' : rest.type} value={v} onChange={e => setV(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
}
const AUDIT_ACTION: Record<string, [string, string]> = { config: ['إعدادات', 'Settings'], save: ['حفظ', 'Save'], submit: ['إرسال', 'Submit'], review: ['مراجعة', 'Review'] }
export default function Admin() {
  const { t, lang, snap, saveConfig, user, cycleId } = useApp(); const cfg = snap!.config
  const admins = cfg.users.filter(u => u.active && u.role === 'admin').length
  const lastAdmin = (u: User) => u.role === 'admin' && u.active && admins <= 1
  const toast = useToast()
  const [tab, setTab] = useState<'users' | 'projects' | 'departments' | 'settings' | 'audit'>('users')
  const [nd, setNd] = useState({ name_ar: '', name_en: '' })
  const [nu, setNu] = useState({ name_ar: '', name_en: '', role: 'evaluator' as Role })
  const [np, setNp] = useState({ name_ar: '', name_en: '', ownerId: '' })
  const commit = async (c: typeof cfg, a: string) => { try { await saveConfig(JSON.parse(JSON.stringify(c)), a); toast(t('saved'), 'ok') } catch (e) { toast(errMsg(e, t), 'bad') } }
  const [pwFor, setPwFor] = useState<string | null>(null); const [p1, setP1] = useState(''); const [p2, setP2] = useState('')
  const pwUserObj = cfg.users.find(u => u.id === pwFor)
  const savePw = () => { if (!pwUserObj) return; if (p1.length < 6) { toast(t('passwordShort'), 'bad'); return } if (p1 !== p2) { toast(t('passwordMismatch'), 'bad'); return }
    commit({ ...cfg, users: cfg.users.map(x => x.id === pwUserObj.id ? { ...x, pwd: makePassword(p1) } : x) }, `password set ${pwUserObj.id}`); setPwFor(null); toast(t('passwordSet'), 'ok') }
  const removePw = () => { if (!pwUserObj) return; commit({ ...cfg, users: cfg.users.map(x => x.id === pwUserObj.id ? { ...x, pwd: null } : x) }, `password removed ${pwUserObj.id}`); setPwFor(null); toast(t('passwordRemoved'), 'ok') }
  const updUser = (u: User) => commit({ ...cfg, users: cfg.users.map(x => x.id === u.id ? u : x) }, `user ${u.id}`)
  const updProj = (p: Project) => commit({ ...cfg, projects: cfg.projects.map(x => x.id === p.id ? p : x) }, `project ${p.id}`)
  const updDept = (d: Department) => commit({ ...cfg, departments: cfg.departments.map(x => x.id === d.id ? d : x) }, `department ${d.id}`)
  const assignedCount = (uidv: string) => cycleId ? master.codes.filter(c => assigneeOf(c.id, cycleId, cfg) === uidv).length : 0
  const toggleActive = (u: User, on: boolean) => { if (!on && assignedCount(u.id) > 0 && !confirm(`${t('deactivateWarn')} (${assignedCount(u.id)})`)) return; updUser({ ...u, active: on }) }
  const toggleProject = (p: Project, on: boolean) => { if (!on && !confirm(t('confirmDeactivateProject'))) return; updProj({ ...p, active: on }) }
  const flagged = master.codes.filter(c => !c.impact)
  const roleOpts = <><option value="admin">{t('adminRole')}</option><option value="reviewer">{t('reviewerRole')}</option><option value="evaluator">{t('evaluatorRole')}</option><option value="viewer">{t('viewerRole')}</option></>
  return (
    <div>
      <PageHeader title={t('admin')} actions={<div className="seg">{(['users', 'projects', 'departments', 'settings', 'audit'] as const).map(k => <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}><Icon name={k === 'users' ? 'users' : k === 'projects' ? 'map' : k === 'departments' ? 'layers' : k === 'settings' ? 'settings' : 'clock'} />{k === 'users' ? t('users') : k === 'projects' ? t('projects') : k === 'departments' ? t('departments') : k === 'settings' ? t('settings') : t('audit')}</button>)}</div>} />
      <Modal open={!!pwUserObj} onClose={() => setPwFor(null)} title={`${pwUserObj?.pwd ? t('changePassword') : t('setPassword')} · ${pwUserObj ? (lang === 'ar' ? pwUserObj.name_ar : pwUserObj.name_en) : ''}`}
        footer={<>{pwUserObj?.pwd && <button className="btn me-auto" onClick={removePw}>{t('removePassword')}</button>}<button className="btn" onClick={() => setPwFor(null)}>{t('cancel')}</button><button className="btn btn-primary" disabled={!p1 || !p2} onClick={savePw}><Icon name="check" />{t('save')}</button></>}>
        <form className="flex flex-col gap-3" onSubmit={e => { e.preventDefault(); savePw() }}>
          <div className="field"><label className="label" htmlFor="pw-new">{t('newPassword')}</label><input id="pw-new" type="password" className="input" autoComplete="new-password" value={p1} onChange={e => setP1(e.target.value)} /></div>
          <div className="field"><label className="label" htmlFor="pw-conf">{t('confirmPassword')}</label><input id="pw-conf" type="password" className="input" autoComplete="new-password" value={p2} onChange={e => setP2(e.target.value)} /></div>
          <p className="text-xs text-muted m-0">{t('passwordHint')}</p>
        </form>
      </Modal>
      {tab === 'users' && <div className="card overflow-x-auto"><table className="tbl"><thead><tr><th></th><th>{t('nameAr')}</th><th>{t('nameEn')}</th><th>{t('role')}</th><th>{t('passwordLabel')}</th><th>{t('active')}</th></tr></thead><tbody>
        {cfg.users.map(u => <tr key={u.id}><td><label className="cursor-pointer inline-block" title={t('photo')}><Avatar name={lang === 'ar' ? u.name_ar : u.name_en} photo={u.photo} size="lg" /><input type="file" accept="image/*" className="sr-only" aria-label={t('photo')} onChange={e => { const f = e.target.files?.[0]; if (f) toDataUrl(f).then(photo => updUser({ ...u, photo })) }} /></label></td><td><DraftInput aria-label={t('nameAr')} value={u.name_ar} onCommit={v => updUser({ ...u, name_ar: v })} /></td><td><DraftInput aria-label={t('nameEn')} dir="ltr" value={u.name_en} onCommit={v => updUser({ ...u, name_en: v })} /></td>
          <td><select className="select" aria-label={t('role')} value={u.role} disabled={lastAdmin(u)} title={lastAdmin(u) ? t('lastAdmin') : undefined} onChange={e => updUser({ ...u, role: e.target.value as Role })}>{roleOpts}</select>{u.id === user!.id && <div className="text-xs text-muted mt-1">{t('thisIsYou')}</div>}</td><td className="whitespace-nowrap"><button className="btn btn-sm" onClick={() => { setPwFor(u.id); setP1(''); setP2('') }}><Icon name="shield" />{u.pwd ? t('changePassword') : t('setPassword')}</button><div className={`text-xs mt-1 ${u.pwd ? 'text-ok-ink' : 'text-muted'}`}>{u.pwd ? t('protectedAcc') : t('noPassword')}</div></td><td><input type="checkbox" aria-label={t('active')} checked={u.active} disabled={lastAdmin(u)} onChange={e => toggleActive(u, e.target.checked)} /></td></tr>)}
        <tr className="!bg-surface-2"><td></td><td><input className="input" placeholder={t('nameAr')} aria-label={t('nameAr')} value={nu.name_ar} onChange={e => setNu({ ...nu, name_ar: e.target.value })} /></td><td><input className="input" dir="ltr" placeholder={t('nameEn')} value={nu.name_en} onChange={e => setNu({ ...nu, name_en: e.target.value })} /></td>
          <td><select className="select" value={nu.role} onChange={e => setNu({ ...nu, role: e.target.value as Role })}>{roleOpts}</select></td><td></td>
          <td><button className="btn btn-primary btn-sm" disabled={!nu.name_ar.trim()} onClick={() => { commit({ ...cfg, users: [...cfg.users, { id: 'u-' + uid(), name_ar: nu.name_ar.trim(), name_en: nu.name_en.trim() || nu.name_ar.trim(), role: nu.role, active: true }] }, 'user add'); setNu({ name_ar: '', name_en: '', role: 'evaluator' }) }}><Icon name="plus" />{t('add')}</button></td></tr>
      </tbody></table></div>}
      {tab === 'projects' && <div className="card overflow-x-auto"><table className="tbl"><thead><tr><th>{t('id')}</th><th>{t('nameAr')}</th><th>{t('nameEn')}</th><th>{t('owner')}</th><th>{t('active')}</th></tr></thead><tbody>
        {cfg.projects.map(p => <tr key={p.id}><td className="code-id">{p.id}</td><td><DraftInput aria-label={t('nameAr')} value={p.name_ar} onCommit={v => updProj({ ...p, name_ar: v })} /></td><td><DraftInput aria-label={t('nameEn')} dir="ltr" value={p.name_en || ''} onCommit={v => updProj({ ...p, name_en: v })} /></td>
          <td><select className="select" aria-label={t('owner')} value={p.ownerId || ''} onChange={e => updProj({ ...p, ownerId: e.target.value || null })}><option value="">—</option>{cfg.users.map(u => <option key={u.id} value={u.id}>{lang === 'ar' ? u.name_ar : u.name_en}</option>)}</select></td><td><input type="checkbox" aria-label={t('active')} checked={p.active} onChange={e => toggleProject(p, e.target.checked)} /></td></tr>)}
        <tr className="!bg-surface-2"><td></td><td><input className="input" placeholder={t('nameAr')} aria-label={t('nameAr')} value={np.name_ar} onChange={e => setNp({ ...np, name_ar: e.target.value })} /></td><td><input className="input" dir="ltr" placeholder={t('nameEn')} value={np.name_en} onChange={e => setNp({ ...np, name_en: e.target.value })} /></td>
          <td><select className="select" value={np.ownerId} onChange={e => setNp({ ...np, ownerId: e.target.value })}><option value="">—</option>{cfg.users.map(u => <option key={u.id} value={u.id}>{lang === 'ar' ? u.name_ar : u.name_en}</option>)}</select></td>
          <td><button className="btn btn-primary btn-sm" disabled={!np.name_ar.trim()} onClick={() => { commit({ ...cfg, projects: [...cfg.projects, { id: 'p' + String(cfg.projects.length + 1).padStart(2, '0') + '-' + uid().slice(0, 4), name_ar: np.name_ar.trim(), name_en: np.name_en.trim(), ownerId: np.ownerId || null, active: true }] }, 'project add'); setNp({ name_ar: '', name_en: '', ownerId: '' }) }}><Icon name="plus" />{t('add')}</button></td></tr>
      </tbody></table></div>}
      {tab === 'departments' && <div className="card overflow-x-auto"><div className="px-4 pt-3 text-sm text-muted">{t('deptHint')}</div><table className="tbl"><thead><tr><th>{t('id')}</th><th>{t('nameAr')}</th><th>{t('nameEn')}</th><th>{t('codes')}</th><th>{t('active')}</th></tr></thead><tbody>
        {cfg.departments.map(d => <tr key={d.id}><td className="code-id">{d.id}</td><td><DraftInput aria-label={t('nameAr')} value={d.name_ar} onCommit={v => updDept({ ...d, name_ar: v })} /></td><td><DraftInput aria-label={t('nameEn')} dir="ltr" value={d.name_en} onCommit={v => updDept({ ...d, name_en: v })} /></td><td className="num">{Object.values(cfg.deptMapping).filter(v => v[0] === d.id).length}</td><td><input type="checkbox" aria-label={t('active')} checked={d.active} onChange={e => updDept({ ...d, active: e.target.checked })} /></td></tr>)}
        <tr className="!bg-surface-2"><td></td><td><input className="input" placeholder={t('nameAr')} aria-label={t('nameAr')} value={nd.name_ar} onChange={e => setNd({ ...nd, name_ar: e.target.value })} /></td><td><input className="input" dir="ltr" placeholder={t('nameEn')} aria-label={t('nameEn')} value={nd.name_en} onChange={e => setNd({ ...nd, name_en: e.target.value })} /></td><td></td>
          <td><button className="btn btn-primary btn-sm" disabled={!nd.name_ar.trim()} onClick={() => { commit({ ...cfg, departments: [...cfg.departments, { id: 'd-' + uid().slice(0, 6), name_ar: nd.name_ar.trim(), name_en: nd.name_en.trim() || nd.name_ar.trim(), active: true }] }, 'department add'); setNd({ name_ar: '', name_en: '' }) }}><Icon name="plus" />{t('add')}</button></td></tr>
      </tbody></table></div>}
      {tab === 'settings' && <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-4 flex flex-col gap-3"><div className="font-semibold flex items-center gap-2"><Icon name="users" className="text-accent-ink" />{t('coreTeam')}</div><p className="text-sm text-muted m-0">{t('step1')}</p>
          <select className="select" aria-label={t('coreTeam')} value={cfg.settings.defaultAssigneeId || ''} onChange={e => commit({ ...cfg, settings: { ...cfg.settings, defaultAssigneeId: e.target.value || null } }, 'default assignee')}><option value="">—</option>{cfg.users.filter(u => u.active).map(u => <option key={u.id} value={u.id}>{lang === 'ar' ? u.name_ar : u.name_en}</option>)}</select>
          <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={cfg.settings.requireEvidence} onChange={e => commit({ ...cfg, settings: { ...cfg.settings, requireEvidence: e.target.checked } }, 'requireEvidence')} />{t('needEvidence')}</label>
          <div className="field"><label className="label" htmlFor="ent-ar">{t('entityName')} — {t('nameAr')}</label><DraftInput id="ent-ar" value={cfg.entity.name_ar} onCommit={v => commit({ ...cfg, entity: { ...cfg.entity, name_ar: v } }, 'entity')} /></div>
          <div className="field"><label className="label" htmlFor="ent-en">{t('entityName')} — {t('nameEn')}</label><DraftInput id="ent-en" dir="ltr" value={cfg.entity.name_en} onCommit={v => commit({ ...cfg, entity: { ...cfg.entity, name_en: v } }, 'entity')} /></div>
        </div>
        <div className="card p-4 flex flex-col gap-3"><div className="font-semibold flex items-center gap-2"><Icon name="target" className="text-accent-ink" />{t('scoringRule')}</div>
          <div><div className="label">{t('answerScores')}</div><div className="grid grid-cols-3 gap-2 text-sm">{(['yes', 'partial', 'no'] as const).map(k => <label key={k}>{t(k)}<DraftInput number min={0} value={cfg.settings.scores[k]} onCommit={v => commit({ ...cfg, settings: { ...cfg.settings, scores: { ...cfg.settings.scores, [k]: Number(v) } } }, 'scores')} /></label>)}</div></div>
          <div><div className="label">{t('impactWeights')}</div><div className="grid grid-cols-4 gap-2 text-sm">{(['high', 'medium', 'low', 'none'] as const).map(k => <label key={k}>{t(k === 'none' ? 'notSpecified' : k)}<DraftInput number min={0} step="0.5" value={cfg.settings.weights[k]} onCommit={v => commit({ ...cfg, settings: { ...cfg.settings, weights: { ...cfg.settings.weights, [k]: Number(v) } } }, 'weights')} /></label>)}</div></div>
          <div><div className="label">{t('impactPoints')}</div><div className="grid grid-cols-4 gap-2 text-sm">{(['high', 'medium', 'low', 'none'] as const).map(k => <label key={k}>{t(k === 'none' ? 'notSpecified' : k)}<DraftInput number min={0} value={(cfg.settings.points || { high: 30, medium: 20, low: 10, none: 20 })[k]} onCommit={v => commit({ ...cfg, settings: { ...cfg.settings, points: { ...(cfg.settings.points || { high: 30, medium: 20, low: 10, none: 20 }), [k]: Number(v) } } }, 'points')} /></label>)}</div><div className="text-xs text-muted mt-1">{t('fulfilmentHint')}</div></div>
          {flagged.length > 0 && <div><div className="label">{t('flagImpact')}</div>{flagged.map(c => <div key={c.id} className="flex items-center gap-2 text-sm mt-1"><span className="code-id">{c.id}</span><select className="select !w-auto" value={cfg.impactOverrides[c.id] || ''} onChange={e => { const io = { ...cfg.impactOverrides }; if (e.target.value) io[c.id] = e.target.value as Impact; else delete io[c.id]; commit({ ...cfg, impactOverrides: io }, 'impact ' + c.id) }}><option value="">{t('notSpecified')}</option><option value="high">{t('high')}</option><option value="medium">{t('medium')}</option><option value="low">{t('low')}</option></select></div>)}</div>}
        </div>
      </div>}
      {tab === 'audit' && (snap!.audit.length === 0 ? <Empty icon="clock" /> : <div className="card overflow-x-auto"><table className="tbl"><thead><tr><th>{t('at')}</th><th>{t('by')}</th><th>{t('action')}</th><th>{t('target')}</th></tr></thead><tbody>
        {[...snap!.audit].reverse().slice(0, 300).map((a, i) => <tr key={i}><td className="whitespace-nowrap text-sm">{fmtDate(a.at, lang)}</td><td>{pick(lang, cfg.users.find(u => u.id === a.by) || { name_ar: a.by })}</td><td><span className="pill pill-muted">{AUDIT_ACTION[a.action] ? AUDIT_ACTION[a.action][lang === 'ar' ? 0 : 1] : a.action}</span></td><td className="code-id">{a.target}</td></tr>)}</tbody></table></div>)}
    </div>
  )
}
