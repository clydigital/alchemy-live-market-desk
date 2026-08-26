import assert from "node:assert/strict";
import test from "node:test";

import { composeAlchemyEdition, type EditionStory } from "../lib/intelligence/edition.ts";
import type { JourneyStorySource } from "../lib/intelligence/journey-briefing.ts";
import type { CanonicalStoryReasoningV1 } from "../lib/intelligence/story-reasoning.ts";
import type { MarketEventV1 } from "../lib/market-events.ts";

function story(id: string, overrides: Partial<EditionStory> = {}): EditionStory {
  return {
    id,
    parentStoryId: id,
    lifecycleStatus: "developing",
    title: `${id} mutable display title`,
    centralQuestion: `${id} mutable question?`,
    thesis: `${id} mutable thesis`,
    whatChanged: `${id} changed on canonical evidence.`,
    previousState: `${id} was stable.`,
    currentState: `${id} is under test.`,
    marketReaction: `${id} mutable ticker repriced.`,
    acceptedExplanation: `${id} mutable explanation.`,
    contradiction: "",
    overlookedVariable: `${id} variable.`,
    overlookedVariableEvidenceStatus: "inferred",
    marketMayBeRight: `${id} market-right case.`,
    mechanismSteps: [],
    plainEnglish: null,
    affectedAssets: [`DISPLAY-${id}`],
    themes: ["Macro"],
    nextTest: `${id} next test.`,
    confirmation: `${id} confirmation.`,
    invalidation: `${id} invalidation.`,
    confidence: 70,
    prohibitedClaims: [],
    changeKinds: ["evidence"],
    eventAt: "2026-08-26T08:00:00.000Z",
    ...overrides,
  };
}

function reasoning(id: string, overrides: Partial<CanonicalStoryReasoningV1> = {}): CanonicalStoryReasoningV1 {
  return {
    contractVersion: "canonical-story-reasoning/v1",
    storyId: id,
    storyVersionId: `thesis-${id}`,
    versionNumber: 2,
    effectiveAt: "2026-08-26T08:00:00.000Z",
    title: `${id} canonical headline`,
    centralQuestion: `What changed in canonical ${id}?`,
    lifecycle: "developing",
    confidence: 72,
    thesis: `${id} canonical thesis remains conditional.`,
    whatChanged: `${id} canonical change.`,
    previousState: `${id} canonical previous state.`,
    currentState: `${id} canonical current state.`,
    marketReaction: `${id} canonical market reaction.`,
    acceptedExplanation: `${id} accepted market interpretation.`,
    claims: [{ id: `claim-${id}`, type: "fact", text: `${id} fact.`, evidenceIds: [`fact-${id}`] }],
    causalChain: [{
      id: `edge-${id}`,
      sourceHypothesisId: `hypothesis-${id}`,
      from: `${id} catalyst`,
      relationship: "changes",
      to: `${id} outcome`,
      evidenceState: "strongly_supported",
      evidenceIds: [`mechanism-${id}`],
    }],
    countercase: {
      strongest: null,
      evidenceIds: [`challenger-${id}`],
      weakestLink: `${id} weakest link.`,
      marketMayBeRight: `${id} market may be right.`,
    },
    overlookedVariable: { text: `${id} overlooked variable.`, evidenceState: "inferred", evidenceIds: [`overlooked-${id}`] },
    assetImplications: [{
      asset: `CANONICAL-${id}`,
      bias: "mixed",
      conviction: 60,
      baseCase: `${id} base case.`,
      evidenceIds: [`asset-${id}`],
      confirmation: `${id} asset confirmation.`,
      invalidation: `${id} asset invalidation.`,
    }],
    confirmation: [`${id} confirms.`],
    invalidation: [`${id} invalidates.`],
    nextTest: {
      id: `next-${id}`,
      label: `${id} next decisive test`,
      status: "upcoming",
      catalystRef: `catalyst-${id}`,
      dueAt: "2026-08-28",
      expiresAt: null,
      evidenceIds: [`next-evidence-${id}`],
      resolutionEvidenceIds: [`resolution-${id}`],
    },
    visualPlan: [],
    ...overrides,
  };
}

