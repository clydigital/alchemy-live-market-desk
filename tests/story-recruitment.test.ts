import assert from "node:assert/strict";
import test from "node:test";

import {
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
  }, stories);
  const replay = recruitCanonicalStories({
    affectedStorySlugs: ["japan-jgb-yen"],
    affectedAssets: [],
    allowAssetRecruitment: false,
  }, stories);

  assert.deepEqual(first, replay);
  assert.equal(first[0]?.reason, "explicit_story_slug");
});
