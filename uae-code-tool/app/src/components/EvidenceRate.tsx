import { useApp } from '../store/state'
import { useToast } from './ui'
import type { Evidence, EvidenceVerdict, ReviewsFile } from '../types'

/** Reviewer verdict on one evidence link (strong / weak). Reviewers and admins can set it; everyone else sees it. */
export function EvidenceRate({ codeId, ev }: { codeId: string; ev: Evidence }) {
  const { t, snap, user, canReview, cycleId, saveReviews } = useApp(); const toast = useToast(); const cy = cycleId!
  const cur = snap?.reviews.evidenceRatings?.[cy]?.[codeId]?.[ev.id]?.rating ?? null
  const set = async (v: EvidenceVerdict) => {
    const r: ReviewsFile = JSON.parse(JSON.stringify(snap!.reviews)); r.evidenceRatings = r.evidenceRatings || {}; r.evidenceRatings[cy] = r.evidenceRatings[cy] || {}; r.evidenceRatings[cy][codeId] = r.evidenceRatings[cy][codeId] || {}
    if (cur === v) delete r.evidenceRatings[cy][codeId][ev.id]; else r.evidenceRatings[cy][codeId][ev.id] = { rating: v, by: user!.id, at: new Date().toISOString() }
    try { await saveReviews(r, `rate ${codeId} ${ev.id} ${cur === v ? 'clear' : v}`) } catch (e) { toast(String((e as Error).message || t('saveFailed')), 'bad') }
  }
  if (!canReview) return cur ? <span className={`pill ${cur === 'strong' ? 'pill-ok' : 'pill-bad'}`} title={t('reviewerRating')}>{t(cur === 'strong' ? 'rateStrong' : 'rateWeak')}</span> : null
  return <span className="seg seg-q text-xs" role="group" aria-label={t('reviewerRating')} title={t('reviewerRating')}>
    <button type="button" aria-pressed={cur === 'strong'} className={cur === 'strong' ? '!bg-ok-soft !text-ok-ink' : ''} onClick={() => set('strong')}>{t('rateStrong')}</button>
    <button type="button" aria-pressed={cur === 'weak'} className={cur === 'weak' ? '!bg-bad-soft !text-bad-ink' : ''} onClick={() => set('weak')}>{t('rateWeak')}</button>
  </span>
}