function source(id: string, position: number, overrides: Partial<CanonicalStoryReasoningV1> = {}): JourneyStorySource {
  return {
    position,
    publicationSnapshotId: `snapshot-${id}`,
    storyId: id,
    thesisVersionId: `thesis-${id}`,
    reasoning: reasoning(id, overrides),
  };
}

function event(id: string, overrides: Partial<MarketEventV1> = {}): MarketEventV1 {
  return {
    version: "market-event-v1",
    id,
    occurrenceKey: id,
    eventType: "central_bank_speech",
    title: `Event ${id}`,
    startAt: "2026-08-28",
    endAt: null,
    timeLabel: "Time TBC",
    timePrecision: "date",
    status: "scheduled",
    verificationState: "official",
    participants: [],
    geography: [],
    affectedAssets: ["USD"],
    linkedStoryIds: [],
    linkedStorySlugs: [],
    decisiveVariable: "Does policy change?",
    transmission: "Policy can reprice rates.",
    expectedStage: null,
    expectation: null,
    sourceName: "Official source",
    sourceUrl: "https://example.com/event",
    sourceUrls: ["https://example.com/event"],
    sourceRecordRefs: [`source-${id}`],
    firstSeenAt: "2026-08-26T08:00:00.000Z",
    lastVerifiedAt: "2026-08-26T08:00:00.000Z",
    updatedAt: "2026-08-26T08:00:00.000Z",
    ...overrides,
  };
}

function board(stories: EditionStory[], sources = stories.map((item, index) => source(item.id, index + 1)), events: MarketEventV1[] = []) {
  return composeAlchemyEdition({
    generatedAt: "2026-08-26T09:00:00.000Z",
    comparisonWindowStart: "2026-08-25T09:00:00.000Z",
    stories,
    journeyStorySources: sources,
    marketEvents: events,
    marketTape: {
      regimeSummary: "Rates lead; cross-asset confirmation is mixed.",
      assets: [{ symbol: "SPX", move: "Observed", state: "Firm", whyRelevant: "Direct market evidence." }],
    },
  });
}

test("normal edition follows immutable manifest order and pins snapshots, thesis versions, and every evidence class", () => {
  const stories = [story("alpha"), story("bravo"), story("charlie")];
  const result = board(stories, [source("bravo", 1), source("alpha", 2), source("charlie", 3)]);
  assert.deepEqual(result.journey?.bigStories.map((item) => item.storyId), ["bravo", "alpha", "charlie"]);
  assert.equal(result.journey?.leadStoryId, "bravo");
  assert.equal(result.journey?.bigStories[0]?.publicationSnapshotId, "snapshot-bravo");
  assert.equal(result.journey?.bigStories[0]?.thesisVersionId, "thesis-bravo");
  assert.deepEqual(result.journey?.bigStories[0]?.evidenceRefs, [
    "fact-bravo", "mechanism-bravo", "challenger-bravo", "overlooked-bravo", "asset-bravo", "next-evidence-bravo", "resolution-bravo",
  ]);
});

test("contradictory edition retains the full Challenger and does not strengthen confidence", () => {
  const result = board([story("lead")], [source("lead", 1, {
    confidence: 51,
    countercase: { strongest: "Credit spreads reject the growth read.", evidenceIds: ["challenger-lead"], weakestLink: "The growth link.", marketMayBeRight: "Pricing may reflect resilient earnings." },
  })]);
  assert.equal(result.journey?.bigStories[0]?.contradiction.strongest, "Credit spreads reject the growth read.");
  assert.equal(result.journey?.bigStories[0]?.confidence, 51);
});

test("sparse editions stay sparse while a fourth supported Story is not hidden by a three-card cap", () => {
  assert.deepEqual(board([story("only")]).journey?.bigStories.map((item) => item.storyId), ["only"]);
  const four = [story("a"), story("b"), story("c"), story("d")];
  assert.equal(board(four).journey?.bigStories.length, 4);
});

