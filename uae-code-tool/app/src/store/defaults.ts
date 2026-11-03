import type { Config, ReviewsFile, User, Project } from '../types'
import projectsSeed from '../data/projects.json'

const slug = (s: string) => s.replace(/\s+/g, '-').toLowerCase()

export function seedUsersAndProjects(): { users: User[]; projects: Project[] } {
  const users: User[] = []; const projects: Project[] = []
  const EN: Record<string, string> = {
    'محمد الجغير': 'Mohammed Al Jughair', 'أحمد حلمي': 'Ahmed Helmy', 'محمد عبد القادر': 'Mohammed Abdelkader',
    'أبو المجد حمد': 'Abu Almajd Hamad', 'محمد عماد': 'Mohammed Emad', 'ألكسندر تكلي': 'Alexander Tekle',
  }
  for (const o of projectsSeed.owners) {
    const id = 'u-' + slug(EN[o.name_ar] || o.name_ar)
    users.push({ id, name_ar: o.name_ar, name_en: EN[o.name_ar] || o.name_ar, role: o.name_ar === 'أحمد حلمي' ? 'admin' : 'evaluator', active: true })
    for (const p of o.projects) projects.push({ id: 'p' + String(p.id).padStart(2, '0'), name_ar: p.name_ar, ownerId: id, active: true })
  }
  return { users, projects }
}

export function defaultConfig(): Config {
  const { users, projects } = seedUsersAndProjects()
  return {
    version: 1,
    entity: { name_ar: 'الهيئة الاتحادية للضرائب', name_en: 'Federal Tax Authority' },
    users, projects, mapping: {}, overrides: {},
    cycles: [{ id: '2026-Q1', name: '2026 Q1 — Baseline', start: '2026-01-01', end: '2026-03-31', due: '2026-03-15', status: 'open', prefillFrom: null }],
    currentCycleId: '2026-Q1',
    settings: { scores: { yes: 100, partial: 50, no: 0 }, weights: { high: 3, medium: 2, low: 1, none: 2 }, defaultAssigneeId: null, requireEvidence: true },
    impactOverrides: {},
    updatedAt: new Date().toISOString(),
  }
}
export const emptyReviews = (): ReviewsFile => ({ updatedAt: new Date().toISOString(), cycles: {}, clarifications: {} })
