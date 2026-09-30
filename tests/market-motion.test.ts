import test from "node:test";
import assert from "node:assert/strict";

import type { Story } from "../lib/data.ts";
import {
  MARKET_MOTION_FRESHNESS_HOURS,
  marketMotionEffectiveState,
  marketMotionExpiry,
  resolveMarketMotionLinks,
  selectMarketMotionForOverview,
  validateMarketMotionInput,
  type MarketMotionRecord,
} from "../lib/market-motion.ts";

function record(overrides: Partial<MarketMotionRecord> = {}): MarketMotionRecord {
  return {
    id: "id",
    motion_key: "motion",
    version_number: 1,
    previous_version_id: null,
    contract_version: "market-motion/v1",
    research_run_id: null,
    source_id: null,
    evidence_id: null,
    primary_story_id: null,
    primary_regime_slug: null,
    lifecycle_state: "MOTION",
    effective_state: "MOTION",
    category: "COMPANY",
    verification_state: "REPORTED",
    headline: "Test",
    what_happened: "Test happened",
    market_reaction: null,
    why_interesting: "It matters",
    big_picture_bridge: "Event → market",
    next_test: null,
    promotion_reason: null,
    tickers: ["TEST"],
    source_name: "Source",
    source_url: "https://example.com/",
    source_kind: "reporting",
    materiality: 50,
    relevance: 50,
    novelty: 50,
    occurred_at: "2026-10-01T00:00:00.000Z",
    observed_at: "2026-10-01T00:00:00.000Z",
    expires_at: "2026-10-04T00:00:00.000Z",
    metadata: {},
    created_at: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

test("Market Motion expiry defaults to 72 hours from the later of occurrence or observation", () => {
  assert.equal(MARKET_MOTION_FRESHNESS_HOURS, 72);
  assert.equal(
    marketMotionExpiry("2026-09-30T10:00:00Z", "2026-09-30T12:00:00Z"),
    "2026-10-03T12:00:00.000Z",
  );
});

test("Market Motion expires dynamically without rewriting history", () => {
  const item = record({ lifecycle_state: "PROMOTED", expires_at: "2026-10-01T01:00:00Z" });
  assert.equal(marketMotionEffectiveState(item, new Date("2026-10-01T00:30:00Z")), "PROMOTED");
  assert.equal(marketMotionEffectiveState(item, new Date("2026-10-01T01:00:00Z")), "EXPIRED");
});

test("Overview selection keeps three highest-priority fresh motion items", () => {
  const items = [
    record({ id: "a", motion_key: "a", lifecycle_state: "MOTION", materiality: 95, relevance: 95 }),
    record({ id: "b", motion_key: "b", lifecycle_state: "PROMOTED", materiality: 70, relevance: 70 }),
    record({ id: "c", motion_key: "c", lifecycle_state: "MOTION", materiality: 90, relevance: 90 }),
    record({ id: "d", motion_key: "d", lifecycle_state: "MOTION", materiality: 80, relevance: 80 }),
    record({ id: "e", motion_key: "e", lifecycle_state: "PROMOTED", materiality: 99, expires_at: "2026-09-30T00:00:00Z" }),
  ];
  assert.deepEqual(
    selectMarketMotionForOverview(items, new Date("2026-10-01T00:00:00Z")).map((item) => item.id),
    ["b", "a", "c"],
  );
});

test("Market Motion links Story only by exact upstream slug while Regime routing stays deterministic", () => {
  const stories = [
    { id: "story-ai", slug: "china-us-ai-war" },
    { id: "story-energy", slug: "energy-security" },
  ] as Pick<Story, "id" | "slug">[];

  const links = resolveMarketMotionLinks({
    text: "Micron HBM pricing and AI memory demand remain tight",
    affectedStorySlugs: ["china-us-ai-war"],
    stories,
  });

  assert.equal(links.primaryStoryId, "story-ai");
  assert.equal(links.primaryRegimeSlug, "us-china-ai");

  const noExactStory = resolveMarketMotionLinks({
    text: "Iran Hormuz tanker traffic changes the energy inflation channel",
    affectedStorySlugs: ["not-a-real-story"],
    stories,
  });
  assert.equal(noExactStory.primaryStoryId, null);
  assert.equal(noExactStory.primaryRegimeSlug, "energy-security-inflation");
});

test("Market Motion validation keeps headlines informative but non-authoritative", () => {
  const validated = validateMarketMotionInput({
    motionKey: "yahoo:meta-enterprise",
    category: "COMPANY",
    verificationState: "REPORTED",
    headline: "Meta launches an enterprise AI platform",
    whatHappened: "A reported company development created a new enterprise-AI monetisation test.",
    whyInteresting: "The event tests whether AI capex can become a new enterprise revenue stream.",
    bigPictureBridge: "AI capex → monetisation → ROIC",
    nextTest: "Verify company materials and watch adoption evidence.",
    tickers: ["meta", "meta", "mdb"],
    sourceName: "Yahoo Finance",
    sourceUrl: "https://finance.yahoo.com/example",
    occurredAt: "2026-09-30T10:00:00Z",
    observedAt: "2026-09-30T10:30:00Z",
  });

  assert.deepEqual(validated.tickers, ["META", "MDB"]);
  assert.equal(validated.lifecycle_state, "MOTION");
  assert.equal(validated.primary_story_id, null);
  assert.equal(validated.expires_at, "2026-10-03T10:30:00.000Z");
});
