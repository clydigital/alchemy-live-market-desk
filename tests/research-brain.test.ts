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
        {
          evidence_id: "ev:yields:2026-09",
          available_at: "2026-09-18T11:30:00Z",
          claim_or_fact: "US 2-Year Treasury yield fell 12 basis points to 3.85%.",
          category: "PRICING_FEED",
          source_type: "PRICING_FEED",
          provenance: [
            { source_type: "PRICING_FEED", source_id: "TREASURY_FEED" },
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
      price_data: {
        status: "OK",
        available_at: "2026-09-18T11:35:00Z",
      },
    },
  );
}

function createValidOutput(packet: ReturnType<typeof createValidBasePacket>): ResearchBrainOutputV1 {
  const ev1 = packet.observed_evidence[0]?.evidence_id ?? "ev:cpi:2026-09";
  const ev2 = packet.observed_evidence[1]?.evidence_id ?? "ev:fed:2026-09";
  const ev3 = packet.observed_evidence[2]?.evidence_id ?? "ev:yields:2026-09";

  return {
    contract_version: RESEARCH_BRAIN_CONTRACT_VERSION,
    packet_id: packet.packet_id,
    as_of: packet.as_of,
    main_thread: {
      headline: "Fed Rate Easing Cycle Commences as Disinflation Accelerates",
      answer: "Federal Reserve cut interest rates by 25bps following 2.5% CPI print.",
      regime_implication: "MONETARY_EASING_REGIME",
      epistemic_label: "OBSERVED",
      evidence_references: [ev1, ev2],
      supporting_story_ids: ["story:fed_easing"],
      contradiction_references: [],
      what_would_change_mind: "A re-acceleration in monthly core CPI above 0.4% MoM.",
    },
    major_stories: [
      {
        story_id: "story:fed_easing",
        title: "Federal Reserve Initiates Easing Cycle",
        what_changed: "FOMC cut target rate by 25bps in response to moderating inflation.",
        why_it_matters: "Shifts central bank reaction function from inflation defense to growth support.",
        headline_decomposition: "25bps rate cut is supported by 2.5% CPI print.",
        causal_mechanism: "Lower headline CPI reduced real policy rate tighteness, allowing FOMC rate cuts.",
        market_evidence: {
          confirming: [ev1, ev2, ev3],
          contradicting: [],
          unresolved: ["lead:oil:supply"],
        },
        conclusion: "Fed easing cycle is actively underway.",
        what_would_change_mind: "Hawkish FOMC statement or CPI rebound above 3.5%.",
        linked_thesis_ids: ["thesis:disinflation"],
        linked_investigation_ids: ["inv:oil_risk"],
        linked_chart_task_ids: ["chart:us2y_yield"],
        epistemic_label: "SUPPORTED",
        evidence_ids: [ev1, ev2, ev3],
      },
    ],
    chart_investigation_queue: {
      core: [
        {
          chart_id: "chart:us2y_yield",
          priority: "HIGH",
          is_required: true,
          ticker_or_instrument: "US02Y",
          instrument_type: "YIELD",
          timeframe: "1D",
          exact_question: "Does 2Y yield break below 3.80% support following 25bps rate cut?",
          confirmation_condition: "2Y yield closes below 3.80%.",
          contradiction_condition: "2Y yield rebounds above 4.00%.",
          linked_story_ids: ["story:fed_easing"],
          linked_investigation_ids: [],
        },
        {
          chart_id: "chart:brent_wti",
          priority: "HIGH",
          is_required: true,
          ticker_or_instrument: "BRENT/WTI",
          instrument_type: "SPREAD",
          timeframe: "1W",
          exact_question: "Is Brent-WTI spread widening due to Middle East supply risk?",
          confirmation_condition: "Spread widens above $5.00/bbl.",
          contradiction_condition: "Spread narrows below $2.00/bbl.",
          linked_story_ids: [],
          linked_investigation_ids: ["inv:oil_risk"],
        },
        {
          chart_id: "chart:spx_eq",
          priority: "HIGH",
          is_required: true,
          ticker_or_instrument: "SPX",
          instrument_type: "EQUITY",
          timeframe: "1D",
          exact_question: "Does S&P 500 sustain new high above 5,600 post rate cut?",
          confirmation_condition: "Daily close above 5,600.",
          contradiction_condition: "Daily close below 5,500.",
          linked_story_ids: ["story:fed_easing"],
          linked_investigation_ids: [],
        },
      ],
      optional: [
        {
          chart_id: "chart:dxy_index",
          priority: "MEDIUM",
          is_required: false,
          ticker_or_instrument: "DXY",
          instrument_type: "FX",
          timeframe: "1D",
          exact_question: "How is USD index reacting to US short rate differentials?",
          confirmation_condition: "DXY declines below 100.",
          contradiction_condition: "DXY rises above 104.",
          linked_story_ids: ["story:fed_easing"],
          linked_investigation_ids: [],
        },
      ],
    },
    investigations: [
      {
        investigation_id: "inv:oil_risk",
        question: "Will Middle East supply disruptions impact Q4 oil prices?",
        why_it_matters: "Energy price shock could reignite headline CPI inflation.",
        current_explanation: "Supply risk is currently unconfirmed by spot pricing.",
        competing_explanations: ["OPEC spare capacity buffers disruption risk."],
        observed_evidence: [ev1],
        missing_evidence: ["Actual tanker tracking disruption data"],
        research_next: "Monitor Brent futures curve backwardation.",
        chart_task_links: ["chart:brent_wti"],
        confirmation_condition: "Brent crude breaks $90/bbl.",
        invalidation_condition: "Brent crude drops below $70/bbl.",
        status: "open",
        linked_story_ids: ["story:fed_easing"],
        linked_thesis_ids: [],
        leads_referenced: ["lead:oil:supply"],
      },
    ],
    market_verdict: {
      verdict_id: "verdict:2026-09-18",
      lenses: {
        US_RATES: {
          lens_name: "US_RATES",
          observed_reaction: "US 2Y yield fell 12bps to 3.85%.",
          interpretation: "Front-end yields pricing in sustained easing path.",
          contradiction_references: [],
          unresolved_signals: [],
        },
        BONDS: {
          lens_name: "BONDS",
          observed_reaction: "Treasury curve bull-steepened.",
          interpretation: "Markets favoring short duration.",
          contradiction_references: [],
          unresolved_signals: [],
        },
        TECH_AI: {
          lens_name: "TECH_AI",
          observed_reaction: "Tech indices up 1.2% in session.",
          interpretation: "Lower rates support tech valuations.",
          contradiction_references: [],
          unresolved_signals: [],
        },
        OIL_WAR_INFLATION: {
          lens_name: "OIL_WAR_INFLATION",
          observed_reaction: "Crude oil flat at $75/bbl.",
          interpretation: "Supply risks unpriced in current spot market.",
          contradiction_references: [],
          unresolved_signals: ["lead:oil:supply"],
        },
        USD: {
          lens_name: "USD",
          observed_reaction: "DXY down 0.4% to 101.2.",
          interpretation: "Dollar weakening on yield differential erosion.",
          contradiction_references: [],
          unresolved_signals: [],
        },
        GOLD: {
          lens_name: "GOLD",
          observed_reaction: "Gold up 0.8% to $2,520/oz.",
          interpretation: "Supported by lower real yields.",
          contradiction_references: [],
          unresolved_signals: [],
        },
        CREDIT: {
          lens_name: "CREDIT",
          observed_reaction: "High yield spreads tightened 5bps.",
          interpretation: "Credit default risk remains muted.",
          contradiction_references: [],
          unresolved_signals: [],
        },
        BREADTH: {
          lens_name: "BREADTH",
          observed_reaction: "Advance/decline ratio 2.1x.",
          interpretation: "Broad participation across sectors.",
          contradiction_references: [],
          unresolved_signals: [],
        },
      },
      cross_asset_readthrough: "Consistent risk-on easing environment across rates, equities, and FX.",
      epistemic_label: "SUPPORTED",
      dominant_confirmation: "2Y yield rally and CPI 2.5% print.",
      dominant_contradiction: "Middle East oil supply uncertainty.",
    },
    research_now: [
      {
        rank: 1,
        action: "Inspect US 2Y Treasury yield reaction at 3.80% support.",
        reason: "Determine if front-end pricing is overextended relative to FOMC dot plot.",
        expected_information_gain: "Assesses rate cut momentum durability.",
        linked_investigations: [],
        linked_stories: ["story:fed_easing"],
        blocking_evidence: [ev3],
      },
    ],
    stock_radar: [
      {
        symbol: "SPY",
        company_name: "S&P 500 ETF Trust",
        why_relevant: "Direct beneficiary of monetary policy rate cuts.",
        research_question: "Does broad market valuation expansion hold at 5,600?",
        linkage_type: "LINKED_MAIN_THREAD",
        linked_main_thread_or_story_id: "thread:fed_easing",
        confirming_signal: "Break above 5,600 on above-average volume.",
        invalidating_signal: "Failure below 5,500 50-day moving average.",
        evidence_references: [ev2, ev3],
      },
    ],
    developing_themes: [
      {
        theme_id: "theme:global_easing",
        title: "Global Central Bank Easing Alignment",
        summary: "Fed joining ECB and BOE in rate cut cycles.",
        supporting_evidence_ids: [ev2],
      },
      {
        theme_id: "theme:disinflation",
        title: "Core Disinflation Consolidation",
        summary: "Headline and core inflation measures returning toward 2% target.",
        supporting_evidence_ids: [ev1],
      },
      {
        theme_id: "theme:yield_curve_steepening",
        title: "Yield Curve Un-Inversion",
        summary: "Bull steepening driving Treasury curve back to positive slope.",
        supporting_evidence_ids: [ev3],
      },
    ],
    creator_theme_expansions: [],
    thesis_ledger: {
      contract_version: THESIS_LEDGER_V2_CONTRACT_VERSION,
      entries: [
        {
          thesis_id: "thesis:disinflation",
          contract_version: THESIS_LEDGER_V2_CONTRACT_VERSION,
          root_thesis_id: "thesis:disinflation",
          parent_thesis_id: null,
          successor_thesis_id: null,
          title: "US Disinflation Trend",
          statement: "US core inflation is returning toward 2% target.",
          state: "confirmed",
          version: 1,
          created_at: "2026-09-01T00:00:00Z",
          updated_at: "2026-09-18T12:00:00Z",
          lineage: [],
          state_reason: "August CPI print of 2.5% YoY confirms disinflation trend.",
          current_evidence_refs: [ev1],
          observed_market_reaction: "Yields fell 12bps post-release.",
          next_catalyst_or_tripwire: "September CPI release.",
        },
      ],
    },
    contradictions_detected: [],
    research_gaps: [],
    diagnostics: {
      degraded: false,
      degradation_reasons: [],
      omitted_or_demoted_items: [],
      missing_input_categories: [],
      model_repair_used: false,
      notes: ["All validation checks passed cleanly."],
    },
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

test("2. Valid Reconciled Output Pass Validation", () => {
  const packet = createValidBasePacket();
  const validOutput = createValidOutput(packet);
  const val = validateResearchBrainOutput(validOutput, packet);

  assert.equal(val.isValid, true);
  assert.equal(val.errors.length, 0);
  assert.ok(val.output);
});

test("3. Attention Limits Enforcement (Strict Reconciled Caps)", () => {
  const packet = createValidBasePacket();
  const invalidOutput = createValidOutput(packet);

  // A. > 4 Major Stories rejected
  const story = invalidOutput.major_stories[0];
  invalidOutput.major_stories = [story, story, story, story, story]; // 5 stories!
  let val = validateResearchBrainOutput(invalidOutput, packet);
  assert.equal(val.isValid, false);
  assert.ok(val.errors.some((e) => e.includes("exceeds maximum limit of 4")));

  // B. > 2 Priority Investigations rejected
  invalidOutput.major_stories = [story];
  const inv = invalidOutput.investigations[0];
  invalidOutput.investigations = [inv, inv, inv]; // 3 investigations!
  val = validateResearchBrainOutput(invalidOutput, packet);
  assert.equal(val.isValid, false);
  assert.ok(val.errors.some((e) => e.includes("exceeds priority limit of 2")));

  // C. > 3 Stock Radar rejected
  invalidOutput.investigations = [inv];
  const item = invalidOutput.stock_radar[0];
  invalidOutput.stock_radar = [item, item, item, item]; // 4 stock radar items!
  val = validateResearchBrainOutput(invalidOutput, packet);
  assert.equal(val.isValid, false);
  assert.ok(val.errors.some((e) => e.includes("exceeds limit of 3")));

  // D. > 3 Research Now actions rejected
  invalidOutput.stock_radar = [item];
  const act = invalidOutput.research_now[0];
  invalidOutput.research_now = [act, act, act, act]; // 4 actions!
  val = validateResearchBrainOutput(invalidOutput, packet);
  assert.equal(val.isValid, false);
  assert.ok(val.errors.some((e) => e.includes("exceeds limit of 3")));
});

test("4. Major Story Research Quality Firewall", () => {
  const packet = createValidBasePacket();
  const invalidOutput = createValidOutput(packet);

  // Missing what_changed fails firewall
  invalidOutput.major_stories[0].what_changed = "";
  const val = validateResearchBrainOutput(invalidOutput, packet);

  assert.equal(val.isValid, false);
  assert.ok(val.errors.some((e) => e.includes("fails Firewall")));
});

test("5. Epistemic Label Enforcement", () => {
  const packet = createValidBasePacket();
  const invalidOutput = createValidOutput(packet);

  // SUPPORTED story with only 1 evidence ID rejected (requires >= 2 evidence references)
  invalidOutput.major_stories[0].epistemic_label = "SUPPORTED";
  invalidOutput.major_stories[0].evidence_ids = ["ev:cpi:2026-09"];
  const val = validateResearchBrainOutput(invalidOutput, packet);

  assert.equal(val.isValid, false);
  assert.ok(val.errors.some((e) => e.includes("requires at least two supporting evidence references")));
});

test("6. Market Verdict Null Reaction on Missing Price Evidence", () => {
  const basePacket = createValidBasePacket();
  const packetNoPrice = assembleDossierV2InputPacket(
    { as_of: "2026-09-18T12:00:00Z" },
    {
      observed_evidence: (basePacket.observed_evidence as unknown) as Array<Record<string, unknown>>,
      price_data: { status: "MISSING" },
    },
  );

  const outputWithReaction = createValidOutput(packetNoPrice);
  outputWithReaction.market_verdict.lenses.US_RATES.observed_reaction = "2Y yield fell 10bps."; // Non-null when price data missing!

  const val = validateResearchBrainOutput(outputWithReaction, packetNoPrice);
  assert.equal(val.isValid, false);
  assert.ok(val.errors.some((e) => e.includes("must have null observed_reaction when price evidence is absent")));
});

test("7. Dedicated TradingView Chart Queue & Generic Task Rejection", () => {
  const packet = createValidBasePacket();
  const invalidOutput = createValidOutput(packet);

  // Generic chart task ("check S&P") rejected
  invalidOutput.chart_investigation_queue.core[0].exact_question = "check S&P";
  const val = validateResearchBrainOutput(invalidOutput, packet);

  assert.equal(val.isValid, false);
  assert.ok(val.errors.some((e) => e.includes("contains generic or vague exact_question")));
});

test("8. Thesis Ledger V2 Evolved Semantics", () => {
  const packet = createValidBasePacket();
  const validOutput = createValidOutput(packet);

  // Predecessor thesis marked 'evolved' pointing to successor
  const predThesis = {
    thesis_id: "thesis:disinflation:v1",
    contract_version: THESIS_LEDGER_V2_CONTRACT_VERSION,
    root_thesis_id: "thesis:disinflation",
    parent_thesis_id: null,
    successor_thesis_id: "thesis:disinflation:v2",
    title: "US Core Inflation Moderating",
    statement: "Inflation is slowing down toward 2.5%.",
    state: "evolved" as const,
    version: 1,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-18T12:00:00Z",
    lineage: [],
    state_reason: "Evolved to broader structural disinflation thesis.",
    current_evidence_refs: ["ev:cpi:2026-09"],
    observed_market_reaction: "Yields fell 12bps.",
    next_catalyst_or_tripwire: "Next CPI print.",
  };

  const succThesis = {
    thesis_id: "thesis:disinflation:v2",
    contract_version: THESIS_LEDGER_V2_CONTRACT_VERSION,
    root_thesis_id: "thesis:disinflation",
    parent_thesis_id: "thesis:disinflation:v1",
    successor_thesis_id: null,
    title: "US Structural Disinflation Reestablished",
    statement: "Core disinflation allows sustained FOMC policy rate cuts.",
    state: "confirmed" as const,
    version: 2,
    created_at: "2026-09-18T12:00:00Z",
    updated_at: "2026-09-18T12:00:00Z",
    lineage: ["thesis:disinflation:v1"],
    state_reason: "2.5% CPI print and FOMC 25bps cut confirm structural disinflation.",
    current_evidence_refs: ["ev:cpi:2026-09", "ev:fed:2026-09"],
    observed_market_reaction: "Yields fell 12bps.",
    next_catalyst_or_tripwire: "Next CPI print.",
  };

  validOutput.thesis_ledger.entries = [predThesis, succThesis];

  const val = validateResearchBrainOutput(validOutput, packet);
  assert.equal(val.isValid, true);
  assert.equal(val.errors.length, 0);
});

test("9. Model Orchestration: Single Provider Attempt per Pass (maxAttempts = 1)", async () => {
  const packet = createValidBasePacket();
  const validOutput = createValidOutput(packet);

  let primaryCalls = 0;
  const mockRunner: ModelRunner = async (inp) => {
    primaryCalls++;
    assert.equal(inp.stageKey, "research_brain_primary");
    return { data: validOutput };
  };

  const result = await executeResearchBrain(
    { as_of: packet.as_of, packet },
    { modelRunner: mockRunner },
  );

  assert.equal(primaryCalls, 1);
  assert.equal(result.diagnostics.degraded, false);
  assert.equal(result.packet_id, packet.packet_id);
});

test("10. Structural Repair Pass (Max 1 Repair Attempt)", async () => {
  const packet = createValidBasePacket();
  const invalidOutput = createValidOutput(packet);
  invalidOutput.major_stories[0].what_changed = ""; // Triggers firewall error on pass 1

  const repairedOutput = createValidOutput(packet); // Valid on pass 2

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
    throw new Error("Exceeded max 2 total provider calls!");
  };

  const result = await executeResearchBrain(
    { as_of: packet.as_of, packet },
    { modelRunner: mockRunner, allowRepair: true },
  );

  assert.equal(callsCount, 2);
  assert.equal(result.diagnostics.degraded, false);
  assert.equal(result.diagnostics.model_repair_used, true);
});

test("11. Deterministic Degradation Fallback & Traceability", async () => {
  const packet = createValidBasePacket();

  const mockRunner: ModelRunner = async () => {
    throw new Error("OpenAI API request timeout");
  };

  const result = await executeResearchBrain(
    { as_of: packet.as_of, packet },
    { modelRunner: mockRunner },
  );

  assert.equal(result.diagnostics.degraded, true);
  assert.ok(result.diagnostics.degradation_reasons[0].includes("timeout"));
  assert.equal(result.packet_id, packet.packet_id);
  assert.equal(result.major_stories.length, 0);
  assert.equal(result.stock_radar.length, 0);
  assert.equal(result.investigations.length, 1);
  assert.equal(result.investigations[0].leads_referenced![0], "lead:oil:supply");
  assert.equal(result.thesis_ledger.entries.length, 1);
});
