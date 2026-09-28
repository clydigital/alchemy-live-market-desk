import assert from "node:assert/strict";
import test from "node:test";

import type { Story } from "../lib/data.ts";
import type { StoryThesisVersion } from "../lib/persistence/contracts.ts";
import { buildStoryBreakdown, storyPresentationState } from "../lib/story-breakdown.ts";

const story: Story = {
  id: "story-1", slug: "rates-inflation", title: "Inflation keeps rates restrictive",
  thesis: "Sticky inflation keeps duration under pressure.", status: "developing", confidence: 72, rank: 1,
  market_question: "Does inflation keep the long end restrictive?", dominant_narrative: null,
  best_explanation: "Persistent inflation keeps rate-cut expectations constrained.", strongest_support: null,
  strongest_contradiction: null, priced_assessment: null, confirmation_trigger: "US10Y remains above 5%.",
  invalidation_trigger: "Inflation cools and long yields fall.", next_catalyst: null, article_angle: null,
  provisional_title: null, article_verdict: null, assets: ["US10Y", "DXY", "NDX", "XAUUSD"],
  source_quality: 80, novelty: 70, persistence: 80, trader_relevance: 90, article_potential: 75,
};

function version(input: Partial<StoryThesisVersion> & { snapshot: Record<string, unknown> }): StoryThesisVersion {
  return {
    id: "version-1", story_id: story.id, event_id: null, version_number: 1, title: story.title, thesis: story.thesis,
    status: "developing", confidence: 72, market_question: story.market_question, dominant_narrative: null,
    best_explanation: story.best_explanation, strongest_support: null, strongest_contradiction: null, priced_assessment: null,
    confirmation_trigger: story.confirmation_trigger, invalidation_trigger: story.invalidation_trigger, next_catalyst: null,
    article_angle: null, provisional_title: null, article_verdict: null, assets: story.assets, portfolio_map: {},
    change_reason: "Material evidence changed the Story.", effective_at: "2026-09-28T00:00:00Z",
    created_at: "2026-09-28T00:00:00Z", created_by: null, ...input,
  };
}

test("expired deciding catalyst forces a Story into needs_reframe", () => {
  const stale = version({
    title: "Weak jobs meet expensive oil; CPI becomes the tie-breaker",
    thesis: "July CPI is the cleanest near-term decision point for rates.",
    next_catalyst: "U.S. CPI and Real Earnings on 12 August 2026",
    snapshot: { maintenanceContext: { reasoningPatch: { nextTest: {
      label: "U.S. CPI and Real Earnings on 12 August 2026", status: "expired", dueAt: null,
      expiresAt: "2026-09-28T06:53:39Z",
    } } } },
  });
  assert.equal(storyPresentationState({ story, version: stale, now: new Date("2026-09-29T00:00:00Z") }).state, "needs_reframe");
});

test("an expired test does not stale durable framing that no longer depends on it", () => {
  const durable = version({
    title: "Productivity gains now face a weaker-demand test",
    thesis: "Productivity gains remain conditional on household demand holding up.",
    snapshot: { reasoning: { contractVersion: "canonical-story-reasoning/v1", nextTest: {
      id: "test-1", label: "U.S. CPI on 12 August 2026", status: "expired", catalystRef: null,
      dueAt: "2026-08-12T12:00:00Z", expiresAt: "2026-08-12T13:00:00Z", evidenceIds: [], resolutionEvidenceIds: [],
    } } },
  });
  assert.equal(storyPresentationState({ story, version: durable, now: new Date("2026-09-29T00:00:00Z") }).state, "active");
  const breakdown = buildStoryBreakdown({ story, version: durable, now: new Date("2026-09-29T00:00:00Z") });
  assert.equal(breakdown.nextTest, null);
});

test("canonical reasoning projects into a compact Story breakdown without another model pass", () => {
  const current = version({ snapshot: { reasoning: {
    contractVersion: "canonical-story-reasoning/v1", lifecycle: "developing",
    whatChanged: "Treasury yields moved higher after stronger inflation evidence.", previousState: "Long yields were stable.",
    currentState: "Rates remain restrictive and duration-sensitive assets are under pressure.",
    marketReaction: "US10Y rose while NDX weakened.",
    acceptedExplanation: "Inflation persistence is keeping the expected policy path tighter for longer.", claims: [],
    causalChain: [{ id: "edge-1", sourceHypothesisId: "hyp-1", from: "Sticky inflation", relationship: "keeps",
      to: "long yields elevated", evidenceState: "strongly_supported", evidenceIds: [] }],
    countercase: { strongest: null, evidenceIds: [], weakestLink: null, marketMayBeRight: null },
    overlookedVariable: { text: null, evidenceState: null, evidenceIds: [] },
    assetImplications: [{ asset: "NDX", bias: "bearish", conviction: 70,
      baseCase: "Higher discount rates pressure long-duration equity valuations.", evidenceIds: [],
      confirmation: "US10Y remains elevated.", invalidation: "Long yields fall materially." }],
    confirmation: ["US10Y remains elevated."], invalidation: ["Inflation cools and long yields fall."],
    nextTest: { id: "test-2", label: "Next PCE release", status: "upcoming", catalystRef: null,
      dueAt: "2026-10-30T12:30:00Z", expiresAt: null, evidenceIds: [], resolutionEvidenceIds: [] },
    visualPlan: [],
  } } });
  const breakdown = buildStoryBreakdown({ story, version: current, event: { headline: "Core inflation surprised higher" }, now: new Date("2026-09-29T00:00:00Z") });
  assert.equal(breakdown.whatHappened, "Core inflation surprised higher");
  assert.equal(breakdown.whyItMatters, "Inflation persistence is keeping the expected policy path tighter for longer.");
  assert.deepEqual(breakdown.affectedMarkets.slice(0, 2), ["NDX", "US10Y"]);
  assert.equal(breakdown.affectedMarkets.includes("NDX"), true);
  assert.equal(breakdown.affectedMarkets.includes("US10Y"), true);
  assert.equal(breakdown.mechanism[0]?.from, "Sticky inflation");
  assert.equal(breakdown.implications[0]?.asset, "NDX");
  assert.equal(breakdown.nextTest?.label, "Next PCE release");
});

test("fallback breakdown does not invent a causal chain from prose", () => {
  const breakdown = buildStoryBreakdown({ story });
  assert.equal(breakdown.mechanism.length, 0);
  assert.equal(breakdown.whyItMatters, story.best_explanation);
});


test("internal recalibration event codes fall back to canonical reader-facing change text", () => {
  const current = version({ snapshot: { reasoning: {
    contractVersion: "canonical-story-reasoning/v1",
    lifecycle: "developing",
    whatChanged: "Treasury yields repriced higher after stronger activity data.",
    previousState: "Rates were stable.",
    currentState: "US10Y remains elevated.",
    marketReaction: "US10Y rose while QQQ softened.",
    acceptedExplanation: "Higher yields raised discount rates.",
    claims: [],
    causalChain: [],
    countercase: { strongest: null, evidenceIds: [], weakestLink: null, marketMayBeRight: null },
    overlookedVariable: { text: null, evidenceState: null, evidenceIds: [] },
    assetImplications: [],
    confirmation: [],
    invalidation: [],
    nextTest: null,
    visualPlan: [],
  } } });
  const breakdown = buildStoryBreakdown({
    story,
    version: { ...current, change_reason: "material_evidence_recalibration" },
    event: { headline: "material_evidence_recalibration" },
  });
  assert.equal(breakdown.whatHappened, "Treasury yields repriced higher after stronger activity data.");
});
