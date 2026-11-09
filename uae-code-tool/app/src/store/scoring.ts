import type { Code, Config, Snapshot, CodeAnswer, Review, WorkState, Impact, AnswerStatus } from '../types'
import masterJson from '../data/master.json'
import type { Master } from '../types'

export const master = masterJson as unknown as Master
export const codeById = new Map(master.codes.map(c => [c.id, c]))
export const subById = new Map(master.subpillars.map(s => [s.id, s]))
export const pillarById = new Map(master.pillars.map(p => [p.id, p]))

export function effectiveImpact(code: Code, cfg: Config): Impact | 'none' {
  return cfg.impactOverrides[code.id] || code.impact || 'none'
}

/** Who evaluates a code in a cycle: frozen assignment of a closed cycle > manual override > owner of the first linked
 *  active project > the project manager (settings.defaultAssigneeId). Inactive or unknown people are skipped. */
export function assigneeOf(codeId: string, cycleId: string, cfg: Config): string | null {
  const active = (id?: string | null) => !!id && cfg.users.some(u => u.id === id && u.active) ? id as string : null
  const frozen = cfg.cycles.find(c => c.id === cycleId)?.assignments?.[codeId]
  if (frozen) return frozen
  const ov = active(cfg.overrides[cycleId]?.[codeId])
  if (ov) return ov
  for (const pid of cfg.mapping[codeId] || []) {
    const p = cfg.projects.find(x => x.id === pid && x.active)
    const o = active(p?.ownerId); if (o) return o
  }
  return active(cfg.settings.defaultAssigneeId)
}
/** Snapshot of every code's assignee, stored on a cycle when it is closed. */
export function freezeAssignments(cycleId: string, cfg: Config): Record<string, string> {
  const out: Record<string, string> = {}
  for (const c of master.codes) { const a = assigneeOf(c.id, cycleId, cfg); if (a) out[c.id] = a }
  return out
}
/** Does this review belong to this exact submission? New reviews carry the submission identity; old ones fall back to time order. */
export function reviewApplies(review: Review | null, answer: CodeAnswer | null, userId: string | null): boolean {
  if (!review || !answer || answer.state !== 'submitted') return false
  if (review.userId || review.submittedAt) return review.userId === userId && review.submittedAt === (answer.submittedAt || answer.updatedAt)
  return review.reviewedAt >= (answer.submittedAt || answer.updatedAt)
}

/** Responsible department for a code: the owner's own choice (in their answers file) wins over the configured primary department. */
export function departmentOf(snap: Snapshot, cycleId: string, codeId: string): string | null {
  const cfg = snap.config; const assignee = assigneeOf(codeId, cycleId, cfg)
  const own = assignee ? snap.answers[assignee]?.departments?.[codeId] : null
  const id = own || cfg.deptMapping?.[codeId]?.[0] || null
  return id && cfg.departments?.some(d => d.id === id && d.active) ? id : (cfg.deptMapping?.[codeId]?.[0] || null)
}
export const supportDepartments = (cfg: Config, codeId: string) => (cfg.deptMapping?.[codeId] || []).slice(1)
export function deptName(cfg: Config, id: string | null | undefined, lang: 'ar' | 'en'): string { const d = cfg.departments?.find(x => x.id === id); return d ? (lang === 'ar' ? d.name_ar : d.name_en) : '' }
export interface Effective { answer: CodeAnswer | null; userId: string | null; review: Review | null; state: WorkState }

const RANK: Record<WorkState, number> = { approved: 4, submitted: 3, returned: 2, draft: 1, none: 0 }
/** The answer that counts for a code in a cycle. Candidates are every known person's answer; the one in the most advanced
 *  state wins (approved > submitted > returned > draft), then the assignee's, then the most recently updated. */
