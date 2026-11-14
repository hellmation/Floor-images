import type { Config, ReviewsFile, User, Project, Department } from '../types'
import projectsSeed from '../data/projects.json'
import photos from '../data/photos.json'
import departmentsSeed from '../data/departments-seed.json'
import mappingSeed from '../data/mapping-seed.json'
import masterJson from '../data/master.json'

const PROJECT_EN: Record<number, string> = {
  1: 'Service Development Strategy', 2: 'Pilot Services Observatory and Local Service Performance Management', 3: 'Service Cards', 4: 'Voice of the Customer (Customer Councils)',
  5: 'Services 2.0 Transformation Tracks', 6: 'Proactive Services', 7: 'Look and Quality of Digital Services', 8: 'Customer Pulse (Integration and Monitoring)',
  9: 'Authority Website', 10: 'Individual Guides System for Service Development', 11: 'Change Management', 12: 'Zero Government Bureaucracy', 13: 'Organisational Structure Development',
  14: 'Employee Journey in Reviewing and Approving Requests', 15: 'Opinion Surveys (Your Opinion Matters)', 16: 'Specialised Programmes for Service Staff', 17: 'Customer Happiness Training Programme (Soft Skills)',
  18: 'Specialised Training Programme in Service Development', 19: 'Developing Relationships with Large Companies', 20: 'Taxpayer Support Centre Operating Model Assessment',
  21: 'Service Level Agreement Management', 22: 'Request Volume and Capacity', 23: 'ISO 11367:2025 Government Service Excellence Certification', 24: 'Participation in Awards',
  25: 'Developing the Switchboard Inbound Call Process', 26: 'Service Development Hackathon 365 (Shawrkom Platform)', 27: 'Smart Service Guide 360', 28: 'Spreading a Culture of Service Excellence Internally',
  29: 'Marketing and Media Campaigns (Tawasul 360)', 30: 'Global Star Rating System for Services', 31: 'Complaints Management', 32: 'Suggestions Management', 33: 'Enquiries Management', 34: 'Customer Segmentation',
  35: 'Service Delivery Quality Assessment', 36: 'Digital Customer Journey', 37: 'Digital Channels Assessment', 38: 'Notifications and Request Tracking Management', 39: 'Service Bundles Development', 40: 'Support for the Mohammed bin Rashid Government Excellence Award',
}
const slug = (s: string) => s.replace(/\s+/g, '-').toLowerCase()

export function seedUsersAndProjects(): { users: User[]; projects: Project[] } {
  const users: User[] = []; const projects: Project[] = []
  const EN: Record<string, string> = {
    'أحمد حلمي': 'Ahmed Helmy', 'محمود عبد القادر': 'Mahmoud Abdelkader',
    'أبو المجد حمد': 'Abu Almajd Hamad', 'محمد عماد': 'Mohammed Emad', 'أليكسندر تكلي': 'Alexander Tekle',
  }
  const PHOTO: Record<string, string> = { 'أحمد حلمي': photos.ahmed, 'محمود عبد القادر': photos.mahmoud, 'أبو المجد حمد': photos.abualmajd, 'محمد عماد': photos.emad, 'أليكسندر تكلي': photos.alex }
  for (const o of projectsSeed.owners as { name_ar: string; removed?: boolean; projects: { id: number; name_ar: string }[] }[]) {
    const removed = !!o.removed
    const id = removed ? null : 'u-' + slug(EN[o.name_ar] || o.name_ar)
    if (id) users.push({ id, name_ar: o.name_ar, name_en: EN[o.name_ar] || o.name_ar, role: o.name_ar === 'أحمد حلمي' ? 'admin' : 'evaluator', active: true, photo: PHOTO[o.name_ar] })
    for (const p of o.projects) projects.push({ id: 'p' + String(p.id).padStart(2, '0'), name_ar: p.name_ar, name_en: PROJECT_EN[p.id] || '', ownerId: id, active: !removed })
  }
  return { users, projects }
}

