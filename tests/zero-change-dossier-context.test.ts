import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { composeAlchemyEdition, type AlchemyEdition } from "../lib/intelligence/edition.ts";
import type { JourneyStorySource } from "../lib/intelligence/journey-briefing.ts";

function source(): JourneyStorySource {
  return {
    position: 1,
    publicationSnapshotId: "snapshot-rates",
    storyId: "story-rates",
    thesisVersionId: "version-rates",
    reasoning: {
      contractVersion: "canonical-story-reasoning/v1",
      storyId: "story-rates",
      storyVersionId: "version-rates",
      versionNumber: 3,
      effectiveAt: "2026-10-07T01:00:00.000Z",
      title: "Rates stay restrictive",
      centralQuestion: "Are higher yields still tightening conditions?",
      lifecycle: "developing",
      confidence: 82,
      thesis: "Higher real and long yields are keeping financial conditions restrictive.",
      whatChanged: null,
      previousState: "Yields were already elevated.",
      currentState: "Yields remain elevated while credit has not cracked.",
      marketReaction: null,
      acceptedExplanation: "The cost of capital remains high even without a fresh policy move.",
      claims: [{
        id: "claim-rates",
        type: "thesis",
        text: "Higher real and long yields are keeping financial conditions restrictive.",
        evidenceIds: ["evidence-rates"],
      }],
      causalChain: [{
        id: "edge-rates",
        sourceHypothesisId: "hyp-rates",
        from: "Higher real yields",
        relationship: "raise",
        to: "cost of capital",
        evidenceState: "strongly_supported",
        evidenceIds: ["evidence-rates"],
      }],
      countercase: {
        strongest: "Credit spreads remain contained.",
        evidenceIds: ["evidence-rates"],
        weakestLink: "Higher yields have not yet produced broad stress.",
        marketMayBeRight: "Growth could absorb restrictive yields for longer.",
      },
      overlookedVariable: {
        text: "Credit spreads show whether valuation pressure becomes financing stress.",
        evidenceState: "strongly_supported",
        evidenceIds: ["evidence-rates"],
      },
      assetImplications: [{
        asset: "US10Y",
        bias: "neutral",
        conviction: 70,
        baseCase: "Long yields remain an important cost-of-capital constraint.",
        evidenceIds: ["evidence-rates"],
        confirmation: "Long and real yields remain elevated.",
        invalidation: "Long and real yields fall sustainably.",
      }],
      confirmation: ["Long and real yields remain elevated."],
      invalidation: ["Long and real yields fall sustainably."],
      nextTest: null,
      visualPlan: [],
    },
  };
}

test("zero-change editions can explain prior immutable Story context without populating Journey", () => {
  const immutable = source();
  const previousEdition = {
    stories: [],
    canonicalStoryManifest: [{
      position: immutable.position,
      snapshotId: immutable.publicationSnapshotId,
      storyId: immutable.storyId,
      thesisVersionId: immutable.thesisVersionId,
      state: {
        id: immutable.storyId,
        confidence: 82,
        assets: ["US10Y"],
        themes: ["Rates"],
        recencyAt: "2026-10-07T01:00:00.000Z",
      },
      reasoning: immutable.reasoning,
    }],
  } as unknown as AlchemyEdition;

  const edition = composeAlchemyEdition({
    generatedAt: "2026-10-07T02:00:00.000Z",
    comparisonWindowStart: "2026-10-06T02:00:00.000Z",
    stories: [],
    previousEdition,
    journeyStorySources: [],
    dossierStorySources: [immutable],
    marketTape: {
      regimeSummary: "Higher yields remain restrictive while credit is contained.",
      assets: [{ symbol: "US10Y", move: "unchanged", state: "elevated", whyRelevant: "cost of capital" }],
    },
  });

  assert.equal(edition.sinceYouLastChecked.length, 0);
  assert.equal(edition.journey?.bigStories.length, 0);
  assert.equal(edition.dossier?.lessons.length, 1);
  assert.equal(edition.dossier?.lessons[0]?.storyId, "story-rates");
  assert.equal(edition.dossier?.lessons[0]?.currentAttention.state, "recent_context");
  assert.ok(edition.dossier?.lessons[0]?.callouts.some((item) => item.label.includes("NO MATERIAL CHANGE")));
});

test("zero-change publisher sources prior immutable reasoning only into Dossier context", () => {
  const sourceText = readFileSync(new URL("../lib/intelligence/canonical-journey-edition.ts", import.meta.url), "utf8");
  assert.match(sourceText, /priorImmutableDossierStorySources\(previousEdition\)/);
  assert.match(sourceText, /journeyStorySources: journeySources,[\s\S]*dossierStorySources/);
  assert.match(sourceText, /candidate\.contractVersion !== CANONICAL_STORY_REASONING_V1/);
  assert.match(sourceText, /candidate\.storyId !== storyId/);
  assert.match(sourceText, /candidate\.storyVersionId !== thesisVersionId/);
});
