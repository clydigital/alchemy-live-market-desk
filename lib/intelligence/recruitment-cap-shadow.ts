import type { FreshNewsRecruitment, RecruitmentEvidenceCandidate } from "./fresh-news-recruitment.ts";

export const RECRUITMENT_CAP_SHADOW_VERSION = "market-belief-recruitment-cap-shadow-v1" as const;
export const PROPOSED_FRESH_RECRUITMENT_CAP = 36;

export type RecruitmentCapShadow = {
  version: typeof RECRUITMENT_CAP_SHADOW_VERSION;
  currentCandidateCount: number;
  proposedCandidateCap: number;
  proposedCandidateCount: number;
  omittedCandidateCount: number;
  omittedMateriality70Count: number;
  omittedMateriality85Count: number;
  omittedFreshness90Count: number;
  omittedTier1Count: number;
  omittedEventOutcomeCount: number;
  omittedMaxMateriality: number | null;
  omittedMaxFreshness: number | null;
};

function count(candidates: RecruitmentEvidenceCandidate[], predicate: (candidate: RecruitmentEvidenceCandidate) => boolean) {
  return candidates.filter(predicate).length;
}

/**
 * Measurement-only view of a smaller Market Belief fresh-evidence packet.
 *
 * The recruiter already sorts deterministically by freshness, upstream
 * materiality, source tier and receipt time. This helper deliberately preserves
 * that order and never mutates or replaces `recruitment.candidates`.
 */
export function buildRecruitmentCapShadow(
  recruitment: Pick<FreshNewsRecruitment, "candidates">,
  proposedCandidateCap = PROPOSED_FRESH_RECRUITMENT_CAP,
): RecruitmentCapShadow {
  const cap = Math.max(0, Math.floor(proposedCandidateCap));
  const current = recruitment.candidates;
  const omitted = current.slice(cap);

  return {
    version: RECRUITMENT_CAP_SHADOW_VERSION,
    currentCandidateCount: current.length,
    proposedCandidateCap: cap,
    proposedCandidateCount: Math.min(current.length, cap),
    omittedCandidateCount: omitted.length,
    omittedMateriality70Count: count(omitted, (candidate) => candidate.upstreamMateriality >= 70),
    omittedMateriality85Count: count(omitted, (candidate) => candidate.upstreamMateriality >= 85),
    omittedFreshness90Count: count(omitted, (candidate) => candidate.freshnessScore >= 90),
    omittedTier1Count: count(omitted, (candidate) => candidate.evidence.sourceTier <= 1),
    omittedEventOutcomeCount: count(omitted, (candidate) => candidate.nature === "event_outcome"),
    omittedMaxMateriality: omitted.length ? Math.max(...omitted.map((candidate) => candidate.upstreamMateriality)) : null,
    omittedMaxFreshness: omitted.length ? Math.max(...omitted.map((candidate) => candidate.freshnessScore)) : null,
  };
}