/** Organisational units and the code -> department mapping derived from the FTA structure decree (18/2023). */
export function seedDepartments(): Department[] { return (departmentsSeed as unknown as { departments: Department[] }).departments.map(d => ({ ...d })) }
export function seedDeptConfirm(): Record<string, true> { return { ...((departmentsSeed as unknown as { confirm?: Record<string, true> }).confirm || {}) } }
export function seedDeptMapping(): Record<string, string[]> { const m = (departmentsSeed as unknown as { mapping: Record<string, string[]> }).mapping; return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, [...v]])) }
/** Code-level mapping derived from the project -> sub-pillar seed. */
export function seedMapping(): Record<string, string[]> {
  const seed = mappingSeed as unknown as { assignments?: Record<string, string[]>; projects: Record<string, { subs: string[]; codes?: string[] }>; excludeIfText: string[] }
  const codes = (masterJson as unknown as { codes: { id: string; sub: string; desc_ar: string }[] }).codes
  const m: Record<string, string[]> = {}
  if (seed.assignments) { for (const c of codes) { const ps = seed.assignments[c.id]; if (ps && ps.length) m[c.id] = [...ps] } return m }
  for (const [pid, p] of Object.entries(seed.projects)) for (const c of codes) {
    if (!p.subs.includes(c.sub) && !(p.codes || []).includes(c.id)) continue
    if (seed.excludeIfText.some(x => c.desc_ar.includes(x))) continue
    ;(m[c.id] = m[c.id] || []).push(pid)
  }
  return m
}

