import type { Config, ReviewsFile, User, Project } from '../types'
import projectsSeed from '../data/projects.json'

const PROJECT_EN: Record<number, string> = {
  1: 'Service Development Strategy', 2: 'Pilot Services Observatory and Local Service Performance Management', 3: 'Service Cards', 4: 'Voice of the Customer (Customer Councils)',
  5: 'Services 2.0 Transformation Tracks', 6: 'Proactive Services', 7: 'Look and Quality of Digital Services', 8: 'Customer Pulse (Integration and Monitoring)',
  9: 'Authority Website', 10: 'Individual Guides System for Service Development', 11: 'Change Management', 12: 'Zero Government Bureaucracy', 13: 'Organisational Structure Development',
  14: 'Employee Journey in Handling Service Requests', 15: 'Opinion Surveys', 16: 'Specialised Programmes for Service Staff', 17: 'Customer Happiness Training Programme (Soft Skills)',
  18: 'Specialised Training Programme in Service Development', 19: 'Developing Relationships with Large Companies', 20: 'Contact Centre Operating Model Assessment',
  21: 'Service Level Agreement Management', 22: 'Request Volume and Capacity', 23: 'Obtaining Government Service Awards', 24: 'Participation in Awards',
  25: 'Developing the Switchboard Inbound Call Process', 26: 'Service Development Hackathon', 27: 'Simplified User Guide for Every Service', 28: 'Spreading a Culture of Service Excellence Internally',
  29: 'Marketing and Media Campaigns', 30: 'Star Rating System', 31: 'Complaints Management', 32: 'Suggestions Management', 33: 'Enquiries Management', 34: 'Customer Segmentation',
  35: 'Service Delivery Quality Assessment', 36: 'Digital Customer Journey', 37: 'Digital Channels Assessment', 38: 'Notifications and Request Tracking Management', 39: 'Service Welfare Development',
}
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
    for (const p of o.projects) projects.push({ id: 'p' + String(p.id).padStart(2, '0'), name_ar: p.name_ar, name_en: PROJECT_EN[p.id] || '', ownerId: id, active: true })
  }
  return { users, projects }
}

export function defaultConfig(): Config {
  const { users, projects } = seedUsersAndProjects()
  return {
    version: 1,
    entity: { name_ar: 'الهيئة الاتحادية للضرائب', name_en: 'Federal Tax Authority' },
    users, projects, mapping: {}, overrides: {},
    cycles: [{ id: '2026-Q4', name: 'الربع الرابع 2026 — خط الأساس', name_en: '2026 Q4 — Baseline', start: '2026-10-01', end: '2026-12-31', due: '2026-12-15', status: 'open', prefillFrom: null }],
    currentCycleId: '2026-Q4',
    settings: { scores: { yes: 100, partial: 50, no: 0 }, weights: { high: 3, medium: 2, low: 1, none: 2 }, defaultAssigneeId: null, requireEvidence: true },
    impactOverrides: {},
    updatedAt: new Date().toISOString(),
  }
}
export const emptyReviews = (): ReviewsFile => ({ updatedAt: new Date().toISOString(), cycles: {}, clarifications: {} })
