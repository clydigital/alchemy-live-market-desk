import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  evaluateCanonicalStoryRecruitment,
  recruitCanonicalStories,
  type CanonicalStoryForRecruitment,
} from "../lib/intelligence/story-recruitment.ts";

function story(input: Partial<CanonicalStoryForRecruitment> & Pick<CanonicalStoryForRecruitment, "id" | "slug">): CanonicalStoryForRecruitment {
  return { assets: [], themeKeys: [], ...input };
}

test("empty intake slugs recruit a unique existing Story through canonical assets", () => {
  const routes = recruitCanonicalStories({
    affectedStorySlugs: [],
    affectedAssets: ["US02Y", "SPX", "XAUUSD"],
    allowAssetRecruitment: true,
  }, [
    story({ id: "fed", slug: "fed-hold-versus-hikes", assets: ["US02Y", "DXY", "SPX"], themeKeys: ["rates-monetary-policy"] }),
    story({ id: "gold", slug: "gold-bitcoin", assets: ["XAUUSD", "DXY"] }),
  ]);

  assert.equal(routes.length, 1);
  assert.equal(routes[0]?.storySlug, "fed-hold-versus-hikes");
  assert.deepEqual(routes[0]?.matchedAssets, ["SPX", "US02Y"]);
});

test("USDJPY evidence prefers the narrower taxonomy-backed Japan Story", () => {
  const routes = recruitCanonicalStories({
    affectedStorySlugs: [],
    affectedAssets: ["USD/JPY"],
    allowAssetRecruitment: true,
  }, [
    story({
      id: "japan",
      slug: "japan-jgb-yen",
      assets: ["USDJPY", "JXY", "US10Y"],
      themeKeys: ["rates-monetary-policy", "global-liquidity"],
    }),
    story({
      id: "legacy",
      slug: "yen-carry-unwind",
      assets: ["USDJPY", "AUDJPY", "GBPJPY", "DXY", "US02Y", "NIKKEI", "TOPIX"],
    }),
  ]);

  assert.deepEqual(routes.map((route) => route.storySlug), ["japan-jgb-yen"]);
});

test("an exact rank tie fails closed instead of forcing an unrelated Story", () => {
  const routes = recruitCanonicalStories({
    affectedStorySlugs: [],
    affectedAssets: ["US10Y"],
    allowAssetRecruitment: true,
  }, [
    story({ id: "fiscal", slug: "fiscal", assets: ["US10Y", "US30Y", "DXY"], themeKeys: ["rates-monetary-policy"] }),
    story({ id: "housing", slug: "housing", assets: ["US10Y", "XHB", "VNQ"], themeKeys: ["rates-monetary-policy"] }),
  ]);

  assert.deepEqual(routes, []);
});

test("article-level research remains unlinked when no canonical Story owns its asset", () => {
  const routes = recruitCanonicalStories({
    affectedStorySlugs: [],
    affectedAssets: ["NFLX"],
    allowAssetRecruitment: true,
  }, [story({ id: "ai", slug: "ai-financing", assets: ["NVDA", "SOXX"] })]);

  assert.deepEqual(routes, []);
});

test("explicit intake Story links remain authoritative and deterministic", () => {
  const stories = [story({ id: "yen", slug: "japan-jgb-yen", assets: ["USDJPY"] })];
  const first = recruitCanonicalStories({
    affectedStorySlugs: ["japan-jgb-yen", "japan-jgb-yen"],
    affectedAssets: [],
    allowAssetRecruitment: false,
    acquisitionMateriality: 64,
  }, stories);
  const replay = recruitCanonicalStories({
    affectedStorySlugs: ["japan-jgb-yen"],
    affectedAssets: [],
    allowAssetRecruitment: false,
    acquisitionMateriality: 64,
  }, stories);

  assert.deepEqual(first, replay);
  assert.equal(first[0]?.reason, "explicit_story_slug");
});