export function effective(snap: Snapshot, cycleId: string, codeId: string): Effective {
  const cfg = snap.config
  const assignee = assigneeOf(codeId, cycleId, cfg)
  const review = snap.reviews.cycles?.[cycleId]?.[codeId] || null
  const known = new Set(cfg.users.map(u => u.id))
  let best: Effective | null = null
  for (const [uid, f] of Object.entries(snap.answers)) {
    const a = f.cycles?.[cycleId]?.[codeId]; if (!a || !known.has(uid)) continue
    const state: WorkState = reviewApplies(review, a, uid) ? review!.state : a.state
    const cand: Effective = { answer: a, userId: uid, review, state }
    if (!best) { best = cand; continue }
    const d = RANK[state] - RANK[best.state]
    if (d > 0 || (d === 0 && (uid === assignee || (best.userId !== assignee && (a.updatedAt > best.answer!.updatedAt || (a.updatedAt === best.answer!.updatedAt && uid < (best.userId || ''))))))) best = cand
  }
  return best || { answer: null, userId: null, review, state: 'none' }
}

export function itemScore(status: AnswerStatus | null, cfg: Config): number | null {
  if (!status || status === 'na') return null
  return cfg.settings.scores[status]
}
export function codeScore(answer: CodeAnswer | null, code: Code, cfg: Config): number | null {
  if (!answer) return null
  const vals: number[] = []
  for (const r of code.requirements) { const s = itemScore(answer.items[String(r.n)]?.status ?? null, cfg); if (s !== null) vals.push(s) }
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}
export function isComplete(answer: CodeAnswer | null, code: Code): boolean {
  return !!answer && code.requirements.every(r => !!answer.items[String(r.n)]?.status)
}

export interface Rollup { total: number; answered: number; submitted: number; approved: number; scored: number; score: number | null; weight: number; gaps: number; clarifications: number }
export function rollup(snap: Snapshot, cycleId: string, codes: Code[], approvedOnly: boolean): Rollup {
  const cfg = snap.config
  let answered = 0, submitted = 0, approved = 0, scored = 0, wsum = 0, wtot = 0, gaps = 0, clar = 0
  for (const c of codes) {
    const e = effective(snap, cycleId, c.id)
    if (e.answer) {
      if (isComplete(e.answer, c)) answered++
      if (e.state === 'submitted' || e.state === 'approved') submitted++
      if (e.state === 'approved') approved++
      for (const r of c.requirements) if (e.answer.items[String(r.n)]?.clarify?.flag) clar++
    }
    const counts = approvedOnly ? e.state === 'approved' : isComplete(e.answer, c)
    if (counts) {
      const s = codeScore(e.answer, c, cfg)
      if (s !== null) { const w = cfg.settings.weights[effectiveImpact(c, cfg)]; wsum += s * w; wtot += w; scored++; if (s < 100) gaps++ }
    }
  }
  return { total: codes.length, answered, submitted, approved, scored, score: wtot ? wsum / wtot : null, weight: wtot, gaps, clarifications: clar }
}

export interface Standing { userId: string; rank: number; points: number; approvedPct: number; score: number | null; total: number; approved: number; answered: number }
/** Championship standings: evaluators ranked by points = 0.5 × approval rate + 0.5 × compliance on answered codes. */
export function standings(snap: Snapshot, cycleId: string): Standing[] {
  const cfg = snap.config
  const rows = cfg.users.filter(u => u.active && u.role !== 'viewer').map(u => {
    const codes = master.codes.filter(c => assigneeOf(c.id, cycleId, cfg) === u.id)
    const r = rollup(snap, cycleId, codes, false)
    const approvedPct = r.total ? (r.approved / r.total) * 100 : 0
    const points = r.total ? 0.5 * approvedPct + 0.5 * (r.score ?? 0) : 0
    return { userId: u.id, rank: 0, points, approvedPct, score: r.score, total: r.total, approved: r.approved, answered: r.answered }
  }).filter(s => s.total > 0).sort((a, b) => b.points - a.points || b.approved - a.approved)
  // competition ranking: identical results share a rank
  rows.forEach((s, i) => { const prev = rows[i - 1]; s.rank = prev && prev.points === s.points && prev.approved === s.approved ? prev.rank : i + 1 })
  return rows
}

export function sortIds(a: string, b: string) {
  const ka = a.replace(/b$/, '').split('.').map(Number), kb = b.replace(/b$/, '').split('.').map(Number)
  for (let i = 0; i < 3; i++) if (ka[i] !== kb[i]) return (ka[i] ?? -1) - (kb[i] ?? -1)
  return a === b ? 0 : a.endsWith('b') ? 1 : -1
}
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
export const now = () => new Date().toISOString()
