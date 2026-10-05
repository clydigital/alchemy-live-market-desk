import assert from "node:assert/strict";
import test from "node:test";

import { explicitlyMentionedAssets } from "../lib/instrument-mentions.ts";
import {
  MAX_STORY_REVIEW_EVIDENCE,
  materialAssessmentHasEligibleEvidence,
  partitionStoryReviewTargetsByQueueClaims,
  planStoryReviewQueueHygiene,
  selectStoryReviewTargets,
  storyAssessmentAcknowledgesQueuedEvidence,
  type StoryEvidenceLink,
  type StoryReviewStory,
} from "../lib/intelligence/story-review.ts";
import type { EvidencePackItem } from "../lib/intelligence/schemas.ts";

const now = new Date("2026-08-21T12:00:00.000Z");

function story(id: string, input: Partial<StoryReviewStory> = {}): StoryReviewStory {
  return {
    id,
    slug: id,
    title: "Story " + id,
    thesis: "Canonical thesis " + id,
    status: "developing",
    confidence: 60,
    marketQuestion: null,
    dominantNarrative: null,
    strongestSupport: null,
    strongestContradiction: null,
    confirmationTrigger: null,
    invalidationTrigger: null,
    nextCatalyst: null,
    assets: ["WTI", "BRENT"],
    lastEvaluatedAt: "2026-08-21T11:00:00.000Z",
    lastEvidenceAt: null,
    nextCatalysts: [],
    ...input,
  };
}

function evidence(id: string, topic: string, input: Partial<EvidencePackItem> = {}): EvidencePackItem {
  return {
    id,
    claim: "Official evidence " + id,
    summary: null,
    evidenceClass: "official_release",
    sourceName: "Official source",
    sourceTier: 1,
    reliabilityScore: 95,
    availableAt: null, receivedAt: null, freshnessStatus: "current", structuredPayload: {},
    ancestryGroupId: id,
    supportDirection: "context",
    eventAt: "2026-08-21T11:30:00.000Z",
    publishedAt: "2026-08-21T11:30:00.000Z",
    affectedAssets: [],
    affectedTopics: [topic],
    provenanceUrls: ["https://example.test/" + id],
    ...input,
  };
}

test("queue-backed Story targets require full claim ownership while queue-less targets remain eligible", () => {
  const selected = selectStoryReviewTargets({
    stories: [
      story("partial"),
      story("owned"),
      story("age", { lastEvaluatedAt: "2026-08-18T00:00:00.000Z" }),
    ],
    evidence: [],
    evidenceLinks: [],
    queue: [
      {
        id: "partial-a", storyId: "partial", status: "pending", reason: "explicit",
        priority: 95, availableAt: "2026-08-21T10:00:00Z", createdAt: "2026-08-21T09:00:00Z",
      },
      {
        id: "partial-b", storyId: "partial", status: "pending", reason: "explicit",
        priority: 94, availableAt: "2026-08-21T10:00:00Z", createdAt: "2026-08-21T09:01:00Z",
      },
      {
        id: "owned-a", storyId: "owned", status: "pending", reason: "explicit",
        priority: 90, availableAt: "2026-08-21T10:00:00Z", createdAt: "2026-08-21T09:02:00Z",
      },
    ],
    debt: [],
    now,
  });

  const ownership = partitionStoryReviewTargetsByQueueClaims(
    selected,
    new Set(["partial-a", "owned-a"]),
  );

  assert.deepEqual(ownership.ownedTargets.map((target) => target.story.id), ["owned", "age"]);
  assert.deepEqual(ownership.partialClaimIds, ["partial-a"]);
  assert.deepEqual(ownership.droppedStoryIds, ["partial"]);
});