export function defaultConfig(): Config {
  const { users, projects } = seedUsersAndProjects()
  return {
    version: 10,
    departments: seedDepartments(), deptMapping: seedDeptMapping(), deptConfirm: seedDeptConfirm(),
    entity: { name_ar: 'الهيئة الاتحادية للضرائب', name_en: 'Federal Tax Authority' },
    users, projects, mapping: seedMapping(), overrides: {},
    cycles: [{ id: '2026-Q1-Q3', name: 'خط الأساس 2026 — الأرباع الأول إلى الثالث', name_en: '2026 Baseline — Q1 to Q3', start: '2026-01-01', end: '2026-09-30', due: '2026-12-15', status: 'open', prefillFrom: null }],
    currentCycleId: '2026-Q1-Q3',
    settings: { scores: { yes: 100, partial: 50, no: 0 }, weights: { high: 3, medium: 2, low: 1, none: 2 }, defaultAssigneeId: 'u-ahmed-helmy', requireEvidence: true, points: { high: 30, medium: 20, low: 10, none: 20 } },
    impactOverrides: {},
    updatedAt: new Date().toISOString(),
  }
}
/** Upgrades a config.json written by an older release. */
/** Guarantees at least one active admin: restores the project manager, else promotes the first active user. */
export function ensureAdmin(c: Config): Config {
  if (c.users.some(u => u.active && u.role === 'admin')) return c
  const pm = c.users.find(u => u.id === 'u-ahmed-helmy') || c.users.find(u => u.active) || c.users[0]
  if (pm) { pm.role = 'admin'; pm.active = true }
  return c
}
/** Adds the reviewed seed mapping for codes that have no mapping yet; codes the admin already mapped are kept as they are. */
function mergeSeedMapping(c: Config) {
  const seed = seedMapping(); const out = { ...c.mapping }
  for (const [code, pids] of Object.entries(seed)) if (!out[code]?.length) out[code] = pids
  c.mapping = out
}
/** Renames a cycle id everywhere inside the config (cycles, current, prefill references, overrides). */
export function renameCycleInConfig(c: Config, from: string, to: string) {
  for (const cy of c.cycles) { if (cy.id === from) cy.id = to; if (cy.prefillFrom === from) cy.prefillFrom = to }
  if (c.currentCycleId === from) c.currentCycleId = to
  if (c.overrides[from] && !c.overrides[to]) { c.overrides[to] = c.overrides[from]; delete c.overrides[from] }
  c.renamedCycles = { ...(c.renamedCycles || {}), [from]: to }
}
export function migrateConfig(c: Config): Config {
  if ((c.version || 1) >= 10) return c
  // v10: optional sign-in passwords and administrator evidence adjustments. No data changes; the version bump makes older files read-only.
  if ((c.version || 1) === 9) { c.version = 10; return c }
  if ((c.version || 1) === 8) {
    // evidence rule narrowed: mandatory for Yes answers only (Partial and No submit without it)
    c.settings.requireEvidence = true
    c.version = 9; return migrateConfig(c)
  }
  if ((c.version || 1) === 7) {
    // reviewed department mapping (9 Nov): the reviewed values replace the first seed; confirmation flags and fulfilment points added
    c.deptMapping = { ...(c.deptMapping || {}), ...seedDeptMapping() }
    c.deptConfirm = { ...seedDeptConfirm(), ...(c.deptConfirm || {}) }
    if (!c.settings.points) c.settings.points = { high: 30, medium: 20, low: 10, none: 20 }
    c.version = 8; return migrateConfig(c)
  }
  if ((c.version || 1) === 6) {
    // responsible departments from the structure decree; existing custom values are kept
    if (!c.departments?.length) c.departments = seedDepartments()
    const seed = seedDeptMapping(); c.deptMapping = { ...seed, ...(c.deptMapping || {}) }
    c.version = 7; return migrateConfig(c)
  }
  if ((c.version || 1) === 5) {
    // the baseline assesses the first three quarters of 2026; the seeded '2026-Q4' cycle is renamed and re-dated
    const cy = c.cycles.find(x => x.id === '2026-Q4' && x.name === 'الربع الرابع 2026 — خط الأساس')
    if (cy && !c.cycles.some(x => x.id === '2026-Q1-Q3')) { cy.name = 'خط الأساس 2026 — الأرباع الأول إلى الثالث'; cy.name_en = '2026 Baseline — Q1 to Q3'; cy.start = '2026-01-01'; cy.end = '2026-09-30'; renameCycleInConfig(c, '2026-Q4', '2026-Q1-Q3') }
    c.version = 6; return migrateConfig(c)
  }
  if ((c.version || 1) < 5) { c = migrateTo5(c); return migrateConfig(c) }
  return c
}
function migrateTo5(c: Config): Config {
  if ((c.version || 1) >= 5) return c
  if ((c.version || 1) === 4) { mergeSeedMapping(c); c.version = 5; return c }
  if ((c.version || 1) === 3) return migrateTo5(migrateV3(c))
  if ((c.version || 1) === 2) { c.version = 3; return migrateTo5(c) }
  return migrateTo5(migrateV1(c))
}
function migrateV3(c: Config): Config {
    const { projects } = seedUsersAndProjects()
    for (const sp of projects) { const cur = c.projects.find(x => x.id === sp.id); if (cur) { cur.name_ar = sp.name_ar; cur.name_en = sp.name_en } else c.projects.push(sp) }
    c.mapping = seedMapping(); if (!c.settings.defaultAssigneeId) c.settings.defaultAssigneeId = 'u-ahmed-helmy'; c.version = 4; return c
}
function migrateV1(c: Config): Config {
  const { users } = seedUsersAndProjects()
  const renames: Record<string, { id: string; name_ar: string; name_en: string }> = {
    'u-mohammed-abdelkader': { id: 'u-mahmoud-abdelkader', name_ar: 'محمود عبد القادر', name_en: 'Mahmoud Abdelkader' },
    'u-alexander-tekle': { id: 'u-alexander-tekle', name_ar: 'أليكسندر تكلي', name_en: 'Alexander Tekle' },
  }
  c.users = c.users.filter(u => u.id !== 'u-mohammed-al-jughair').map(u => {
    const r = renames[u.id]; const n = { ...u, ...(r || {}) }
    const seed = users.find(s => s.id === n.id); if (seed?.photo && !n.photo) n.photo = seed.photo
    return n
  })
  c.projects = c.projects.map(p => p.ownerId === 'u-mohammed-al-jughair' ? { ...p, ownerId: null, active: false } : p.ownerId === 'u-mohammed-abdelkader' ? { ...p, ownerId: 'u-mahmoud-abdelkader' } : p)
  for (const cy of Object.keys(c.overrides)) for (const k of Object.keys(c.overrides[cy])) { if (c.overrides[cy][k] === 'u-mohammed-abdelkader') c.overrides[cy][k] = 'u-mahmoud-abdelkader'; if (c.overrides[cy][k] === 'u-mohammed-al-jughair') delete c.overrides[cy][k] }
  if (c.settings.defaultAssigneeId === 'u-mohammed-abdelkader') c.settings.defaultAssigneeId = 'u-mahmoud-abdelkader'
  if (c.settings.defaultAssigneeId === 'u-mohammed-al-jughair') c.settings.defaultAssigneeId = null
  c.mapping = seedMapping()
  c.version = 3
  return c
}
export const emptyReviews = (): ReviewsFile => ({ updatedAt: new Date().toISOString(), cycles: {}, clarifications: {} })
