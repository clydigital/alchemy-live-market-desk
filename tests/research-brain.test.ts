import assert from "node:assert/strict";
import { test } from "node:test";
import { assembleDossierV2InputPacket } from "../lib/dossier-v2/input-packet.ts";
import {
  RESEARCH_BRAIN_CONTRACT_VERSION,
  RESEARCH_BRAIN_INPUT_CONTRACT_VERSION,
  THESIS_LEDGER_V2_CONTRACT_VERSION,
} from "../lib/dossier-v2/research-brain-contracts.ts";
import type {
  ResearchBrainInputV1,
  ResearchBrainOutputV1,
} from "../lib/dossier-v2/research-brain-contracts.ts";
import {
  buildResearchBrainPrompt,
  buildResearchBrainRepairPrompt,
  getResearchBrainJsonSchema,
} from "../lib/dossier-v2/research-brain-prompt.ts";
import {
  validateResearchBrainInput,
  validateResearchBrainOutput,
} from "../lib/dossier-v2/research-brain-validation.ts";
import {
  executeResearchBrain,
  produceDegradedOutput,
} from "../lib/dossier-v2/research-brain.ts";
import type { ModelRunner } from "../lib/dossier-v2/research-brain.ts";

function createValidBasePacket() {
  return assembleDossierV2InputPacket(
    {
      as_of: "2026-09-18T12:00:00Z",
    },
    {
      observed_evidence: [
        {
          evidence_id: "ev:cpi:2026-09",
          available_at: "2026-09-18T10:00:00Z",
          claim_or_fact: "US CPI inflation print was 2.5% YoY in August 2026.",
          category: "ECONOMIC_METRIC",
          source_type: "STATISTICAL_AGENCY",
          provenance: [
            { source_type: "STATISTICAL_AGENCY", source_id: "BLS_CPI" },
          ],
        },
        {
          evidence_id: "ev:fed:2026-09",
          available_at: "2026-09-18T11:00:00Z",
          claim_or_fact: "Federal Reserve cut interest rates by 25 basis points.",
          category: "MONETARY_POLICY",
          source_type: "PRESS_RELEASE",
          provenance: [
            { source_type: "PRESS_RELEASE", source_id: "FOMC_STATEMENT" },
          ],
        },
      ],
      research_leads: [
        {
          lead_id: "lead:oil:supply",
          available_at: "2026-09-18T10:30:00Z",
          claim_or_question: "Will Middle East supply disruptions impact Q4 oil prices?",
          source_type: "LEAD",
          provenance: [
            { source_type: "DESK", source_id: "ANALYST_QUESTION" },
          ],
        },
      ],
      thesis_ledger: {
        contract_version: "thesis-ledger/1",
        entries: [
          {
            thesis_id: "thesis:disinflation",
            contract_version: "thesis-ledger/1",
            title: "US Disinflation Trend",
            statement: "US core inflation is returning toward 2% target.",
            state: "confirmed",
            version: 1,
            created_at: "2026-09-01T00:00:00Z",
            updated_at: "2026-09-18T00:00:00Z",
            lineage: [],
          },
        ],
      },
    },
  );
}

