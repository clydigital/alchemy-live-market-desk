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
          candidate_explanations: [{
            rank: 1,
            explanation: "Duration pressure is transmitting through credit.",
            evidence_for_ids: [],
            evidence_against_ids: [],
            confidence: "UNRESOLVED",
            discriminating_test: "Compare HY/IG spread widening with MOVE and long-end yield persistence.",
          }, {
            rank: 2,
            explanation: "The move is valuation-only rather than credit transmission.",
            evidence_for_ids: [],
            evidence_against_ids: [],
            confidence: "UNRESOLVED",
            discriminating_test: "Check whether credit spreads remain contained while duration-sensitive equities lag.",
          }],
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

test("B3 raw promoted Motion cannot create Research Gap work outside the Dossier", () => {
  const sameNextTest = "Pull MOVE/VIX, HY/IG, global long yields and FX basis.";
  const queue = buildResearchGapWorkQueue(
    dossier(),
    new Date("2026-10-01T01:00:00.000Z"),
    [
      motion({ next_test: sameNextTest }),
      motion({ id: "expired", motion_key: "expired", expires_at: "2026-10-01T00:59:00.000Z" }),
      motion({ id: "plain", motion_key: "plain", lifecycle_state: "MOTION", effective_state: "MOTION" }),
    ],
  );

  assert.equal(queue.sourceCounts.marketMotion, 0);
  assert.equal(queue.candidates.some((item) => item.sourceKind === "market_motion"), false);
  assert.deepEqual(queue.candidates.map((item) => item.sourceKind), [
    "research_gap",
    "research_now",
    "investigation",
  ]);

  const matchingQuestion = queue.candidates.filter((item) => item.question === sameNextTest);
  assert.equal(matchingQuestion.length, 0);
  assert.equal(
    queue.candidates.filter((item) => item.sourceKind === "investigation").length,
    1,
  );
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
  assert.deepEqual(investigation.evidenceNeeded, [
    "MOVE/VIX",
    "HY/IG",
    "Compare HY/IG spread widening with MOVE and long-end yield persistence.",
  ]);
  assert.deepEqual(investigation.causalDiscriminatorPlan?.discriminators, [
    "Compare HY/IG spread widening with MOVE and long-end yield persistence.",
    "Check whether credit spreads remain contained while duration-sensitive equities lag.",
  ]);
  assert.deepEqual(investigation.causalDiscriminatorPlan?.baseEvidenceNeeded, [
    "MOVE/VIX",
    "HY/IG",
  ]);
});

test("causal discriminating tests do not churn persistent Investigation gap identity", () => {
  const first = buildResearchGapWorkQueue(dossier());
  const changed = dossier();
  const analytical = changed.payload.analytical_output as Record<string, unknown>;
  const investigations = analytical.investigations as Array<Record<string, unknown>>;
  investigations[0] = {
    ...investigations[0],
    candidate_explanations: [{
      rank: 1,
      explanation: "A different mechanism is now plausible.",
      evidence_for_ids: [],
      evidence_against_ids: [],
      confidence: "LOW",
      discriminating_test: "Test a newly identified cross-asset transmission channel.",
    }],
  };

  const second = buildResearchGapWorkQueue(changed);
  const firstInvestigation = first.candidates.find((item) => item.sourceKind === "investigation");
  const secondInvestigation = second.candidates.find((item) => item.sourceKind === "investigation");

  assert.equal(firstInvestigation?.gapKey, "gap:investigation:inv:duration-transmission");
  assert.equal(secondInvestigation?.gapKey, firstInvestigation?.gapKey);
  assert.deepEqual(secondInvestigation?.evidenceNeeded, [
    "MOVE/VIX",
    "HY/IG",
    "Test a newly identified cross-asset transmission channel.",
  ]);
  assert.notEqual(
    secondInvestigation?.causalDiscriminatorPlan?.planSignature,
    firstInvestigation?.causalDiscriminatorPlan?.planSignature,
  );
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

test("B3 latest-Dossier loader does not query current Market Motion", async () => {
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
      return { data: [], error: null };
    },
  };
  const fakeClient = {
    from(table: string) {
      calls.push(["from", table]);
      if (table === "market_dossiers_v2") return dossierQuery;
      if (table === "research_debt") return debtQuery;
      throw new Error(`unexpected table ${table}`);
    },
  };

  const queue = await loadLatestResearchGapWorkQueue(
    fakeClient as never,
    new Date("2026-10-01T01:00:00Z"),
  );
  assert.equal(queue?.dossierId, row.id);
  assert.equal(queue?.sourceCounts.marketMotion, 0);
  assert.deepEqual(calls.filter(([name]) => String(name).startsWith("dossier:order:")), [
    ["dossier:order:as_of", { ascending: false }],
    ["dossier:order:created_at", { ascending: false }],
  ]);
  assert.ok(calls.some(([name, value]) => name === "debt:eq:status" && value === "open"));
  assert.ok(calls.some(([name, value]) => name === "debt:like:debt_key" && value === "divergence:%"));
  assert.equal(
    calls.some(([name, value]) => name === "from" && value === "current_market_motion_items"),
    false,
  );
});

test("machine-authenticated queue endpoint is whitelisted before dashboard session auth", () => {
  const config = readFileSync(new URL("../lib/supabase/config.ts", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/research-gap/queue/route.ts", import.meta.url), "utf8");
  assert.match(config, /MACHINE_AUTH_PATHS[\s\S]*"\/api\/research-gap\/queue"/);
  assert.match(route, /acceptsResearchAuthorization/);
  assert.match(route, /loadLatestResearchGapWorkQueue/);
});


test("B3 Dossier Investigation and Research Now remain Research Gap sources when raw Motion collides", () => {
  const raw = motion({
    next_test: "Pull MOVE/VIX, HY/IG, global long yields and FX basis.",
  });
  const queue = buildResearchGapWorkQueue(
    dossier(),
    new Date("2026-10-01T01:00:00.000Z"),
    [raw],
  );

  const investigation = queue.candidates.find((item) => item.sourceKind === "investigation");
  const researchNow = queue.candidates.find((item) => item.sourceKind === "research_now");

  assert.equal(investigation?.sourceRef, "inv:duration-transmission");
  assert.deepEqual(investigation?.linkedInvestigationIds, ["inv:duration-transmission"]);
  assert.equal(researchNow?.nativeSignals.researchNowRank, 1);
  assert.ok(researchNow?.gapKey);
  assert.equal(queue.candidates.some((item) => item.sourceKind === "market_motion"), false);
});
