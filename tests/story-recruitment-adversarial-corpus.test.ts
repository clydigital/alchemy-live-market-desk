import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateCanonicalStoryRecruitment,
  type CanonicalStoryForRecruitment,
  type StoryRecruitmentDiagnostic,
  type StoryRecruitmentInput,
} from "../lib/intelligence/story-recruitment.ts";

type CorpusCase = {
  id: string;
  family: "relevant_below_70" | "generic_commentary" | "seed_established_collision" | "paraphrase" | "ambiguous" | "replay";
  input: StoryRecruitmentInput;
  storyIds?: string[];
  replayOf?: string;
  expectedStoryIds: string[];
  expectedReason: StoryRecruitmentDiagnostic["reason"];
};

function story(input: CanonicalStoryForRecruitment): CanonicalStoryForRecruitment {
  return input;
}

const STORIES = [
  story({
    id: "fed-established", slug: "fed-hold", assets: ["USD", "SPX", "US02Y"], themeKeys: ["rates-monetary-policy"],
    title: "Federal Reserve disinflation policy hold", thesis: "Disinflation reduces rate hike risk and supports a policy hold.",
    articleVerdict: "research_engine",
  }),
  story({
    id: "liquidity-seed", slug: "dealer-liquidity", assets: ["SPX"], themeKeys: ["market-structure-positioning"],
    title: "Dealer liquidity stress", thesis: "Dealer balance-sheet capacity weakens equity liquidity and market depth.",
    articleVerdict: "theme_seed_unverified",
  }),
  story({
    id: "fiscal-established", slug: "sovereign-term-premium", assets: ["US10Y", "US30Y", "DXY"], themeKeys: ["fiscal-sovereign-risk"],
    title: "Treasury term premium repricing", thesis: "Sovereign issuance and auction demand lift the term premium.",
    articleVerdict: "research_engine",
  }),
  story({
    id: "housing-established", slug: "housing-rates", assets: ["US10Y", "XHB", "VNQ"], themeKeys: ["housing"],
    title: "Mortgage housing transmission", thesis: "Mortgage rates weaken housing affordability and construction.",
    articleVerdict: "research_engine",
  }),
  story({
    id: "yen-established", slug: "japan-jgb-yen", assets: ["USDJPY", "JXY", "US10Y"], themeKeys: ["rates-monetary-policy", "global-liquidity"],
    title: "Bank of Japan JGB and yen carry", thesis: "JGB policy normalization can reverse the yen carry trade.",
    articleVerdict: "research_engine",
  }),
  story({
    id: "gold-established", slug: "gold-monetary-alternative", assets: ["XAUUSD", "DXY"], themeKeys: ["real-assets-monetary-alternatives"],
    title: "Gold monetary alternative", thesis: "Central bank demand and monetary debasement support gold.",
    articleVerdict: "research_engine",
  }),
  story({
    id: "duration-a", slug: "duration-a", assets: ["US10Y"], themeKeys: [],
    title: "Treasury term premium duration demand", thesis: "Duration demand changes the Treasury term premium.",
    articleVerdict: "theme_seed_unverified",
  }),
  story({
    id: "duration-b", slug: "duration-b", assets: ["US10Y"], themeKeys: [],
    title: "Treasury term premium duration demand", thesis: "Duration demand changes the Treasury term premium.",
    articleVerdict: "research_engine",
  }),
  story({
    id: "yen-a", slug: "yen-a", assets: ["USDJPY"], themeKeys: [],
    title: "Japan policy yen carry", thesis: "Japan policy normalization reverses yen carry positions.",
    articleVerdict: "theme_seed_unverified",
  }),
  story({
    id: "yen-b", slug: "yen-b", assets: ["USDJPY"], themeKeys: [],
    title: "Japan policy yen carry", thesis: "Japan policy normalization reverses yen carry positions.",
    articleVerdict: "research_engine",
  }),
];

const CORE_STORY_IDS = [
  "fed-established", "liquidity-seed", "fiscal-established", "housing-established", "yen-established", "gold-established",
];

function input(affectedAssets: string[], evidenceText: string, acquisitionMateriality = 64): StoryRecruitmentInput {
  return { affectedStorySlugs: [], affectedAssets, allowAssetRecruitment: true, acquisitionMateriality, evidenceText };
}