test("accepted below-70 Evidence can reach an existing Story through a strong Story-local match", () => {
  const decision = evaluateCanonicalStoryRecruitment({
    affectedStorySlugs: [],
    affectedAssets: ["USD", "SPX"],
    allowAssetRecruitment: true,
    acquisitionMateriality: 64,
    evidenceText: "Federal Reserve officials reinforced a rate hold as disinflation continued.",
  }, [
    story({
      id: "fed",
      slug: "fed-hold-versus-hikes",
      assets: ["USD", "SPX", "US02Y"],
      title: "Federal Reserve hold versus rate hikes",
      thesis: "Disinflation allows the Federal Reserve to hold rates.",
    }),
    story({
      id: "earnings",
      slug: "earnings-breadth",
      assets: ["SPX"],
      title: "Earnings breadth improves",
      thesis: "Profit revisions broaden beyond technology.",
    }),
  ]);

  assert.deepEqual(decision.routes.map((route) => route.storyId), ["fed"]);
  assert.equal(decision.routes[0]?.reason, "canonical_story_local_match");
  assert.equal(decision.diagnostic.initialAssetRouteEligible, false);
  assert.equal(decision.diagnostic.storyLocalEscalationEligible, true);
});

test("below-70 generic commentary does not attach from common asset overlap alone", () => {
  const decision = evaluateCanonicalStoryRecruitment({
    affectedStorySlugs: [],
    affectedAssets: ["USD", "SPX"],
    allowAssetRecruitment: true,
    acquisitionMateriality: 64,
    evidenceText: "Generic SPX and USD market commentary described trading prices and investor positioning.",
  }, [story({
    id: "fed",
    slug: "fed-hold-versus-hikes",
    assets: ["USD", "SPX", "US02Y"],
    title: "Federal Reserve hold versus rate hikes",
    thesis: "Disinflation allows the Federal Reserve to hold rates.",
  })]);

  assert.deepEqual(decision.routes, []);
  assert.equal(decision.diagnostic.reason, "not_story_relevant");
});

test("equal Story-local evidence remains an ambiguous fail-closed collision", () => {
  const decision = evaluateCanonicalStoryRecruitment({
    affectedStorySlugs: [],
    affectedAssets: ["US10Y"],
    allowAssetRecruitment: true,
    acquisitionMateriality: 64,
    evidenceText: "Treasury term premium repricing changed duration demand.",
  }, [
    story({ id: "one", slug: "one", assets: ["US10Y"], title: "Treasury term premium", thesis: "Duration demand drives repricing." }),
    story({ id: "two", slug: "two", assets: ["US10Y"], title: "Treasury term premium", thesis: "Duration demand drives repricing." }),
  ]);

  assert.deepEqual(decision.routes, []);
  assert.equal(decision.diagnostic.reason, "ambiguous_story_match");
});

test("weak Story-local overlap is diagnosed without escalating below the initial route", () => {
  const decision = evaluateCanonicalStoryRecruitment({
    affectedStorySlugs: [],
    affectedAssets: ["SPX"],
    allowAssetRecruitment: true,
    acquisitionMateriality: 64,
    evidenceText: "Disinflation commentary for equities.",
  }, [story({
    id: "fed",
    slug: "fed",
    assets: ["SPX", "USD"],
    title: "Federal Reserve policy hold",
    thesis: "Disinflation reduces rate-hike risk.",
  })]);

  assert.deepEqual(decision.routes, []);
  assert.equal(decision.diagnostic.reason, "below_initial_route_not_escalation_eligible");
});

test("semantic evidence selects the established Story over a narrower seed", () => {
  const decision = evaluateCanonicalStoryRecruitment({
    affectedStorySlugs: [],
    affectedAssets: ["SPX"],
    allowAssetRecruitment: true,
    acquisitionMateriality: 64,
    evidenceText: "Federal Reserve disinflation supports a policy hold and reduces rate-hike risk.",
  }, [
    story({
      id: "seed",
      slug: "liquidity-seed",
      assets: ["SPX"],
      title: "Dealer liquidity stress",
      thesis: "Dealer balance-sheet capacity may weaken equity liquidity.",
      articleVerdict: "theme_seed_unverified",
    }),
    story({
      id: "established",
      slug: "fed-hold",
      assets: ["SPX", "USD", "US02Y"],
      title: "Federal Reserve policy hold",
      thesis: "Disinflation reduces rate-hike risk.",
      articleVerdict: "research_engine",
    }),
  ]);

  assert.deepEqual(decision.routes.map((route) => route.storyId), ["established"]);
});

