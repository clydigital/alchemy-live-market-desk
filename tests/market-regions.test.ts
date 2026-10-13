import assert from "node:assert/strict";
import test from "node:test";

import {
  combineMarketRegions,
  matchesMarketRegion,
  resolveMarketRegions,
} from "../lib/market-regions.ts";

test("regional filters recognise clear event headlines without assigning unmentioned regions", () => {
  assert.deepEqual(resolveMarketRegions({ headline: "China raises restrictions on chip exports" }), {
    primaryRegion: "Asia",
    affectedRegions: ["Asia"],
  });
  assert.deepEqual(resolveMarketRegions({ headline: "Federal Reserve changes Treasury yield assumptions" }), {
    primaryRegion: "US",
    affectedRegions: ["US"],
  });
  assert.deepEqual(resolveMarketRegions({ headline: "ECB reviews eurozone financing" }), {
    primaryRegion: "Europe",
    affectedRegions: ["Europe"],
  });
  assert.deepEqual(resolveMarketRegions({ headline: "AI capex cycle remains mixed" }), {
    primaryRegion: "Other",
    affectedRegions: ["Other"],
  });
});

test("cross-border events retain multiple affected regions without inventing a primary owner", () => {
  const item = resolveMarketRegions({ headline: "China and US discuss semiconductor export controls" });
  assert.deepEqual(item, {
    primaryRegion: "Other",
    affectedRegions: ["Asia", "US"],
  });
  assert.equal(matchesMarketRegion(item, "Asia"), true);
  assert.equal(matchesMarketRegion(item, "US"), true);
  assert.equal(matchesMarketRegion(item, "Europe"), false);
  assert.equal(matchesMarketRegion(item, "Other"), true);
});

test("explicit structured provenance takes priority over headline clues", () => {
  const item = resolveMarketRegions({
    headline: "China AI demand affects US chips",
    primaryRegion: "Asia",
    affectedRegions: ["US", "Asia", "US", "unrecognised", 45],
  });
  assert.deepEqual(item, {
    primaryRegion: "Asia",
    affectedRegions: ["Asia", "US"],
  });
});

test("an explicit affected-region list without primary stays cross-border", () => {
  assert.deepEqual(resolveMarketRegions({
    headline: "Technology markets",
    affectedRegions: ["Europe", "US"],
  }), {
    primaryRegion: "Other",
    affectedRegions: ["Other", "Europe", "US"],
  });
});

test("creator bundles preserve all underlying geographic references", () => {
  const combined = combineMarketRegions([
    resolveMarketRegions({ headline: "Japan memory supply changes" }),
    resolveMarketRegions({ headline: "Fed credit conditions tighten" }),
  ]);
  assert.deepEqual(combined, {
    primaryRegion: "Other",
    affectedRegions: ["Asia", "US"],
  });
});

test("unknown regions stay Other, and an accidental lowercase 'us' does not mean United States", () => {
  assert.deepEqual(resolveMarketRegions({ headline: "Oil uncertainty reminds us of earlier shortages" }), {
    primaryRegion: "Other",
    affectedRegions: ["Other"],
  });
});