test("selector consumes queue, debt and evidence triggers in deterministic priority order", () => {
  const stories = ["queue", "criteria", "debt", "contradiction", "support", "catalyst", "age"].map((id) => story(id));
  stories.find((item) => item.id === "catalyst")!.nextCatalysts = ["CPI due 2026-08-21T11:45:00Z"];
  stories.find((item) => item.id === "age")!.lastEvaluatedAt = "2026-08-18T00:00:00.000Z";
  const rows = [
    evidence("criteria-evidence", "criteria"),
    evidence("contra-evidence", "contradiction", { supportDirection: "contradicting" }),
    evidence("support-evidence", "support", { supportDirection: "supporting" }),
  ];
  const links: StoryEvidenceLink[] = [
    { storyId: "criteria", evidenceId: "criteria-evidence", evidenceRole: "confirmation", linkedAt: rows[0].eventAt! },
    { storyId: "contradiction", evidenceId: "contra-evidence", evidenceRole: "contradicting", linkedAt: rows[1].eventAt! },
    { storyId: "support", evidenceId: "support-evidence", evidenceRole: "supporting", linkedAt: rows[2].eventAt! },
  ];

  const selected = selectStoryReviewTargets({
    stories,
    evidence: rows,
    evidenceLinks: links,
    queue: [{
      id: "queue-1", storyId: "queue", status: "pending", reason: "Manual review after positioning reversal",
      priority: 90, availableAt: "2026-08-21T10:00:00Z", createdAt: "2026-08-21T10:00:00Z",
    }],
    debt: [{
      storyId: "debt", debtKey: "physical-flow-confirmation", severity: "critical", status: "open",
      reason: "Need physical shipping-flow confirmation", nextAction: "Check JODI/EIA/flow evidence",
      nextCheckAt: "2026-08-21T10:00:00Z",
    }],
    now,
  });

  assert.deepEqual(selected.map((target) => target.story.id), ["queue", "criteria", "debt", "contradiction"]);
  assert.deepEqual(selected.map((target) => target.reason), [
    "explicit_queue", "criteria_evidence", "overdue_critical_debt", "contradictory_evidence",
  ]);
  assert.equal(selected.length, 4);
  const queueContext = (selected[0] as typeof selected[0] & { reviewContext?: { queueReasons?: string[] } }).reviewContext;
  assert.deepEqual(queueContext?.queueReasons, ["Manual review after positioning reversal"]);
  const debtContext = (selected[2] as typeof selected[2] & { reviewContext?: { researchDebt?: Array<{ debtKey: string; reason: string | null; nextAction: string | null }> } }).reviewContext;
  assert.deepEqual(debtContext?.researchDebt, [{
    debtKey: "physical-flow-confirmation",
    severity: "critical",
    reason: "Need physical shipping-flow confirmation",
    nextAction: "Check JODI/EIA/flow evidence",
    nextCheckAt: "2026-08-21T10:00:00Z",
  }]);
});

test("an overdue dated catalyst on a published Story cannot be starved by the four-target budget", () => {
  const stories = [
    story("queue-1"),
    story("queue-2"),
    story("queue-3"),
    story("queue-4"),
    story("fed-rate-repricing", {
      status: "publish",
      lastEvaluatedAt: null,
      nextCatalyst: "U.S. CPI and Real Earnings on 12 August 2026, followed by PPI on 13 August.",
      nextCatalysts: ["U.S. CPI and Real Earnings on 12 August 2026, followed by PPI on 13 August."],
    }),
  ];
  const queue = ["queue-1", "queue-2", "queue-3", "queue-4"].map((storyId, index) => ({
    id: `queue-${index + 1}`,
    storyId,
    status: "pending",
    reason: "Routine explicit queue",
    priority: 90 - index,
    availableAt: "2026-08-21T10:00:00Z",
    createdAt: "2026-08-21T10:00:00Z",
  }));

  const selected = selectStoryReviewTargets({
    stories,
    evidence: [],
    evidenceLinks: [],
    queue,
    debt: [],
    now,
  });

  assert.equal(selected.length, 4);
  assert.ok(selected.some((target) => target.story.id === "fed-rate-repricing"));
  const fed = selected.find((target) => target.story.id === "fed-rate-repricing");
  assert.equal(fed?.reason, "catalyst_expired");
  assert.deepEqual(
    fed?.reviewContext?.expiredCatalysts,
    ["U.S. CPI and Real Earnings on 12 August 2026, followed by PPI on 13 August."],
  );
  assert.equal(fed?.reviewContext?.catalystRecalibrationRequired, true);
});

test("explicit queue evidence is Story-relevant even before a durable Story-evidence link exists", () => {
  const requested = evidence("queued-news", "unrelated-topic", {
    evidenceClass: "news_report",
    sourceTier: 3,
    claim: "Refinery disruption keeps diesel supply tight.",
  });
  const selected = selectStoryReviewTargets({
    stories: [story("refining-crack-spread-stress", { status: "archived" })],
    evidence: [requested],
    evidenceLinks: [],
    queue: [{
      id: "queue-news",
      storyId: "refining-crack-spread-stress",
      status: "pending",
      reason: "dossier_refresh:test:dossier_story_match",
      priority: 90,
      availableAt: "2026-08-21T10:00:00Z",
      createdAt: "2026-08-21T10:00:00Z",
      requestedEvidenceId: requested.id,
    }],
    debt: [],
    now,
  });

  assert.equal(selected.length, 1);
  assert.deepEqual(selected[0]?.relevantEvidence.map((item) => item.id), [requested.id]);
  assert.ok(selected[0]?.reviewContext?.triggerEvidenceIds.includes(requested.id));
  assert.equal(materialAssessmentHasEligibleEvidence("reinforced", [requested.id], selected[0]!), true);
});

