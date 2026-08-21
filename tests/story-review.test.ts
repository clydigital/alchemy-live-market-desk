import assert from "node:assert/strict";
import test from "node:test";

import { explicitlyMentionedAssets } from "../lib/instrument-mentions.ts";
import {
  MAX_STORY_REVIEW_EVIDENCE,
  materialAssessmentHasEligibleEvidence,
  selectStoryReviewTargets,
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

test("stale review age creates a target using lifecycle-specific thresholds", () => {
  const selected = selectStoryReviewTargets({
    stories: [story("confirmed", { status: "confirmed", lastEvaluatedAt: "2026-08-20T11:59:59Z" })],
    evidence: [], evidenceLinks: [], queue: [], debt: [], now,
  });
  assert.equal(selected[0]?.reason, "review_age");
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
