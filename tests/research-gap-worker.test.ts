import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { MarketDossierV2 } from "../lib/dossier-v2/contracts.ts";
import type { MarketMotionRecord } from "../lib/market-motion.ts";
import {
  buildResearchGapWorkQueue,
  loadLatestResearchGapWorkQueue,
  type CanonicalDivergenceResearchDebtRow,
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

function divergenceDebt(
  overrides: Partial<CanonicalDivergenceResearchDebtRow> = {},
): CanonicalDivergenceResearchDebtRow {
  return {
    debt_key: "divergence:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    severity: "high",
    status: "open",
    reason: "Material canonical divergence remains causally unresolved after Hypothesis: COMPETING_HYPOTHESES.",
    next_action: "Recruit only real yields and breakevens around the divergence window; if still unresolved, then recruit curve or term-premium context.",
    next_check_at: "2026-10-01T01:00:00.000Z",
    metadata: {
      kind: "canonical_divergence_recruitment",
      contractVersion: "divergence-evidence-recruitment/1",
      divergenceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      marketBeliefId: "belief-rates",
      question: "Why did long-end yields stay elevated when they were expected to ease?",
      evidenceNeeded: [
        "real yields and breakevens around the divergence window",
        "curve, term-premium or meeting-pricing context only if the first test remains unresolved",
      ],
      magnitude: 82,
      persistenceScore: 76,
      resolutionState: "COMPETING_HYPOTHESES",
    },
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

test("fresh promoted Motion opens traceable Story or Regime research candidates without becoming a second authority", () => {
  const queue = buildResearchGapWorkQueue(
    dossier(),
    new Date("2026-10-01T01:00:00.000Z"),
    [
      motion(),
      motion({ id: "expired", motion_key: "expired", expires_at: "2026-10-01T00:59:00.000Z" }),
      motion({ id: "plain", motion_key: "plain", lifecycle_state: "MOTION", effective_state: "MOTION" }),
      motion({ id: "no-test", motion_key: "no-test", next_test: null }),
      motion({ id: "regime-only", motion_key: "regime-only", primary_story_id: null }),
      motion({ id: "unlinked", motion_key: "unlinked", primary_story_id: null, primary_regime_slug: null }),
    ],
  );

  const candidates = queue.candidates.filter((item) => item.sourceKind === "market_motion");
  assert.equal(candidates.length, 2);
  assert.equal(queue.sourceCounts.marketMotion, 2);

  const storyScoped = candidates.find((item) => item.sourceRef === "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.ok(storyScoped);
  assert.equal(storyScoped?.question, motion().next_test);
  assert.deepEqual(storyScoped?.linkedStoryIds, ["story:rates-duration-stress"]);
  assert.deepEqual(storyScoped?.blockingRefs, [
    "MOTION:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "STORY:story:rates-duration-stress",
    "REGIME:global-cost-of-capital",
  ]);
  assert.ok(storyScoped?.gapKey.startsWith("gap:motion:event:rates:term-premium:branch:"));
  assert.equal(storyScoped?.nativeSignals.motionAttentionTier, "PRIMARY");
  assert.ok((storyScoped?.nativeSignals.motionAttentionScore ?? 0) >= 82);

  const regimeOnly = candidates.find((item) => item.sourceRef === "regime-only");
  assert.ok(regimeOnly);
  assert.deepEqual(regimeOnly?.linkedStoryIds, []);
  assert.deepEqual(regimeOnly?.blockingRefs, [
    "MOTION:regime-only",
    "REGIME:global-cost-of-capital",
  ]);
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
  const debtQuery = {
    select(value: string) {
      calls.push(["debt:select", value]);
      return this;
    },
    eq(column: string, value: unknown) {
      calls.push([`debt:eq:${column}`, value]);
      return this;
    },
    like(column: string, value: unknown) {
      calls.push([`debt:like:${column}`, value]);
      return this;
    },
    order(column: string, options: unknown) {
      calls.push([`debt:order:${column}`, options]);
      return this;
    },
    async limit(value: number) {
      calls.push(["debt:limit", value]);
      return { data: [divergenceDebt()], error: null };
    },
  };
  const fakeClient = {
    from(table: string) {
      if (table === "market_dossiers_v2") return dossierQuery;
      if (table === "current_market_motion_items") return motionQuery;
      if (table === "research_debt") return debtQuery;
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
  assert.ok(calls.some(([name, value]) => name === "debt:eq:status" && value === "open"));
  assert.ok(calls.some(([name, value]) => name === "debt:like:debt_key" && value === "divergence:%"));
  assert.ok(calls.some(([name, value]) => name === "debt:limit" && value === 12));
  assert.equal(queue?.sourceCounts.researchGaps, 2);
});

test("machine-authenticated queue endpoint is whitelisted before dashboard session auth", () => {
  const config = readFileSync(new URL("../lib/supabase/config.ts", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/research-gap/queue/route.ts", import.meta.url), "utf8");
  assert.match(config, /MACHINE_AUTH_PATHS[\s\S]*"\/api\/research-gap\/queue"/);
  assert.match(route, /acceptsResearchAuthorization/);
  assert.match(route, /loadLatestResearchGapWorkQueue/);
});


test("B3a unresolved Dossier Motion enters Research Gap work without promotion", () => {
  const row = dossier({
    payload: {
      motion_attention_snapshot: [{
        motion_id: "motion-unresolved-story",
        headline: "Long-end yields stay firm after softer inflation",
        what_happened: "The long end remained elevated.",
        market_reaction: "10Y and 30Y stayed firm.",
        why_interesting: "Tests whether duration pressure is broader than inflation alone.",
        big_picture_bridge: "Long-end pressure -> financing costs -> valuation.",
        next_test: "Separate real yields, supply and term premium.",
        primary_story_id: "story:rates-duration-stress",
        primary_regime_slug: "global-cost-of-capital",
        packet_evidence_id: "ev:rates",
        verification_state: "VERIFIED",
        materiality: 93,
        relevance: 95,
        novelty: 84,
      }],
      analytical_output: {
        research_now: [],
        investigations: [],
        motion_attention_assessments: [{
          motion_id: "motion-unresolved-story",
          decision: "UNRESOLVED",
          reason: "The move is material but current evidence cannot identify the dominant long-end driver.",
          evidence_references: ["ev:rates"],
          story_implication: null,
          regime_implication: null,
          investigation_next: "Separate real yields, supply and term premium.",
          refined_headline: null,
          refined_why_interesting: null,
          refined_big_picture_bridge: null,
        }],
      },
    },
  });

  const queue = buildResearchGapWorkQueue(row, new Date("2026-10-01T01:00:00.000Z"));
  const candidate = queue.candidates.find((item) => item.sourceRef === "motion-unresolved-story");

  assert.ok(candidate);
  assert.equal(candidate?.sourceKind, "market_motion");
  assert.equal(candidate?.question, "Separate real yields, supply and term premium.");
  assert.deepEqual(candidate?.linkedStoryIds, ["story:rates-duration-stress"]);
  assert.deepEqual(candidate?.blockingRefs, [
    "MOTION:motion-unresolved-story",
    "STORY:story:rates-duration-stress",
    "REGIME:global-cost-of-capital",
  ]);
  assert.equal(candidate?.nativeSignals.divergence, "UNRESOLVED");
  assert.equal(queue.sourceCounts.marketMotion, 1);
});

test("B3a regime-only unresolved Motion can become research work without inventing a Story", () => {
  const row = dossier({
    payload: {
      motion_attention_snapshot: [{
        motion_id: "motion-unresolved-regime",
        headline: "Long-end pressure persists",
        what_happened: "Long-end yields remained elevated.",
        market_reaction: "Duration stayed weak.",
        why_interesting: "Tests the active rate regime.",
        big_picture_bridge: "Duration pressure -> funding costs -> valuation.",
        next_test: "Check auctions, real yields and foreign duration.",
        primary_story_id: null,
        primary_regime_slug: "global-cost-of-capital",
        packet_evidence_id: "ev:rates",
        verification_state: "REPORTED",
        materiality: 91,
        relevance: 92,
        novelty: 81,
      }],
      analytical_output: {
        research_now: [],
        investigations: [],
        motion_attention_assessments: [{
          motion_id: "motion-unresolved-regime",
          decision: "UNRESOLVED",
          reason: "The regime implication is material, but no exact Story conclusion is established.",
          evidence_references: ["ev:rates"],
          story_implication: null,
          regime_implication: null,
          investigation_next: "Check auctions, real yields and foreign duration.",
          refined_headline: null,
          refined_why_interesting: null,
          refined_big_picture_bridge: null,
        }],
      },
    },
  });

  const queue = buildResearchGapWorkQueue(row, new Date("2026-10-01T01:00:00.000Z"));
  const candidate = queue.candidates.find((item) => item.sourceRef === "motion-unresolved-regime");

  assert.ok(candidate);
  assert.deepEqual(candidate?.linkedStoryIds, []);
  assert.deepEqual(candidate?.blockingRefs, [
    "MOTION:motion-unresolved-regime",
    "REGIME:global-cost-of-capital",
  ]);
  assert.match(candidate?.gapKey || "", /^gap:motion:motion-unresolved-regime:branch:/);
});

test("B3a only UNRESOLVED Motion assessments open the pre-promotion research path", () => {
  const row = dossier({
    payload: {
      motion_attention_snapshot: [
        {
          motion_id: "motion-rejected",
          headline: "Rejected framing",
          what_happened: "A development occurred.",
          market_reaction: null,
          why_interesting: "Needs checking.",
          big_picture_bridge: "Event -> regime.",
          next_test: "Check source.",
          primary_story_id: null,
          primary_regime_slug: "global-cost-of-capital",
          packet_evidence_id: "ev:1",
          verification_state: "REPORTED",
          materiality: 95,
          relevance: 95,
          novelty: 95,
        },
        {
          motion_id: "motion-unresolved-no-next",
          headline: "Unresolved without next test",
          what_happened: "A development occurred.",
          market_reaction: null,
          why_interesting: "Needs checking.",
          big_picture_bridge: "Event -> regime.",
          next_test: null,
          primary_story_id: null,
          primary_regime_slug: "global-cost-of-capital",
          packet_evidence_id: "ev:2",
          verification_state: "REPORTED",
          materiality: 95,
          relevance: 95,
          novelty: 95,
        },
      ],
      analytical_output: {
        research_now: [],
        investigations: [],
        motion_attention_assessments: [
          {
            motion_id: "motion-rejected",
            decision: "REJECT",
            reason: "Canonical evidence does not support the framing.",
            evidence_references: ["ev:1"],
            story_implication: null,
            regime_implication: null,
            investigation_next: null,
            refined_headline: null,
            refined_why_interesting: null,
            refined_big_picture_bridge: null,
          },
          {
            motion_id: "motion-unresolved-no-next",
            decision: "UNRESOLVED",
            reason: "Material but no discriminator was supplied.",
            evidence_references: ["ev:2"],
            story_implication: null,
            regime_implication: null,
            investigation_next: null,
            refined_headline: null,
            refined_why_interesting: null,
            refined_big_picture_bridge: null,
          },
        ],
      },
    },
  });

  const queue = buildResearchGapWorkQueue(row, new Date("2026-10-01T01:00:00.000Z"));
  assert.equal(queue.sourceCounts.marketMotion, 0);
});


test("P2.2 canonical divergence debt enters the existing Research Gap queue as bounded research work", () => {
  const queue = buildResearchGapWorkQueue(
    dossier(),
    new Date("2026-10-01T01:00:00.000Z"),
    [],
    [divergenceDebt()],
  );

  const candidate = queue.candidates.find((item) => item.sourceRef.startsWith("divergence:"));
  assert.ok(candidate);
  assert.equal(candidate?.sourceKind, "research_gap");
  assert.equal(candidate?.nativeSignals.severity, "MATERIAL");
  assert.equal(candidate?.nativeSignals.gapClass, "REFINEMENT");
  assert.equal(candidate?.nativeSignals.divergence, "UNRESOLVED");
  assert.equal(candidate?.nativeSignals.expectedInformationGain, "High");
  assert.deepEqual(candidate?.blockingRefs, [
    "DIVERGENCE:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "BELIEF:belief-rates",
  ]);
  assert.deepEqual(candidate?.evidenceNeeded, [
    "real yields and breakevens around the divergence window",
    "curve, term-premium or meeting-pricing context only if the first test remains unresolved",
  ]);
  assert.equal(queue.sourceCounts.researchGaps, 2);
});

test("P2.2 malformed or non-open divergence debt fails closed", () => {
  const queue = buildResearchGapWorkQueue(
    dossier(),
    new Date("2026-10-01T01:00:00.000Z"),
    [],
    [
      divergenceDebt({ status: "resolved" }),
      divergenceDebt({ debt_key: "transcript:youtube:abc" }),
      divergenceDebt({ metadata: { kind: "other" } }),
      divergenceDebt({ metadata: { kind: "canonical_divergence_recruitment" } }),
    ],
  );

  assert.equal(queue.sourceCounts.researchGaps, 1);
  assert.equal(queue.candidates.some((item) => item.sourceRef.startsWith("divergence:")), false);
});
