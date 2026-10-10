import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { composeAlchemyEdition, type AlchemyEdition } from "../lib/intelligence/edition.ts";
import type { JourneyStorySource } from "../lib/intelligence/journey-briefing.ts";
import { nearestImmutableDossierContext, MAX_ZERO_CHANGE_DOSSIER_CONTEXT_AGE_MS } from "../lib/intelligence/zero-change-immutable-context.ts";

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

test("two consecutive empty zero-change editions recover the most recent immutable prior Story", () => {
  const asOf = "2026-10-10T04:00:00.000Z";
  const rows = [
    { published_at: "2026-10-10T02:00:00.000Z", payload: { canonicalStoryManifest: [] } },
    { published_at: "2026-10-09T22:00:00.000Z", payload: { canonicalStoryManifest: [] } },
    { published_at: "2026-10-08T04:00:00.000Z", payload: { canonicalStoryManifest: [{ storyId: "story-rates", thesisVersionId: "v-3" }] } },
  ];
  const result = nearestImmutableDossierContext(rows, asOf, (payload) => (
    (payload.canonicalStoryManifest as Array<{ storyId: string; thesisVersionId: string }> || [])
      .map((x) => x.storyId + ":" + x.thesisVersionId)
  ));
  assert.deepEqual(result, {
    publishedAt: "2026-10-08T04:00:00.000Z",
    sources: ["story-rates:v-3"],
  });
  // This helper selects commentary sources only. No Journey or current manifest is projected.
  assert.deepEqual(rows[0].payload.canonicalStoryManifest, []);
  assert.deepEqual(rows[1].payload.canonicalStoryManifest, []);
});

test("historical context never accepts future, stale, malformed or ineligible reasoning", () => {
  const rows = [
    { published_at: "2026-10-11T01:00:00Z", payload: { canonicalStoryManifest: ["future"] } },
    { published_at: "malformed", payload: { canonicalStoryManifest: ["invalid-date"] } },
    { published_at: "2026-09-01T01:00:00Z", payload: { canonicalStoryManifest: ["stale"] } },
    { published_at: "2026-10-09T01:00:00Z", payload: { canonicalStoryManifest: ["invalid-reasoning"] } },
  ];
  const seen: string[] = [];
  const result = nearestImmutableDossierContext(rows, "2026-10-10T01:00:00Z", (payload) => {
    const labels = payload.canonicalStoryManifest as string[];
    seen.push(...labels);
    return labels.filter((x) => x.startsWith("valid:"));
  });
  assert.equal(result, null);
  assert.deepEqual(seen, ["invalid-reasoning"]);
  assert.equal(nearestImmutableDossierContext(rows, "bad-date", () => ["valid"]), null);
  assert.ok(MAX_ZERO_CHANGE_DOSSIER_CONTEXT_AGE_MS <= 5 * 86_400_000);
});

test("historical context cannot become fresh when an older immutable source exists", () => {
  const editionTime = "2026-10-10T12:00:00Z";
  const old = source();
  const rows = [
    { published_at: "2026-10-10T11:00:00Z", payload: { canonicalStoryManifest: [] } },
    { published_at: "2026-10-08T04:06:02Z", payload: { canonicalStoryManifest: [old] } },
  ];
  const exact = nearestImmutableDossierContext(rows, editionTime, (payload) => (
    (payload.canonicalStoryManifest as JourneyStorySource[]).filter((entry) =>
      entry.reasoning?.contractVersion === "canonical-story-reasoning/v1"
      && entry.reasoning.storyId === entry.storyId
      && entry.reasoning.storyVersionId === entry.thesisVersionId)
  ));
  assert.equal(exact?.sources[0]?.thesisVersionId, "version-rates");
  const edition = composeAlchemyEdition({
    generatedAt: editionTime,
    comparisonWindowStart: "2026-10-10T11:00:00Z",
    stories: [],
    journeyStorySources: [],
    dossierStorySources: exact?.sources || [],
    marketTape: {
      regimeSummary: "US Treasury yields still constrain valuations.",
      assets: [{ symbol: "US10Y", move: "unknown", state: "elevated", whyRelevant: "cost of capital" }],
    },
  });
  assert.equal(edition.journey?.bigStories.length, 0);
  assert.equal(edition.sinceYouLastChecked.length, 0);
  assert.ok(edition.dossier?.lessons.every((item) => item.currentAttention.state !== "fresh_change"));
});

test("zero-change canonical publisher looks back only at immutable base editions and labels historical context", () => {
  const sourceText = readFileSync(new URL("../lib/intelligence/canonical-journey-edition.ts", import.meta.url), "utf8");
  assert.match(sourceText, /edition_phase=eq\.base/);
  assert.match(sourceText, /nearestImmutableDossierContext\(/);
  assert.match(sourceText, /this run has no new accepted Story change/);
  assert.match(sourceText, /journeyStorySources: journeySources,[\s\S]*dossierStorySources/);
  assert.match(sourceText, /canonicalStoryManifest,/);
});
