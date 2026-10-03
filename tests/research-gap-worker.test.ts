import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { MarketDossierV2 } from "../lib/dossier-v2/contracts.ts";
import type { MarketMotionRecord } from "../lib/market-motion.ts";
import {
  buildResearchGapWorkQueue,
  loadLatestResearchGapWorkQueue,
} from "../lib/research-gap-worker.ts";

function dossier(overrides: Partial<MarketDossierV2> = {}): MarketDossierV2 {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    contract_version: "market-dossier-v2/1",
    previous_dossier_id: null,
    as_of: "2026-10-01T00:00:00.000Z",
    freshness: { warnings: [] },
    research_gaps: [{
      gap_id: "gap:credit-confirmation",
      category: "INVESTIGATION_EVIDENCE",
      description: "Need current HY/IG and MOVE/VIX confirmation.",
      severity: "MATERIAL",
      gap_class: "BLOCKER",
      blocking_refs: ["REGIME:CURRENT", "STORY:story:rates-duration-stress"],
    }],
    payload: {
      analytical_output: {
        research_now: [{
          rank: 1,
          action: "Decompose the full Treasury curve and global long-end confirmation.",
          reason: "Separate Fed path from term-premium and global-duration pressure.",
          expected_information_gain: "High",
          linked_investigations: ["inv:duration-transmission"],
          linked_stories: ["story:rates-duration-stress"],
          blocking_evidence: ["Bund/JGB 10Y/30Y", "Cross-currency basis"],
        }],
        investigations: [{
          investigation_id: "inv:duration-transmission",
          status: "open",
          question: "Is duration stress transmitting into credit and volatility?",
          research_next: "Pull MOVE/VIX, HY/IG, global long yields and FX basis.",
          why_it_matters: "Tests whether a rates shock is becoming broader financial tightening.",
          missing_evidence: ["MOVE/VIX", "HY/IG"],
          linked_story_ids: ["story:rates-duration-stress"],
          divergence: "UNRESOLVED",
        }, {
          investigation_id: "inv:old",
          status: "resolved",
          question: "Old resolved question?",
          research_next: "Nothing.",
          why_it_matters: "Historical only.",
          missing_evidence: [],
          linked_story_ids: [],
          divergence: "NONE",
        }],
      },
    },
    created_at: "2026-10-01T00:01:00.000Z",
    ...overrides,
  };
}

function unresolvedMotionDossier(
  overrides: Partial<MarketDossierV2> = {},
): MarketDossierV2 {
  const base = dossier();
  const unresolvedMotionId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  return {
    ...base,
    payload: {
      ...base.payload,
      motion_attention_snapshot: [{
        motion_id: unresolvedMotionId,
        headline: "Long-end yields remain firm after softer inflation evidence",
        what_happened: "The long end stayed elevated.",
        market_reaction: "US10Y and US30Y remained firm.",
        why_interesting: "Tests whether duration pressure is broader than the inflation impulse.",
        big_picture_bridge: "Long-end pressure -> financing conditions -> valuation.",
        next_test: "Separate real-yield, Treasury supply and term-premium channels.",
        primary_story_id: null,
        primary_regime_slug: "global-cost-of-capital",
        packet_evidence_id: "verified-macro:rates-1",
        verification_state: "VERIFIED",
        materiality: 94,
        relevance: 93,
        novelty: 86,
      }],
      analytical_output: {
        ...((base.payload.analytical_output || {}) as Record<string, unknown>),
        motion_attention_assessments: [{
          motion_id: unresolvedMotionId,
          decision: "UNRESOLVED",
          reason: "Current evidence confirms the move but cannot yet discriminate the dominant long-end driver.",
          evidence_references: ["verified-macro:rates-1"],
          story_implication: null,
          regime_implication: null,
          investigation_next: "Separate real-yield, Treasury supply and term-premium channels.",
          refined_headline: null,
          refined_why_interesting: null,
          refined_big_picture_bridge: null,
        }],
      },
    },
    ...overrides,
  };
}

function motion(overrides: Partial<MarketMotionRecord> = {}): MarketMotionRecord {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    motion_key: "event:rates:term-premium",
    version_number: 2,
    previous_version_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    contract_version: "market-motion/v1",
    research_run_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    source_id: null,
    evidence_id: null,
    primary_story_id: "story:rates-duration-stress",
    primary_regime_slug: "global-cost-of-capital",
    lifecycle_state: "PROMOTED",
    effective_state: "PROMOTED",
    category: "MACRO",
    verification_state: "VERIFIED",
    headline: "Long-end yields stay elevated after the policy move",
    what_happened: "The long end remains under pressure despite a less dramatic front-end move.",
    market_reaction: "US10Y and US30Y stayed firm while growth equities lagged.",
    why_interesting: "Tests whether term premium is becoming the dominant rates channel.",
    big_picture_bridge: "Treasury supply → long-end yields → financing costs → valuation",
    next_test: "Decompose 10Y/30Y real yields versus breakevens and compare DXY plus growth equities.",
    promotion_reason: "Canonical Story changed.",
    tickers: ["US10Y", "US30Y", "DXY"],
    source_name: "Treasury",
    source_url: "https://home.treasury.gov/example",
    source_kind: "official",
    materiality: 94,
    relevance: 93,
    novelty: 86,
    occurred_at: "2026-10-01T00:30:00.000Z",
    observed_at: "2026-10-01T00:40:00.000Z",
    expires_at: "2026-10-03T00:40:00.000Z",
    metadata: { writingAngles: ["Why the long end matters now"] },
    created_at: "2026-10-01T00:40:00.000Z",
    ...overrides,
  };
}

