import assert from "node:assert/strict";
import test from "node:test";

import {
  MARKET_MOTION_BUNDLE_PREVIEW_LIMIT,
  buildMarketMotionPresentationUnits,
  marketMotionPresentationUnderlyingCount,
} from "../lib/market-motion-presentation.ts";
import type { MarketMotionRecord } from "../lib/market-motion.ts";

function record(
  id: string,
  overrides: Partial<MarketMotionRecord> = {},
): MarketMotionRecord {
  return {
    id,
    motion_key: `creator:key:${id}`,
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
    category: "MACRO",
    verification_state: "LEAD",
    headline: `Claim ${id}`,
    what_happened: `What happened ${id}`,
    market_reaction: null,
    why_interesting: `Why it matters ${id}`,
    big_picture_bridge: "AI compute → grid capex → utility costs",
    next_test: `Verify claim ${id}`,
    promotion_reason: null,
    tickers: [],
    source_name: "Wall Street Truthbombs",
    source_url: "https://www.youtube.com/watch?v=video-a",
    source_kind: "creator",
    materiality: 80,
    relevance: 80,
    novelty: 80,
    occurred_at: "2026-10-02T12:15:00.000Z",
    observed_at: "2026-10-02T12:30:00.000Z",
    expires_at: "2026-10-04T12:30:00.000Z",
    metadata: {
      ingestion: "creator-transcript-motion-lead/v1",
      itemKey: "youtube:wallstreettruthbombs:video-a",
      creatorVideoTitle: "AI grid bills are exploding",
    },
    created_at: "2026-10-02T12:30:00.000Z",
    ...overrides,
  };
}

test("same exact creator video itemKey becomes one presentation bundle", () => {
  const units = buildMarketMotionPresentationUnits([
    record("a"),
    record("b"),
    record("c"),
    record("d"),
    record("e"),
  ]);

  assert.equal(units.length, 1);
  assert.equal(units[0]?.kind, "creator_bundle");
  if (units[0]?.kind !== "creator_bundle") return;
  assert.equal(units[0].records.length, 5);
  assert.equal(units[0].bundleKey, "youtube:wallstreettruthbombs:video-a");
  assert.equal(units[0].videoTitle, "AI grid bills are exploding");
  assert.equal(marketMotionPresentationUnderlyingCount(units), 5);
});

test("different videos from the same creator stay separate", () => {
  const units = buildMarketMotionPresentationUnits([
    record("a"),
    record("b"),
    record("c", {
      source_url: "https://www.youtube.com/watch?v=video-b",
      metadata: {
        ingestion: "creator-transcript-motion-lead/v1",
        itemKey: "youtube:wallstreettruthbombs:video-b",
        creatorVideoTitle: "Second video",
      },
    }),
    record("d", {
      source_url: "https://www.youtube.com/watch?v=video-b",
      metadata: {
        ingestion: "creator-transcript-motion-lead/v1",
        itemKey: "youtube:wallstreettruthbombs:video-b",
        creatorVideoTitle: "Second video",
      },
    }),
  ]);

  assert.equal(units.length, 2);
  assert.ok(units.every((unit) => unit.kind === "creator_bundle"));
});

test("creator rows without exact itemKey fail open as singletons", () => {
  const units = buildMarketMotionPresentationUnits([
    record("a", { metadata: { ingestion: "creator-transcript-motion-lead/v1" } }),
    record("b", { metadata: { itemKey: "youtube:x" } }),
  ]);

  assert.equal(units.length, 2);
  assert.ok(units.every((unit) => unit.kind === "singleton"));
});