test("stale review age creates a target using lifecycle-specific thresholds", () => {
  const selected = selectStoryReviewTargets({
    stories: [story("confirmed", { status: "confirmed", lastEvaluatedAt: "2026-08-20T11:59:59Z" })],
    evidence: [], evidenceLinks: [], queue: [], debt: [], now,
  });
  assert.equal(selected[0]?.reason, "review_age");
});

test("overdue high Story debt wakes a review like production research obligations", () => {
  const selected = selectStoryReviewTargets({
    stories: [story("oil", { lastEvaluatedAt: "2026-08-21T11:59:00Z" })],
    evidence: [], evidenceLinks: [], queue: [],
    debt: [{
      storyId: "oil",
      debtKey: "oil-physical-disruption:freight-insurance-premia",
      severity: "high",
      status: "open",
      reason: "Required Story research obligation has never been checked.",
      nextAction: "Check the registered source/monitor, record a requirement check, then re-run debt refresh.",
      nextCheckAt: "2026-08-09T22:55:32.915849Z",
    }],
    now,
  });
  assert.equal(selected.length, 1);
  assert.equal(selected[0]?.reason, "overdue_critical_debt");
  const context = (selected[0] as typeof selected[0] & { reviewContext?: { researchDebt?: Array<{ severity: string; debtKey: string }> } }).reviewContext;
  assert.equal(context?.researchDebt?.[0]?.severity, "high");
  assert.equal(context?.researchDebt?.[0]?.debtKey, "oil-physical-disruption:freight-insurance-premia");
});

test("relevant evidence is prioritised before the maximum-ten truncation", () => {
  const rows = Array.from({ length: 14 }, (_, index) => evidence("ev-" + index, "bounded", {
    sourceTier: index === 13 ? 1 : 4,
    supportDirection: index === 13 ? "contradicting" : "supporting",
  }));
  const selected = selectStoryReviewTargets({
    stories: [story("bounded")],
    evidence: rows,
    evidenceLinks: rows.map((item) => ({
      storyId: "bounded",
      evidenceId: item.id,
      evidenceRole: item.id === "ev-13" ? "invalidation" : "supporting",
      linkedAt: item.eventAt!,
    })),
    queue: [], debt: [], now,
  });
  assert.equal(selected[0]?.relevantEvidence.length, MAX_STORY_REVIEW_EVIDENCE);
  assert.equal(selected[0]?.relevantEvidence[0]?.id, "ev-13");
});

test("explicitly requested canonical evidence survives the ten-item Story-review cap", () => {
  const requested = evidence("requested-canonical", "unrelated-topic", {
    evidenceClass: "news_report",
    sourceTier: 5,
    eventAt: "2026-08-21T11:01:00.000Z",
    publishedAt: "2026-08-21T11:01:00.000Z",
  });
  const strongerContext = Array.from({ length: 12 }, (_, index) => evidence(
    `linked-${String(index).padStart(2, "0")}`,
    "busy-story",
    {
      sourceTier: 1,
      supportDirection: "supporting",
      eventAt: `2026-08-21T11:${String(59 - index).padStart(2, "0")}:00.000Z`,
      publishedAt: `2026-08-21T11:${String(59 - index).padStart(2, "0")}:00.000Z`,
    },
  ));
  const selected = selectStoryReviewTargets({
    stories: [story("busy-story")],
    evidence: [...strongerContext, requested],
    evidenceLinks: strongerContext.map((item) => ({
      storyId: "busy-story",
      evidenceId: item.id,
      evidenceRole: "supporting",
      linkedAt: item.eventAt!,
    })),
    queue: [{
      id: "queue-requested",
      storyId: "busy-story",
      status: "pending",
      reason: "dossier_motion_acceptance",
      priority: 95,
      availableAt: "2026-08-21T10:00:00Z",
      createdAt: "2026-08-21T10:00:00Z",
      requestedEvidenceId: requested.id,
    }],
    debt: [],
    now,
  });

  assert.equal(selected.length, 1);
  assert.equal(selected[0]?.relevantEvidence.length, MAX_STORY_REVIEW_EVIDENCE);
  assert.equal(selected[0]?.relevantEvidence[0]?.id, requested.id);
  assert.ok(selected[0]?.relevantEvidence.some((item) => item.id === requested.id));
  assert.ok(selected[0]?.reviewContext?.triggerEvidenceIds.includes(requested.id));
});