function createValidOutput(packet: ReturnType<typeof createValidBasePacket>): ResearchBrainOutputV1 {
  const ev1 = packet.observed_evidence[0].evidence_id;
  const ev2 = packet.observed_evidence[1].evidence_id;

  return {
    contract_version: RESEARCH_BRAIN_CONTRACT_VERSION,
    as_of: packet.as_of,
    main_thread: {
      thread_id: "thread:fed_easing",
      title: "Fed Rate Easing Cycle Initiated",
      summary: "Fed cuts rates by 25bps as CPI moderates to 2.5%.",
      primary_story_ids: ["story:fed_easing"],
      dominant_macro_driver: "MONETARY_POLICY",
    },
    major_stories: [
      {
        story_id: "story:fed_easing",
        title: "Fed Easing Cycle Commences",
        summary: "Lower inflation allows Federal Reserve to begin policy normalization.",
        confidence_score: 85,
        evidence_ids: [ev1, ev2],
        core_claims: [
          {
            claim_id: "claim:cpi_print",
            epistemic_label: "OBSERVED",
            claim_text: "August CPI print reached 2.5% YoY.",
            evidence_ids: [ev1],
          },
          {
            claim_id: "claim:rate_cut",
            epistemic_label: "OBSERVED",
            claim_text: "FOMC lowered target rate by 25bps.",
            evidence_ids: [ev2],
          },
        ],
        causal_links: [
          {
            link_id: "link:cpi_to_cut",
            cause_claim_id: "claim:cpi_print",
            effect_claim_id: "claim:rate_cut",
            mechanism_summary: "Moderating inflation allowed FOMC to shift focus to labor market.",
            evidence_ids: [ev1, ev2],
          },
        ],
      },
    ],
    investigations: [
      {
        investigation_id: "inv:oil_risk",
        title: "Middle East Supply Risk Assessment",
        trigger_reason: "Research lead on Q4 oil supply risk.",
        key_questions: ["Will Middle East supply disruptions impact Q4 oil prices?"],
        evidence_ids: [ev1],
        leads_referenced: ["lead:oil:supply"],
        chart_tasks: [
          {
            chart_id: "chart:brent_spread",
            symbol_or_instrument: "BRENT",
            timeframe: "1M",
            metric_or_relationship: "Brent-WTI Spread",
            hypothesis_to_test: "Check whether Brent-WTI spread widens during supply shock.",
          },
        ],
      },
    ],
    market_verdict: {
      verdict_id: "verdict:2026-09-18",
      regime_summary: "EASING_REGIME",
      dominant_drivers: ["Monetary policy easing", "Disinflation"],
      key_risks: ["Geopolitical supply shocks"],
    },
    research_now: {
      summary_now: "Fed easing underway; inflation trajectory remains benign.",
      actionable_takeaways: ["Monitor front-end yield reaction to rate cut."],
      immediate_catalysts: ["Upcoming payrolls report"],
    },
    stock_radar: [
      {
        symbol: "SPY",
        company_or_asset: "S&P 500 ETF",
        radar_type: "BULLISH",
        thesis_summary: "Rate cuts provide liquidity support for broad market.",
        supporting_claim_ids: ["claim:rate_cut"],
        evidence_ids: [ev2],
      },
    ],
    developing_themes: [
      {
        theme_id: "theme:rate_cuts",
        title: "Global Easing Cycle",
        summary: "Central banks lowering rates in response to disinflation.",
        supporting_evidence_ids: [ev2],
      },
    ],
    creator_theme_expansions: [],
    thesis_ledger: {
      contract_version: THESIS_LEDGER_V2_CONTRACT_VERSION,
      entries: [
        {
          thesis_id: "thesis:disinflation",
          contract_version: THESIS_LEDGER_V2_CONTRACT_VERSION,
          title: "US Disinflation Trend",
          statement: "US core inflation is returning toward 2% target.",
          state: "confirmed",
          version: 1,
          created_at: "2026-09-01T00:00:00Z",
          updated_at: "2026-09-18T12:00:00Z",
          lineage: [],
          supporting_claim_ids: ["claim:cpi_print"],
          counter_claim_ids: [],
        },
      ],
    },
    contradictions_detected: [],
    research_gaps: [],
  };
}

test("1. Contract & Constant Definitions", () => {
  assert.equal(RESEARCH_BRAIN_CONTRACT_VERSION, "research-brain/1");
  assert.equal(RESEARCH_BRAIN_INPUT_CONTRACT_VERSION, "research-brain-input/1");
  assert.equal(THESIS_LEDGER_V2_CONTRACT_VERSION, "thesis-ledger/2");

  const packet = createValidBasePacket();
  const input = validateResearchBrainInput({
    as_of: packet.as_of,
    packet,
  });
  assert.equal(input.contract_version, RESEARCH_BRAIN_INPUT_CONTRACT_VERSION);
  assert.equal(input.packet.packet_id, packet.packet_id);
});

test("2. Valid Output Pass Validation", () => {
  const packet = createValidBasePacket();
  const validOutput = createValidOutput(packet);
  const val = validateResearchBrainOutput(validOutput, packet);

  assert.equal(val.isValid, true);
  assert.equal(val.errors.length, 0);
  assert.ok(val.output);
});

test("3. Epistemic Separation Enforcement", () => {
  const packet = createValidBasePacket();
  const invalidOutput = createValidOutput(packet);

  // A. Current OBSERVED claim citing prior claims rejected
  invalidOutput.major_stories[0].core_claims[0].prior_claim_ids = ["pc:prior_claim_123"];
  let val = validateResearchBrainOutput(invalidOutput, packet);
  assert.equal(val.isValid, false);
  assert.ok(val.errors.some((e) => e.includes("cannot cite prior_claim_ids")));

  // B. Research lead cited in evidence_ids rejected
  invalidOutput.major_stories[0].core_claims[0].prior_claim_ids = [];
  invalidOutput.major_stories[0].core_claims[0].evidence_ids = ["lead:oil:supply"];
  val = validateResearchBrainOutput(invalidOutput, packet);
  assert.equal(val.isValid, false);
  assert.ok(val.errors.some((e) => e.includes("invalidly references research lead")));

  // C. OBSERVED claim with no current evidence rejected
  invalidOutput.major_stories[0].core_claims[0].evidence_ids = [];
  val = validateResearchBrainOutput(invalidOutput, packet);
  assert.equal(val.isValid, false);
  assert.ok(val.errors.some((e) => e.includes("must cite at least one current observed evidence_id")));
});