test("worker reads research gaps, Research Now and unresolved investigations without ranking them", () => {
  const queue = buildResearchGapWorkQueue(
    dossier(),
    new Date("2026-10-01T00:05:00.000Z"),
  );

  assert.equal(queue.contractVersion, "research-gap-work-queue/1");
  assert.equal(queue.generatedAt, "2026-10-01T00:05:00.000Z");
  assert.deepEqual(queue.sourceCounts, {
    researchGaps: 1,
    researchNow: 1,
    investigations: 1,
    marketMotion: 0,
  });
  assert.equal(queue.candidates.length, 3);
  assert.deepEqual(queue.candidates.map((item) => item.sourceKind), [
    "research_gap",
    "research_now",
    "investigation",
  ]);
  assert.equal(queue.diagnostics.needsPrioritisation, true);
  assert.equal(queue.diagnostics.excludedResolvedInvestigations, 1);
});

test("fresh promoted Motion opens one traceable research candidate without becoming a second authority", () => {
  const queue = buildResearchGapWorkQueue(
    dossier(),
    new Date("2026-10-01T01:00:00.000Z"),
    [
      motion(),
      motion({ id: "expired", motion_key: "expired", expires_at: "2026-10-01T00:59:00.000Z" }),
      motion({ id: "plain", motion_key: "plain", lifecycle_state: "MOTION", effective_state: "MOTION" }),
      motion({ id: "no-test", motion_key: "no-test", next_test: null }),
      motion({ id: "no-story", motion_key: "no-story", primary_story_id: null }),
    ],
  );

  const candidates = queue.candidates.filter((item) => item.sourceKind === "market_motion");
  assert.equal(candidates.length, 1);
  assert.equal(queue.sourceCounts.marketMotion, 1);
  assert.equal(candidates[0]?.sourceRef, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.equal(candidates[0]?.question, motion().next_test);
  assert.deepEqual(candidates[0]?.linkedStoryIds, ["story:rates-duration-stress"]);
  assert.ok(candidates[0]?.gapKey.startsWith("gap:motion:event:rates:term-premium:branch:"));
  assert.equal(candidates[0]?.nativeSignals.motionAttentionTier, "PRIMARY");
  assert.ok((candidates[0]?.nativeSignals.motionAttentionScore ?? 0) >= 82);
});

test("B3 Dossier-UNRESOLVED Motion enters Research Gap without promotion or a Story link", () => {
  const unresolvedRow = motion({
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    motion_key: "event:rates:unresolved-long-end",
    lifecycle_state: "MOTION",
    effective_state: "MOTION",
    primary_story_id: null,
    primary_regime_slug: "global-cost-of-capital",
    promotion_reason: null,
    next_test: "Original Motion next test should not override the Dossier assessment.",
  });
  const queue = buildResearchGapWorkQueue(
    unresolvedMotionDossier(),
    new Date("2026-10-01T01:00:00.000Z"),
    [],
    [unresolvedRow],
  );

  const candidates = queue.candidates.filter((item) => item.sourceKind === "market_motion");
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.sourceRef, unresolvedRow.id);
  assert.equal(
    candidates[0]?.question,
    "Separate real-yield, Treasury supply and term-premium channels.",
  );
  assert.deepEqual(candidates[0]?.linkedStoryIds, []);
  assert.deepEqual(candidates[0]?.blockingRefs, [
    `MOTION:${unresolvedRow.id}`,
    "REGIME:global-cost-of-capital",
  ]);
  assert.equal(candidates[0]?.nativeSignals.divergence, "UNRESOLVED");
  assert.ok(candidates[0]?.gapKey.startsWith("gap:motion:event:rates:unresolved-long-end:branch:"));
  assert.equal(unresolvedRow.lifecycle_state, "MOTION");
});

test("B3 unresolved Motion fails closed without exact Dossier snapshot lineage", () => {
  const broken = unresolvedMotionDossier();
  broken.payload.motion_attention_snapshot = [];
  const unresolvedRow = motion({
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    lifecycle_state: "MOTION",
    effective_state: "MOTION",
  });

  const queue = buildResearchGapWorkQueue(
    broken,
    new Date("2026-10-01T01:00:00.000Z"),
    [],
    [unresolvedRow],
  );

  assert.equal(queue.sourceCounts.marketMotion, 0);
});

