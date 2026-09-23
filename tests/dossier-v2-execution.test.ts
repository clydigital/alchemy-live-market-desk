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
