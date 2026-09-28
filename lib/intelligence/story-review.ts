import type { EvidencePackItem, ExistingStoryPackItem, StoryReviewTargetPackItem } from "./schemas.ts";
import { isCanonicalEligibleEvidence, isScheduledEvidence } from "./source-verification.ts";
import {
  assessStoryCatalyst,
  catalystTimestamp,
  shouldRecalibrateExpiredCatalyst,
} from "../story-hygiene.ts";

export const MAX_STORY_REVIEW_TARGETS = 4;
export const MAX_STORY_REVIEW_EVIDENCE = 10;

export type StoryReviewReason =
  | "explicit_queue"
  | "catalyst_expired"
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
  requestedEvidenceId?: string | null;
};

export type StoryReviewDebt = {
  storyId: string | null;
  debtKey: string;
  severity: string;
  status: string;
  nextCheckAt: string | null;
  reason?: string | null;
  nextAction?: string | null;
};

export type StoryEvidenceLink = {
  storyId: string;
  evidenceId: string;
  evidenceRole: string;
  linkedAt: string;
};

export type StoryReviewContext = {
  queueReasons: string[];
  researchDebt: Array<{
    debtKey: string;
    severity: string;
    reason: string | null;
    nextAction: string | null;
    nextCheckAt: string | null;
  }>;
  dueCatalysts: string[];
  expiredCatalysts: string[];
  catalystRecalibrationRequired: boolean;
  triggerEvidenceIds: string[];
  catalystCandidates: Array<{
    label: string;
    catalystRef: string | null;
    evidenceNature?: "scheduled_event";
  }>;
};