test("requested trigger ids never reference evidence omitted from the bounded review pack", () => {
  const requested = Array.from({ length: 11 }, (_, index) => evidence(
    `requested-${String(index).padStart(2, "0")}`,
    "other",
    { sourceTier: 3 + (index % 2) },
  ));
  const selected = selectStoryReviewTargets({
    stories: [story("cap-story")],
    evidence: requested,
    evidenceLinks: [],
    queue: requested.map((item, index) => ({
      id: `queue-${index}`,
      storyId: "cap-story",
      status: "pending",
      reason: "dossier_motion_acceptance",
      priority: 95 - index,
      availableAt: "2026-08-21T10:00:00Z",
      createdAt: "2026-08-21T10:00:00Z",
      requestedEvidenceId: item.id,
    })),
    debt: [],
    now,
  });

  const packed = new Set(selected[0]?.relevantEvidence.map((item) => item.id) ?? []);
  const triggers = selected[0]?.reviewContext?.triggerEvidenceIds ?? [];
  const consumedQueueIds = new Set(selected[0]?.queueIds ?? []);
  const queueEvidenceIds = new Set(selected[0]?.reviewContext?.queueEvidenceIds ?? []);
  assert.equal(packed.size, MAX_STORY_REVIEW_EVIDENCE);
  assert.ok(triggers.every((id) => packed.has(id)));
  assert.equal(consumedQueueIds.size, MAX_STORY_REVIEW_EVIDENCE);
  assert.deepEqual(queueEvidenceIds, packed);
  for (const [index, item] of requested.entries()) {
    assert.equal(
      consumedQueueIds.has(`queue-${index}`),
      packed.has(item.id),
      `queue-${index} must be consumed only when its requested Evidence is in the bounded review pack`,
    );
  }
  assert.ok(
    requested.some((item, index) => !packed.has(item.id) && !consumedQueueIds.has(`queue-${index}`)),
    "at least one overflow request must remain pending for a later review",
  );
});

test("a dormant Story does not consume an evidence-backed queue whose requested Evidence is unavailable", () => {
  const selected = selectStoryReviewTargets({
    stories: [story("archived-story", { status: "archived" })],
    evidence: [],
    evidenceLinks: [],
    queue: [{
      id: "queue-missing",
      storyId: "archived-story",
      status: "pending",
      reason: "dossier_motion_acceptance",
      priority: 95,
      availableAt: "2026-08-21T10:00:00Z",
      createdAt: "2026-08-21T10:00:00Z",
      requestedEvidenceId: "missing-canonical-evidence",
    }],
    debt: [],
    now,
  });

  assert.deepEqual(selected, []);
});

test("evidence-backed Story assessment must acknowledge every queued canonical trigger", () => {
  const requested = [evidence("trigger-a", "story"), evidence("trigger-b", "story")];
  const selected = selectStoryReviewTargets({
    stories: [story("story")],
    evidence: requested,
    evidenceLinks: [],
    queue: requested.map((item, index) => ({
      id: `queue-${index}`,
      storyId: "story",
      status: "pending",
      reason: "dossier_motion_acceptance",
      priority: 95 - index,
      availableAt: "2026-08-21T10:00:00Z",
      createdAt: "2026-08-21T10:00:00Z",
      requestedEvidenceId: item.id,
    })),
    debt: [],
    now,
  });
  const target = selected[0]!;
  assert.deepEqual(target.reviewContext?.queueEvidenceIds, ["trigger-a", "trigger-b"]);
  assert.equal(storyAssessmentAcknowledgesQueuedEvidence(["trigger-a"], target), false);
  assert.equal(storyAssessmentAcknowledgesQueuedEvidence(["trigger-a", "trigger-b"], target), true);
});

test("evidence-less operational Story queues do not create a trigger acknowledgement obligation", () => {
  const selected = selectStoryReviewTargets({
    stories: [story("rates")],
    evidence: [],
    evidenceLinks: [],
    queue: [{
      id: "system1-rates",
      storyId: "rates",
      status: "pending",
      reason: "system1_threshold_crossing",
      priority: 80,
      availableAt: "2026-08-21T10:00:00Z",
      createdAt: "2026-08-21T10:00:00Z",
      requestedEvidenceId: null,
    }],
    debt: [],
    now,
  });
  const target = selected[0]!;
  assert.deepEqual(target.reviewContext?.queueEvidenceIds, []);
  assert.equal(storyAssessmentAcknowledgesQueuedEvidence([], target), true);
});