test("4. Unsupported Evidence IDs Rejected", () => {
  const packet = createValidBasePacket();
  const invalidOutput = createValidOutput(packet);

  invalidOutput.major_stories[0].evidence_ids.push("ev:fake_id_123");
  const val = validateResearchBrainOutput(invalidOutput, packet);

  assert.equal(val.isValid, false);
  assert.ok(val.errors.some((e) => e.includes("unsupported evidence_id \"ev:fake_id_123\"")));
});

test("5. Attention Budget Caps", () => {
  const packet = createValidBasePacket();
  const invalidOutput = createValidOutput(packet);

  // Duplicate story 7 times to exceed limit of 6
  const story = invalidOutput.major_stories[0];
  invalidOutput.major_stories = [
    story, story, story, story, story, story, story,
  ];

  const val = validateResearchBrainOutput(invalidOutput, packet);
  assert.equal(val.isValid, false);
  assert.ok(val.errors.some((e) => e.includes("exceeds attention limit of 6")));
});

test("6. Research Quality Firewall", () => {
  const packet = createValidBasePacket();
  const invalidOutput = createValidOutput(packet);

  // Story with no core claims rejected
  invalidOutput.major_stories[0].core_claims = [];
  const val = validateResearchBrainOutput(invalidOutput, packet);

  assert.equal(val.isValid, false);
  assert.ok(val.errors.some((e) => e.includes("fails Firewall: no core_claims provided")));
});

test("7. Contradictions Preservation", () => {
  // Create a packet with a conflict group
  const packetWithConflict = assembleDossierV2InputPacket(
    { as_of: "2026-09-18T12:00:00Z" },
    {
      observed_evidence: [
        {
          evidence_id: "ev:fact1",
          available_at: "2026-09-18T10:00:00Z",
          claim_or_fact: "Job growth was +250k.",
          category: "LABOR",
          source_type: "STATISTICAL_AGENCY",
          grouping_key: "payrolls_august",
          conflict_key: "payrolls_august",
          provenance: [{ source_type: "STATISTICAL_AGENCY", source_id: "BLS" }],
        },
        {
          evidence_id: "ev:fact2",
          available_at: "2026-09-18T10:00:00Z",
          claim_or_fact: "Job growth was +100k.",
          category: "LABOR",
          source_type: "STATISTICAL_AGENCY",
          grouping_key: "payrolls_august",
          conflict_key: "payrolls_august",
          provenance: [{ source_type: "STATISTICAL_AGENCY", source_id: "ADP" }],
        },
      ],
    },
  );

  const outputMissingConflict = createValidOutput(packetWithConflict);
  outputMissingConflict.major_stories[0].evidence_ids = ["ev:fact1", "ev:fact2"];
  outputMissingConflict.major_stories[0].core_claims[0].evidence_ids = ["ev:fact1"];
  outputMissingConflict.major_stories[0].core_claims[1].evidence_ids = ["ev:fact2"];
  outputMissingConflict.stock_radar[0].evidence_ids = ["ev:fact1"];
  outputMissingConflict.developing_themes[0].supporting_evidence_ids = ["ev:fact1"];
  outputMissingConflict.contradictions_detected = []; // Omitted conflict!

  const val = validateResearchBrainOutput(outputMissingConflict, packetWithConflict);
  assert.equal(val.isValid, false);
  assert.ok(val.errors.some((e) => e.includes("was not preserved in contradictions_detected")));
});

test("8. Thesis Ledger Lineage and Versioning", () => {
  const packet = createValidBasePacket();
  const invalidOutput = createValidOutput(packet);

  // A. Self-link rejected
  invalidOutput.thesis_ledger.entries[0].lineage = ["thesis:disinflation"];
  let val = validateResearchBrainOutput(invalidOutput, packet);
  assert.equal(val.isValid, false);
  assert.ok(val.errors.some((e) => e.includes("contains self-reference in lineage")));

  // B. Evolved thesis with version <= prior version rejected
  invalidOutput.thesis_ledger.entries[0].lineage = [];
  invalidOutput.thesis_ledger.entries[0].state = "evolved";
  invalidOutput.thesis_ledger.entries[0].version = 1; // Prior version was 1!
  val = validateResearchBrainOutput(invalidOutput, packet);
  assert.equal(val.isValid, false);
  assert.ok(val.errors.some((e) => e.includes("evolved state requires version")));

  // C. Valid evolved thesis successor passes
  invalidOutput.thesis_ledger.entries[0].version = 2;
  val = validateResearchBrainOutput(invalidOutput, packet);
  assert.equal(val.isValid, true);
});

