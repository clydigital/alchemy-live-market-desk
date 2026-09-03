import type { EvidencePackItem } from "./schemas.ts";

export const MAX_FRESH_RECRUITMENT_CANDIDATES = 48;

export type EvidenceNature =
  | "fresh_news"
  | "event_outcome"
  | "scheduled_event"
  | "creator_lead"
  | "research_context";

export type RecruitmentEvidenceCandidate = {
  evidence: EvidencePackItem;
  nature: EvidenceNature;
  ageHours: number | null;
  freshnessScore: number;
  upstreamMateriality: number;
  eligible: boolean;
  exclusionReason: "scheduled_only" | "stale" | "future_timestamp" | "duplicate" | "capacity" | null;
  duplicateOfEvidenceId: string | null;
};

export type FreshNewsRecruitment = {
  asOf: string;
  evidenceCount: number;
  eligibleCount: number;
  scheduledOnlyCount: number;
  staleCount: number;
  futureTimestampCount: number;
  duplicateCount: number;
  candidates: RecruitmentEvidenceCandidate[];
  diagnostics: RecruitmentEvidenceCandidate[];
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function timestamp(value: string | null | undefined) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function itemKey(item: EvidencePackItem) {
  const value = item.structuredPayload?.itemKey;
  return typeof value === "string" ? value : "";
}

function evidenceNature(item: EvidencePackItem): EvidenceNature {
  const explicit = item.structuredPayload?.evidenceNature;
  if (["fresh_news", "event_outcome", "scheduled_event", "creator_lead", "research_context"].includes(String(explicit))) {
    return explicit as EvidenceNature;
  }
  if (itemKey(item).startsWith("calendar:")) {
    const text = `${item.claim} ${item.summary || ""} ${String(item.structuredPayload?.title || "")}`;
    return /\breleased\b|actual:\s*(?!awaiting)/i.test(text) ? "event_outcome" : "scheduled_event";
  }
  if (item.evidenceClass === "transcript") return "creator_lead";
  if (item.evidenceClass === "research_analysis") return "research_context";
  return "fresh_news";
}

function freshnessWindowHours(item: EvidencePackItem, nature: EvidenceNature) {
  if (nature === "event_outcome") return 120;
  if (item.evidenceClass === "market_observation" || item.evidenceClass === "derived_metric") return 36;
  if (item.evidenceClass === "official_release" || item.evidenceClass === "company_primary" || item.evidenceClass === "regulatory_filing") return 120;
  if (nature === "creator_lead") return 96;
  if (nature === "research_context") return 168;
  return 72;
}

function ageHours(item: EvidencePackItem, nature: EvidenceNature, asOfMs: number) {
  const reference = nature === "event_outcome"
    ? timestamp(item.eventAt) ?? timestamp(item.publishedAt) ?? timestamp(item.availableAt)
    : timestamp(item.publishedAt) ?? timestamp(item.availableAt) ?? timestamp(item.eventAt);
  return reference === null ? null : (asOfMs - reference) / 3_600_000;
}

function freshnessScore(item: EvidencePackItem, nature: EvidenceNature, age: number | null) {
  if (nature === "scheduled_event" || age === null || age < -1) return 0;
  if (age <= 3) return 100;
  const window = freshnessWindowHours(item, nature);
  return clamp(100 * (1 - ((age - 3) / Math.max(1, window - 3))));
}

function words(value: string) {
  return new Set(value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !["that", "this", "with", "from", "have", "will", "said", "says", "market"].includes(word)));
}

function similarity(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const word of left) if (right.has(word)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function compareCandidates(left: RecruitmentEvidenceCandidate, right: RecruitmentEvidenceCandidate) {
  return right.freshnessScore - left.freshnessScore
    || right.upstreamMateriality - left.upstreamMateriality
    || left.evidence.sourceTier - right.evidence.sourceTier
    || (timestamp(right.evidence.receivedAt) ?? 0) - (timestamp(left.evidence.receivedAt) ?? 0)
    || left.evidence.id.localeCompare(right.evidence.id);
}

/**
 * Deterministic front door for the semantic recruiter. It separates scheduled
 * events from observed news, computes publication-time freshness, and removes
 * near-identical copy before the existing Market Belief model call clusters it.
 * It deliberately does not impose a materiality threshold.
 */
export function buildFreshNewsRecruitment(
  evidence: EvidencePackItem[],
  asOf: string,
  maximum = MAX_FRESH_RECRUITMENT_CANDIDATES,
): FreshNewsRecruitment {
  const parsedAsOf = timestamp(asOf);
  if (parsedAsOf === null) throw new Error("Fresh-news recruitment requires a valid as-of timestamp.");

  const diagnostics = evidence.map((item): RecruitmentEvidenceCandidate => {
    const nature = evidenceNature(item);
    const age = ageHours(item, nature, parsedAsOf);
    const freshness = freshnessScore(item, nature, age);
    const upstreamMateriality = clamp(finiteNumber(item.structuredPayload?.materiality) ?? 50);
    const exclusionReason = nature === "scheduled_event"
      ? "scheduled_only" as const
      : age !== null && age < -1
        ? "future_timestamp" as const
        : freshness <= 0
          ? "stale" as const
          : null;
    return {
      evidence: item,
      nature,
      ageHours: age === null ? null : Math.round(age * 10) / 10,
      freshnessScore: freshness,
      upstreamMateriality,
      eligible: exclusionReason === null,
      exclusionReason,
      duplicateOfEvidenceId: null,
    };
  }).sort(compareCandidates);

  const retained: RecruitmentEvidenceCandidate[] = [];
  const retainedWords = new Map<string, Set<string>>();
  for (const candidate of diagnostics) {
    if (!candidate.eligible) continue;
    const candidateWords = words(`${candidate.evidence.claim} ${candidate.evidence.summary || ""}`);
    const duplicate = retained.find((prior) => {
      const overlap = similarity(candidateWords, retainedWords.get(prior.evidence.id) || new Set());
      const sameAncestry = Boolean(candidate.evidence.ancestryGroupId)
        && candidate.evidence.ancestryGroupId === prior.evidence.ancestryGroupId;
      return overlap >= 0.96 || (sameAncestry && overlap >= 0.86);
    });
    if (duplicate) {
      candidate.eligible = false;
      candidate.exclusionReason = "duplicate";
      candidate.duplicateOfEvidenceId = duplicate.evidence.id;
      continue;
    }
    retained.push(candidate);
    retainedWords.set(candidate.evidence.id, candidateWords);
  }

  const candidates = retained.slice(0, Math.max(0, maximum));
  const selectedIds = new Set(candidates.map((candidate) => candidate.evidence.id));
  for (const candidate of retained.slice(candidates.length)) {
    candidate.eligible = false;
    candidate.exclusionReason = "capacity";
  }

  return {
    asOf,
    evidenceCount: evidence.length,
    eligibleCount: selectedIds.size,
    scheduledOnlyCount: diagnostics.filter((item) => item.exclusionReason === "scheduled_only").length,
    staleCount: diagnostics.filter((item) => item.exclusionReason === "stale").length,
    futureTimestampCount: diagnostics.filter((item) => item.exclusionReason === "future_timestamp").length,
    duplicateCount: diagnostics.filter((item) => item.exclusionReason === "duplicate").length,
    candidates,
    diagnostics,
  };
}
