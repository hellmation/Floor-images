import { useState } from 'react'
import { useApp } from '../store/state'
import { master, uid } from '../store/scoring'
import { pick } from '../i18n'
import { fmtDate } from '../components/ui'
import type { Impact, Project, Role, User } from '../types'

export default function Admin() {
  const { t, lang, snap, saveConfig } = useApp(); const cfg = snap!.config
  const [tab, setTab] = useState<'users' | 'projects' | 'settings' | 'audit'>('users')
  const [nu, setNu] = useState({ name_ar: '', name_en: '', role: 'evaluator' as Role })
  const [np, setNp] = useState({ name_ar: '', name_en: '', ownerId: '' })
  const commit = (c: typeof cfg, a: string) => saveConfig(JSON.parse(JSON.stringify(c)), a)
  const updUser = (u: User) => commit({ ...cfg, users: cfg.users.map(x => x.id === u.id ? u : x) }, `user ${u.id}`)
  const updProj = (p: Project) => commit({ ...cfg, projects: cfg.projects.map(x => x.id === p.id ? p : x) }, `project ${p.id}`)
  const flagged = master.codes.filter(c => !c.impact)
  return (
    <div className="flex flex-col gap-4 max-w-5xl">
      <div className="seg">{(['users', 'projects', 'settings', 'audit'] as const).map(k => <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{k === 'users' ? t('users') : k === 'projects' ? t('projects') : k === 'settings' ? t('settings') : t('audit')}</button>)}</div>
      {tab === 'users' && <div className="card overflow-x-auto"><table className="tbl"><thead><tr><th>{t('nameAr')}</th><th>{t('nameEn')}</th><th>{t('role')}</th><th>{t('active')}</th></tr></thead><tbody>
        {cfg.users.map(u => <tr key={u.id}><td><input className="input" value={u.name_ar} onChange={e => updUser({ ...u, name_ar: e.target.value })} /></td><td><input className="input" value={u.name_en} onChange={e => updUser({ ...u, name_en: e.target.value })} /></td>
          <td><select className="select" value={u.role} onChange={e => updUser({ ...u, role: e.target.value as Role })}><option value="admin">{t('adminRole')}</option><option value="evaluator">{t('evaluatorRole')}</option><option value="viewer">{t('viewerRole')}</option></select></td>
          <td><input type="checkbox" checked={u.active} onChange={e => updUser({ ...u, active: e.target.checked })} /></td></tr>)}
        <tr><td><input className="input" placeholder={t('nameAr')} value={nu.name_ar} onChange={e => setNu({ ...nu, name_ar: e.target.value })} /></td><td><input className="input" placeholder={t('nameEn')} value={nu.name_en} onChange={e => setNu({ ...nu, name_en: e.target.value })} /></td>
          <td><select className="select" value={nu.role} onChange={e => setNu({ ...nu, role: e.target.value as Role })}><option value="admin">{t('adminRole')}</option><option value="evaluator">{t('evaluatorRole')}</option><option value="viewer">{t('viewerRole')}</option></select></td>
          <td><button className="btn btn-sm" disabled={!nu.name_ar.trim()} onClick={() => { commit({ ...cfg, users: [...cfg.users, { id: 'u-' + uid(), name_ar: nu.name_ar.trim(), name_en: nu.name_en.trim() || nu.name_ar.trim(), role: nu.role, active: true }] }, 'user add'); setNu({ name_ar: '', name_en: '', role: 'evaluator' }) }}>{t('add')}</button></td></tr>
      </tbody></table></div>}
      {tab === 'projects' && <div className="card overflow-x-auto"><table className="tbl"><thead><tr><th>{t('id')}</th><th>{t('nameAr')}</th><th>{t('nameEn')}</th><th>{t('owner')}</th><th>{t('active')}</th></tr></thead><tbody>
        {cfg.projects.map(p => <tr key={p.id}><td className="code-id">{p.id}</td><td><input className="input" value={p.name_ar} onChange={e => updProj({ ...p, name_ar: e.target.value })} /></td><td><input className="input" value={p.name_en || ''} onChange={e => updProj({ ...p, name_en: e.target.value })} /></td>
          <td><select className="select" value={p.ownerId || ''} onChange={e => updProj({ ...p, ownerId: e.target.value || null })}><option value="">—</option>{cfg.users.map(u => <option key={u.id} value={u.id}>{lang === 'ar' ? u.name_ar : u.name_en}</option>)}</select></td>
          <td><input type="checkbox" checked={p.active} onChange={e => updProj({ ...p, active: e.target.checked })} /></td></tr>)}
        <tr><td></td><td><input className="input" placeholder={t('nameAr')} value={np.name_ar} onChange={e => setNp({ ...np, name_ar: e.target.value })} /></td><td><input className="input" placeholder={t('nameEn')} value={np.name_en} onChange={e => setNp({ ...np, name_en: e.target.value })} /></td>
          <td><select className="select" value={np.ownerId} onChange={e => setNp({ ...np, ownerId: e.target.value })}><option value="">—</option>{cfg.users.map(u => <option key={u.id} value={u.id}>{lang === 'ar' ? u.name_ar : u.name_en}</option>)}</select></td>
          <td><button className="btn btn-sm" disabled={!np.name_ar.trim()} onClick={() => { commit({ ...cfg, projects: [...cfg.projects, { id: 'p' + String(cfg.projects.length + 1).padStart(2, '0') + '-' + uid().slice(0, 4), name_ar: np.name_ar.trim(), name_en: np.name_en.trim(), ownerId: np.ownerId || null, active: true }] }, 'project add'); setNp({ name_ar: '', name_en: '', ownerId: '' }) }}>{t('add')}</button></td></tr>
      </tbody></table></div>}
      {tab === 'settings' && <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-4 flex flex-col gap-2"><div className="font-semibold">{t('coreTeam')}</div><p className="text-sm text-muted m-0">{t('unmappedCodes')} → </p>
          <select className="select" value={cfg.settings.defaultAssigneeId || ''} onChange={e => commit({ ...cfg, settings: { ...cfg.settings, defaultAssigneeId: e.target.value || null } }, 'default assignee')}><option value="">—</option>{cfg.users.filter(u => u.active).map(u => <option key={u.id} value={u.id}>{lang === 'ar' ? u.name_ar : u.name_en}</option>)}</select>
          <label className="text-sm flex items-center gap-2 mt-2"><input type="checkbox" checked={cfg.settings.requireEvidence} onChange={e => commit({ ...cfg, settings: { ...cfg.settings, requireEvidence: e.target.checked } }, 'requireEvidence')} />{t('needEvidence')}</label>
          <label className="text-sm mt-2">{t('entityName')} — {t('nameAr')}<input className="input" value={cfg.entity.name_ar} onChange={e => commit({ ...cfg, entity: { ...cfg.entity, name_ar: e.target.value } }, 'entity')} /></label>
          <label className="text-sm">{t('entityName')} — {t('nameEn')}<input className="input" value={cfg.entity.name_en} onChange={e => commit({ ...cfg, entity: { ...cfg.entity, name_en: e.target.value } }, 'entity')} /></label>
        </div>
        <div className="card p-4 flex flex-col gap-2"><div className="font-semibold">{t('scoringRule')}</div><div className="label">{t('answerScores')}</div>
          <div className="grid grid-cols-3 gap-2 text-sm">{(['yes', 'partial', 'no'] as const).map(k => <label key={k}>{t(k)}<input type="number" className="input" value={cfg.settings.scores[k]} onChange={e => commit({ ...cfg, settings: { ...cfg.settings, scores: { ...cfg.settings.scores, [k]: Number(e.target.value) } } }, 'scores')} /></label>)}</div>
          <div className="label mt-1">{t('impactWeights')}</div><div className="grid grid-cols-4 gap-2 text-sm">{(['high', 'medium', 'low', 'none'] as const).map(k => <label key={k}>{t(k === 'none' ? 'notSpecified' : k)}<input type="number" step="0.5" className="input" value={cfg.settings.weights[k]} onChange={e => commit({ ...cfg, settings: { ...cfg.settings, weights: { ...cfg.settings.weights, [k]: Number(e.target.value) } } }, 'weights')} /></label>)}</div>
          {flagged.length > 0 && <div className="mt-2"><div className="font-semibold text-sm">{t('flagImpact')}</div>{flagged.map(c => <div key={c.id} className="flex items-center gap-2 text-sm mt-1"><span className="code-id">{c.id}</span><select className="select !w-auto" value={cfg.impactOverrides[c.id] || ''} onChange={e => { const io = { ...cfg.impactOverrides }; if (e.target.value) io[c.id] = e.target.value as Impact; else delete io[c.id]; commit({ ...cfg, impactOverrides: io }, 'impact ' + c.id) }}><option value="">{t('notSpecified')}</option><option value="high">{t('high')}</option><option value="medium">{t('medium')}</option><option value="low">{t('low')}</option></select></div>)}</div>}
        </div>
      </div>}
      {tab === 'audit' && <div className="card overflow-x-auto"><table className="tbl"><thead><tr><th>{t('at')}</th><th>{t('by')}</th><th>{t('action')}</th><th>{t('target')}</th></tr></thead><tbody>
        {[...snap!.audit].reverse().slice(0, 300).map((a, i) => <tr key={i}><td className="whitespace-nowrap">{fmtDate(a.at, lang)}</td><td>{pick(lang, cfg.users.find(u => u.id === a.by) || { name_ar: a.by })}</td><td>{a.action}</td><td className="code-id">{a.target}</td></tr>)}</tbody></table></div>}
    </div>
  )
}
