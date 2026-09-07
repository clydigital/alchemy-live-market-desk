import assert from "node:assert/strict";
import test from "node:test";

import { buildDeskRead, type DeskReadStory } from "../lib/desk-read.ts";

const generatedAt = "2026-09-07T09:00:00Z";

function candidate(input: Partial<DeskReadStory>): DeskReadStory {
  return {
    id: input.id || "story",
    slug: input.slug || input.id || "story",
    title: input.title || "Story",
    marketQuestion: input.marketQuestion || input.title || "Story",
    thesis: input.thesis || "Canonical thesis.",
    confidence: input.confidence ?? 90,
    rank: input.rank ?? null,
    featuredRank: input.featuredRank ?? null,
    status: input.status || "confirmed",
    bestExplanation: input.bestExplanation || "Canonical explanation.",
    strongestSupport: input.strongestSupport || "Canonical supporting evidence.",
    recencyAt: input.recencyAt || "2026-09-07T08:45:00Z",
    intelligence: input.intelligence || {
      lifecycleStatus: "confirmed",
      qualificationScore: input.confidence ?? 90,
      causalMechanism: "Canonical causal mechanism.",
      affectedAssets: [],
      lastEvidenceAt: "2026-09-07T08:45:00Z",
    },
  };
}

test("Desk Read prefers broad cross-asset Story over higher-confidence isolated ticker", () => {
  const singleName = candidate({
    id: "mcd",
    title: "MCD operational reset",
    confidence: 95,
    rank: 1,
    featuredRank: 1,
    intelligence: {
      lifecycleStatus: "confirmed",
      qualificationScore: 95,
      causalMechanism: "Restaurant investment may lift MCD volumes.",
      affectedAssets: ["MCD"],
      strongestSupport: "Store rollout is progressing.",
      lastEvidenceAt: "2026-09-07T08:55:00Z",
    },
  });
  const crossAsset = candidate({
    id: "oil-rates-risk",
    title: "Oil risk is feeding the rates complex",
    confidence: 88,
    rank: 2,
    featuredRank: 2,
    intelligence: {
      lifecycleStatus: "confirmed",
      qualificationScore: 88,
      causalMechanism: "Oil risk lifts the inflation tail and changes the rates/equity mix.",
      affectedAssets: ["BRENT", "US10Y", "USD", "SPX"],
      strongestSupport: "Multiple linked markets are moving in the expected direction.",
      lastEvidenceAt: "2026-09-07T08:45:00Z",
    },
  });

  const read = buildDeskRead({ stories: [singleName, crossAsset], generatedAt });

  assert.equal(read.dominantDriver?.storyId, "oil-rates-risk");
  assert.equal(read.headline, "Oil risk is feeding the rates complex");
});

test("unsupported thesis stays partial instead of being presented as fully explained", () => {
  const read = buildDeskRead({
    stories: [candidate({
      id: "unsupported",
      strongestSupport: null,
      intelligence: {
        lifecycleStatus: "confirmed",
        qualificationScore: 92,
        causalMechanism: "Plausible but not yet independently supported.",
        affectedAssets: ["BRENT", "US10Y", "USD", "SPX"],
        strongestSupport: null,
        lastEvidenceAt: "2026-09-07T08:45:00Z",
      },
    })],
    generatedAt,
  });

  assert.equal(read.status, "partial");
  assert.equal(read.noConvincingExplanation, true);
  assert.equal(read.explanationBasis, "canonical_story_thesis");
});