test("degraded Event Horizon preserves known event IDs and visible coverage debt", () => {
  const fed = event("fed-appearance", { startAt: "2026-08-28", timePrecision: "date", timeLabel: "Time TBC" });
  const base = board([story("fed")], undefined, [fed]);
  const result = composeAlchemyEdition({
    generatedAt: base.generatedAt,
    comparisonWindowStart: base.comparisonWindowStart,
    stories: [story("fed")],
    journeyStorySources: [source("fed", 1)],
    marketEvents: [fed],
    diagnostics: {
      warnings: ["OPEC schedule unavailable: HTTP 403"],
      eventHorizonCoverage: [
        { family: "central_bank_appearances", state: "covered", sourceName: "Fed", sourceUrl: null, retrievedAt: base.generatedAt, confirmedEventCount: 1, detail: "Fed covered" },
        { family: "energy_policy", state: "source_failed", sourceName: "OPEC", sourceUrl: null, retrievedAt: base.generatedAt, confirmedEventCount: 0, detail: "Energy unavailable" },
        { family: "geopolitical_diplomatic", state: "unsupported", sourceName: null, sourceUrl: null, retrievedAt: base.generatedAt, confirmedEventCount: 0, detail: "No adapter" },
      ],
    },
  });
  assert.equal(result.journey?.horizon.later[0]?.eventId, "fed-appearance");
  assert.equal(result.journey?.horizon.later[0]?.timing.value, "2026-08-28");
  assert.equal(result.journey?.horizon.later[0]?.timing.precision, "date");
  assert.equal(result.journey?.diagnostics.eventHorizonCoverage.find((item) => item.family === "energy_policy")?.state, "source_failed");
  assert.equal(result.journey?.diagnostics.eventHorizonCoverage.find((item) => item.family === "geopolitical_diplomatic")?.state, "unsupported");
});

test("historical Journey payload remains byte-equivalent after newer Story versions are composed", () => {
  const oldJourney = structuredClone(board([story("oil")]).journey);
  const persistedOldEdition = { id: "7a90ab55-bd88-41c4-b138-1e9fad6399f6", payload: { journey: structuredClone(oldJourney) } };
  board([story("oil")], [source("oil", 1, { storyVersionId: "thesis-oil-v3", thesis: "New current thesis." })]);
  assert.deepEqual(persistedOldEdition.payload.journey, oldJourney);
});

test("hostile title, slug-like metadata, rank, and display tickers cannot alter canonical semantic selection", () => {
  const canonicalSource = [source("oil", 1)];
  const original = board([story("oil")], canonicalSource).journey;
  const hostile = board([story("oil", {
    title: "HOSTILE FED AI WAR TITLE",
    parentStoryId: "hostile-slug",
    affectedAssets: ["FAKE1", "FAKE2"],
    centralQuestion: "Hostile question?",
  })], canonicalSource).journey;
  assert.deepEqual(hostile, original);
  assert.deepEqual(hostile?.bigStories[0]?.assetImplications.map((item) => item.asset), ["CANONICAL-oil"]);
});

test("exact timestamps create Today and Tonight deterministically without title keywords", () => {
  const today = event("today", { title: "Neutral title A", startAt: "2026-08-26T09:30:00Z", timePrecision: "exact" });
  const tonight = event("tonight", { title: "Neutral title B", startAt: "2026-08-26T10:30:00Z", timePrecision: "exact" });
  const result = board([story("time")], undefined, [today, tonight]);
  assert.deepEqual(result.journey?.horizon.today.map((item) => item.eventId), ["today"]);
  assert.deepEqual(result.journey?.horizon.tonight.map((item) => item.eventId), ["tonight"]);
});

test("no tape does not manufacture a portfolio-wide opinion", () => {
  const result = composeAlchemyEdition({
    generatedAt: "2026-08-26T09:00:00.000Z",
    comparisonWindowStart: "2026-08-25T09:00:00.000Z",
    stories: [story("only")],
    journeyStorySources: [source("only", 1)],
  });
  assert.equal(result.journey?.closingMemory.currentBias, "No single portfolio-wide bias is canonically supported for this edition.");
});

test("missing exact reasoning degrades visibly instead of blocking the edition or using current state", () => {
  const result = board([story("missing")], []);
  assert.equal(result.journey?.bigStories.length, 0);
  assert.match(result.journey?.diagnostics.warnings[0] || "", /exact immutable Canonical Story Reasoning V1 snapshot is unavailable/i);
});