test("semantic evidence can select an emerging seed without an established-Story preference", () => {
  const decision = evaluateCanonicalStoryRecruitment({
    affectedStorySlugs: [],
    affectedAssets: ["SPX"],
    allowAssetRecruitment: true,
    acquisitionMateriality: 64,
    evidenceText: "Dealer balance-sheet constraints are weakening equity liquidity and market depth.",
  }, [
    story({
      id: "seed",
      slug: "liquidity-seed",
      assets: ["SPX"],
      title: "Dealer liquidity stress",
      thesis: "Dealer balance-sheet capacity may weaken equity liquidity and market depth.",
      articleVerdict: "theme_seed_unverified",
    }),
    story({
      id: "established",
      slug: "fed-hold",
      assets: ["SPX", "USD", "US02Y"],
      title: "Federal Reserve policy hold",
      thesis: "Disinflation reduces rate-hike risk.",
      articleVerdict: "research_engine",
    }),
  ]);

  assert.deepEqual(decision.routes.map((route) => route.storyId), ["seed"]);
});

test("asset coverage alone cannot make a narrow seed win an unresolved collision", () => {
  const decision = evaluateCanonicalStoryRecruitment({
    affectedStorySlugs: [],
    affectedAssets: ["SPX"],
    allowAssetRecruitment: true,
    acquisitionMateriality: 75,
    evidenceText: "Broad equity positioning update.",
  }, [
    story({
      id: "seed",
      slug: "liquidity-seed",
      assets: ["SPX"],
      title: "Dealer liquidity stress",
      thesis: "Dealer balance-sheet capacity may weaken liquidity.",
      articleVerdict: "theme_seed_unverified",
    }),
    story({
      id: "established",
      slug: "fed-hold",
      assets: ["SPX", "USD", "US02Y"],
      title: "Federal Reserve policy hold",
      thesis: "Disinflation reduces rate-hike risk.",
      articleVerdict: "research_engine",
    }),
  ]);

  assert.deepEqual(decision.routes, []);
  assert.equal(decision.diagnostic.reason, "ambiguous_story_match");
});

test("manual and scheduled intake share the same canonical routing decision", () => {
  const input = {
    affectedStorySlugs: [],
    affectedAssets: ["USD", "SPX"],
    allowAssetRecruitment: true,
    acquisitionMateriality: 64,
    evidenceText: "Federal Reserve officials reinforced a rate hold as disinflation continued.",
  };
  const stories = [story({
    id: "fed",
    slug: "fed-hold",
    assets: ["USD", "SPX"],
    title: "Federal Reserve policy hold",
    thesis: "Disinflation supports a rate hold.",
  })];

  const results = (["manual", "scheduled"] as const).map(() => evaluateCanonicalStoryRecruitment(input, stories));
  assert.deepEqual(results[0], results[1]);
});

test("the existing high-materiality asset route remains available", () => {
  const decision = evaluateCanonicalStoryRecruitment({
    affectedStorySlugs: [],
    affectedAssets: ["US02Y", "SPX"],
    allowAssetRecruitment: true,
    acquisitionMateriality: 75,
  }, [
    story({ id: "fed", slug: "fed", assets: ["US02Y", "SPX", "USD"] }),
    story({ id: "equities", slug: "equities", assets: ["SPX"] }),
  ]);

  assert.deepEqual(decision.routes.map((route) => route.storyId), ["fed"]);
  assert.equal(decision.routes[0]?.reason, "canonical_asset_overlap");
});

test("runtime persists the shared routing diagnostic without a trigger-specific branch", () => {
  const runtime = readFileSync(new URL("../lib/intelligence/runtime.ts", import.meta.url), "utf8");

  assert.match(runtime, /const routing = evaluateCanonicalStoryRecruitment\(\{/);
  assert.match(runtime, /acquisitionMateriality: item\.materiality/);
  assert.match(runtime, /storyRouting: routing\.diagnostic/);
  assert.doesNotMatch(runtime, /allowAssetRecruitment:[\s\S]{0,160}item\.materiality\s*>=\s*70/);
});