test("native urgency and linkage signals survive normalisation", () => {
  const queue = buildResearchGapWorkQueue(dossier());
  const gap = queue.candidates[0]!;
  const now = queue.candidates[1]!;
  const investigation = queue.candidates[2]!;

  assert.equal(gap.nativeSignals.severity, "MATERIAL");
  assert.equal(gap.nativeSignals.gapClass, "BLOCKER");
  assert.deepEqual(gap.blockingRefs, ["REGIME:CURRENT", "STORY:story:rates-duration-stress"]);
  assert.deepEqual(gap.linkedStoryIds, ["story:rates-duration-stress"]);

  assert.equal(now.nativeSignals.researchNowRank, 1);
  assert.equal(now.nativeSignals.expectedInformationGain, "High");
  assert.deepEqual(now.linkedInvestigationIds, ["inv:duration-transmission"]);
  assert.deepEqual(now.evidenceNeeded, ["Bund/JGB 10Y/30Y", "Cross-currency basis"]);

  assert.equal(investigation.question, "Is duration stress transmitting into credit and volatility?");
  assert.equal(investigation.nativeSignals.investigationStatus, "open");
  assert.equal(investigation.nativeSignals.divergence, "UNRESOLVED");
  assert.deepEqual(investigation.evidenceNeeded, ["MOVE/VIX", "HY/IG"]);
});

test("work IDs stay Dossier-scoped while gap keys persist across Dossiers", () => {
  const first = buildResearchGapWorkQueue(dossier(), new Date("2026-10-01T00:05:00Z"));
  const replay = buildResearchGapWorkQueue(dossier(), new Date("2026-10-01T00:06:00Z"));
  const next = buildResearchGapWorkQueue(dossier({
    id: "22222222-2222-4222-8222-222222222222",
    previous_dossier_id: "11111111-1111-4111-8111-111111111111",
    as_of: "2026-10-01T12:00:00.000Z",
  }));

  assert.deepEqual(
    first.candidates.map((item) => item.workId),
    replay.candidates.map((item) => item.workId),
  );
  assert.notDeepEqual(
    first.candidates.map((item) => item.workId),
    next.candidates.map((item) => item.workId),
  );
  assert.deepEqual(
    first.candidates.map((item) => item.gapKey),
    next.candidates.map((item) => item.gapKey),
  );
});

test("latest-Dossier loader adds current promoted Motion as a bounded secondary work source", async () => {
  const row = dossier();
  const calls: Array<[string, unknown]> = [];
  const dossierQuery = {
    select(value: string) {
      calls.push(["dossier:select", value]);
      return this;
    },
    order(column: string, options: unknown) {
      calls.push([`dossier:order:${column}`, options]);
      return this;
    },
    limit(value: number) {
      calls.push(["dossier:limit", value]);
      return this;
    },
    async maybeSingle() {
      calls.push(["dossier:maybeSingle", true]);
      return { data: row, error: null };
    },
  };
  const motionQuery = {
    select(value: string) {
      calls.push(["motion:select", value]);
      return this;
    },
    eq(column: string, value: unknown) {
      calls.push([`motion:eq:${column}`, value]);
      return this;
    },
    order(column: string, options: unknown) {
      calls.push([`motion:order:${column}`, options]);
      return this;
    },
    async limit(value: number) {
      calls.push(["motion:limit", value]);
      return { data: [motion()], error: null };
    },
  };
  const fakeClient = {
    from(table: string) {
      if (table === "market_dossiers_v2") return dossierQuery;
      if (table === "current_market_motion_items") return motionQuery;
      throw new Error(`unexpected table ${table}`);
    },
  };

  const queue = await loadLatestResearchGapWorkQueue(
    fakeClient as never,
    new Date("2026-10-01T01:00:00Z"),
  );
  assert.equal(queue?.dossierId, row.id);
  assert.equal(queue?.sourceCounts.marketMotion, 1);
  assert.deepEqual(calls.filter(([name]) => String(name).startsWith("dossier:order:")), [
    ["dossier:order:as_of", { ascending: false }],
    ["dossier:order:created_at", { ascending: false }],
  ]);
  assert.ok(calls.some(([name, value]) => name === "motion:eq:lifecycle_state" && value === "PROMOTED"));
  assert.ok(calls.some(([name, value]) => name === "motion:eq:effective_state" && value === "PROMOTED"));
  assert.ok(calls.some(([name, value]) => name === "motion:limit" && value === 18));
});

test("machine-authenticated queue endpoint is whitelisted before dashboard session auth", () => {
  const config = readFileSync(new URL("../lib/supabase/config.ts", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/research-gap/queue/route.ts", import.meta.url), "utf8");
  assert.match(config, /MACHINE_AUTH_PATHS[\s\S]*"\/api\/research-gap\/queue"/);
  assert.match(route, /acceptsResearchAuthorization/);
  assert.match(route, /loadLatestResearchGapWorkQueue/);
});