const REASON_RANK: Record<StoryReviewReason, number> = {
  explicit_queue: 1,
  catalyst_expired: 2,
  criteria_evidence: 3,
  overdue_critical_debt: 4,
  contradictory_evidence: 5,
  supporting_evidence: 6,
  catalyst_due: 7,
  review_age: 8,
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

function scheduledCatalystCandidate(item: EvidencePackItem, nowMs: number) {
  if (!isScheduledEvidence(item)) return null;
  const title = typeof item.structuredPayload?.title === "string"
    ? item.structuredPayload.title.trim()
    : "";
  const eventMs = item.eventAt && Number.isFinite(Date.parse(item.eventAt))
    ? Date.parse(item.eventAt)
    : null;
  if (eventMs !== null && eventMs < nowMs) return null;
  const eventDate = eventMs !== null ? new Date(eventMs).toISOString().slice(0, 10) : "";
  const baseLabel = title || item.claim.trim();
  if (!baseLabel) return null;
  return {
    label: eventDate && !baseLabel.includes(eventDate) ? `${baseLabel} · ${eventDate}` : baseLabel,
    catalystRef: item.id,
    evidenceNature: "scheduled_event" as const,
  };
}

function relevantEvidenceForStory(
  story: StoryReviewStory,
  evidence: EvidencePackItem[],
  links: StoryEvidenceLink[],
  requestedEvidenceIds: Set<string>,
) {
  const linkByEvidence = new Map(links.filter((link) => link.storyId === story.id).map((link) => [link.evidenceId, link]));
  return evidence
    .filter((item) => requestedEvidenceIds.has(item.id)
      || linkByEvidence.has(item.id)
      || item.affectedTopics.includes(story.slug))
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
    const dormant = ["archived", "invalidated", "discarded"].includes(story.status.toLowerCase());
    if (dormant && !availableQueue.length) return [];
    const linkRoles = new Map(input.evidenceLinks.filter((link) => link.storyId === story.id).map((link) => [link.evidenceId, link.evidenceRole]));
    const requestedEvidenceIds = new Set(
      availableQueue
        .map((item) => item.requestedEvidenceId)
        .filter((id): id is string => Boolean(id)),
    );
    const lastEvaluated = milliseconds(story.lastEvaluatedAt) ?? 0;
    const relevantEvidence = relevantEvidenceForStory(
      story,
      input.evidence,
      input.evidenceLinks,
      requestedEvidenceIds,
    );
    const fresh = relevantEvidence.filter((item) => (milliseconds(item.eventAt ?? item.publishedAt) ?? 0) > lastEvaluated);
    const relevantDebt = input.debt.filter((debt) => debt.storyId === story.id && debt.status === "open");
    // Production obligations historically use both high and critical severity.
    // Both are actionable Story-local blockers once their next-check time passes.
    const overdueCriticalDebt = relevantDebt.filter((debt) => ["high", "critical"].includes(debt.severity)
      && (milliseconds(debt.nextCheckAt) ?? Number.POSITIVE_INFINITY) <= nowMs);
    const dueCatalysts = story.nextCatalysts.filter((catalyst) => {
      const due = catalystTimestamp(catalyst);
      return due !== null && due <= nowMs && due > lastEvaluated;
    });
    const expiredCatalysts = story.nextCatalysts.filter((catalyst) => {
      const assessment = assessStoryCatalyst({ nextCatalyst: catalyst, now: input.now });
      return assessment.status === "expired";
    });
    const catalystRecalibrationRequired = expiredCatalysts.some((catalyst) =>
      shouldRecalibrateExpiredCatalyst({
        assessment: assessStoryCatalyst({ nextCatalyst: catalyst, now: input.now }),
        lastEvaluatedAt: story.lastEvaluatedAt,
        now: input.now,
      }),
    );
    const catalystCandidates = [
      ...[...new Set(story.nextCatalysts.map((value) => value.trim()).filter(Boolean))]
        .filter((label) => !expiredCatalysts.includes(label))
        .map((label) => ({ label, catalystRef: null })),
      ...relevantEvidence.flatMap((item) => {
        const candidate = scheduledCatalystCandidate(item, nowMs);
        return candidate ? [candidate] : [];
      }),
    ];
    const reasons: StoryReviewReason[] = [];
    if (availableQueue.length) reasons.push("explicit_queue");
    if (catalystRecalibrationRequired) reasons.push("catalyst_expired");
    if (fresh.some((item) => ["confirmation", "invalidation"].includes(linkRoles.get(item.id) ?? ""))) reasons.push("criteria_evidence");
    if (overdueCriticalDebt.length) reasons.push("overdue_critical_debt");
    if (fresh.some((item) => item.supportDirection === "contradicting" || linkRoles.get(item.id) === "contradicting")) reasons.push("contradictory_evidence");
    if (fresh.some((item) => item.supportDirection === "supporting" || ["supporting", "decisive"].includes(linkRoles.get(item.id) ?? ""))) reasons.push("supporting_evidence");
    if (dueCatalysts.length) reasons.push("catalyst_due");
    if (nowMs - lastEvaluated >= reviewAgeHours(story.status) * 60 * 60 * 1_000) reasons.push("review_age");
    if (!reasons.length) return [];

    const reason = [...reasons].sort((left, right) => REASON_RANK[left] - REASON_RANK[right])[0];
    const reviewContext: StoryReviewContext = {
      queueReasons: [...new Set(availableQueue.map((item) => item.reason).filter(Boolean))],
      researchDebt: relevantDebt.map((debt) => ({
        debtKey: debt.debtKey,
        severity: debt.severity,
        reason: debt.reason ?? null,
        nextAction: debt.nextAction ?? null,
        nextCheckAt: debt.nextCheckAt,
      })),
      dueCatalysts,
      expiredCatalysts,
      catalystRecalibrationRequired,
      triggerEvidenceIds: [...new Set([
        ...fresh.map((item) => item.id),
        ...requestedEvidenceIds,
      ])],
      catalystCandidates,
    };
    return [{
      story,
      reason,
      reasonRank: REASON_RANK[reason],
      reasons: [...new Set(reasons)].sort((left, right) => REASON_RANK[left] - REASON_RANK[right]),
      queueIds: availableQueue.map((item) => item.id).sort(),
      relevantEvidence,
      selectedAt: input.now.toISOString(),
      reviewContext,
      queuePriority: Math.max(0, ...availableQueue.map((item) => item.priority)),
      dueAt: availableQueue.map((item) => milliseconds(item.createdAt) ?? nowMs).sort((a, b) => a - b)[0]
        ?? lastEvaluated,
    } as StoryReviewTargetPackItem & { reviewContext: StoryReviewContext; queuePriority: number; dueAt: number }];
  });

  const maxTargets = Math.max(0, Math.min(MAX_STORY_REVIEW_TARGETS, input.maxTargets ?? MAX_STORY_REVIEW_TARGETS));
  const sorted = candidates.sort((left, right) => left.reasonRank - right.reasonRank
    || right.queuePriority - left.queuePriority
    || left.dueAt - right.dueAt
    || left.story.id.localeCompare(right.story.id));

  let selected = sorted.slice(0, maxTargets);
  if (maxTargets > 0) {
    const overduePublished = sorted.find((target) =>
      ["publish", "published", "confirmed"].includes(target.story.status.toLowerCase())
      && (target.reasons.includes("catalyst_due") || target.reasons.includes("catalyst_expired")),
    );
    if (overduePublished && !selected.some((target) => target.story.id === overduePublished.story.id)) {
      selected = [...selected.slice(0, Math.max(0, maxTargets - 1)), overduePublished];
    }
  }

  return selected.map(({ queuePriority: _queuePriority, dueAt: _dueAt, ...target }) => target);
}

function independentGroup(item: EvidencePackItem) {
  return item.ancestryGroupId || `source:${item.sourceName.trim().toLowerCase()}`;
}

/**
 * Existing-Story mutation policy. Creator commentary can wake a review or suggest
 * a test, but it cannot materially rewrite the canonical thesis by itself.
 * Invalidation is stricter because it is the highest-impact automatic transition.
 */
export function materialAssessmentHasEligibleEvidence(
  disposition: string,
  evidenceIds: string[],
  target: StoryReviewTargetPackItem,
) {
  if (disposition === "unchanged") return true;
  const selected = new Set(evidenceIds);
  const credible = target.relevantEvidence.filter((item) => selected.has(item.id)
    && isCanonicalEligibleEvidence(item));
  if (!credible.length) return false;
  if (disposition !== "invalidated") return true;
  if (credible.some((item) => item.sourceTier <= 2)) return true;
  return new Set(credible.map(independentGroup)).size >= 2;
}