test("9. Chart Task Specificity & Vague Placeholders", () => {
  const packet = createValidBasePacket();
  const invalidOutput = createValidOutput(packet);

  invalidOutput.investigations[0].chart_tasks![0].symbol_or_instrument = "TBD";
  const val = validateResearchBrainOutput(invalidOutput, packet);

  assert.equal(val.isValid, false);
  assert.ok(val.errors.some((e) => e.includes("has vague or missing symbol_or_instrument")));
});

test("10. Absence of Numerical Probability Claims", () => {
  const packet = createValidBasePacket();
  const invalidOutput = createValidOutput(packet);

  invalidOutput.major_stories[0].core_claims[0].claim_text =
    "There is an 80% probability that the Fed will cut rates again in November.";
  const val = validateResearchBrainOutput(invalidOutput, packet);

  assert.equal(val.isValid, false);
  assert.ok(val.errors.some((e) => e.includes("contains forbidden numerical probability claim")));
});

test("11. One-Call Model Orchestration (Success on First Call)", async () => {
  const packet = createValidBasePacket();
  const validOutput = createValidOutput(packet);

  let callsCount = 0;
  const mockRunner: ModelRunner = async (inp) => {
    callsCount++;
    assert.equal(inp.stageKey, "research_brain_primary");
    return { data: validOutput };
  };

  const result = await executeResearchBrain(
    { as_of: packet.as_of, packet },
    { modelRunner: mockRunner },
  );

  assert.equal(callsCount, 1);
  assert.equal(result.is_degraded, undefined);
  assert.equal(result.major_stories.length, 1);
});

test("12. Single Repair Retry Orchestration", async () => {
  const packet = createValidBasePacket();
  const invalidOutput = createValidOutput(packet);
  invalidOutput.major_stories[0].evidence_ids.push("ev:fake_id"); // Invalid on call 1

  const repairedOutput = createValidOutput(packet); // Valid on call 2

  let callsCount = 0;
  const mockRunner: ModelRunner = async (inp) => {
    callsCount++;
    if (callsCount === 1) {
      assert.equal(inp.stageKey, "research_brain_primary");
      return { data: invalidOutput };
    }
    if (callsCount === 2) {
      assert.equal(inp.stageKey, "research_brain_repair");
      return { data: repairedOutput };
    }
    throw new Error("Too many calls!");
  };

  const result = await executeResearchBrain(
    { as_of: packet.as_of, packet },
    { modelRunner: mockRunner, allowRepair: true },
  );

  assert.equal(callsCount, 2);
  assert.equal(result.is_degraded, undefined);
  assert.equal(result.major_stories.length, 1);
});

test("13. Deterministic Degradation Engine (Model Failure)", async () => {
  const packet = createValidBasePacket();

  const mockRunner: ModelRunner = async () => {
    throw new Error("Model provider timeout after 120s");
  };

  const result = await executeResearchBrain(
    { as_of: packet.as_of, packet },
    { modelRunner: mockRunner },
  );

  assert.equal(result.is_degraded, true);
  assert.ok(result.degraded_reason?.includes("Model provider timeout"));
  assert.equal(result.major_stories.length, 0);
  assert.equal(result.stock_radar.length, 0);
  // Preserves research leads as investigations
  assert.equal(result.investigations.length, 1);
  assert.equal(result.investigations[0].leads_referenced![0], "lead:oil:supply");
  // Preserves prior thesis ledger safely
  assert.equal(result.thesis_ledger.entries.length, 1);
  assert.equal(result.thesis_ledger.entries[0].thesis_id, "thesis:disinflation");
});

test("14. Edge Cases: First Run, Missing Data, Conflicting Evidence", async () => {
  // First run (no prior dossier, no creator material, missing price/macro data)
  const emptyPacket = assembleDossierV2InputPacket(
    { as_of: "2026-09-18T12:00:00Z" },
    {},
  );

  const degraded = produceDegradedOutput(emptyPacket, "Test forced degradation");
  assert.equal(degraded.is_degraded, true);
  assert.equal(degraded.thesis_ledger.entries.length, 0);
  assert.equal(degraded.major_stories.length, 0);

  const val = validateResearchBrainOutput(degraded, emptyPacket);
  assert.equal(val.isValid, true);
});
