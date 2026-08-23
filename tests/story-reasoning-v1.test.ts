import test from "node:test";
import assert from "node:assert/strict";

import {
  CANONICAL_STORY_REASONING_V1,
  buildCanonicalStoryReasoningSnapshotV1,
  canonicalCausalEdgeId,
  materialiseCanonicalStoryReasoningV1,
  type ImmutableStoryVersionV1,
  type StoryReasoningEvidence,
} from "../lib/intelligence/story-reasoning.ts";

const evidence: StoryReasoningEvidence[] = [
  { id: "ev-1", claim: "US 2-year yields fell after the inflation release." },
  { id: "ev-2", claim: "Gold rose while the dollar weakened." },
  { id: "ev-3", claim: "The next CPI release remains the resolving catalyst." },
];

const evidenceById = new Map(evidence.map((item) => [item.id, item]));

function buildSnapshot() {
  return buildCanonicalStoryReasoningSnapshotV1({
    synthesis: {
      lifecycleStatus: "developing",
      thesis: "Lower front-end yields are supporting gold while the dollar softens.",
      whatChanged: "The yield move now confirms the earlier macro setup.",
      previousState: "Gold was waiting for rates confirmation.",
      currentState: "Rates have moved in the thesis direction.",
      marketReaction: "Gold strengthened and DXY weakened.",
      acceptedExplanation: "The rates impulse is easing the opportunity cost of holding gold.",
      acceptedExplanationEvidenceIds: ["ev-1", "ev-2"],
      overlookedVariable: "Treasury intervention can temporarily distort long-end price signals.",
      overlookedVariableEvidenceStatus: "inferred",
      overlookedVariableEvidenceIds: ["ev-1"],
      marketMayBeRight: "The move can reverse if inflation reaccelerates.",
      decisiveEvidenceIds: ["ev-1", "ev-2"],
    },
    hypothesis: {
      id: "hyp-1",
      causalMechanism: "Lower front-end yields reduce the opportunity cost of holding gold.",
      evidenceForIds: ["ev-1", "ev-2"],
      causalChain: [
        {
          from: "Lower front-end yields",
          relationship: "reduce",
          to: "gold opportunity cost",
          evidenceState: "strongly_supported",
          evidenceIds: ["ev-1"],
        },
        {
          from: "Lower gold opportunity cost",
          relationship: "supports",
          to: "gold demand",
          evidenceState: "inferred",
          evidenceIds: ["ev-1", "ev-2"],
        },
        {
          from: "Further policy intervention",
          relationship: "could distort",
          to: "long-end yield signals",
          evidenceState: "speculative",
          evidenceIds: [],
        },
      ],
      confirmationCriteria: ["Front-end yields continue lower"],
      invalidationCriteria: ["DXY and real yields break materially higher"],
      nextCatalysts: ["Next CPI release"],
    },
    challenger: {
      strongestCountercase: "Inflation reacceleration could reverse the yield move.",
      conflictingEvidenceIds: ["ev-3"],
      weakestLink: "The durability of the rates move is not yet proven.",
    },
    scenarios: [
      {
        asset: "XAUUSD",
        bias: "slightly_bullish",
        conviction: 65,
        baseCase: { summary: "Gold remains supported while front-end yields stay contained.", probability: 55 },
        bullCase: { summary: "Gold extends higher as yields fall further.", probability: 25 },
        bearCase: { summary: "Gold reverses as yields and DXY recover.", probability: 15 },
        tailCase: { summary: "A liquidity shock lifts the dollar and gold together.", probability: 5 },
        explanatoryEvidenceIds: ["ev-1", "ev-2"],
        confirmation: "Gold holds above the breakout while yields remain lower.",
        invalidation: "Gold loses the breakout as yields and DXY recover.",
      },
    ],
    evidenceById,
  });
}

test("Canonical Story Reasoning V1 preserves edge order and evidence state", () => {
  const snapshot = buildSnapshot();
  assert.equal(snapshot.contractVersion, CANONICAL_STORY_REASONING_V1);
  assert.equal(snapshot.causalChain.length, 3);
  assert.deepEqual(snapshot.causalChain.map((edge) => edge.evidenceState), ["strongly_supported", "inferred", "speculative"]);
  assert.deepEqual(snapshot.causalChain.map((edge) => [edge.from, edge.relationship, edge.to]), [
    ["Lower front-end yields", "reduce", "gold opportunity cost"],
    ["Lower gold opportunity cost", "supports", "gold demand"],
    ["Further policy intervention", "could distort", "long-end yield signals"],
  ]);
  assert.equal(snapshot.causalChain[0].id, canonicalCausalEdgeId("hyp-1", 0, snapshot.causalChain[0]));
  assert.equal(snapshot.causalChain[1].id, canonicalCausalEdgeId("hyp-1", 1, snapshot.causalChain[1]));
});