test("Story target age is measured within its highest-priority queue class", () => {
  const aHigh = evidence("a-high", "story-a");
  const aLow = evidence("a-low", "story-a");
  const bHigh = evidence("b-high", "story-b");
  const selected = selectStoryReviewTargets({
    stories: [story("story-a"), story("story-b")],
    evidence: [aHigh, aLow, bHigh],
    evidenceLinks: [],
    queue: [
      {
        id: "a-low-old",
        storyId: "story-a",
        status: "pending",
        reason: "dossier_refresh",
        priority: 70,
        availableAt: "2026-08-21T08:00:00Z",
        createdAt: "2026-08-21T08:00:00Z",
        requestedEvidenceId: aLow.id,
      },
      {
        id: "a-high-new",
        storyId: "story-a",
        status: "pending",
        reason: "dossier_motion_acceptance",
        priority: 95,
        availableAt: "2026-08-21T10:30:00Z",
        createdAt: "2026-08-21T10:30:00Z",
        requestedEvidenceId: aHigh.id,
      },
      {
        id: "b-high-older",
        storyId: "story-b",
        status: "pending",
        reason: "dossier_motion_acceptance",
        priority: 95,
        availableAt: "2026-08-21T10:00:00Z",
        createdAt: "2026-08-21T10:00:00Z",
        requestedEvidenceId: bHigh.id,
      },
    ],
    debt: [],
    now,
    maxTargets: 1,
  });

  assert.equal(selected.length, 1);
  assert.equal(selected[0]?.story.id, "story-b");
  assert.ok(selected[0]?.queueIds.includes("b-high-older"));
});

test("bounded requested Evidence pack follows queue priority before evidence quality", () => {
  const highPriority = evidence("priority-trigger", "priority-story", {
    sourceTier: 5,
    eventAt: "2026-08-21T11:01:00.000Z",
    publishedAt: "2026-08-21T11:01:00.000Z",
  });
  const lowerPriority = Array.from({ length: 10 }, (_, index) => evidence(
    `quality-${String(index).padStart(2, "0")}`,
    "priority-story",
    {
      sourceTier: 1,
      eventAt: `2026-08-21T11:${String(50 - index).padStart(2, "0")}:00.000Z`,
      publishedAt: `2026-08-21T11:${String(50 - index).padStart(2, "0")}:00.000Z`,
    },
  ));
  const selected = selectStoryReviewTargets({
    stories: [story("priority-story")],
    evidence: [...lowerPriority, highPriority],
    evidenceLinks: [],
    queue: [
      {
        id: "queue-priority",
        storyId: "priority-story",
        status: "pending",
        reason: "dossier_motion_acceptance",
        priority: 95,
        availableAt: "2026-08-21T10:00:00Z",
        createdAt: "2026-08-21T10:10:00Z",
        requestedEvidenceId: highPriority.id,
      },
      ...lowerPriority.map((item, index) => ({
        id: `queue-quality-${index}`,
        storyId: "priority-story",
        status: "pending",
        reason: "dossier_refresh",
        priority: 80,
        availableAt: "2026-08-21T10:00:00Z",
        createdAt: `2026-08-21T10:${String(20 + index).padStart(2, "0")}:00Z`,
        requestedEvidenceId: item.id,
      })),
    ],
    debt: [],
    now,
  });

  const target = selected[0]!;
  assert.equal(target.relevantEvidence.length, MAX_STORY_REVIEW_EVIDENCE);
  assert.equal(target.relevantEvidence[0]?.id, highPriority.id);
  assert.ok(target.queueIds.includes("queue-priority"));
  assert.ok(target.reviewContext?.queueEvidenceIds?.includes(highPriority.id));
  assert.equal(
    lowerPriority.filter((item) => target.relevantEvidence.some((packed) => packed.id === item.id)).length,
    MAX_STORY_REVIEW_EVIDENCE - 1,
  );
});

test("equal-priority queued Evidence uses oldest request before evidence quality", () => {
  const older = evidence("older-request", "queue-age", { sourceTier: 5 });
  const newer = evidence("newer-request", "queue-age", { sourceTier: 1 });
  const fillers = Array.from({ length: 9 }, (_, index) => evidence(
    `age-fill-${index}`,
    "queue-age",
    { sourceTier: 1 },
  ));
  const selected = selectStoryReviewTargets({
    stories: [story("queue-age")],
    evidence: [newer, ...fillers, older],
    evidenceLinks: [],
    queue: [
      {
        id: "queue-older",
        storyId: "queue-age",
        status: "pending",
        reason: "dossier_motion_acceptance",
        priority: 90,
        availableAt: "2026-08-21T10:00:00Z",
        createdAt: "2026-08-21T09:00:00Z",
        requestedEvidenceId: older.id,
      },
      {
        id: "queue-newer",
        storyId: "queue-age",
        status: "pending",
        reason: "dossier_motion_acceptance",
        priority: 90,
        availableAt: "2026-08-21T10:00:00Z",
        createdAt: "2026-08-21T10:00:00Z",
        requestedEvidenceId: newer.id,
      },
      ...fillers.map((item, index) => ({
        id: `queue-fill-${index}`,
        storyId: "queue-age",
        status: "pending",
        reason: "dossier_refresh",
        priority: 90,
        availableAt: "2026-08-21T10:00:00Z",
        createdAt: `2026-08-21T10:${String(index + 1).padStart(2, "0")}:00Z`,
        requestedEvidenceId: item.id,
      })),
    ],
    debt: [],
    now,
  });
  const target = selected[0]!;
  assert.ok(target.relevantEvidence.some((item) => item.id === older.id));
  assert.equal(target.relevantEvidence[0]?.id, older.id);
  assert.ok(target.queueIds.includes("queue-older"));
});

