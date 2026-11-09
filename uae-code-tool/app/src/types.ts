export type Impact = 'high' | 'medium' | 'low'
export type Lang = 'ar' | 'en'
export type Role = 'admin' | 'evaluator' | 'viewer'
export type AnswerStatus = 'yes' | 'partial' | 'no' | 'na'
export type CycleStatus = 'planning' | 'open' | 'review' | 'closed'
export type WorkState = 'none' | 'draft' | 'submitted' | 'returned' | 'approved'

export interface Pillar { id: string; name_ar: string; name_en: string; desc_ar: string; desc_en: string }
export interface SubPillar { id: string; pillar: string; name_ar: string; name_en: string }
export interface Item { n: number; text_ar: string; text_en: string }
export interface Code {
  id: string; pdf_id: string; sub: string; pillar: string; impact: Impact | null
  desc_ar: string; desc_en: string; requirements: Item[]; criteria: Item[]; pdf_page: number; flags: string[]
}
export interface Master { pillars: Pillar[]; subpillars: SubPillar[]; codes: Code[] }

export interface User { id: string; name_ar: string; name_en: string; role: Role; email?: string; active: boolean; photo?: string }
export interface Project { id: string; name_ar: string; name_en?: string; ownerId: string | null; active: boolean }
export interface Cycle { id: string; name: string; name_en?: string; start: string; end: string; due: string; status: CycleStatus; prefillFrom?: string | null
  /** Assignee per code frozen when the cycle is closed, so later mapping edits never rewrite history. */
  assignments?: Record<string, string> }
export interface Settings {
  scores: { yes: number; partial: number; no: number }
  weights: { high: number; medium: number; low: number; none: number }
  /** Fulfilment points per requirement by the code's impact (Yes earns all, Partial half, No none; N/A excluded). */
  points: { high: number; medium: number; low: number; none: number }
  defaultAssigneeId: string | null
  requireEvidence: boolean
}
export interface Department { id: string; name_ar: string; name_en: string; active: boolean }
export interface Config {
  version: number
  /** Organisational units from the FTA structure decree; the responsible department per code (first = primary, rest = supporting). */
  departments: Department[]
  deptMapping: Record<string, string[]>
  /** Codes whose department mapping is uncertain: the owner must confirm the department before submitting. */
  deptConfirm: Record<string, true>
  /** Cycle ids renamed by a migration (old -> new); load() moves any file still carrying the old key. */
  renamedCycles?: Record<string, string>
  entity: { name_ar: string; name_en: string }
  users: User[]
  projects: Project[]
  mapping: Record<string, string[]>            // codeId -> projectIds
  overrides: Record<string, Record<string, string>> // cycleId -> codeId -> userId
  cycles: Cycle[]
  currentCycleId: string | null
  settings: Settings
  impactOverrides: Record<string, Impact>
  updatedAt: string
}

export interface Evidence { id: string; type: 'link' | 'file'; title: string; url: string; addedAt: string; addedBy: string }
export interface ItemAnswer {
  status: AnswerStatus | null
  justification?: string
  note?: string
  evidence: Evidence[]
  projectId?: string | null
  service?: string
  departmentId?: string | null                           // responsible department for this requirement when it differs from the code's
  clarify?: { flag: boolean; question: string; raisedAt?: string }
}
export interface CodeAnswer {
  state: 'draft' | 'submitted'
  updatedAt: string
  submittedAt?: string
  items: Record<string, ItemAnswer>      // requirement n -> answer
  carriedFrom?: string | null
  deptConfirmed?: boolean                // owner confirmed the responsible department (required when the mapping is flagged)
}
export interface AnswersFile {
  userId: string
  updatedAt: string
  cycles: Record<string, Record<string, CodeAnswer>>   // cycleId -> codeId -> answer
  notes?: Record<string, PersonalNote>                  // codeId -> private follow-up note (not cycle-bound, never exported)
  departments?: Record<string, string>                  // codeId -> responsible department chosen by this person for codes they own
}
export interface PersonalNote { text: string; updatedAt: string }
export interface Review {
  state: 'approved' | 'returned'
  comment?: string
  reviewedBy: string
  reviewedAt: string
  evidenceVerified?: boolean
  /** Identity of the submission that was reviewed (who submitted and when). A review only applies to that exact submission. */
  userId?: string
  submittedAt?: string
}
export interface Clarification { answer: string; answeredBy: string; answeredAt: string }
export interface ReviewsFile {
  updatedAt: string
  cycles: Record<string, Record<string, Review>>                      // cycleId -> codeId -> review
  clarifications: Record<string, Record<string, Record<string, Clarification>>> // cycleId -> codeId -> reqN -> answer
}
export interface AuditEntry { at: string; by: string; action: string; target: string; detail?: string }

export interface Snapshot {
  config: Config
  answers: Record<string, AnswersFile>  // userId -> file
  reviews: ReviewsFile
  audit: AuditEntry[]
}
