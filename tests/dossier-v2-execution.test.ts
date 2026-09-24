import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  MARKET_DOSSIER_V2_CONTRACT_VERSION,
  type MarketDossierV2,
} from "../lib/dossier-v2/contracts.ts";
import {
  buildMarketDossierV2InputFromResearchBrain,
  executeAndPersistDossierV2,
} from "../lib/dossier-v2/execution.ts";
import { assembleDossierV2InputPacket } from "../lib/dossier-v2/input-packet.ts";
import {
  RESEARCH_BRAIN_CONTRACT_VERSION,
  THESIS_LEDGER_V2_CONTRACT_VERSION,
  type MarketLens,
  type ResearchBrainOutputV1,
} from "../lib/dossier-v2/research-brain-contracts.ts";
import type { ModelRunner } from "../lib/dossier-v2/research-brain.ts";

const REQUIRED_LENSES = [
  "US_RATES",
  "BONDS",
  "TECH_AI",
  "OIL_WAR_INFLATION",
  "USD",
  "GOLD",
  "CREDIT",
  "BREADTH",
];

function createMockDossierStore() {
  const store = new Map<string, MarketDossierV2>();

  const client = {
    from(table: string) {
      assert.equal(table, "market_dossiers_v2");

      return {
        insert(payload: Record<string, unknown>) {
          return {
            select(_fields: string) {
              return {
                async single() {
                  const id = (payload.id as string) || randomUUID();
                  const record: MarketDossierV2 = {
                    id,
                    contract_version: String(payload.contract_version),
                    previous_dossier_id: payload.previous_dossier_id
                      ? String(payload.previous_dossier_id)
                      : null,
                    as_of: String(payload.as_of),
                    freshness: payload.freshness as Record<string, unknown>,
                    research_gaps: payload.research_gaps as unknown[],
                    payload: payload.payload as Record<string, unknown>,
                    created_at: "2026-09-20T00:00:00.000Z",
                  };
                  store.set(id, record);
                  return { data: record, error: null };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;

  return { store, client };
}

function createFailingDossierClient(): SupabaseClient {
  return {
    from(table: string) {
      assert.equal(table, "market_dossiers_v2");
      return {
        insert(_payload: Record<string, unknown>) {
          return {
            select(_fields: string) {
              return {
                async single() {
                  return {
                    data: null,
                    error: { message: "forced persistence failure" },
                  };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
}

function createPacket(previousDossierId: string | null = null) {
  const asOf = "2026-09-20T01:00:00.000Z";

  return assembleDossierV2InputPacket(
    {
      as_of: asOf,
      previous_dossier_id: previousDossierId,
      previous_dossier: previousDossierId
        ? {
            id: previousDossierId,
            as_of: "2026-09-19T12:00:00.000Z",
          }
        : null,
    },
    {
      observed_evidence: [
        {
          evidence_id: "ev:fed:task8",
          available_at: "2026-09-20T00:30:00.000Z",
          claim_or_fact: "Federal Reserve changed the target policy rate.",
          category: "MONETARY_POLICY",
          source_type: "PRESS_RELEASE",
          grouping_key: "task8-fed",
          provenance: [
            {
              source_type: "PRESS_RELEASE",
              source_id: "FOMC_STATEMENT_TASK8",
              publisher: "Federal Reserve",
            },
          ],
        },
        {
          evidence_id: "verified-macro:us-flash-pmi",
          available_at: "2026-09-20T00:32:00.000Z",
          claim_or_fact: "US Flash Manufacturing PMI was 57.0, above the 53.6 expected reading and 53.9 prior.",
          category: "US_ACTIVITY",
          source_type: "VERIFIED_MACRO_DATA",
          grouping_key: "US_ACTIVITY",
          metrics: {
            signal_kind: "economic_release",
            signal_context: "STRONG_ACTIVITY_SURPRISE",
            observed_value: 57,
            expected_value: 53.6,
            previous_value: 53.9,
            measurement_unit: "index",
          },
          provenance: [{
            source_type: "VERIFIED_MACRO_DATA",
            source_id: "verified-pmi",
            publisher: "Calendar",
          }],
        },
        {
          evidence_id: "ev:yields:task8",
          available_at: "2026-09-20T00:35:00.000Z",
          claim_or_fact: "US 2-year Treasury yield moved after the policy decision.",
          category: "PRICING_FEED",
          source_type: "PRICING_FEED",
          grouping_key: "task8-yields",
          provenance: [
            {
              source_type: "PRICING_FEED",
              source_id: "TREASURY_FEED_TASK8",
              publisher: "Market Data",
            },
          ],
        },
      ],
      price_data: {
        status: "OK",
        available_at: "2026-09-20T00:40:00.000Z",
      },
      macro_data: {
        status: "OK",
        available_at: "2026-09-20T00:25:00.000Z",
      },
      sources_status: {
        creator_intelligence: {
          status: "STALE",
          available_at: "2026-09-19T08:00:00.000Z",
          message: "Creator intelligence is stale for this execution fixture.",
        },
      },
    },
  );
}

function createValidBrainOutput(
  packet: ReturnType<typeof createPacket>,
): ResearchBrainOutputV1 {
  const observedEvidenceId =
    packet.observed_evidence.find((item) => item.evidence_id.includes("fed"))
      ?.evidence_id ?? packet.observed_evidence[0].evidence_id;

  const lenses: Record<string, MarketLens> = {};
  for (const lensName of REQUIRED_LENSES) {
    lenses[lensName] = {
      lens_name: lensName,
      observed_reaction: null,
      observed_reaction_evidence_refs: [],
      interpretation: "No validated reaction is supplied by this execution fixture.",
      contradiction_references: [],
      unresolved_signals: [],
    };
  }

  return {
    contract_version: RESEARCH_BRAIN_CONTRACT_VERSION,
    packet_id: packet.packet_id,
    as_of: packet.as_of,
    main_thread: {
      thread_id: "thread:task8",
      headline: "Policy change is the primary current desk development",
      answer: "The official policy release changed the policy rate.",
      regime_implication:
        "The policy change is observed; cross-asset interpretation remains separate.",
      regime_family: "UNRESOLVED",
      epistemic_label: "OBSERVED",
      evidence_references: [observedEvidenceId],
      supporting_story_ids: [],
      contradiction_references: [],
      what_would_change_mind: "A corrected or superseding official policy release.",
    },
    major_stories: [],
    chart_investigation_queue: {
      core: [],
      optional: [],
    },
    investigations: [],
    market_verdict: {
      verdict_id: "verdict:task8",
      lenses,
      cross_asset_readthrough:
        "No validated cross-asset reaction is supplied in this execution fixture.",
      epistemic_label: "OBSERVED",
      dominant_confirmation: "Official policy release.",
      dominant_contradiction: "Cross-asset confirmation is not supplied in this fixture.",
    },
    research_now: [],
    stock_radar: [],
    developing_themes: [],
    creator_theme_expansions: [],
    thesis_ledger: {
      contract_version: THESIS_LEDGER_V2_CONTRACT_VERSION,
      entries: [],
    },
    contradictions_detected: [],
    research_gaps: [...packet.research_gaps],
    diagnostics: {
      degraded: false,
      degradation_reasons: [],
      omitted_or_demoted_items: [],
      missing_input_categories: [],
      model_repair_used: false,
      notes: ["Task 8 valid execution fixture."],
    },
  };
}

test("Task 8 bridge executes Research Brain and persists one immutable MarketDossierV2", async () => {
  const previousDossierId = randomUUID();
  const packet = createPacket(previousDossierId);
  const packetSnapshot = structuredClone(packet);
  const { client, store } = createMockDossierStore();

  const validOutput = createValidBrainOutput(packet);
  let modelCalls = 0;

  const modelRunner: ModelRunner = async () => {
    modelCalls += 1;
    return { data: validOutput };
  };

  const result = await executeAndPersistDossierV2(packet, {
    client,
    researchBrainOptions: {
      modelRunner,
      allowRepair: true,
    },
  });

  assert.equal(modelCalls, 1);
  assert.equal(store.size, 1);
  assert.equal(result.packet_id, packet.packet_id);
  assert.equal(result.dossier.contract_version, MARKET_DOSSIER_V2_CONTRACT_VERSION);
  assert.equal(result.dossier.previous_dossier_id, previousDossierId);
  assert.equal(result.dossier.as_of, packet.as_of);

  assert.equal(result.dossier.payload.packet_id, packet.packet_id);
  assert.equal(
    result.dossier.payload.contract_version,
    RESEARCH_BRAIN_CONTRACT_VERSION,
  );

  const policyOutlook = result.dossier.payload.system1_policy_outlook as Array<Record<string, unknown>>;
  assert.equal(policyOutlook.length, 1);
  assert.equal(policyOutlook[0]?.policyImpulse, "HAWKISH");
  assert.equal(policyOutlook[0]?.fedWatchExpectedDirection, "HIKE_ODDS_UP");

  const rateRegime = result.dossier.payload.system1_rate_regime as Record<string, unknown>;
  assert.equal(rateRegime.contractVersion, "rate-regime/1");
  assert.equal(rateRegime.state, "UNRESOLVED");
  assert.equal(typeof rateRegime.score, "number");
  assert.ok(Array.isArray(rateRegime.signals));

  const analyticalOutput = result.dossier.payload
    .analytical_output as ResearchBrainOutputV1;
  assert.equal(analyticalOutput.packet_id, packet.packet_id);
  assert.equal(analyticalOutput.as_of, packet.as_of);
  assert.equal(analyticalOutput.diagnostics.degraded, false);

  const freshnessWarnings = result.dossier.freshness.warnings as unknown[];
  assert.equal(freshnessWarnings.length, 1);
  assert.deepEqual(
    result.dossier.freshness.input_diagnostics,
    packet.diagnostics,
  );

  assert.deepEqual(packet, packetSnapshot);
});

test("Task 8 bridge persists safe degraded Research Brain output instead of dropping the dossier", async () => {
  const packet = createPacket();
  const { client, store } = createMockDossierStore();

  const failingModelRunner: ModelRunner = async () => {
    throw new Error("forced Research Brain provider failure");
  };

  const result = await executeAndPersistDossierV2(packet, {
    client,
    researchBrainOptions: {
      modelRunner: failingModelRunner,
    },
  });

  assert.equal(store.size, 1);
  assert.equal(result.analytical_output.diagnostics.degraded, true);
  assert.equal(result.dossier.previous_dossier_id, null);

  const persistedAnalysis = result.dossier.payload
    .analytical_output as ResearchBrainOutputV1;
  assert.equal(persistedAnalysis.diagnostics.degraded, true);
  assert.equal(persistedAnalysis.stock_radar.length, 0);
  assert.equal(persistedAnalysis.major_stories.length, 0);

  const persistedGapCategories = result.dossier.research_gaps.map((gap) =>
    gap && typeof gap === "object" && !Array.isArray(gap)
      ? (gap as { category?: unknown }).category
      : undefined,
  );
  assert.ok(persistedGapCategories.includes("RESEARCH_BRAIN_DEGRADED"));
});

test("Task 8 mapper rejects analytical output from a different packet or as_of", () => {
  const packet = createPacket();
  const output = createValidBrainOutput(packet);

  const wrongPacketOutput: ResearchBrainOutputV1 = {
    ...output,
    packet_id: "packet:wrong",
  };

  assert.throws(
    () =>
      buildMarketDossierV2InputFromResearchBrain(
        packet,
        wrongPacketOutput,
      ),
    /packet_id mismatch/,
  );

  const wrongAsOfOutput: ResearchBrainOutputV1 = {
    ...output,
    as_of: "2026-09-20T02:00:00.000Z",
  };

  assert.throws(
    () =>
      buildMarketDossierV2InputFromResearchBrain(
        packet,
        wrongAsOfOutput,
      ),
    /as_of mismatch/,
  );
});

test("Task 8 bridge propagates persistence failure and never reports false success", async () => {
  const packet = createPacket();
  const validOutput = createValidBrainOutput(packet);

  const modelRunner: ModelRunner = async () => ({ data: validOutput });

  await assert.rejects(
    async () => {
      await executeAndPersistDossierV2(packet, {
        client: createFailingDossierClient(),
        researchBrainOptions: {
          modelRunner,
        },
      });
    },
    /Failed to persist MarketDossierV2: forced persistence failure/,
  );
});


test("Task 8 mapper demotes model-labelled refinements and keeps only structured canonical blockers", () => {
  const packet = createPacket();
  const output = createValidBrainOutput(packet);

  output.research_now = [
    {
      rank: 1,
      action: "Separate policy-path from real-yield, inflation and term-premium contributions.",
      reason: "Determine what is driving duration stress.",
      linked_stories: [],
      blocking_evidence: [],
      linked_investigations: [],
      expected_information_gain: "High",
    },
    {
      rank: 2,
      action: "Test credit, breadth and volatility transmission.",
      reason: "Distinguish rates stress from systemic risk-off.",
      linked_stories: [],
      blocking_evidence: [],
      linked_investigations: [],
      expected_information_gain: "High",
    },
    {
      rank: 3,
      action: "Test energy structure and event implementation.",
      reason: "Check whether the inflation impulse remains active.",
      linked_stories: [],
      blocking_evidence: [],
      linked_investigations: [],
      expected_information_gain: "High",
    },
  ];

  output.research_gaps = [
    {
      gap_id: "gap:term-premium-global-confirm",
      category: "rates",
      description: "Lack of term-premium decomposition and foreign-sovereign confirmation refines the US-led duration label.",
      severity: "MATERIAL",
    },
    {
      gap_id: "gap:padd2-flow-details",
      category: "energy",
      description: "Missing PADD2 outage schedules and intraregional flow detail refine the durability assessment.",
      severity: "MATERIAL",
    },
    {
      gap_id: "gap:material-blocker",
      category: "PRICE_DATA",
      description: "Required current price evidence is unavailable for a material conclusion.",
      severity: "MATERIAL",
      gap_class: "BLOCKER",
      blocking_refs: ["MAIN_THREAD"],
    },
  ] as typeof output.research_gaps;

  const dossierInput = buildMarketDossierV2InputFromResearchBrain(packet, output);
  const ids = dossierInput.research_gaps.flatMap((gap) =>
    gap && typeof gap === "object" && !Array.isArray(gap) && typeof (gap as { gap_id?: unknown }).gap_id === "string"
      ? [(gap as { gap_id: string }).gap_id]
      : [],
  );

  assert.ok(ids.includes("gap:material-blocker"));
  assert.ok(!ids.includes("gap:term-premium-global-confirm"));
  assert.ok(!ids.includes("gap:padd2-flow-details"));

  const persistedOutput = dossierInput.payload.analytical_output as ResearchBrainOutputV1;
  const routedEvidence = persistedOutput.research_now.flatMap((item) => item.blocking_evidence);
  assert.ok(routedEvidence.some((item) => /term-premium decomposition/i.test(item)));
  assert.ok(routedEvidence.some((item) => /PADD2 outage schedules/i.test(item)));
  assert.ok(persistedOutput.diagnostics.omitted_or_demoted_items.some((item) => /gap:term-premium-global-confirm/.test(item)));
  assert.equal(persistedOutput.research_now.length, 3);
});

test("Task 8 mapper rejects blocker references that do not resolve to a canonical conclusion", () => {
  const packet = createPacket();
  const output = createValidBrainOutput(packet);
  output.research_gaps = [{
    gap_id: "gap:orphan-blocker",
    category: "rates",
    description: "An unlinked blocker must not make the Dossier unhealthy.",
    severity: "MATERIAL",
    gap_class: "BLOCKER",
    blocking_refs: ["STORY:missing"],
  }] as typeof output.research_gaps;

  const dossierInput = buildMarketDossierV2InputFromResearchBrain(packet, output);
  assert.equal(dossierInput.research_gaps.length, 0);

  const persistedOutput = dossierInput.payload.analytical_output as ResearchBrainOutputV1;
  assert.ok(persistedOutput.research_now.some((item) =>
    item.blocking_evidence.some((evidence) => /unlinked blocker/i.test(evidence))
  ));
});

test("Task 8 mapper preserves an explicit global-duration blocker linked to the canonical Main Thread", () => {
  const packet = createPacket();
  const output = createValidBrainOutput(packet);
  output.main_thread.headline = "Global duration shock is the active regime";
  output.research_gaps = [{
    gap_id: "gap:global-duration-confirmation",
    category: "rates",
    description: "Non-US sovereign long-end evidence is required for the explicit global claim.",
    severity: "MATERIAL",
    gap_class: "BLOCKER",
    blocking_refs: ["MAIN_THREAD"],
  }] as typeof output.research_gaps;

  const dossierInput = buildMarketDossierV2InputFromResearchBrain(packet, output);
  const ids = dossierInput.research_gaps.map((gap) => (gap as { gap_id: string }).gap_id);
  assert.deepEqual(ids, ["gap:global-duration-confirmation"]);
});

test("Task 8 mapper completes the bounded rates-led research agenda without publishing unverified outcomes", () => {
  const packet = createPacket();
  const output = createValidBrainOutput(packet);
  output.main_thread.regime_family = "RATES_LED_TIGHTENING";
  output.research_now = [
    {
      rank: 1,
      action: "Perform 10Y/30Y decomposition.",
      reason: "Separate long-end drivers.",
      expected_information_gain: "High",
      linked_investigations: ["invest:duration-transmission"],
      linked_stories: [],
      blocking_evidence: [],
    },
    {
      rank: 2,
      action: "Check credit and breadth transmission.",
      reason: "Test whether rates stress is spreading.",
      expected_information_gain: "High",
      linked_investigations: ["invest:duration-transmission"],
      linked_stories: [],
      blocking_evidence: [],
    },
    {
      rank: 3,
      action: "Map PADD2 refinery detail.",
      reason: "Test product tightness.",
      expected_information_gain: "High",
      linked_investigations: ["invest:energy-inflation"],
      linked_stories: [],
      blocking_evidence: [],
    },
  ];
  output.investigations = [
    {
      investigation_id: "invest:duration-transmission",
      question: "Is duration stress transmitting into credit and breadth?",
      why_it_matters: "Distinguishes rates-led tightening from growth-scare risk-off.",
      current_explanation: "Transmission is incomplete.",
      expected_reaction: null,
      observed_reaction: null,
      divergence: "UNRESOLVED",
      competing_explanations: [],
      observed_evidence: [],
      missing_evidence: ["intraday credit reaction"],
      research_next: "Check HY and breadth.",
      chart_task_links: [],
      confirmation_condition: "Credit and breadth weaken with rates volatility.",
      invalidation_condition: "Credit remains contained while breadth improves.",
      status: "open",
      linked_story_ids: [],
      linked_thesis_ids: [],
    },
    {
      investigation_id: "invest:energy-inflation",
      question: "Will product tightness sustain the inflation impulse?",
      why_it_matters: "Energy can reinforce long-end pressure.",
      current_explanation: "Regional product stress is visible.",
      expected_reaction: null,
      observed_reaction: null,
      divergence: "UNRESOLVED",
      competing_explanations: [],
      observed_evidence: [],
      missing_evidence: ["refinery restart timing"],
      research_next: "Check PADD2 flows.",
      chart_task_links: [],
      confirmation_condition: "Product tightness persists.",
      invalidation_condition: "Stocks rebuild and cracks weaken.",
      status: "open",
      linked_story_ids: [],
      linked_thesis_ids: [],
    },
  ];

  const dossierInput = buildMarketDossierV2InputFromResearchBrain(packet, output);
  const persistedOutput = dossierInput.payload.analytical_output as ResearchBrainOutputV1;
  const agenda = persistedOutput.research_now.map((item) => `${item.action} ${item.reason}`).join(" ");
  assert.match(agenda, /2Y.*10Y.*30Y/i);
  assert.match(agenda, /term.?premium/i);
  assert.match(agenda, /Bund.*gilt.*JGB/i);
  assert.match(agenda, /gold.*real.?yield.*USD/i);
  assert.match(agenda, /HY.*IG.*MOVE.*VIX/i);
  assert.match(agenda, /crude curve.*cracks/i);
  assert.match(agenda, /verified Trump.*Xi/i);
  assert.doesNotMatch(agenda, /Trump.*Xi (agreed|announced|signed)/i);

  const watchNext = persistedOutput.investigations
    .flatMap((item) => [item.research_next, ...item.missing_evidence])
    .join(" ");
  assert.match(watchNext, /Bund.*gilt.*JGB/i);
  assert.match(watchNext, /gold.*real.?yield.*USD/i);
  assert.match(watchNext, /crude curve.*cracks/i);
  assert.match(watchNext, /verified Trump.*Xi/i);
  assert.equal(persistedOutput.research_now.length, 3);
  assert.equal(persistedOutput.investigations.length, 2);
});