test("unrelated Story debt cannot make another fresh Story eligible", () => {
  const selected = selectStoryReviewTargets({
    stories: [story("unrelated")],
    evidence: [], evidenceLinks: [], queue: [],
    debt: [{ storyId: "other", debtKey: "critical", severity: "critical", status: "open", nextCheckAt: "2026-08-20T00:00:00Z" }],
    now,
  });
  assert.deepEqual(selected, []);
});

test("creator-only evidence cannot materially mutate a Story", () => {
  const target = {
    story: story("video"),
    reason: "contradictory_evidence",
    reasonRank: 4,
    reasons: ["contradictory_evidence"],
    queueIds: [],
    selectedAt: now.toISOString(),
    relevantEvidence: [
      evidence("video-only", "video", { evidenceClass: "transcript", supportDirection: "contradicting" }),
      evidence("house-research", "video", { evidenceClass: "research_analysis", sourceTier: 4, supportDirection: "contradicting" }),
    ],
  };
  assert.equal(materialAssessmentHasEligibleEvidence("weakened", ["video-only"], target), false);
  assert.equal(materialAssessmentHasEligibleEvidence("invalidated", ["house-research"], target), false);
});

test("a linked scheduled event becomes a catalyst candidate but cannot materially mutate the thesis", () => {
  const scheduled = evidence("fomc-scheduled", "", {
    claim: "Official schedule for the upcoming FOMC decision.",
    evidenceClass: "other",
    sourceTier: 1,
    eventAt: "2026-08-28T18:00:00.000Z",
    publishedAt: "2026-08-28T18:00:00.000Z",
    affectedAssets: ["US02Y", "SPX"],
    affectedTopics: [],
    structuredPayload: {
      title: "FOMC decision and projections · Scheduled",
      evidenceNature: "scheduled_event",
      materiality: 100,
    },
  });
  const selected = selectStoryReviewTargets({
    stories: [story("fed", { assets: ["US02Y", "DXY", "SPX"] })],
    evidence: [scheduled],
    evidenceLinks: [{ storyId: "fed", evidenceId: scheduled.id, evidenceRole: "context", linkedAt: now.toISOString() }],
    queue: [{
      id: "queue-fomc",
      storyId: "fed",
      status: "pending",
      reason: "new_linked_evidence",
      priority: 70,
      availableAt: "2026-08-21T11:00:00.000Z",
      createdAt: "2026-08-21T11:00:00.000Z",
    }],
    debt: [],
    now,
  });

  assert.equal(selected.length, 1);
  assert.deepEqual(selected[0]?.reviewContext?.catalystCandidates, [{
    label: "FOMC decision and projections · Scheduled · 2026-08-28",
    catalystRef: "fomc-scheduled",
    evidenceNature: "scheduled_event",
  }]);
  assert.equal(materialAssessmentHasEligibleEvidence("reinforced", [scheduled.id], selected[0]!), false);
  assert.equal(materialAssessmentHasEligibleEvidence("unchanged", [scheduled.id], selected[0]!), true);
});

test("invalidation requires Tier 1-2 evidence or two independent credible sources", () => {
  const oneNews = evidence("news-a", "strict", {
    evidenceClass: "news_report", sourceTier: 3, sourceName: "News A", ancestryGroupId: "group-a", supportDirection: "contradicting",
  });
  const secondNews = evidence("news-b", "strict", {
    evidenceClass: "news_report", sourceTier: 3, sourceName: "News B", ancestryGroupId: "group-b", supportDirection: "contradicting",
  });
  const official = evidence("official", "strict", { sourceTier: 1, supportDirection: "contradicting" });
  const target = {
    story: story("strict"), reason: "contradictory_evidence", reasonRank: 4, reasons: ["contradictory_evidence"],
    queueIds: [], selectedAt: now.toISOString(), relevantEvidence: [oneNews, secondNews, official],
  };
  assert.equal(materialAssessmentHasEligibleEvidence("invalidated", ["news-a"], target), false);
  assert.equal(materialAssessmentHasEligibleEvidence("invalidated", ["news-a", "news-b"], target), true);
  assert.equal(materialAssessmentHasEligibleEvidence("invalidated", ["official"], target), true);
  assert.equal(materialAssessmentHasEligibleEvidence("weakened", ["news-a"], target), true);
});

