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

/** Who evaluates a code in a cycle: manual override > owner of the first linked project with an owner > default assignee (core team). */
export function assigneeOf(codeId: string, cycleId: string, cfg: Config): string | null {
  const ov = cfg.overrides[cycleId]?.[codeId]
  if (ov) return ov
  for (const pid of cfg.mapping[codeId] || []) {
    const p = cfg.projects.find(x => x.id === pid && x.active)
    if (p?.ownerId) return p.ownerId
  }
  return cfg.settings.defaultAssigneeId
}

export interface Effective { answer: CodeAnswer | null; userId: string | null; review: Review | null; state: WorkState }

/** The answer that counts for a code in a cycle: the assignee's answer if present, else the most recently updated answer by anyone. */
export function effective(snap: Snapshot, cycleId: string, codeId: string): Effective {
  const assignee = assigneeOf(codeId, cycleId, snap.config)
  let answer: CodeAnswer | null = null, userId: string | null = null
  const own = assignee ? snap.answers[assignee]?.cycles?.[cycleId]?.[codeId] : null
  if (own) { answer = own; userId = assignee }
  else {
    for (const [uid, f] of Object.entries(snap.answers)) {
      const a = f.cycles?.[cycleId]?.[codeId]
      if (a && (!answer || a.updatedAt > answer.updatedAt)) { answer = a; userId = uid }
    }
  }
  const review = snap.reviews.cycles?.[cycleId]?.[codeId] || null
  let state: WorkState = 'none'
  if (answer) {
    state = answer.state
    if (answer.state === 'submitted' && review && review.reviewedAt >= (answer.submittedAt || answer.updatedAt)) state = review.state
  }
  return { answer, userId, review, state }
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
      for (const it of Object.values(e.answer.items)) if (it.clarify?.flag) clar++
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
  rows.forEach((s, i) => { s.rank = i + 1 })
  return rows
}

export function sortIds(a: string, b: string) {
  const ka = a.replace(/b$/, '').split('.').map(Number), kb = b.replace(/b$/, '').split('.').map(Number)
  for (let i = 0; i < 3; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i]
  return a.endsWith('b') ? 1 : -1
}
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
export const now = () => new Date().toISOString()
