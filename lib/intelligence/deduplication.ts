import { createHash } from "node:crypto";

import {
  MAX_FEATURED_STORIES,
  MAX_PUBLISHED_STORIES,
  type DuplicateExceptionProof,
  type StoryCandidate,
  type StoryComparison,
} from "./contracts.ts";

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "in", "into",
  "is", "it", "its", "of", "on", "or", "that", "the", "their", "this", "to", "was", "were", "with",
]);

const EVENT_PATTERNS: Array<[string, RegExp]> = [
  ["us_payrolls", /\b(nonfarm|payrolls?|employment situation|jobs report|nfp)\b/i],
  ["us_cpi", /\b(consumer price|cpi|inflation report)\b/i],
  ["us_pce", /\b(personal consumption|core pce|pce inflation)\b/i],
  ["fomc", /\b(fomc|federal reserve|fed decision|fed meeting)\b/i],
  ["ecb", /\b(ecb|european central bank)\b/i],
  ["boe", /\b(boe|bank of england)\b/i],
  ["boj", /\b(boj|bank of japan)\b/i],
  ["oil_disruption", /\b(hormuz|oil disruption|crude supply|refining outage)\b/i],
];

function clean(value: string | null | undefined) {
  return (value || "").toLowerCase().replace(/[^a-z0-9%$]+/g, " ").trim();
}

function tokens(value: string | null | undefined) {
  return new Set(clean(value).split(/\s+/).filter((token) => (token.length > 2 || /^\d+$/.test(token)) && !STOP_WORDS.has(token)));
}