test("Story routing never fabricates asset mentions", () => {
  assert.deepEqual(explicitlyMentionedAssets("Oil supply conditions tightened.", ["WTI", "BRENT"]), []);
  assert.deepEqual(explicitlyMentionedAssets("WTI rose while shipping remained constrained.", ["WTI", "BRENT"]), ["WTI"]);
  assert.deepEqual(explicitlyMentionedAssets("Brent weakened against WTI.", ["WTI", "BRENT"]), ["WTI", "BRENT"]);
});


test("an expired catalyst remains actionable even after a later review left it unchanged", () => {
  const selected = selectStoryReviewTargets({
    stories: [story("fed-rate-repricing", {
      status: "publish",
      lastEvaluatedAt: "2026-09-26T19:57:32.000Z",
      nextCatalyst: "U.S. CPI and Real Earnings on 12 August 2026, followed by PPI on 13 August.",
      nextCatalysts: ["U.S. CPI and Real Earnings on 12 August 2026, followed by PPI on 13 August."],
    })],
    evidence: [],
    evidenceLinks: [],
    queue: [],
    debt: [],
    now: new Date("2026-09-28T06:30:00.000Z"),
  });

  assert.equal(selected.length, 1);
  assert.equal(selected[0]?.reason, "catalyst_expired");
  assert.deepEqual(selected[0]?.reviewContext?.expiredCatalysts, [
    "U.S. CPI and Real Earnings on 12 August 2026, followed by PPI on 13 August.",
  ]);
  assert.deepEqual(selected[0]?.reviewContext?.catalystCandidates, []);
});

test("expired-catalyst recalibration uses a cooldown instead of consuming every engine run", () => {
  const selected = selectStoryReviewTargets({
    stories: [story("recently-reviewed", {
      status: "publish",
      lastEvaluatedAt: "2026-09-28T06:00:00.000Z",
      nextCatalyst: "12 August 2026 CPI",
      nextCatalysts: ["12 August 2026 CPI"],
    })],
    evidence: [],
    evidenceLinks: [],
    queue: [],
    debt: [],
    now: new Date("2026-09-28T06:30:00.000Z"),
  });

  assert.deepEqual(selected, []);
});

test("past scheduled evidence is never offered as a future catalyst candidate", () => {
  const past = evidence("past-scheduled", "fed", {
    claim: "Old scheduled release.",
    evidenceClass: "other",
    sourceTier: 1,
    eventAt: "2026-08-12T12:30:00.000Z",
    publishedAt: "2026-08-01T00:00:00.000Z",
    structuredPayload: {
      title: "CPI release",
      evidenceNature: "scheduled_event",
    },
  });
  const selected = selectStoryReviewTargets({
    stories: [story("fed", { lastEvaluatedAt: "2026-08-10T00:00:00.000Z" })],
    evidence: [past],
    evidenceLinks: [{ storyId: "fed", evidenceId: past.id, evidenceRole: "context", linkedAt: "2026-08-10T01:00:00.000Z" }],
    queue: [{
      id: "queue-past",
      storyId: "fed",
      status: "pending",
      reason: "test",
      priority: 50,
      availableAt: "2026-09-28T00:00:00.000Z",
      createdAt: "2026-09-28T00:00:00.000Z",
    }],
    debt: [],
    now: new Date("2026-09-28T06:30:00.000Z"),
  });

  assert.equal(selected.length, 1);
  assert.deepEqual(selected[0]?.reviewContext?.catalystCandidates, []);
});


test("queue hygiene cancels only exact duplicates or already-applied requests", () => {
  const plan = planStoryReviewQueueHygiene({
    queue: [
      {
        id: "keep-high",
        storyId: "rates",
        status: "pending",
        reason: "new_linked_evidence",
        priority: 80,
        availableAt: "2026-08-19T10:00:00Z",
        createdAt: "2026-08-19T10:00:00Z",
        requestedEvidenceId: "evidence-1",
      },
      {
        id: "duplicate-low",
        storyId: "rates",
        status: "retryable",
        reason: "new_linked_evidence",
        priority: 70,
        availableAt: "2026-08-19T10:05:00Z",
        createdAt: "2026-08-19T10:05:00Z",
        requestedEvidenceId: "evidence-1",
      },
      {
        id: "distinct-aged",
        storyId: "rates",
        status: "pending",
        reason: "new_linked_evidence",
        priority: 70,
        availableAt: "2026-08-19T09:00:00Z",
        createdAt: "2026-08-19T09:00:00Z",
        requestedEvidenceId: "evidence-2",
      },
      {
        id: "already-applied",
        storyId: "ai",
        status: "pending",
        reason: "new_linked_evidence",
        priority: 70,
        availableAt: "2026-08-21T10:00:00Z",
        createdAt: "2026-08-21T10:00:00Z",
        requestedEvidenceId: "evidence-3",
      },
      {
        id: "system1-live",
        storyId: "rates",
        status: "pending",
        reason: "system1_threshold_crossing | Long End: Mixed -> Restrictive",
        priority: 80,
        availableAt: "2026-08-19T08:00:00Z",
        createdAt: "2026-08-19T08:00:00Z",
        requestedEvidenceId: null,
      },
    ],
    storyStatuses: new Map([
      ["rates", "publish"],
      ["ai", "publish"],
    ]),
    appliedQueueIds: new Set(["already-applied"]),
    requestedEvidenceFreshness: new Map([
      ["evidence-1", "current"],
      ["evidence-2", "current"],
      ["evidence-3", "current"],
    ]),
    now,
  });

  assert.deepEqual(plan.duplicateIds, ["duplicate-low"]);
  assert.deepEqual(plan.alreadyAppliedIds, ["already-applied"]);
  assert.deepEqual(plan.supersededEvidenceIds, []);
  assert.deepEqual(plan.cancelIds, ["already-applied", "duplicate-low"]);
  assert.deepEqual(plan.agedIds, ["distinct-aged", "keep-high"]);
  assert.equal(plan.cancelIds.includes("system1-live"), false);
  assert.equal(plan.agedIds.includes("system1-live"), false);
});

