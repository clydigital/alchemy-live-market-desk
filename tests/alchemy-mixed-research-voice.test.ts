import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  applyExplanationPass,
  composeAlchemyEdition,
  normaliseWatchlist,
  qualifySource,
  scheduledGeopoliticalEvents,
  selectMaterialChanges,
  type AlchemyEdition,
  type EditionStory,
  type WatchlistItem,
} from "../lib/intelligence/edition.ts";

function story(overrides: Partial<EditionStory> = {}): EditionStory {
  return {
    id: "story-1",
    parentStoryId: "story-1",
    lifecycleStatus: "developing",
    title: "Oil state changed",
    centralQuestion: "Did the physical oil state change?",
    thesis: "Physical supply is tighter than the headline implies.",
    whatChanged: "Exports fell.",
    previousState: "Exports were stable.",
    currentState: "Exports are lower.",
    marketReaction: "Oil rose.",
    acceptedExplanation: "The market added supply risk.",
    contradiction: "Energy equities lagged.",
    overlookedVariable: "Verified vessel departures.",
    overlookedVariableEvidenceStatus: "observed",
    marketMayBeRight: "Demand could weaken.",
    mechanismSteps: [{ step: 1, text: "Lower exports tighten prompt supply.", evidenceStatus: "strongly_supported" }],
    plainEnglish: "Less oil left the port.",
    affectedAssets: ["CL"],
    themes: ["Energy"],
    nextTest: "Next export print",
    confirmation: "Exports remain lower",
    invalidation: "Exports recover",
    confidence: 70,
    prohibitedClaims: ["mispriced"],
    changeKinds: ["evidence"],
    eventAt: "2026-08-13T06:00:00.000Z",
    ...overrides,
  };
}

function edition(stories: EditionStory[]): AlchemyEdition {
  return composeAlchemyEdition({
    generatedAt: "2026-08-13T07:00:00.000Z",
    comparisonWindowStart: "2026-08-12T07:00:00.000Z",
    stories,
  });
}

test("minimum-four logic does not manufacture a fourth weak story", () => {
  const stories = [
    story({ id: "a", parentStoryId: "a" }),
    story({ id: "b", parentStoryId: "b" }),
    story({ id: "c", parentStoryId: "c" }),
    story({ id: "weak", parentStoryId: "weak", changeKinds: [] }),
  ];
  const result = edition(stories);
  assert.equal(result.sinceYouLastChecked.length, 3);
  assert.equal(result.materialChangeTargetMet, false);
});

test("four updates to one parent story remain one material change", () => {
  const result = selectMaterialChanges([1, 2, 3, 4].map((index) => story({
    id: `child-${index}`,
    parentStoryId: "same-parent",
    currentState: `state-${index}`,
  })));
  assert.equal(result.length, 1);
});

test("genuinely distinct material changes remain distinct", () => {
  const result = selectMaterialChanges([1, 2, 3, 4].map((index) => story({
    id: `story-${index}`,
    parentStoryId: `story-${index}`,
  })));
  assert.equal(result.length, 4);
});

test("an unchanged recurring story is not relabelled as new", () => {
  const current = story();
  const prior = edition([current]);
  assert.equal(selectMaterialChanges([current], prior).length, 0);
});

test("the explanation pass cannot alter locked analytical fields", () => {
  const canonical = {
    thesis: "Locked thesis",
    confidence: 68,
    confirmation: "Locked confirmation",
    invalidation: "Locked invalidation",
    prohibitedClaims: ["priced in"],
  };
  const explained = applyExplanationPass(canonical, {
    thesis: "Changed thesis",
    confidence: 99,
    confirmation: "Changed confirmation",
    invalidation: "Changed invalidation",
    prohibitedClaims: [],
    plainEnglish: "A simpler explanation.",
  });
  assert.deepEqual(
    {
      thesis: explained.thesis,
      confidence: explained.confidence,
      confirmation: explained.confirmation,
      invalidation: explained.invalidation,
      prohibitedClaims: explained.prohibitedClaims,
    },
    canonical,
  );
});

test("a political or social statement remains messaging rather than proof", () => {
  const qualified = qualifySource({
    evidenceClass: "news_report",
    sourceTier: 3,
    isPoliticalOrSocialStatement: true,
  });
  assert.equal(qualified.sourceStatus, "named_source");
  assert.equal(qualified.evidenceMeaning, "messaging_or_intent");
  assert.equal(qualified.establishesRealWorldCondition, false);
});

test("Big Names Said preserves source status", () => {
  const result = composeAlchemyEdition({
    generatedAt: "2026-08-13T07:00:00.000Z",
    comparisonWindowStart: "2026-08-12T07:00:00.000Z",
    stories: [story()],
    bigNames: [{
      personOrInstitution: "Central bank",
      statement: "Policy remains data-dependent.",
      sourceStatus: "official",
      whatChanged: "New guidance",
      implication: "Front-end rates remain exposed.",
      verificationNeeded: "Official minutes",
    }],
  });
  assert.equal(result.bigNames[0]?.sourceStatus, "official");
});

test("the watchlist is conditional and capped at six names", () => {
  const valid = (index: number): WatchlistItem => ({
    symbol: `T${index}`,
    bucket: "setup",
    theme: "Energy",
    whyNow: "New evidence",
    structure: "Near trigger",
    confirmation: "Breaks trigger",
    invalidation: "Loses support",
    catalyst: "Earnings",
    confidence: "medium",
  });
  const result = normaliseWatchlist([
    ...Array.from({ length: 8 }, (_, index) => valid(index)),
    { ...valid(9), confirmation: "" },
  ]);
  assert.equal(result.length, 6);
  assert.ok(result.every((item) => item.confirmation));
});

test("the geopolitical clock accepts scheduled events only", () => {
  const result = scheduledGeopoliticalEvents([
    {
      time: "2026-08-14T10:00:00.000Z",
      event: "Scheduled summit",
      participants: ["A", "B"],
      transmission: "Risk premium",
      decisiveOutcome: "Joint statement",
      scheduled: true,
    },
    {
      time: "2026-08-15T10:00:00.000Z",
      event: "Speculated talks",
      participants: [],
      transmission: "None",
      decisiveOutcome: "Unknown",
      scheduled: false,
    },
  ]);
  assert.deepEqual(result.map((item) => item.event), ["Scheduled summit"]);
});

test("the existing canonical feed contract remains version 2 and keeps edition payload", () => {
  const source = readFileSync(new URL("../lib/hybrid-publication.ts", import.meta.url), "utf8");
  assert.match(source, /contractVersion:\s*2/);
  assert.match(source, /payload:\s*dailyBrief\?\.payload\s*\|\|\s*\{\}/);
  assert.doesNotMatch(source, /contractVersion:\s*3/);
});
