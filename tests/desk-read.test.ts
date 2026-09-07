import assert from "node:assert/strict";
import test from "node:test";

import { buildDeskRead, type DeskReadStory } from "../lib/desk-read.ts";

const generatedAt = "2026-09-07T09:00:00Z";

function story(input: Partial<DeskReadStory> = {}): DeskReadStory {
  return {
    id: "rates-story",
    slug: "rates-story",
    title: "Rates retake control",
    marketQuestion: "Are rates becoming the dominant cross-asset driver again?",
    thesis: "Higher energy and policy risk are tightening the rates backdrop.",
    confidence: 78,
    rank: 1,
    featuredRank: 1,
    status: "confirmed",
    bestExplanation: "Oil and hawkish policy risk are lifting inflation-sensitive yields.",
    strongestSupport: "Rates and energy are moving in the direction implied by the thesis.",
    strongestContradiction: "Equities remain resilient rather than confirming broad risk-off.",
    confirmationCondition: "US yields continue higher with inflation-sensitive assets confirming.",
    invalidationCondition: "Yields reverse while the oil impulse fades.",
    nextCatalyst: "Next inflation release",
    recencyAt: "2026-09-07T08:40:00Z",
    intelligence: {
      lifecycleStatus: "confirmed",
      qualificationScore: 86,
      causalMechanism: "Oil inflation pressure raises the policy-rate tail and pushes yields higher.",
      affectedAssets: ["US10Y", "NDX", "BRENT"],
      confirmationCriteria: ["Breakevens and nominal yields confirm the inflation impulse."],
      invalidationCriteria: ["Oil and yields both reverse the move."],
      nextCatalysts: ["CPI"],
      marketBelief: "Rates are reasserting themselves as the main cross-asset constraint.",
      strongestSupport: "The rates complex confirms the direction of the causal chain.",
      strongestContradiction: "Equity breadth has not deteriorated materially.",
      lastEvidenceAt: "2026-09-07T08:45:00Z",
    },
    ...input,
  };
}

test("Desk Read exposes a supported canonical causal explanation and cross-asset checks", () => {
  const read = buildDeskRead({
    stories: [story(), story({ id: "secondary", slug: "secondary", featuredRank: 2, confidence: 68, marketQuestion: "Secondary driver?" })],
    materialDeltas: [{
      id: "event-1",
      storyId: "rates-story",
      storySlug: "rates-story",
      type: "confirmation",
      headline: "Rates impulse strengthened",
      detail: "New evidence reinforced the existing Story.",
      eventAt: "2026-09-07T08:50:00Z",
      canonical: true,
      materiality: "high",
    }],
    causalEdges: [{
      id: "edge-1",
      story_id: "rates-story",
      from_node: "Oil",
      relationship: "raises",
      to_node: "Inflation risk",
      direction: "positive",
      evidence_state: "confirmed",
      confidence: 82,
      mechanism: "Higher oil keeps the inflation tail alive.",
      confirmation_condition: "Breakevens rise with oil.",
      invalidation_condition: "Oil reverses without inflation follow-through.",
    }],
    assetImpacts: [
      { id: "impact-1", story_id: "rates-story", asset_key: "US10Y", asset_class: "rates", direction: "higher", time_horizon: "days", mechanism: "Inflation risk lifts yields.", confidence: 84, evidence_state: "confirmed", as_of: "2026-09-07T08:50:00Z" },
      { id: "impact-2", story_id: "rates-story", asset_key: "NDX", asset_class: "equities", direction: "negative", time_horizon: "days", mechanism: "Higher discount rates pressure duration.", confidence: 74, evidence_state: "supporting", as_of: "2026-09-07T08:50:00Z" },
    ],
    deskMemory: {
      toneShift: {
        detected: true,
        severity: "meaningful",
        shifts: [{ key: "rates", label: "Rates", currentTone: "MORE HAWKISH", baselineTone: "MIXED", direction: "riskier", summary: "Rate expectations have turned more hawkish.", delta: 0.8 }],
      },
    },
    generatedAt,
  });

  assert.equal(read.status, "explained");
  assert.equal(read.noConvincingExplanation, false);
  assert.equal(read.explanationBasis, "canonical_causal_graph");
  assert.equal(read.dominantDriver?.storyId, "rates-story");
  assert.equal(read.explanationConfidence.label, "high");
  assert.equal(read.observedChanges[0]?.headline, "Rates impulse strengthened");
  assert.deepEqual(read.crossAssetChecks.map((item) => item.asset), ["US10Y", "NDX"]);
  assert.match(read.regime.label, /RATES/);
  assert.ok(read.invalidationConditions.some((item) => /reverse/i.test(item)));
});

test("Desk Read says explanation is unresolved instead of inventing a causal story", () => {
  const read = buildDeskRead({
    stories: [story({
      bestExplanation: null,
      strongestSupport: null,
      strongestContradiction: null,
      intelligence: {
        lifecycleStatus: "developing",
        qualificationScore: 60,
        causalMechanism: null,
        affectedAssets: ["SPX"],
        marketBelief: null,
        researchSynthesis: null,
        lastEvidenceAt: "2026-09-07T08:45:00Z",
      },
    })],
    generatedAt,
  });

  assert.equal(read.status, "unresolved");
  assert.equal(read.noConvincingExplanation, true);
  assert.equal(read.explanationBasis, "insufficient_canonical_evidence");
  assert.equal(read.mechanism, null);
  assert.equal(read.causalChain.length, 0);
  assert.equal(read.assetImplications.length, 0);
});

test("historical Desk Read does not leak current material deltas", () => {
  const read = buildDeskRead({
    stories: [story()],
    materialDeltas: [{ id: "current-event", storyId: "rates-story", headline: "Current event", eventAt: generatedAt, canonical: true }],
    generatedAt,
    historical: true,
  });

  assert.equal(read.historical, true);
  assert.deepEqual(read.observedChanges, []);
  assert.equal(read.materialChangeSincePrevious, null);
});