test("queue hygiene cancels an evidence-backed Story request when its exact canonical Evidence is superseded", () => {
  const plan = planStoryReviewQueueHygiene({
    queue: [
      {
        id: "dossier-superseded",
        storyId: "rates",
        status: "pending",
        reason: "dossier_motion_acceptance:dossier:motion:ACCEPT",
        priority: 95,
        availableAt: "2026-08-21T11:00:00Z",
        createdAt: "2026-08-21T11:00:00Z",
        requestedEvidenceId: "old-evidence",
      },
      {
        id: "dossier-current",
        storyId: "rates",
        status: "pending",
        reason: "dossier_motion_acceptance:dossier:new-motion:ACCEPT",
        priority: 95,
        availableAt: "2026-08-21T11:01:00Z",
        createdAt: "2026-08-21T11:01:00Z",
        requestedEvidenceId: "new-evidence",
      },
      {
        id: "system1-live",
        storyId: "rates",
        status: "pending",
        reason: "system1_threshold_crossing",
        priority: 80,
        availableAt: "2026-08-21T11:02:00Z",
        createdAt: "2026-08-21T11:02:00Z",
        requestedEvidenceId: null,
      },
    ],
    storyStatuses: new Map([["rates", "publish"]]),
    appliedQueueIds: new Set(),
    requestedEvidenceFreshness: new Map([
      ["old-evidence", "superseded"],
      ["new-evidence", "current"],
    ]),
    now,
  });

  assert.deepEqual(plan.supersededEvidenceIds, ["dossier-superseded"]);
  assert.deepEqual(plan.cancelIds, ["dossier-superseded"]);
  assert.equal(plan.cancelIds.includes("dossier-current"), false);
  assert.equal(plan.cancelIds.includes("system1-live"), false);
});

test("queue hygiene does not cancel requested Evidence merely because freshness lookup is unavailable", () => {
  const plan = planStoryReviewQueueHygiene({
    queue: [{
      id: "lookup-unavailable",
      storyId: "oil",
      status: "pending",
      reason: "dossier_motion_acceptance",
      priority: 95,
      availableAt: "2026-08-21T11:00:00Z",
      createdAt: "2026-08-21T11:00:00Z",
      requestedEvidenceId: "unknown-evidence",
    }],
    storyStatuses: new Map([["oil", "publish"]]),
    appliedQueueIds: new Set(),
    requestedEvidenceFreshness: new Map(),
    now,
  });

  assert.deepEqual(plan.supersededEvidenceIds, []);
  assert.deepEqual(plan.cancelIds, []);
});

test("queue hygiene never collapses distinct fresh evidence for the same Story", () => {
  const plan = planStoryReviewQueueHygiene({
    queue: [
      {
        id: "evidence-a",
        storyId: "oil",
        status: "pending",
        reason: "new_linked_evidence",
        priority: 70,
        availableAt: "2026-08-21T11:30:00Z",
        createdAt: "2026-08-21T11:30:00Z",
        requestedEvidenceId: "evidence-a",
      },
      {
        id: "evidence-b",
        storyId: "oil",
        status: "pending",
        reason: "new_linked_evidence",
        priority: 70,
        availableAt: "2026-08-21T11:31:00Z",
        createdAt: "2026-08-21T11:31:00Z",
        requestedEvidenceId: "evidence-b",
      },
    ],
    storyStatuses: new Map([["oil", "publish"]]),
    appliedQueueIds: new Set(),
    now,
  });

  assert.deepEqual(plan.cancelIds, []);
  assert.deepEqual(plan.duplicateIds, []);
  assert.deepEqual(plan.agedIds, []);
});