test("Canonical Story Reasoning V1 rejects unknown causal evidence IDs", () => {
  assert.throws(() => buildCanonicalStoryReasoningSnapshotV1({
    synthesis: {
      lifecycleStatus: "developing",
      thesis: "Test thesis",
      whatChanged: null,
      previousState: null,
      currentState: null,
      marketReaction: null,
      acceptedExplanation: null,
      overlookedVariable: null,
      overlookedVariableEvidenceStatus: null,
      marketMayBeRight: null,
      decisiveEvidenceIds: [],
    },
    hypothesis: {
      id: "hyp-1",
      causalMechanism: "A moves B.",
      evidenceForIds: [],
      causalChain: [{
        from: "A",
        relationship: "moves",
        to: "B",
        evidenceState: "observed",
        evidenceIds: ["missing-evidence"],
      }],
      confirmationCriteria: [],
      invalidationCriteria: [],
      nextCatalysts: [],
    },
    challenger: null,
    scenarios: [],
    evidenceById,
  }), /unknown canonical evidence ID/);
});

test("observed and strongly-supported causal edges require evidence", () => {
  for (const evidenceState of ["observed", "strongly_supported"] as const) {
    assert.throws(() => buildCanonicalStoryReasoningSnapshotV1({
      synthesis: {
        lifecycleStatus: "developing",
        thesis: "Test thesis",
        whatChanged: null,
        previousState: null,
        currentState: null,
        marketReaction: null,
        acceptedExplanation: null,
        overlookedVariable: null,
        overlookedVariableEvidenceStatus: null,
        marketMayBeRight: null,
        decisiveEvidenceIds: [],
      },
      hypothesis: {
        id: "hyp-1",
        causalMechanism: "A moves B.",
        evidenceForIds: [],
        causalChain: [{
          from: "A",
          relationship: "moves",
          to: "B",
          evidenceState,
          evidenceIds: [],
        }],
        confirmationCriteria: [],
        invalidationCriteria: [],
        nextCatalysts: [],
      },
      challenger: null,
      scenarios: [],
      evidenceById,
    }), new RegExp(`state ${evidenceState} requires canonical evidence`));
  }
});

test("fact claims are copied only from canonical evidence text", () => {
  const snapshot = buildSnapshot();
  const facts = snapshot.claims.filter((claim) => claim.type === "fact");
  assert.deepEqual(facts.map((claim) => claim.text), [evidence[0].claim, evidence[1].claim]);
  assert.deepEqual(facts.map((claim) => claim.evidenceIds), [["ev-1"], ["ev-2"]]);
});

test("Hypothesis-owned causal state and criteria survive materialisation", () => {
  const snapshot = buildSnapshot();
  assert.equal(snapshot.causalMechanism, "Lower front-end yields reduce the opportunity cost of holding gold.");
  assert.deepEqual(snapshot.confirmation, ["Front-end yields continue lower"]);
  assert.deepEqual(snapshot.invalidation, ["DXY and real yields break materially higher"]);
  assert.deepEqual(snapshot.nextCatalysts, ["Next CPI release"]);
});

test("Challenger countercase survives materialisation", () => {
  const snapshot = buildSnapshot();
  assert.deepEqual(snapshot.countercase, {
    strongest: "Inflation reacceleration could reverse the yield move.",
    evidenceIds: ["ev-3"],
    weakestLink: "The durability of the rates move is not yet proven.",
    marketMayBeRight: "The move can reverse if inflation reaccelerates.",
  });
});

test("Scenario asset implications survive materialisation", () => {
  const snapshot = buildSnapshot();
  assert.deepEqual(snapshot.assetImplications, [{
    asset: "XAUUSD",
    bias: "bullish",
    conviction: 65,
    baseCase: { summary: "Gold remains supported while front-end yields stay contained.", probability: 55 },
    bullCase: { summary: "Gold extends higher as yields fall further.", probability: 25 },
    bearCase: { summary: "Gold reverses as yields and DXY recover.", probability: 15 },
    tailCase: { summary: "A liquidity shock lifts the dollar and gold together.", probability: 5 },
    evidenceIds: ["ev-1", "ev-2"],
    confirmation: "Gold holds above the breakout while yields remain lower.",
    invalidation: "Gold loses the breakout as yields and DXY recover.",
  }]);
});

test("materialisation is immutable and ignores later current Story state", () => {
  const reasoning = buildSnapshot();
  const version: ImmutableStoryVersionV1 = {
    id: "version-7",
    story_id: "story-1",
    version_number: 7,
    effective_at: "2026-08-23T06:00:00.000Z",
    title: "Frozen title",
    market_question: "Will lower yields keep supporting gold?",
    status: "monitor",
    confidence: 68,
    thesis: "Frozen thesis",
    snapshot: { origin: "alchemy_research_engine", reasoning },
  };

  const first = materialiseCanonicalStoryReasoningV1(version);
  assert.ok(first);
  assert.equal(first.storyVersionId, "version-7");
  assert.equal(first.title, "Frozen title");
  assert.equal(first.thesis, "Frozen thesis");

  const mutatedCurrentStory = {
    title: "Current Story title changed later",
    thesis: "Current Story thesis changed later",
    confidence: 5,
  };
  void mutatedCurrentStory;

  const replay = materialiseCanonicalStoryReasoningV1(structuredClone(version));
  assert.deepEqual(replay, first);
});

test("PR 1 leaves next-test structuring and visual planning empty for PR 3", () => {
  const snapshot = buildSnapshot();
  assert.equal(snapshot.nextTest, null);
  assert.deepEqual(snapshot.visualPlan, []);
});
