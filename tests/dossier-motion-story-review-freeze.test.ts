import assert from "node:assert/strict";
import test from "node:test";

import type { DossierMotionStoryReviewContext } from "../lib/dossier-v2/story-review-context.ts";
import { selectStoryReviewTargets, type StoryReviewStory } from "../lib/intelligence/story-review.ts";
import type { EvidencePackItem } from "../lib/intelligence/schemas.ts";

const now = new Date("2026-10-06T02:00:00.000Z");
const storyId = "22222222-2222-4222-8222-222222222222";

function story(): StoryReviewStory {
  return {
    id: storyId,
    slug: "rates-duration-stress",
    title: "Rates duration stress",
    thesis: "Long-end funding conditions remain restrictive.",
    status: "developing",
    confidence: 66,
    marketQuestion: null,
    dominantNarrative: null,
    strongestSupport: null,
    strongestContradiction: null,
    confirmationTrigger: null,
    invalidationTrigger: null,
    nextCatalyst: null,
    assets: ["US10Y"],
    lastEvaluatedAt: "2026-10-06T00:00:00.000Z",
    lastEvidenceAt: null,
    nextCatalysts: [],
  };
}

function evidence(id: string): EvidencePackItem {
  return {
    id,
    claim: `Canonical evidence ${id}`,
    summary: null,
    evidenceClass: "official_release",
    sourceName: "Official source",
    sourceTier: 1,
    reliabilityScore: 95,
    ancestryGroupId: id,
    supportDirection: "context",
    eventAt: "2026-10-06T01:00:00.000Z",
    publishedAt: "2026-10-06T01:00:00.000Z",
    availableAt: "2026-10-06T01:00:00.000Z",
    receivedAt: "2026-10-06T01:01:00.000Z",
    freshnessStatus: "current",
    affectedAssets: ["US10Y"],
    affectedTopics: ["rates-duration-stress"],
    provenanceUrls: [`https://example.test/${id}`],
    structuredPayload: {},
  };
}

function context(index: number, evidenceId: string): DossierMotionStoryReviewContext {
  return {
    contractVersion: "dossier-motion-story-review-context/1",
    authority: "CONTEXT_ONLY",
    dossierId: "11111111-1111-4111-8111-111111111111",
    motionId: `motion-${index}`,
    decision: index % 2 ? "REFINE" : "ACCEPT",
    targetStoryId: storyId,
    canonicalEvidenceId: evidenceId,
    routeKind: "motion_primary_story",
    routeReason: "motion_primary_story",
    primaryStoryId: storyId,
    primaryRegimeSlug: "global-cost-of-capital",
    system2Conclusion: `System 2 context ${index}`,
    system2Rationale: `Why Story review was requested ${index}`,
    nextTest: index % 2 ? `Next test ${index}` : null,
  };
}

test("C1.4b1 freezes resolved Dossier context only for processable Story queue obligations", () => {
  const evidenceIds = [
    "33333333-3333-4333-8333-333333333331",
    "33333333-3333-4333-8333-333333333332",
    "33333333-3333-4333-8333-333333333333",
    "33333333-3333-4333-8333-333333333334",
  ];
  const queue = evidenceIds.map((evidenceId, index) => ({
    id: `queue-${index}`,
    storyId,
    status: "pending",
    reason: `dossier_motion_acceptance:11111111-1111-4111-8111-111111111111:motion-${index}:REFINE | motion_primary_story`,
    priority: 100 - index,
    availableAt: "2026-10-06T01:30:00.000Z",
    createdAt: `2026-10-06T01:0${index}:00.000Z`,
    requestedEvidenceId: evidenceId,
    dossierMotionContext: context(index, evidenceId),
  }));

  const [target] = selectStoryReviewTargets({
    stories: [story()],
    evidence: evidenceIds.map(evidence),
    evidenceLinks: [],
    queue,
    debt: [],
    now,
  });

  assert.ok(target);
  assert.deepEqual(
    target.reviewContext?.dossierMotionReassessments?.map((item) => item.motionId),
    ["motion-0", "motion-1", "motion-2"],
  );
  assert.deepEqual(
    target.reviewContext?.dossierMotionReassessments?.map((item) => item.canonicalEvidenceId),
    evidenceIds.slice(0, 3),
  );
  assert.equal(target.reviewContext?.dossierMotionReassessments?.every(
    (item) => item.authority === "CONTEXT_ONLY",
  ), true);
});

test("C1.4b1 does not freeze Dossier context when its Evidence obligation is not in the bounded review pack", () => {
  const missingEvidenceId = "33333333-3333-4333-8333-333333333399";
  const [target] = selectStoryReviewTargets({
    stories: [story()],
    evidence: [],
    evidenceLinks: [],
    queue: [{
      id: "queue-missing",
      storyId,
      status: "pending",
      reason: "dossier_motion_acceptance:11111111-1111-4111-8111-111111111111:motion-x:REFINE | motion_primary_story",
      priority: 100,
      availableAt: "2026-10-06T01:30:00.000Z",
      createdAt: "2026-10-06T01:00:00.000Z",
      requestedEvidenceId: missingEvidenceId,
      dossierMotionContext: context(9, missingEvidenceId),
    }],
    debt: [],
    now,
  });

  assert.equal(target, undefined);
});

test("C1.4b1 deduplicates the same immutable Dossier Motion context deterministically", () => {
  const evidenceId = "33333333-3333-4333-8333-333333333333";
  const frozen = context(1, evidenceId);
  const [target] = selectStoryReviewTargets({
    stories: [story()],
    evidence: [evidence(evidenceId)],
    evidenceLinks: [],
    queue: [
      {
        id: "queue-a", storyId, status: "pending", reason: "a", priority: 95,
        availableAt: "2026-10-06T01:30:00.000Z", createdAt: "2026-10-06T01:00:00.000Z",
        requestedEvidenceId: evidenceId, dossierMotionContext: frozen,
      },
      {
        id: "queue-b", storyId, status: "pending", reason: "b", priority: 90,
        availableAt: "2026-10-06T01:30:00.000Z", createdAt: "2026-10-06T01:01:00.000Z",
        requestedEvidenceId: evidenceId, dossierMotionContext: frozen,
      },
    ],
    debt: [],
    now,
  });

  assert.equal(target?.reviewContext?.dossierMotionReassessments?.length, 1);
  assert.equal(target?.reviewContext?.dossierMotionReassessments?.[0]?.motionId, "motion-1");
});