function jaccard(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function arrayOverlap(left: string[], right: string[]) {
  return jaccard(new Set(left.map(clean).filter(Boolean)), new Set(right.map(clean).filter(Boolean)));
}

function disjoint(left: string[], right: string[]) {
  if (!left.length || !right.length) return false;
  const rightSet = new Set(right.map(clean));
  return left.every((value) => !rightSet.has(clean(value)));
}

export function canonicalEventSignature(value: string) {
  for (const [key, pattern] of EVENT_PATTERNS) if (pattern.test(value)) return key;
  return [...tokens(value)].sort().slice(0, 12).join("_");
}

/** A future catalyst must not redefine the event a persistent Story represents. */
export function canonicalStoryEventSignature(story: Pick<StoryCandidate, "title" | "thesis" | "causalMechanism">) {
  return canonicalEventSignature(`${story.title} ${story.thesis} ${story.causalMechanism}`);
}

function candidateEventSignature(candidate: StoryCandidate) {
  const explicit = clean(candidate.eventSignature);
  if (explicit) return canonicalEventSignature(explicit);
  return canonicalEventSignature(`${candidate.title} ${candidate.thesis} ${candidate.nextCatalysts.join(" ")}`);
}

export function noveltyFingerprint(candidate: StoryCandidate) {
  const payload = [
    candidateEventSignature(candidate),
    [...tokens(candidate.thesis)].sort().join(" "),
    [...tokens(candidate.causalMechanism)].sort().join(" "),
    candidate.affectedAssets.map(clean).sort().join(" "),
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

function exceptionProof(candidate: StoryCandidate, existing: StoryCandidate): DuplicateExceptionProof {
  const mechanismSimilarity = jaccard(tokens(candidate.causalMechanism), tokens(existing.causalMechanism));
  const assetSimilarity = arrayOverlap(candidate.affectedAssets, existing.affectedAssets);
  const confirmationSimilarity = arrayOverlap(candidate.confirmationCriteria, existing.confirmationCriteria);
  const invalidationSimilarity = arrayOverlap(candidate.invalidationCriteria, existing.invalidationCriteria);
  const independentEvidenceDistinct = disjoint(candidate.decisiveEvidenceIds, existing.decisiveEvidenceIds)
    && disjoint(candidate.sourceAncestryGroupIds, existing.sourceAncestryGroupIds);
  const proof = {
    causalMechanismDistinct: Boolean(candidate.causalMechanism && existing.causalMechanism && mechanismSimilarity < 0.45),
    affectedMarketDistinct: Boolean(candidate.affectedAssets.length && existing.affectedAssets.length && assetSimilarity < 0.25),
    independentEvidenceDistinct,
    confirmationAndInvalidationDistinct: Boolean(
      candidate.confirmationCriteria.length
      && existing.confirmationCriteria.length
      && candidate.invalidationCriteria.length
      && existing.invalidationCriteria.length
      && confirmationSimilarity < 0.5
      && invalidationSimilarity < 0.5
    ),
    satisfied: false,
  };
  proof.satisfied = proof.causalMechanismDistinct
    && proof.affectedMarketDistinct
    && proof.independentEvidenceDistinct
    && proof.confirmationAndInvalidationDistinct;
  return proof;
}

export function compareStoryCandidates(candidate: StoryCandidate, existing: StoryCandidate): StoryComparison {
  const candidateEvent = candidateEventSignature(candidate);
  const existingEvent = candidateEventSignature(existing);
  const sameEvent = Boolean(candidateEvent && existingEvent && candidateEvent === existingEvent);
  const thesisSimilarity = jaccard(tokens(`${candidate.title} ${candidate.thesis}`), tokens(`${existing.title} ${existing.thesis}`));
  const mechanismSimilarity = jaccard(tokens(candidate.causalMechanism), tokens(existing.causalMechanism));
  const assetSimilarity = arrayOverlap(candidate.affectedAssets, existing.affectedAssets);
  const evidenceSimilarity = arrayOverlap(candidate.decisiveEvidenceIds, existing.decisiveEvidenceIds);
  const similarityScore = Math.round(100 * (
    (sameEvent ? 0.35 : 0)
    + thesisSimilarity * 0.25
    + mechanismSimilarity * 0.2
    + assetSimilarity * 0.1
    + evidenceSimilarity * 0.1
  ));
  const proof = exceptionProof(candidate, existing);

  if (sameEvent && !proof.satisfied) {
    return {
      classification: "duplicate",
      similarityScore,
      sameEvent,
      duplicateOfId: existing.id || existing.slug || null,
      exceptionProof: proof,
      rationale: "The same evidence event is already represented and the candidate does not prove a distinct mechanism, affected market, independent evidence, and separate confirmation/invalidation criteria.",
    };
  }

  if (similarityScore >= 72 && !proof.satisfied) {
    return {
      classification: "existing_story_update",
      similarityScore,
      sameEvent,
      duplicateOfId: existing.id || existing.slug || null,
      exceptionProof: proof,
      rationale: "The candidate is materially closer to an update of the existing causal thesis than a new Story.",
    };
  }

  return {
    classification: sameEvent ? "related_distinct" : "new_story",
    similarityScore,
    sameEvent,
    duplicateOfId: null,
    exceptionProof: proof,
    rationale: sameEvent
      ? "The candidate cleared every same-event exception test."
      : "No existing Story represents the same event and causal thesis.",
  };
}

export type QualifiedStorySelection = {
  selected: StoryCandidate[];
  excluded: Array<{ story: StoryCandidate; comparison: StoryComparison }>;
};

function recencyTimestamp(story: StoryCandidate) {
  if (!story.recencyAt) return 0;
  const parsed = Date.parse(story.recencyAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

function comparePublicationPriority(left: StoryCandidate, right: StoryCandidate) {
  return right.qualificationScore - left.qualificationScore
    || right.confidence - left.confidence
    || recencyTimestamp(right) - recencyTimestamp(left)
    || (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER);
}

function compareFeaturedPriority(left: StoryCandidate, right: StoryCandidate) {
  return recencyTimestamp(right) - recencyTimestamp(left)
    || right.qualificationScore - left.qualificationScore
    || right.confidence - left.confidence
    || (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER);
}

export function selectQualifiedStories(candidates: StoryCandidate[], maximum = MAX_PUBLISHED_STORIES): QualifiedStorySelection {
  const eligible = candidates
    .filter((story) => story.publicationEligible)
    .filter((story) => !["invalidated", "archived"].includes(story.lifecycleStatus))
    .sort(comparePublicationPriority);

  const selected: StoryCandidate[] = [];
  const excluded: QualifiedStorySelection["excluded"] = [];
  for (const story of eligible) {
    const conflict = selected
      .map((existing) => compareStoryCandidates(story, existing))
      .find((comparison) => comparison.classification === "duplicate" || comparison.classification === "existing_story_update");
    if (conflict) {
      excluded.push({ story, comparison: conflict });
      continue;
    }
    if (selected.length < Math.max(0, Math.min(MAX_PUBLISHED_STORIES, maximum))) selected.push(story);
  }
  return { selected, excluded };
}

/** The featured rail is a recency-first view over the persistent published set. */
export function selectFeaturedStories(candidates: StoryCandidate[], maximum = MAX_FEATURED_STORIES) {
  return [...candidates]
    .sort(compareFeaturedPriority)
    .slice(0, Math.max(0, Math.min(MAX_FEATURED_STORIES, maximum)));
}
