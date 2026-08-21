import type { EvidencePackItem, ExistingStoryPackItem, StoryReviewTargetPackItem } from "./schemas.ts";

export const MAX_STORY_REVIEW_TARGETS = 4;
export const MAX_STORY_REVIEW_EVIDENCE = 10;

export type StoryReviewReason =
  | "explicit_queue"
  | "criteria_evidence"
  | "overdue_critical_debt"
  | "contradictory_evidence"
  | "supporting_evidence"
  | "catalyst_due"
  | "review_age";

export type StoryReviewStory = ExistingStoryPackItem & {
  lastEvaluatedAt: string | null;
  lastEvidenceAt: string | null;
  nextCatalysts: string[];
};

export type StoryReviewQueueItem = {
  id: string;
  storyId: string;
  status: string;
  reason: string;
  priority: number;
  availableAt: string;
  createdAt: string;
};

export type StoryReviewDebt = {
  storyId: string | null;
  debtKey: string;
  severity: string;
  status: string;
  nextCheckAt: string | null;
};

export type StoryEvidenceLink = {
  storyId: string;
  evidenceId: string;
  evidenceRole: string;
  linkedAt: string;
};

const REASON_RANK: Record<StoryReviewReason, number> = {
  explicit_queue: 1,
  criteria_evidence: 2,
  overdue_critical_debt: 3,
  contradictory_evidence: 4,
  supporting_evidence: 5,
  catalyst_due: 6,
  review_age: 7,
};

const EVIDENCE_ROLE_RANK: Record<string, number> = {
  invalidation: 1,
  confirmation: 1,
  contradicting: 2,
  supporting: 3,
  decisive: 3,
  context: 4,
};

function milliseconds(value: string | null | undefined) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function reviewAgeHours(status: string) {
  const normalised = status.toLowerCase();
  if (["publish", "published", "confirmed"].includes(normalised)) return 24;
  if (["develop", "developing"].includes(normalised)) return 48;
  return 72;
}

function catalystTime(value: string) {
  const iso = value.match(/\b\d{4}-\d{2}-\d{2}(?:[T ][0-9:.+-Z]+)?\b/)?.[0];
  return milliseconds(iso ?? null);
}

function relevantEvidenceForStory(
  story: StoryReviewStory,
  evidence: EvidencePackItem[],
  links: StoryEvidenceLink[],
) {
  const linkByEvidence = new Map(links.filter((link) => link.storyId === story.id).map((link) => [link.evidenceId, link]));
  return evidence
    .filter((item) => linkByEvidence.has(item.id) || item.affectedTopics.includes(story.slug))
    .sort((left, right) => {
      const leftRole = linkByEvidence.get(left.id)?.evidenceRole ?? "context";
      const rightRole = linkByEvidence.get(right.id)?.evidenceRole ?? "context";
      return (EVIDENCE_ROLE_RANK[leftRole] ?? 9) - (EVIDENCE_ROLE_RANK[rightRole] ?? 9)
        || left.sourceTier - right.sourceTier
        || (milliseconds(right.eventAt) ?? 0) - (milliseconds(left.eventAt) ?? 0)
        || left.id.localeCompare(right.id);
    })
    .slice(0, MAX_STORY_REVIEW_EVIDENCE);
}

export function selectStoryReviewTargets(input: {
  stories: StoryReviewStory[];
  evidence: EvidencePackItem[];
  evidenceLinks: StoryEvidenceLink[];
  queue: StoryReviewQueueItem[];
  debt: StoryReviewDebt[];
  now: Date;
  maxTargets?: number;
}): StoryReviewTargetPackItem[] {
  const nowMs = input.now.getTime();
  const candidates = input.stories.flatMap((story) => {
    const availableQueue = input.queue.filter((item) => item.storyId === story.id
      && ["pending", "retryable"].includes(item.status)
      && (milliseconds(item.availableAt) ?? 0) <= nowMs);
    const linkRoles = new Map(input.evidenceLinks.filter((link) => link.storyId === story.id).map((link) => [link.evidenceId, link.evidenceRole]));
    const lastEvaluated = milliseconds(story.lastEvaluatedAt) ?? 0;
    const relevantEvidence = relevantEvidenceForStory(story, input.evidence, input.evidenceLinks);
    const fresh = relevantEvidence.filter((item) => (milliseconds(item.eventAt ?? item.publishedAt) ?? 0) > lastEvaluated);
    const reasons: StoryReviewReason[] = [];
    if (availableQueue.length) reasons.push("explicit_queue");
    if (fresh.some((item) => ["confirmation", "invalidation"].includes(linkRoles.get(item.id) ?? ""))) reasons.push("criteria_evidence");
    if (input.debt.some((debt) => debt.storyId === story.id
      && debt.status === "open"
      && debt.severity === "critical"
      && (milliseconds(debt.nextCheckAt) ?? Number.POSITIVE_INFINITY) <= nowMs)) reasons.push("overdue_critical_debt");
    if (fresh.some((item) => item.supportDirection === "contradicting" || linkRoles.get(item.id) === "contradicting")) reasons.push("contradictory_evidence");
    if (fresh.some((item) => item.supportDirection === "supporting" || ["supporting", "decisive"].includes(linkRoles.get(item.id) ?? ""))) reasons.push("supporting_evidence");
    if (story.nextCatalysts.some((catalyst) => {
      const due = catalystTime(catalyst);
      return due !== null && due <= nowMs && due > lastEvaluated;
    })) reasons.push("catalyst_due");
    if (nowMs - lastEvaluated >= reviewAgeHours(story.status) * 60 * 60 * 1_000) reasons.push("review_age");
    if (!reasons.length) return [];

    const reason = [...reasons].sort((left, right) => REASON_RANK[left] - REASON_RANK[right])[0];
    return [{
      story,
      reason,
      reasonRank: REASON_RANK[reason],
      reasons: [...new Set(reasons)].sort((left, right) => REASON_RANK[left] - REASON_RANK[right]),
      queueIds: availableQueue.map((item) => item.id).sort(),
      relevantEvidence,
      selectedAt: input.now.toISOString(),
      queuePriority: Math.max(0, ...availableQueue.map((item) => item.priority)),
      dueAt: availableQueue.map((item) => milliseconds(item.createdAt) ?? nowMs).sort((a, b) => a - b)[0]
        ?? lastEvaluated,
    }];
  });

  return candidates
    .sort((left, right) => left.reasonRank - right.reasonRank
      || right.queuePriority - left.queuePriority
      || left.dueAt - right.dueAt
      || left.story.id.localeCompare(right.story.id))
    .slice(0, Math.max(0, Math.min(MAX_STORY_REVIEW_TARGETS, input.maxTargets ?? MAX_STORY_REVIEW_TARGETS)))
    .map(({ queuePriority: _queuePriority, dueAt: _dueAt, ...target }) => target);
}

export function materialAssessmentHasEligibleEvidence(
  disposition: string,
  evidenceIds: string[],
  target: StoryReviewTargetPackItem,
) {
  if (disposition === "unchanged") return true;
  const selected = new Set(evidenceIds);
  return target.relevantEvidence.some((item) => selected.has(item.id) && item.evidenceClass !== "transcript");
}