const CASES: CorpusCase[] = [
  { id: "rel-fed", family: "relevant_below_70", input: input(["USD", "SPX"], "Federal Reserve disinflation reinforced a policy hold."), expectedStoryIds: ["fed-established"], expectedReason: "canonical_story_local_match" },
  { id: "rel-liquidity", family: "relevant_below_70", input: input(["SPX"], "Dealer balance-sheet capacity weakened equity liquidity and market depth."), expectedStoryIds: ["liquidity-seed"], expectedReason: "canonical_story_local_match" },
  { id: "rel-fiscal", family: "relevant_below_70", input: input(["US10Y"], "Treasury term premium rose as sovereign issuance tested auction demand."), expectedStoryIds: ["fiscal-established"], expectedReason: "canonical_story_local_match" },
  { id: "rel-housing", family: "relevant_below_70", input: input(["US10Y", "XHB"], "Mortgage rates weakened housing affordability and construction."), expectedStoryIds: ["housing-established"], expectedReason: "canonical_story_local_match" },
  { id: "rel-yen", family: "relevant_below_70", input: input(["USDJPY"], "Bank of Japan JGB policy normalization reversed the yen carry trade."), expectedStoryIds: ["yen-established"], expectedReason: "canonical_story_local_match" },
  { id: "rel-gold", family: "relevant_below_70", input: input(["XAUUSD", "DXY"], "Central bank demand and monetary debasement supported gold."), expectedStoryIds: ["gold-established"], expectedReason: "canonical_story_local_match" },

  { id: "generic-usd-spx-1", family: "generic_commentary", input: input(["USD", "SPX"], "USD and SPX prices moved during ordinary trading."), expectedStoryIds: [], expectedReason: "not_story_relevant" },
  { id: "generic-usd-spx-2", family: "generic_commentary", input: input(["USD", "SPX"], "Dollar and equities were mixed in a quiet session."), expectedStoryIds: [], expectedReason: "not_story_relevant" },
  { id: "generic-spx-positioning", family: "generic_commentary", input: input(["SPX"], "Broad SPX positioning commentary described investor flows."), expectedStoryIds: [], expectedReason: "below_initial_route_not_escalation_eligible" },
  { id: "generic-cross-asset", family: "generic_commentary", input: input(["USD", "SPX"], "Cross-asset markets traded without a new catalyst."), expectedStoryIds: [], expectedReason: "not_story_relevant" },
  { id: "generic-us10y", family: "generic_commentary", input: input(["US10Y"], "US10Y prices changed during the afternoon session."), expectedStoryIds: [], expectedReason: "not_story_relevant" },

  { id: "collision-established-wins", family: "seed_established_collision", input: input(["SPX"], "Federal Reserve disinflation reduced rate hike risk and supported a policy hold."), expectedStoryIds: ["fed-established"], expectedReason: "canonical_story_local_match" },
  { id: "collision-seed-wins", family: "seed_established_collision", input: input(["SPX"], "Dealer balance-sheet capacity weakened equity liquidity and market depth."), expectedStoryIds: ["liquidity-seed"], expectedReason: "canonical_story_local_match" },
  { id: "collision-high-materiality-no-semantics", family: "seed_established_collision", input: input(["SPX"], "Broad SPX session update.", 75), expectedStoryIds: [], expectedReason: "ambiguous_story_match" },
  { id: "collision-equal-duration", family: "seed_established_collision", storyIds: ["duration-a", "duration-b"], input: input(["US10Y"], "Treasury term premium changed with duration demand."), expectedStoryIds: [], expectedReason: "ambiguous_story_match" },
  { id: "collision-equal-yen-high", family: "seed_established_collision", storyIds: ["yen-a", "yen-b"], input: input(["USDJPY"], "Japan policy normalization reversed yen carry positions.", 75), expectedStoryIds: [], expectedReason: "ambiguous_story_match" },

  { id: "paraphrase-fed", family: "paraphrase", input: input(["USD", "SPX"], "Policymakers will wait as price pressure cools."), expectedStoryIds: [], expectedReason: "not_story_relevant" },
  { id: "paraphrase-fiscal", family: "paraphrase", input: input(["US10Y"], "Government borrowing costs reflect heavy bond supply."), expectedStoryIds: [], expectedReason: "not_story_relevant" },
  { id: "paraphrase-yen", family: "paraphrase", input: input(["USDJPY"], "Tokyo officials may alter course and unwind leveraged FX bets."), expectedStoryIds: [], expectedReason: "not_story_relevant" },
  { id: "paraphrase-gold", family: "paraphrase", input: input(["XAUUSD"], "Bullion benefits from reserve diversification."), expectedStoryIds: [], expectedReason: "not_story_relevant" },
  { id: "paraphrase-housing", family: "paraphrase", input: input(["US10Y", "XHB"], "Homebuyers face expensive loans and weak construction activity."), expectedStoryIds: [], expectedReason: "below_initial_route_not_escalation_eligible" },

  { id: "ambiguous-duration", family: "ambiguous", storyIds: ["duration-a", "duration-b"], input: input(["US10Y"], "Treasury term premium repricing changed duration demand."), expectedStoryIds: [], expectedReason: "ambiguous_story_match" },
  { id: "ambiguous-yen", family: "ambiguous", storyIds: ["yen-a", "yen-b"], input: input(["USDJPY"], "Japan policy normalization reversed yen carry positions."), expectedStoryIds: [], expectedReason: "ambiguous_story_match" },
  { id: "ambiguous-shared-asset", family: "ambiguous", storyIds: ["yen-a", "yen-b"], input: input(["USDJPY"], "Japan policy yen carry conditions changed."), expectedStoryIds: [], expectedReason: "ambiguous_story_match" },

  { id: "replay-relevant", family: "replay", replayOf: "rel-fed", input: input([], ""), expectedStoryIds: ["fed-established"], expectedReason: "canonical_story_local_match" },
  { id: "replay-ambiguous", family: "replay", replayOf: "ambiguous-duration", input: input([], ""), expectedStoryIds: [], expectedReason: "ambiguous_story_match" },
  { id: "replay-paraphrase", family: "replay", replayOf: "paraphrase-fiscal", input: input([], ""), expectedStoryIds: [], expectedReason: "not_story_relevant" },
];

