import test from "node:test";
import assert from "node:assert/strict";

import {
  MARKET_MOTION_EDITION_V1,
  buildMarketMotionEditionAttachment,
  marketMotionFromEditionPayload,
  selectMarketMotionEditionContext,
} from "../lib/market-motion-edition.ts";
import type { MarketMotionRecord } from "../lib/market-motion.ts";

const CAPTURED_AT = "2026-10-01T03:00:00.000Z";

function record(overrides: Partial<MarketMotionRecord> = {}): MarketMotionRecord {
  return {
    id: "motion-a",
    motion_key: "intake:motion-a",
    version_number: 2,
    previous_version_id: "motion-a-v1",
    contract_version: "market-motion/v1",
    research_run_id: "run-1",
    source_id: null,
    evidence_id: null,
    primary_story_id: "story-1",
    primary_regime_slug: "us-china-ai",
    lifecycle_state: "PROMOTED",
    effective_state: "PROMOTED",
    category: "COMPANY",
    verification_state: "REPORTED",
    headline: "Micron HBM pricing stays tight",
    what_happened: "Fresh reporting says AI-memory demand remains strong.",
    market_reaction: null,
    why_interesting: "The event tests the memory-scarcity branch.",
    big_picture_bridge: "Memory supply → AI infrastructure cost → AI regime",
    next_test: "Confirm with primary supply evidence.",
    promotion_reason: "Linked canonical Story changed.",
    tickers: ["MU"],
    source_name: "Reuters",
    source_url: "https://www.reuters.com/technology/example",
    source_kind: "reporting",
    materiality: 90,
    relevance: 88,
    novelty: 84,
    occurred_at: "2026-10-01T00:30:00.000Z",
    observed_at: "2026-10-01T00:45:00.000Z",
    expires_at: "2026-10-04T00:45:00.000Z",
    metadata: {},
    created_at: "2026-10-01T00:45:00.000Z",
    ...overrides,
  };
}

const stories = [
  { id: "story-1", slug: "china-us-ai-war", title: "China–US AI War" },
  { id: "story-2", slug: "energy-security", title: "Energy Security" },
];

test("edition attachment freezes only fresh PROMOTED Motion with exact Story identity", () => {
  const attachment = buildMarketMotionEditionAttachment({
    researchRunId: "run-1",
    capturedAt: CAPTURED_AT,
    stories,
    rows: [
      record({ id: "later", motion_key: "later", occurred_at: "2026-10-01T02:00:00.000Z" }),
      record({ id: "earlier", motion_key: "earlier", occurred_at: "2026-10-01T00:15:00.000Z" }),
      record({ id: "wrong-run", motion_key: "wrong-run", research_run_id: "run-2" }),
      record({ id: "plain-motion", motion_key: "plain-motion", lifecycle_state: "MOTION", effective_state: "MOTION" }),
      record({ id: "expired", motion_key: "expired", expires_at: "2026-10-01T02:30:00.000Z" }),
      record({ id: "no-story", motion_key: "no-story", primary_story_id: null }),
    ],
  });

  assert.equal(attachment.contractVersion, MARKET_MOTION_EDITION_V1);
  assert.equal(attachment.researchRunId, "run-1");
  assert.deepEqual(attachment.items.map((item) => item.id), ["earlier", "later"]);
  assert.equal(attachment.items[0].storySlug, "china-us-ai-war");
  assert.equal(attachment.items[0].regimeLabel, "AI Capital Cycle");
});

test("edition parser rejects missing or wrong contracts and preserves snapshot identity", () => {
  const attachment = buildMarketMotionEditionAttachment({
    researchRunId: "run-1",
    capturedAt: CAPTURED_AT,
    stories,
    rows: [record()],
  });

  assert.equal(marketMotionFromEditionPayload({}), null);
  assert.equal(marketMotionFromEditionPayload({ marketMotion: { contractVersion: "wrong" } }), null);

  const parsed = marketMotionFromEditionPayload({ marketMotion: attachment });
  assert.ok(parsed);
  assert.equal(parsed?.items[0].id, "motion-a");
  assert.equal(parsed?.items[0].versionNumber, 2);
  assert.equal(parsed?.items[0].storyTitle, "China–US AI War");
});

test("Hybrid context can prioritise an exact deep-linked Story or Regime without fuzzy matching", () => {
  const attachment = buildMarketMotionEditionAttachment({
    researchRunId: "run-1",
    capturedAt: CAPTURED_AT,
    stories,
    rows: [
      record({ id: "ai", motion_key: "ai", primary_story_id: "story-1", primary_regime_slug: "us-china-ai", materiality: 82 }),
      record({ id: "energy", motion_key: "energy", primary_story_id: "story-2", primary_regime_slug: "energy-security-inflation", materiality: 98 }),
    ],
  });

  assert.equal(
    selectMarketMotionEditionContext({
      attachment,
      preferredStoryId: "story-1",
      limit: 2,
    })[0].id,
    "ai",
  );

  assert.equal(
    selectMarketMotionEditionContext({
      attachment,
      preferredRegimeSlug: "energy-security-inflation",
      limit: 2,
    })[0].id,
    "energy",
  );
});
