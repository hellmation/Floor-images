import { useState } from 'react'
import { useApp } from '../store/state'
import { master, uid } from '../store/scoring'
import { pick } from '../i18n'
import { Avatar, PageHeader, fmtDate, useToast } from '../components/ui'
import { Icon } from '../components/icons'
import type { Impact, Project, Role, User } from '../types'

function toDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => { const img = new Image(); const url = URL.createObjectURL(file)
    img.onload = () => { const s = 192, c = document.createElement('canvas'); c.width = s; c.height = s; const x = c.getContext('2d')!; const m = Math.min(img.width, img.height)
      x.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, s, s); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.82)) }
    img.onerror = rej; img.src = url })
}
export default function Admin() {
  const { t, lang, snap, saveConfig, user } = useApp(); const cfg = snap!.config
  const admins = cfg.users.filter(u => u.active && u.role === 'admin').length
  const lastAdmin = (u: User) => u.role === 'admin' && u.active && admins <= 1
  const toast = useToast()
  const [tab, setTab] = useState<'users' | 'projects' | 'settings' | 'audit'>('users')
  const [nu, setNu] = useState({ name_ar: '', name_en: '', role: 'evaluator' as Role })
  const [np, setNp] = useState({ name_ar: '', name_en: '', ownerId: '' })
  const commit = async (c: typeof cfg, a: string) => { await saveConfig(JSON.parse(JSON.stringify(c)), a); toast(t('saved'), 'ok') }
  const updUser = (u: User) => saveConfig(JSON.parse(JSON.stringify({ ...cfg, users: cfg.users.map(x => x.id === u.id ? u : x) })), `user ${u.id}`)
  const updProj = (p: Project) => saveConfig(JSON.parse(JSON.stringify({ ...cfg, projects: cfg.projects.map(x => x.id === p.id ? p : x) })), `project ${p.id}`)
  const flagged = master.codes.filter(c => !c.impact)
  const roleOpts = <><option value="admin">{t('adminRole')}</option><option value="evaluator">{t('evaluatorRole')}</option><option value="viewer">{t('viewerRole')}</option></>
  return (
    <div>
      <PageHeader title={t('admin')} actions={<div className="seg">{(['users', 'projects', 'settings', 'audit'] as const).map(k => <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}><Icon name={k === 'users' ? 'users' : k === 'projects' ? 'map' : k === 'settings' ? 'settings' : 'clock'} />{k === 'users' ? t('users') : k === 'projects' ? t('projects') : k === 'settings' ? t('settings') : t('audit')}</button>)}</div>} />
      {tab === 'users' && <div className="card overflow-x-auto"><table className="tbl"><thead><tr><th></th><th>{t('nameAr')}</th><th>{t('nameEn')}</th><th>{t('role')}</th><th>{t('active')}</th></tr></thead><tbody>
        {cfg.users.map(u => <tr key={u.id}><td><label className="cursor-pointer inline-block" title={t('photo')}><Avatar name={lang === 'ar' ? u.name_ar : u.name_en} photo={u.photo} size="lg" /><input type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) toDataUrl(f).then(photo => updUser({ ...u, photo })) }} /></label></td><td><input className="input" value={u.name_ar} onChange={e => updUser({ ...u, name_ar: e.target.value })} /></td><td><input className="input" dir="ltr" value={u.name_en} onChange={e => updUser({ ...u, name_en: e.target.value })} /></td>
          <td><select className="select" value={u.role} disabled={lastAdmin(u)} title={lastAdmin(u) ? t('lastAdmin') : undefined} onChange={e => updUser({ ...u, role: e.target.value as Role })}>{roleOpts}</select>{u.id === user!.id && <div className="text-xs text-muted mt-1">{t('thisIsYou')}</div>}</td><td><input type="checkbox" checked={u.active} disabled={lastAdmin(u)} onChange={e => updUser({ ...u, active: e.target.checked })} /></td></tr>)}
        <tr className="!bg-surface-2"><td></td><td><input className="input" placeholder={t('nameAr')} value={nu.name_ar} onChange={e => setNu({ ...nu, name_ar: e.target.value })} /></td><td><input className="input" dir="ltr" placeholder={t('nameEn')} value={nu.name_en} onChange={e => setNu({ ...nu, name_en: e.target.value })} /></td>
          <td><select className="select" value={nu.role} onChange={e => setNu({ ...nu, role: e.target.value as Role })}>{roleOpts}</select></td>
          <td><button className="btn btn-primary btn-sm" disabled={!nu.name_ar.trim()} onClick={() => { commit({ ...cfg, users: [...cfg.users, { id: 'u-' + uid(), name_ar: nu.name_ar.trim(), name_en: nu.name_en.trim() || nu.name_ar.trim(), role: nu.role, active: true }] }, 'user add'); setNu({ name_ar: '', name_en: '', role: 'evaluator' }) }}><Icon name="plus" />{t('add')}</button></td></tr>
      </tbody></table></div>}
      {tab === 'projects' && <div className="card overflow-x-auto"><table className="tbl"><thead><tr><th>{t('id')}</th><th>{t('nameAr')}</th><th>{t('nameEn')}</th><th>{t('owner')}</th><th>{t('active')}</th></tr></thead><tbody>
        {cfg.projects.map(p => <tr key={p.id}><td className="code-id">{p.id}</td><td><input className="input" value={p.name_ar} onChange={e => updProj({ ...p, name_ar: e.target.value })} /></td><td><input className="input" dir="ltr" value={p.name_en || ''} onChange={e => updProj({ ...p, name_en: e.target.value })} /></td>
          <td><select className="select" value={p.ownerId || ''} onChange={e => updProj({ ...p, ownerId: e.target.value || null })}><option value="">—</option>{cfg.users.map(u => <option key={u.id} value={u.id}>{lang === 'ar' ? u.name_ar : u.name_en}</option>)}</select></td><td><input type="checkbox" checked={p.active} onChange={e => updProj({ ...p, active: e.target.checked })} /></td></tr>)}
        <tr className="!bg-surface-2"><td></td><td><input className="input" placeholder={t('nameAr')} value={np.name_ar} onChange={e => setNp({ ...np, name_ar: e.target.value })} /></td><td><input className="input" dir="ltr" placeholder={t('nameEn')} value={np.name_en} onChange={e => setNp({ ...np, name_en: e.target.value })} /></td>
          <td><select className="select" value={np.ownerId} onChange={e => setNp({ ...np, ownerId: e.target.value })}><option value="">—</option>{cfg.users.map(u => <option key={u.id} value={u.id}>{lang === 'ar' ? u.name_ar : u.name_en}</option>)}</select></td>
          <td><button className="btn btn-primary btn-sm" disabled={!np.name_ar.trim()} onClick={() => { commit({ ...cfg, projects: [...cfg.projects, { id: 'p' + String(cfg.projects.length + 1).padStart(2, '0') + '-' + uid().slice(0, 4), name_ar: np.name_ar.trim(), name_en: np.name_en.trim(), ownerId: np.ownerId || null, active: true }] }, 'project add'); setNp({ name_ar: '', name_en: '', ownerId: '' }) }}><Icon name="plus" />{t('add')}</button></td></tr>
      </tbody></table></div>}
      {tab === 'settings' && <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-4 flex flex-col gap-3"><div className="font-semibold flex items-center gap-2"><Icon name="users" className="text-accent-ink" />{t('coreTeam')}</div><p className="text-sm text-muted m-0">{t('unmappedCodes')} →</p>
          <select className="select" value={cfg.settings.defaultAssigneeId || ''} onChange={e => commit({ ...cfg, settings: { ...cfg.settings, defaultAssigneeId: e.target.value || null } }, 'default assignee')}><option value="">—</option>{cfg.users.filter(u => u.active).map(u => <option key={u.id} value={u.id}>{lang === 'ar' ? u.name_ar : u.name_en}</option>)}</select>
          <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={cfg.settings.requireEvidence} onChange={e => commit({ ...cfg, settings: { ...cfg.settings, requireEvidence: e.target.checked } }, 'requireEvidence')} />{t('needEvidence')}</label>
          <div className="field"><label className="label">{t('entityName')} — {t('nameAr')}</label><input className="input" value={cfg.entity.name_ar} onChange={e => saveConfig({ ...cfg, entity: { ...cfg.entity, name_ar: e.target.value } }, 'entity')} /></div>
          <div className="field"><label className="label">{t('entityName')} — {t('nameEn')}</label><input className="input" dir="ltr" value={cfg.entity.name_en} onChange={e => saveConfig({ ...cfg, entity: { ...cfg.entity, name_en: e.target.value } }, 'entity')} /></div>
        </div>
        <div className="card p-4 flex flex-col gap-3"><div className="font-semibold flex items-center gap-2"><Icon name="target" className="text-accent-ink" />{t('scoringRule')}</div>
          <div><div className="label">{t('answerScores')}</div><div className="grid grid-cols-3 gap-2 text-sm">{(['yes', 'partial', 'no'] as const).map(k => <label key={k}>{t(k)}<input type="number" className="input" value={cfg.settings.scores[k]} onChange={e => saveConfig({ ...cfg, settings: { ...cfg.settings, scores: { ...cfg.settings.scores, [k]: Number(e.target.value) } } }, 'scores')} /></label>)}</div></div>
          <div><div className="label">{t('impactWeights')}</div><div className="grid grid-cols-4 gap-2 text-sm">{(['high', 'medium', 'low', 'none'] as const).map(k => <label key={k}>{t(k === 'none' ? 'notSpecified' : k)}<input type="number" step="0.5" className="input" value={cfg.settings.weights[k]} onChange={e => saveConfig({ ...cfg, settings: { ...cfg.settings, weights: { ...cfg.settings.weights, [k]: Number(e.target.value) } } }, 'weights')} /></label>)}</div></div>
          {flagged.length > 0 && <div><div className="label">{t('flagImpact')}</div>{flagged.map(c => <div key={c.id} className="flex items-center gap-2 text-sm mt-1"><span className="code-id">{c.id}</span><select className="select !w-auto" value={cfg.impactOverrides[c.id] || ''} onChange={e => { const io = { ...cfg.impactOverrides }; if (e.target.value) io[c.id] = e.target.value as Impact; else delete io[c.id]; commit({ ...cfg, impactOverrides: io }, 'impact ' + c.id) }}><option value="">{t('notSpecified')}</option><option value="high">{t('high')}</option><option value="medium">{t('medium')}</option><option value="low">{t('low')}</option></select></div>)}</div>}
        </div>
      </div>}
      {tab === 'audit' && <div className="card overflow-x-auto"><table className="tbl"><thead><tr><th>{t('at')}</th><th>{t('by')}</th><th>{t('action')}</th><th>{t('target')}</th></tr></thead><tbody>
        {[...snap!.audit].reverse().slice(0, 300).map((a, i) => <tr key={i}><td className="whitespace-nowrap text-sm">{fmtDate(a.at, lang)}</td><td>{pick(lang, cfg.users.find(u => u.id === a.by) || { name_ar: a.by })}</td><td><span className="pill pill-muted">{a.action}</span></td><td className="code-id">{a.target}</td></tr>)}</tbody></table></div>}
    </div>
  )
}