test("production-shaped adversarial corpus records expected versus actual fail-closed routing", () => {
  const storyById = new Map(STORIES.map((item) => [item.id, item]));
  const decisionByCase = new Map<string, ReturnType<typeof evaluateCanonicalStoryRecruitment>>();
  const report: Array<Record<string, unknown>> = [];
  const mismatches: string[] = [];

  for (const corpusCase of CASES) {
    const replaySource = corpusCase.replayOf ? CASES.find((item) => item.id === corpusCase.replayOf) : null;
    const effectiveCase = replaySource ?? corpusCase;
    const selectedIds = effectiveCase.storyIds ?? CORE_STORY_IDS;
    const selectedStories = selectedIds.map((id) => storyById.get(id)!).filter(Boolean);
    const decision = evaluateCanonicalStoryRecruitment(effectiveCase.input, selectedStories);
    const actualStoryIds = decision.routes.map((route) => route.storyId);

    report.push({
      id: corpusCase.id,
      family: corpusCase.family,
      expectedStoryIds: corpusCase.expectedStoryIds,
      actualStoryIds,
      expectedReason: corpusCase.expectedReason,
      actualReason: decision.diagnostic.reason,
      diagnosticOutcome: decision.diagnostic.outcome,
      candidateStoryIds: decision.diagnostic.candidateStoryIds,
      matchedStoryTerms: decision.diagnostic.matchedStoryTerms,
      replayOf: corpusCase.replayOf ?? null,
    });

    if (JSON.stringify(actualStoryIds) !== JSON.stringify(corpusCase.expectedStoryIds)) {
      mismatches.push(`${corpusCase.id}: expected Stories ${JSON.stringify(corpusCase.expectedStoryIds)}, got ${JSON.stringify(actualStoryIds)}`);
    }
    if (decision.diagnostic.reason !== corpusCase.expectedReason) {
      mismatches.push(`${corpusCase.id}: expected reason ${corpusCase.expectedReason}, got ${decision.diagnostic.reason}`);
    }
    if (corpusCase.replayOf) {
      assert.deepEqual(decision, decisionByCase.get(corpusCase.replayOf), `${corpusCase.id}: replay decision diverged`);
    }
    decisionByCase.set(corpusCase.id, decision);
  }

  console.log(`ADVERSARIAL_CORPUS_REPORT=${JSON.stringify(report)}`);
  assert.equal(report.length, 27);
  assert.equal(report.filter((row) => (row.actualStoryIds as string[]).length > 0).length, 9);
  assert.deepEqual(mismatches, []);
});