test("corroborated stronger-source event is never swallowed by creator bundle", () => {
  const corroborated = record("reported", {
    motion_key: "event:financing:utility-grid",
    source_name: "Reuters",
    source_url: "https://www.reuters.com/example",
    source_kind: "reporting",
    verification_state: "REPORTED",
    metadata: {
      ingestion: "creator-transcript-motion-lead/v1",
      itemKey: "youtube:wallstreettruthbombs:video-a",
      creatorVideoTitle: "AI grid bills are exploding",
      sourceRefs: [
        { sourceName: "Wall Street Truthbombs", sourceUrl: "https://www.youtube.com/watch?v=video-a", sourceKind: "creator" },
        { sourceName: "Reuters", sourceUrl: "https://www.reuters.com/example", sourceKind: "reporting" },
      ],
    },
  });

  const units = buildMarketMotionPresentationUnits([
    record("a"),
    record("b"),
    corroborated,
  ]);

  assert.equal(units.length, 2);
  const bundle = units.find((unit) => unit.kind === "creator_bundle");
  const singleton = units.find((unit) => unit.kind === "singleton");
  assert.ok(bundle);
  assert.equal(bundle?.records.length, 2);
  assert.equal(singleton?.primary.id, "reported");
});

test("a single creator claim remains a normal singleton", () => {
  const units = buildMarketMotionPresentationUnits([record("only")]);
  assert.equal(units.length, 1);
  assert.equal(units[0]?.kind, "singleton");
  assert.equal(units[0]?.primary.id, "only");
});

test("promoted child leads deterministic bundle ranking without promoting siblings", () => {
  const units = buildMarketMotionPresentationUnits([
    record("high-score", { materiality: 99, relevance: 99, novelty: 99 }),
    record("promoted", {
      lifecycle_state: "PROMOTED",
      effective_state: "PROMOTED",
      materiality: 75,
      relevance: 75,
      novelty: 75,
    }),
    record("lead"),
  ]);

  assert.equal(units[0]?.kind, "creator_bundle");
  if (units[0]?.kind !== "creator_bundle") return;
  assert.equal(units[0].primary.id, "promoted");
  assert.equal(units[0].promotedCount, 1);
  assert.equal(units[0].leadCount, 3);
  assert.equal(units[0].records.filter((item) => item.lifecycle_state === "PROMOTED").length, 1);
});

test("bundle preview is capped at three while preserving all underlying records", () => {
  const units = buildMarketMotionPresentationUnits([
    record("a"),
    record("b"),
    record("c"),
    record("d"),
    record("e"),
  ]);

  assert.equal(units[0]?.kind, "creator_bundle");
  if (units[0]?.kind !== "creator_bundle") return;
  assert.equal(MARKET_MOTION_BUNDLE_PREVIEW_LIMIT, 3);
  assert.equal(units[0].previewRecords.length, 3);
  assert.equal(units[0].records.length, 5);
});

test("ranking uses lifecycle, attention, materiality, relevance, novelty then stable identity", () => {
  const units = buildMarketMotionPresentationUnits([
    record("secondary", {
      materiality: 74,
      relevance: 72,
      novelty: 70,
    }),
    record("primary", {
      materiality: 96,
      relevance: 95,
      novelty: 90,
    }),
    record("promoted", {
      lifecycle_state: "PROMOTED",
      effective_state: "PROMOTED",
      materiality: 73,
      relevance: 71,
      novelty: 69,
    }),
  ]);

  assert.equal(units[0]?.kind, "creator_bundle");
  if (units[0]?.kind !== "creator_bundle") return;
  assert.deepEqual(units[0].records.map((item) => item.id), [
    "promoted",
    "primary",
    "secondary",
  ]);
});

test("presentation units remain chronological at top level", () => {
  const older = record("older", {
    source_url: "https://example.com/older",
    source_kind: "reporting",
    metadata: {},
    occurred_at: "2026-10-01T10:00:00.000Z",
  });
  const newer = record("newer", {
    source_url: "https://example.com/newer",
    source_kind: "reporting",
    metadata: {},
    occurred_at: "2026-10-02T10:00:00.000Z",
  });

  const units = buildMarketMotionPresentationUnits([older, newer]);
  assert.deepEqual(units.map((unit) => unit.primary.id), ["newer", "older"]);
});

test("presentation helper is read-only and does not alter canonical rows", () => {
  const input = [record("a"), record("b")];
  const before = structuredClone(input);
  buildMarketMotionPresentationUnits(input);
  assert.deepEqual(input, before);
});
