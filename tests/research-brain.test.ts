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
  ThesisLedgerEntryV2,
} from "../lib/dossier-v2/research-brain-contracts.ts";
import {
  buildResearchBrainCompactRecoveryPrompt,
  buildResearchBrainPrompt,
  buildResearchBrainRepairPrompt,
  getResearchBrainJsonSchema,
} from "../lib/dossier-v2/research-brain-prompt.ts";
import {
  buildValidationIndexes,
  validateResearchBrainInput,
  validateResearchBrainOutput,
} from "../lib/dossier-v2/research-brain-validation.ts";
import {
  executeResearchBrain,
  normalizeResearchBrainOutputReferences,
  preservePriorInvestigationExpectedReactions,
  pruneInvalidStockRadarEvidenceReferences,
  produceDegradedOutput,
  researchBrainStageRuntime,
} from "../lib/dossier-v2/research-brain.ts";
import type { ModelRunner } from "../lib/dossier-v2/research-brain.ts";
import { OpenAIStageError } from "../lib/intelligence/openai-core.ts";


test("Research Brain runtime keeps full rebase output bounded by default", () => {
  const primary = researchBrainStageRuntime(
    "research_brain_primary",
    undefined,
    {} as NodeJS.ProcessEnv,
  );
  const repair = researchBrainStageRuntime(
    "research_brain_repair",
    undefined,
    {} as NodeJS.ProcessEnv,
  );

  assert.equal(primary.maxOutputTokens, 16_000);
  assert.equal(primary.reasoningEffort, "medium");
  assert.equal(primary.timeoutMs, 240_000);
  assert.equal(repair.maxOutputTokens, 8_000);
  assert.equal(repair.reasoningEffort, "low");
  assert.equal(repair.timeoutMs, 240_000);
});

test("Research Brain runtime allows bounded production overrides", () => {
  const runtime = researchBrainStageRuntime(
    "research_brain_primary",
    999_999,
    {
      OPENAI_RESEARCH_BRAIN_MAX_OUTPUT_TOKENS: "22000",
      OPENAI_RESEARCH_BRAIN_REASONING_EFFORT: "low",
    } as unknown as NodeJS.ProcessEnv,
  );

  assert.equal(runtime.maxOutputTokens, 22_000);
  assert.equal(runtime.reasoningEffort, "low");
  assert.equal(runtime.timeoutMs, 240_000);
});

test("Research Brain schema enforces Dossier attention budgets before generation", () => {
  const schema = getResearchBrainJsonSchema();
  const properties = schema.properties as Record<string, Record<string, unknown>>;
  const chartQueue = properties.chart_investigation_queue.properties as Record<string, Record<string, unknown>>;
  const thesisLedger = properties.thesis_ledger.properties as Record<string, Record<string, unknown>>;

  assert.equal(properties.major_stories.maxItems, 4);
  assert.equal(chartQueue.core.maxItems, 3);
  assert.equal(chartQueue.optional.maxItems, 2);
  assert.equal(properties.investigations.maxItems, 2);
  assert.equal(properties.research_now.maxItems, 3);
  assert.equal(properties.stock_radar.maxItems, 3);
  assert.equal(properties.developing_themes.maxItems, 5);
  assert.equal(properties.creator_theme_expansions.maxItems, 2);
  assert.equal(thesisLedger.entries.maxItems, 12);
  assert.equal(properties.contradictions_detected.maxItems, 10);
  assert.equal(properties.research_gaps.maxItems, 12);
});

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
            { source_type: "STATISTICAL_AGENCY", source_id: "BLS_CPI", publisher: "BLS" },
          ],
        },
        {
          evidence_id: "ev:fed:2026-09",
          available_at: "2026-09-18T11:00:00Z",
          claim_or_fact: "Federal Reserve cut interest rates by 25 basis points.",
          category: "MONETARY_POLICY",
          source_type: "PRESS_RELEASE",
          provenance: [
            { source_type: "PRESS_RELEASE", source_id: "FOMC_STATEMENT", publisher: "FED" },
          ],
        },
        {
          evidence_id: "ev:yields:2026-09",
          available_at: "2026-09-18T11:30:00Z",
          claim_or_fact: "US 2-Year Treasury yield fell 12 basis points to 3.85%.",
          category: "PRICING_FEED",
          source_type: "PRICING_FEED",
          provenance: [
            { source_type: "PRICING_FEED", source_id: "TREASURY_FEED", publisher: "BLOOMBERG" },
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


test("Research Brain sees and validates protected rate-context evidence", () => {
  const packet = createValidBasePacket();
  packet.rate_context = {
    evidence: [{
      evidence_id: "verified-macro:pmi-reaction",
      epistemic_label: "OBSERVED",
      claim_or_fact: "US 2Y and 10Y yields rose after the PMI release.",
      category: "RATES",
      source_type: "VERIFIED_MACRO_DATA",
      available_at: "2026-09-18T11:45:00Z",
      metrics: {
        signal_kind: "market_reaction",
        signal_context: "STRONG_ACTIVITY_SURPRISE",
      },
      provenance: [{
        source_type: "VERIFIED_MACRO_DATA",
        source_id: "pmi-reaction-source",
        publisher: "Verified Market Source",
      }],
    }],
  };

  const prompt = buildResearchBrainPrompt({
    contract_version: RESEARCH_BRAIN_INPUT_CONTRACT_VERSION,
    as_of: packet.as_of,
    packet,
  });
  const bounded = prompt.boundedInput as {
    rate_context?: { evidence?: Array<{ evidence_id?: string }> };
  };

  assert.equal(
    bounded.rate_context?.evidence?.[0]?.evidence_id,
    "verified-macro:pmi-reaction",
  );
  assert.match(prompt.instructions, /rate_context\.evidence/);

  const indexes = buildValidationIndexes(packet);
  assert.equal(indexes.validEvidenceIds.has("verified-macro:pmi-reaction"), true);
  assert.equal(
    indexes.evidenceSourceMap.get("verified-macro:pmi-reaction")?.source_type,
    "VERIFIED_MACRO_DATA",
  );
});

test("Research Brain prompt keeps evidence identity but strips redundant source URLs", () => {
  const packet = createValidBasePacket();
  packet.observed_evidence[0].provenance[0].url = "https://example.test/very-long-source-url";
  const prompt = buildResearchBrainPrompt({
    contract_version: RESEARCH_BRAIN_INPUT_CONTRACT_VERSION,
    as_of: packet.as_of,
    packet,
  });

  const serialized = JSON.stringify(prompt.boundedInput);
  assert.match(serialized, /ev:cpi:2026-09/);
  assert.match(serialized, /BLS_CPI/);
  assert.doesNotMatch(serialized, /very-long-source-url/);
  assert.match(prompt.instructions, /OUTPUT DISCIPLINE/);
});

function createValidOutput(packet: ReturnType<typeof createValidBasePacket>): ResearchBrainOutputV1 {
  const evCpi = packet.observed_evidence.find((e) => e.evidence_id.includes("cpi"))?.evidence_id ?? "ev:cpi:2026-09";
  const evFed = packet.observed_evidence.find((e) => e.evidence_id.includes("fed"))?.evidence_id ?? "ev:fed:2026-09";
  const evYields = packet.observed_evidence.find((e) => e.evidence_id.includes("yields"))?.evidence_id ?? "ev:yields:2026-09";

  return {
    contract_version: RESEARCH_BRAIN_CONTRACT_VERSION,
    packet_id: packet.packet_id,
    as_of: packet.as_of,
    main_thread: {
      thread_id: "thread:fed_easing",
      headline: "Fed Rate Easing Cycle Commences as Disinflation Accelerates",
      answer: "Federal Reserve cut interest rates by 25bps following 2.5% CPI print.",
      regime_implication: "MONETARY_EASING_REGIME",
      regime_family: "GROWTH_SCARE_RISK_OFF",
      epistemic_label: "OBSERVED",
      evidence_references: [evCpi, evFed],
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
        causal_mechanism: "Lower headline CPI reduced real policy rate tightness, allowing FOMC rate cuts.",
        market_evidence: {
          confirming: [evCpi, evFed, evYields],
          contradicting: [],
          unresolved: ["lead:oil:supply"],
        },
        conclusion: "Fed easing cycle is actively underway.",
        what_would_change_mind: "Hawkish FOMC statement or CPI rebound above 3.5%.",
        linked_thesis_ids: ["thesis:disinflation"],
        linked_investigation_ids: ["inv:oil_risk"],
        linked_chart_task_ids: ["chart:us2y_yield"],
        epistemic_label: "SUPPORTED",
        evidence_ids: [evCpi, evFed, evYields],
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
        expected_reaction: null,
        observed_reaction: null,
        divergence: "UNRESOLVED",
        competing_explanations: ["OPEC spare capacity buffers disruption risk."],
        observed_evidence: [evCpi],
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
          observed_reaction_evidence_refs: [evYields],
          interpretation: "Front-end yields pricing in sustained easing path.",
          contradiction_references: [],
          unresolved_signals: [],
        },
        BONDS: {
          lens_name: "BONDS",
          observed_reaction: "Treasury curve bull-steepened.",
          observed_reaction_evidence_refs: [evYields],
          interpretation: "Markets favoring short duration.",
          contradiction_references: [],
          unresolved_signals: [],
        },
        TECH_AI: {
          lens_name: "TECH_AI",
          observed_reaction: "Tech indices up 1.2% in session.",
          observed_reaction_evidence_refs: [evYields],
          interpretation: "Lower rates support tech valuations.",
          contradiction_references: [],
          unresolved_signals: [],
        },
        OIL_WAR_INFLATION: {
          lens_name: "OIL_WAR_INFLATION",
          observed_reaction: "Crude oil flat at $75/bbl.",
          observed_reaction_evidence_refs: [evYields],
          interpretation: "Supply risks unpriced in current spot market.",
          contradiction_references: [],
          unresolved_signals: ["lead:oil:supply"],
        },
        USD: {
          lens_name: "USD",
          observed_reaction: "DXY down 0.4% to 101.2.",
          observed_reaction_evidence_refs: [evYields],
          interpretation: "Dollar weakening on yield differential erosion.",
          contradiction_references: [],
          unresolved_signals: [],
        },
        GOLD: {
          lens_name: "GOLD",
          observed_reaction: "Gold up 0.8% to $2,520/oz.",
          observed_reaction_evidence_refs: [evYields],
          interpretation: "Supported by lower real yields.",
          contradiction_references: [],
          unresolved_signals: [],
        },
        CREDIT: {
          lens_name: "CREDIT",
          observed_reaction: "High yield spreads tightened 5bps.",
          observed_reaction_evidence_refs: [evYields],
          interpretation: "Credit default risk remains muted.",
          contradiction_references: [],
          unresolved_signals: [],
        },
        BREADTH: {
          lens_name: "BREADTH",
          observed_reaction: "Advance/decline ratio 2.1x.",
          observed_reaction_evidence_refs: [evYields],
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
        blocking_evidence: [evYields],
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
        evidence_references: [evFed, evYields],
      },
    ],
    developing_themes: [
      {
        theme_id: "theme:global_easing",
        title: "Global Central Bank Easing Alignment",
        summary: "Fed joining ECB and BOE in rate cut cycles.",
        supporting_evidence_ids: [evFed],
      },
      {
        theme_id: "theme:disinflation",
        title: "Core Disinflation Consolidation",
        summary: "Headline and core inflation measures returning toward 2% target.",
        supporting_evidence_ids: [evCpi],
      },
      {
        theme_id: "theme:yield_curve_steepening",
        title: "Yield Curve Un-Inversion",
        summary: "Bull steepening driving Treasury curve back to positive slope.",
        supporting_evidence_ids: [evYields],
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
          current_evidence_refs: [evCpi],
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

test("3. Epistemic Label Validation - SUPPORTED Same-Source Duplicate Rejection", () => {
  const packetDuplicateSource = assembleDossierV2InputPacket(
    { as_of: "2026-09-18T12:00:00Z" },
    {
      observed_evidence: [
        {
          evidence_id: "ev:sourceA:item1",
          available_at: "2026-09-18T10:00:00Z",
          claim_or_fact: "Report part 1.",
          category: "GENERAL",
          source_type: "PRESS_RELEASE",
          provenance: [{ source_type: "PRESS_RELEASE", source_id: "SOURCE_A", publisher: "BLS" }],
        },
        {
          evidence_id: "ev:sourceA:item2",
          available_at: "2026-09-18T10:05:00Z",
          claim_or_fact: "Report part 2.",
          category: "GENERAL",
          source_type: "PRESS_RELEASE",
          provenance: [{ source_type: "PRESS_RELEASE", source_id: "SOURCE_A", publisher: "BLS" }],
        },
      ],
    },
  );

  const output = createValidOutput(packetDuplicateSource);
  output.major_stories[0].epistemic_label = "SUPPORTED";
  output.major_stories[0].evidence_ids = ["ev:sourceA:item1", "ev:sourceA:item2"];

  const val = validateResearchBrainOutput(output, packetDuplicateSource);
  assert.equal(val.isValid, false);
  assert.ok(val.errors.some((e) => e.includes("requires at least two independent evidence sources/ancestries")));
});

test("3A. Test A - same pricing feed duplicate rejected", () => {
  const packetPricingDuplicate = assembleDossierV2InputPacket(
    { as_of: "2026-09-18T12:00:00Z" },
    {
      observed_evidence: [
        {
          evidence_id: "ev:pfeed:item1",
          available_at: "2026-09-18T10:00:00Z",
          claim_or_fact: "US 2Y yield is 3.85%.",
          category: "PRICING_FEED",
          source_type: "PRICING_FEED",
          provenance: [{ source_type: "PRICING_FEED", source_id: "TREASURY_FEED", publisher: "Bloomberg" }],
        },
        {
          evidence_id: "ev:pfeed:item2",
          available_at: "2026-09-18T10:05:00Z",
          claim_or_fact: "US 10Y yield is 4.10%.",
          category: "PRICING_FEED",
          source_type: "PRICING_FEED",
          provenance: [{ source_type: "PRICING_FEED", source_id: "TREASURY_FEED", publisher: "Bloomberg" }],
        },
      ],
    },
  );

  const output = createValidOutput(packetPricingDuplicate);
  output.major_stories[0].epistemic_label = "SUPPORTED";
  output.major_stories[0].evidence_ids = ["ev:pfeed:item1", "ev:pfeed:item2"];

  const val = validateResearchBrainOutput(output, packetPricingDuplicate);
  assert.equal(val.isValid, false);
  assert.ok(val.errors.some((e) => e.includes("requires at least two independent evidence sources/ancestries")));
});

test("3B. Test B - independent fundamental + market evidence accepted", () => {
  const packetFundaMarket = assembleDossierV2InputPacket(
    { as_of: "2026-09-18T12:00:00Z" },
    {
      observed_evidence: [
        {
          evidence_id: "ev:cpi:report",
          available_at: "2026-09-18T09:00:00Z",
          claim_or_fact: "US CPI inflation print was 2.5% YoY in August 2026.",
          category: "ECONOMIC_METRIC",
          source_type: "STATISTICAL_AGENCY",
          provenance: [{ source_type: "STATISTICAL_AGENCY", source_id: "BLS_CPI", publisher: "BLS" }],
        },
        {
          evidence_id: "ev:fed:stmt",
          available_at: "2026-09-18T10:00:00Z",
          claim_or_fact: "FOMC statement cut rates 25bps.",
          category: "MONETARY_POLICY",
          source_type: "PRESS_RELEASE",
          provenance: [{ source_type: "PRESS_RELEASE", source_id: "FOMC_STATEMENT", publisher: "Federal Reserve" }],
        },
        {
          evidence_id: "ev:yields:market",
          available_at: "2026-09-18T10:05:00Z",
          claim_or_fact: "2Y yield fell 12bps.",
          category: "PRICING_FEED",
          source_type: "PRICING_FEED",
          provenance: [{ source_type: "PRICING_FEED", source_id: "TREASURY_FEED", publisher: "Bloomberg" }],
        },
      ],
      price_data: { status: "OK", available_at: "2026-09-18T10:05:00Z" },
    },
  );

  const evFed = packetFundaMarket.observed_evidence.find((e) => e.evidence_id.includes("fed"))!.evidence_id;
  const evYield = packetFundaMarket.observed_evidence.find((e) => e.evidence_id.includes("yields"))!.evidence_id;

  const output = createValidOutput(packetFundaMarket);
  output.major_stories[0].epistemic_label = "SUPPORTED";
  output.major_stories[0].evidence_ids = [evFed, evYield];
  output.major_stories[0].market_evidence.confirming = [evFed, evYield];
  output.major_stories[0].market_evidence.unresolved = [];

  const val = validateResearchBrainOutput(output, packetFundaMarket);
  assert.equal(val.isValid, true);
});

test("3C. Test C - two independent factual sources accepted", () => {
  const packetTwoFactual = assembleDossierV2InputPacket(
    { as_of: "2026-09-18T12:00:00Z" },
    {
      observed_evidence: [
        {
          evidence_id: "ev:cpi:report",
          available_at: "2026-09-18T09:00:00Z",
          claim_or_fact: "US CPI inflation print was 2.5% YoY in August 2026.",
          category: "ECONOMIC_METRIC",
          source_type: "STATISTICAL_AGENCY",
          provenance: [{ source_type: "STATISTICAL_AGENCY", source_id: "BLS_CPI", publisher: "BLS" }],
        },
        {
          evidence_id: "ev:fed:stmt",
          available_at: "2026-09-18T10:00:00Z",
          claim_or_fact: "FOMC statement cut rates 25bps.",
          category: "MONETARY_POLICY",
          source_type: "PRESS_RELEASE",
          provenance: [{ source_type: "PRESS_RELEASE", source_id: "FOMC_STATEMENT", publisher: "Federal Reserve" }],
        },
        {
          evidence_id: "ev:yields:market",
          available_at: "2026-09-18T10:05:00Z",
          claim_or_fact: "2Y yield fell 12bps.",
          category: "PRICING_FEED",
          source_type: "PRICING_FEED",
          provenance: [{ source_type: "PRICING_FEED", source_id: "TREASURY_FEED", publisher: "Bloomberg" }],
        },
      ],
      price_data: { status: "OK", available_at: "2026-09-18T10:05:00Z" },
    },
  );

  const evCpi = packetTwoFactual.observed_evidence.find((e) => e.evidence_id.includes("cpi"))!.evidence_id;
  const evFed = packetTwoFactual.observed_evidence.find((e) => e.evidence_id.includes("fed"))!.evidence_id;

  const output = createValidOutput(packetTwoFactual);
  output.major_stories[0].epistemic_label = "SUPPORTED";
  output.major_stories[0].evidence_ids = [evCpi, evFed];
  output.major_stories[0].market_evidence.confirming = [evCpi, evFed];
  output.major_stories[0].market_evidence.unresolved = [];

  const val = validateResearchBrainOutput(output, packetTwoFactual);
  assert.equal(val.isValid, true);
});

test("3D. Test D - duplicate same-source IDs remain rejected", () => {
  const packetSameSource = assembleDossierV2InputPacket(
    { as_of: "2026-09-18T12:00:00Z" },
    {
      observed_evidence: [
        {
          evidence_id: "ev:sec:filing1",
          available_at: "2026-09-18T10:00:00Z",
          claim_or_fact: "Filing item A.",
          category: "GENERAL",
          source_type: "SEC_FILING",
          provenance: [{ source_type: "SEC_FILING", source_id: "10Q_FILING", publisher: "SEC_EDGAR" }],
        },
        {
          evidence_id: "ev:sec:filing2",
          available_at: "2026-09-18T10:05:00Z",
          claim_or_fact: "Filing item B.",
          category: "GENERAL",
          source_type: "SEC_FILING",
          provenance: [{ source_type: "SEC_FILING", source_id: "10Q_FILING", publisher: "SEC_EDGAR" }],
        },
      ],
    },
  );

  const output = createValidOutput(packetSameSource);
  output.major_stories[0].epistemic_label = "SUPPORTED";
  output.major_stories[0].evidence_ids = ["ev:sec:filing1", "ev:sec:filing2"];

  const val = validateResearchBrainOutput(output, packetSameSource);
  assert.equal(val.isValid, false);
  assert.ok(val.errors.some((e) => e.includes("requires at least two independent evidence sources/ancestries")));
});

test("4. Epistemic Label Validation - INFERRED Uncertainty Signal Required", () => {
  const packet = createValidBasePacket();
  const output = createValidOutput(packet);

  output.major_stories[0].epistemic_label = "INFERRED";
  output.major_stories[0].market_evidence.unresolved = [];
  output.major_stories[0].market_evidence.contradicting = [];

  const val = validateResearchBrainOutput(output, packet);
  assert.equal(val.isValid, false);
  assert.ok(val.errors.some((e) => e.includes("INFERRED story requires explicit uncertainty/alternative signals")));
});

test("5. Thesis Ledger Evolution Integrity & Cycle Detection", () => {
  const packet = createValidBasePacket();
  const output = createValidOutput(packet);

  // A. Two-node cycle (A -> B -> A) rejected
  const entryA: ThesisLedgerEntryV2 = {
    thesis_id: "thesis:A",
    contract_version: THESIS_LEDGER_V2_CONTRACT_VERSION,
    root_thesis_id: "thesis:A",
    parent_thesis_id: "thesis:B",
    successor_thesis_id: "thesis:B",
    title: "Thesis A",
    statement: "Statement A",
    state: "evolved",
    version: 1,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-18T12:00:00Z",
    lineage: [],
    state_reason: "Reason A",
    current_evidence_refs: ["ev:cpi:2026-09"],
    observed_market_reaction: null,
    next_catalyst_or_tripwire: "Catalyst A",
  };

  const entryB: ThesisLedgerEntryV2 = {
    thesis_id: "thesis:B",
    contract_version: THESIS_LEDGER_V2_CONTRACT_VERSION,
    root_thesis_id: "thesis:A",
    parent_thesis_id: "thesis:A",
    successor_thesis_id: "thesis:A",
    title: "Thesis B",
    statement: "Statement B",
    state: "evolved",
    version: 2,
    created_at: "2026-09-18T12:00:00Z",
    updated_at: "2026-09-18T12:00:00Z",
    lineage: ["thesis:A"],
    state_reason: "Reason B",
    current_evidence_refs: ["ev:cpi:2026-09"],
    observed_market_reaction: null,
    next_catalyst_or_tripwire: "Catalyst B",
  };

  output.thesis_ledger.entries = [entryA, entryB];
  let val = validateResearchBrainOutput(output, packet);
  assert.equal(val.isValid, false);
  assert.ok(val.errors.some((e) => e.includes("contains cycle in successor lineage")));

  // B. Three-node cycle (A -> B -> C -> A) rejected
  const entryC: ThesisLedgerEntryV2 = {
    thesis_id: "thesis:C",
    contract_version: THESIS_LEDGER_V2_CONTRACT_VERSION,
    root_thesis_id: "thesis:A",
    parent_thesis_id: "thesis:B",
    successor_thesis_id: "thesis:A",
    title: "Thesis C",
    statement: "Statement C",
    state: "confirmed",
    version: 3,
    created_at: "2026-09-18T12:00:00Z",
    updated_at: "2026-09-18T12:00:00Z",
    lineage: ["thesis:A", "thesis:B"],
    state_reason: "Reason C",
    current_evidence_refs: ["ev:cpi:2026-09"],
    observed_market_reaction: null,
    next_catalyst_or_tripwire: "Catalyst C",
  };

  entryB.successor_thesis_id = "thesis:C";
  output.thesis_ledger.entries = [entryA, entryB, entryC];
  val = validateResearchBrainOutput(output, packet);
  assert.equal(val.isValid, false);
  assert.ok(val.errors.some((e) => e.includes("contains cycle in successor lineage")));

  // C. Valid 3-node chain (A -> B -> C) accepted
  entryA.parent_thesis_id = null;
  entryA.successor_thesis_id = "thesis:B";
  entryB.parent_thesis_id = "thesis:A";
  entryB.successor_thesis_id = "thesis:C";
  entryC.parent_thesis_id = "thesis:B";
  entryC.successor_thesis_id = null;

  output.thesis_ledger.entries = [entryA, entryB, entryC];
  val = validateResearchBrainOutput(output, packet);
  assert.equal(val.isValid, true);
});

test("6. Market Verdict Observed Reaction Market Evidence Requirement", () => {
  const packet = createValidBasePacket();
  const output = createValidOutput(packet);

  const evFed = packet.observed_evidence.find((e) => e.evidence_id.includes("fed"))?.evidence_id ?? "ev:fed:2026-09";
  const evYields = packet.observed_evidence.find((e) => e.evidence_id.includes("yields"))?.evidence_id ?? "ev:yields:2026-09";

  // Reaction supported ONLY by FOMC press release (non-market factual evidence) rejected
  output.market_verdict.lenses.US_RATES.observed_reaction = "2Y yield fell 12bps.";
  output.market_verdict.lenses.US_RATES.observed_reaction_evidence_refs = [evFed]; // FOMC_STATEMENT!

  let val = validateResearchBrainOutput(output, packet);
  assert.equal(val.isValid, false);
  assert.ok(val.errors.some((e) => e.includes("requires at least one market/pricing evidence reference")));

  // Reaction supported by TREASURY_FEED pricing feed accepted
  output.market_verdict.lenses.US_RATES.observed_reaction_evidence_refs = [evYields];
  val = validateResearchBrainOutput(output, packet);
  assert.equal(val.isValid, true);
});

test("6A. Investigation divergence requires observed market/pricing evidence", () => {
  const packet = createValidBasePacket();
  const output = createValidOutput(packet);
  const inv = output.investigations[0];

  const evFed = packet.observed_evidence.find((e) => e.evidence_id.includes("fed"))?.evidence_id ?? "ev:fed:2026-09";
  const evYields = packet.observed_evidence.find((e) => e.evidence_id.includes("yields"))?.evidence_id ?? "ev:yields:2026-09";

  inv.expected_reaction = "A rate cut should pull the front end lower.";
  inv.observed_reaction = "US 2Y yield fell after the decision.";
  inv.divergence = "NONE";
  inv.observed_evidence = [evFed];

  let val = validateResearchBrainOutput(output, packet);
  assert.equal(val.isValid, false);
  assert.ok(val.errors.some((e) => e.includes("requires observed market/pricing evidence")));
  assert.ok(val.errors.some((e) => e.includes("observed_reaction requires at least one market/pricing")));

  inv.observed_evidence = [evYields];
  val = validateResearchBrainOutput(output, packet);
  assert.equal(val.isValid, true);
});

test("6B. Investigation divergence stays unresolved when reaction evidence is missing", () => {
  const packet = createValidBasePacket();
  const output = createValidOutput(packet);
  const inv = output.investigations[0];

  inv.expected_reaction = "A supply disruption would normally lift crude and refined products.";
  inv.observed_reaction = null;
  inv.divergence = "UNRESOLVED";

  const val = validateResearchBrainOutput(output, packet);
  assert.equal(val.isValid, true);
});

test("6C. Divergence V1 demotes model-authored mismatch without System 1 evidence", () => {
  const packet = createValidBasePacket();
  const output = createValidOutput(packet);
  const inv = output.investigations[0];

  const evCpi = packet.observed_evidence.find((e) => e.evidence_id.includes("cpi"))?.evidence_id ?? "ev:cpi:2026-09";
  const evYields = packet.observed_evidence.find((e) => e.evidence_id.includes("yields"))?.evidence_id ?? "ev:yields:2026-09";

  inv.expected_reaction = "A rate cut should pull the front end lower.";
  inv.observed_reaction = "The front end moved higher instead.";
  inv.divergence = "MATERIAL";
  inv.observed_evidence = [evCpi, evYields];

  const normalized = normalizeResearchBrainOutputReferences(output, []) as ResearchBrainOutputV1;
  assert.equal(normalized.investigations[0].divergence, "UNRESOLVED");
});

test("6D. Divergence V1 preserves mismatch only when System 1 evidence pair is carried", () => {
  const packet = createValidBasePacket();
  const output = createValidOutput(packet);
  const inv = output.investigations[0];

  const evCpi = packet.observed_evidence.find((e) => e.evidence_id.includes("cpi"))?.evidence_id ?? "ev:cpi:2026-09";
  const evYields = packet.observed_evidence.find((e) => e.evidence_id.includes("yields"))?.evidence_id ?? "ev:yields:2026-09";

  inv.expected_reaction = "Hot inflation should push the front end higher.";
  inv.observed_reaction = "The front end fell instead.";
  inv.divergence = "MATERIAL";
  inv.observed_evidence = [evCpi, evYields];

  const normalized = normalizeResearchBrainOutputReferences(output, [{
    trigger_evidence_id: evCpi,
    market_evidence_id: evYields,
  }]) as ResearchBrainOutputV1;

  assert.equal(normalized.investigations[0].divergence, "MATERIAL");
  const val = validateResearchBrainOutput(normalized, packet);
  assert.equal(val.isValid, true);
});

test("6E. Divergence V1 never treats System 1 mismatch evidence as proof of NONE", () => {
  const packet = createValidBasePacket();
  const output = createValidOutput(packet);
  const inv = output.investigations[0];

  const evCpi = packet.observed_evidence.find((e) => e.evidence_id.includes("cpi"))?.evidence_id ?? "ev:cpi:2026-09";
  const evYields = packet.observed_evidence.find((e) => e.evidence_id.includes("yields"))?.evidence_id ?? "ev:yields:2026-09";

  inv.expected_reaction = "Hot inflation should push the front end higher.";
  inv.observed_reaction = "The front end moved higher.";
  inv.divergence = "NONE";
  inv.observed_evidence = [evCpi, evYields];

  const normalized = normalizeResearchBrainOutputReferences(output, [{
    trigger_evidence_id: evCpi,
    market_evidence_id: evYields,
  }]) as ResearchBrainOutputV1;

  assert.equal(normalized.investigations[0].divergence, "UNRESOLVED");
});

test("6F. Divergence V1 preserves NONE only when an aligned System 1 evidence pair is carried", () => {
  const packet = createValidBasePacket();
  const output = createValidOutput(packet);
  const inv = output.investigations[0];

  const evCpi = packet.observed_evidence.find((e) => e.evidence_id.includes("cpi"))?.evidence_id ?? "ev:cpi:2026-09";
  const evYields = packet.observed_evidence.find((e) => e.evidence_id.includes("yields"))?.evidence_id ?? "ev:yields:2026-09";

  inv.expected_reaction = "Hot inflation should push the front end higher.";
  inv.observed_reaction = "The front end moved higher.";
  inv.divergence = "NONE";
  inv.observed_evidence = [evCpi, evYields];

  const normalized = normalizeResearchBrainOutputReferences(
    output,
    [],
    [{
      trigger_evidence_id: evCpi,
      market_evidence_id: evYields,
      relation: "ALIGNED",
      timing_precision: "INTRADAY",
    }],
  ) as ResearchBrainOutputV1;

  assert.equal(normalized.investigations[0].divergence, "NONE");
  const val = validateResearchBrainOutput(normalized, packet);
  assert.equal(val.isValid, true);
});

test("6G. Divergence V1 rejects NONE when the deterministic aligned pair is not carried", () => {
  const packet = createValidBasePacket();
  const output = createValidOutput(packet);
  const inv = output.investigations[0];

  const evCpi = packet.observed_evidence.find((e) => e.evidence_id.includes("cpi"))?.evidence_id ?? "ev:cpi:2026-09";
  const evYields = packet.observed_evidence.find((e) => e.evidence_id.includes("yields"))?.evidence_id ?? "ev:yields:2026-09";

  inv.expected_reaction = "Hot inflation should push the front end higher.";
  inv.observed_reaction = "The front end moved higher.";
  inv.divergence = "NONE";
  inv.observed_evidence = [evYields];

  const normalized = normalizeResearchBrainOutputReferences(
    output,
    [],
    [{
      trigger_evidence_id: evCpi,
      market_evidence_id: evYields,
      relation: "ALIGNED",
      timing_precision: "INTRADAY",
    }],
  ) as ResearchBrainOutputV1;

  assert.equal(normalized.investigations[0].divergence, "UNRESOLVED");
});

test("6H. Divergence explanation must add analysis beyond the measured move", () => {
  const packet = createValidBasePacket();
  const output = createValidOutput(packet);
  const inv = output.investigations[0];
  const evYields = packet.observed_evidence.find((e) => e.evidence_id.includes("yields"))?.evidence_id ?? "ev:yields:2026-09";

  inv.expected_reaction = "The front end should rise.";
  inv.observed_reaction = "The front end fell instead.";
  inv.current_explanation = "The front end fell instead.";
  inv.divergence = "MATERIAL";
  inv.observed_evidence = [evYields];

  const val = validateResearchBrainOutput(output, packet);
  assert.equal(val.isValid, false);
  assert.ok(val.errors.some((e) => e.includes("only restates observed_reaction")));
});

test("6I. Divergence explanation keeps an alternative or explicit missing evidence", () => {
  const packet = createValidBasePacket();
  const output = createValidOutput(packet);
  const inv = output.investigations[0];
  const evYields = packet.observed_evidence.find((e) => e.evidence_id.includes("yields"))?.evidence_id ?? "ev:yields:2026-09";

  inv.expected_reaction = "The front end should rise.";
  inv.observed_reaction = "The front end fell instead.";
  inv.current_explanation = "The expected policy transmission may have been offset by another macro impulse.";
  inv.divergence = "MATERIAL";
  inv.observed_evidence = [evYields];
  inv.competing_explanations = [];
  inv.missing_evidence = [];

  const val = validateResearchBrainOutput(output, packet);
  assert.equal(val.isValid, false);
  assert.ok(val.errors.some((e) => e.includes("requires at least one competing_explanation or missing_evidence")));
});

test("6J. Divergence Lab candidates cannot cite evidence outside the Investigation", () => {
  const packet = createValidBasePacket();
  const output = createValidOutput(packet);
  const inv = output.investigations[0];

  inv.candidate_explanations = [{
    rank: 1,
    explanation: "A competing macro impulse may be offsetting the expected move.",
    evidence_for_ids: ["ev:not-in-investigation"],
    evidence_against_ids: [],
    confidence: "MEDIUM",
    discriminating_test: "Compare rates, USD and breadth on the next comparable catalyst.",
  }];

  const val = validateResearchBrainOutput(output, packet);
  assert.equal(val.isValid, false);
  assert.ok(val.errors.some((e) => e.includes("outside this Investigation's observed_evidence")));
});

test("6K. Divergence Lab medium confidence requires supporting evidence", () => {
  const packet = createValidBasePacket();
  const output = createValidOutput(packet);
  const inv = output.investigations[0];

  inv.candidate_explanations = [{
    rank: 1,
    explanation: "Positioning may be offsetting the expected macro transmission.",
    evidence_for_ids: [],
    evidence_against_ids: [],
    confidence: "MEDIUM",
    discriminating_test: "Check whether the move persists after the next session.",
  }];

  const val = validateResearchBrainOutput(output, packet);
  assert.equal(val.isValid, false);
  assert.ok(val.errors.some((e) => e.includes("MEDIUM confidence requires at least one evidence_for_id")));
});

test("6K1. Mechanical-flow candidate rejects generic price evidence at MEDIUM confidence", () => {
  const packet = createValidBasePacket();
  const output = createValidOutput(packet);
  const inv = output.investigations[0];
  const evYields = packet.observed_evidence.find((e) => e.evidence_id.includes("yields"))?.evidence_id ?? "ev:yields:2026-09";

  inv.observed_evidence = [evYields];
  inv.candidate_explanations = [{
    rank: 1,
    explanation: "Short covering drove the rally.",
    evidence_for_ids: [evYields],
    evidence_against_ids: [],
    confidence: "MEDIUM",
    discriminating_test: "Check whether positioning normalises as the rally persists.",
  }];

  const val = validateResearchBrainOutput(output, packet);
  assert.equal(val.isValid, false);
  assert.ok(
    val.errors.some((e) =>
      e.includes("SHORT_COVERING at MEDIUM confidence requires mechanism-specific supporting evidence")
    ),
  );
});

test("6K2. Mechanical-flow candidate accepts direct positioning evidence", () => {
  const packet = createValidBasePacket();
  const positioningEvidenceId = "ev:gold-positioning:2026-09";
  packet.observed_evidence.push({
    evidence_id: positioningEvidenceId,
    epistemic_label: "OBSERVED",
    claim_or_fact: "COMEX gold futures open interest fell while net-short positioning was reduced during the rally.",
    category: "POSITIONING",
    source_type: "EXCHANGE_DATA",
    available_at: "2026-09-18T11:45:00Z",
    occurrence_time: "2026-09-18T11:40:00Z",
    provenance: [
      { source_type: "EXCHANGE_DATA", source_id: "COMEX_POSITIONING", publisher: "CME" },
    ],
  });

  const output = createValidOutput(packet);
  const inv = output.investigations[0];
  inv.observed_evidence = [...inv.observed_evidence, positioningEvidenceId];
  inv.candidate_explanations = [{
    rank: 1,
    explanation: "Short covering drove the rally.",
    evidence_for_ids: [positioningEvidenceId],
    evidence_against_ids: [],
    confidence: "MEDIUM",
    discriminating_test: "Check whether the rally fades as short positioning normalises.",
  }];

  const val = validateResearchBrainOutput(output, packet);
  assert.equal(val.isValid, true, val.errors.join("\n"));
});

test("6K3. Mechanical-flow hypothesis may remain LOW without direct mechanism evidence", () => {
  const packet = createValidBasePacket();
  const output = createValidOutput(packet);
  const inv = output.investigations[0];

  inv.candidate_explanations = [{
    rank: 1,
    explanation: "Short covering may have amplified the rally.",
    evidence_for_ids: [],
    evidence_against_ids: [],
    confidence: "LOW",
    discriminating_test: "Obtain positioning and open-interest evidence before upgrading the mechanism.",
  }];

  const val = validateResearchBrainOutput(output, packet);
  assert.equal(val.isValid, true, val.errors.join("\n"));
});

test("6L. Continued investigation preserves its exact prior expected reaction", () => {
  const packet = createValidBasePacket();
  packet.prior_analytical_state.prior_investigations = [{
    investigation_id: "inv:oil_risk",
    question: "Will Middle East supply disruptions impact Q4 oil prices?",
    expected_reaction: "Original pre-event expectation, preserved byte-for-byte.",
    observed_reaction: null,
    divergence: "UNRESOLVED",
    current_explanation: "Prior explanation.",
    competing_explanations: [],
    research_next: "Keep testing.",
    status: "open",
    linked_story_ids: ["story:fed_easing"],
    linked_thesis_ids: [],
  }];

  const output = createValidOutput(packet);
  output.investigations[0].expected_reaction = "Model rewrote the expectation after seeing the tape.";

  const preserved = preservePriorInvestigationExpectedReactions(output, packet) as ResearchBrainOutputV1;
  assert.equal(
    preserved.investigations[0].expected_reaction,
    "Original pre-event expectation, preserved byte-for-byte.",
  );
});

test("6K. Continued investigation preserves a prior null expectation", () => {
  const packet = createValidBasePacket();
  packet.prior_analytical_state.prior_investigations = [{
    investigation_id: "inv:oil_risk",
    question: "Will Middle East supply disruptions impact Q4 oil prices?",
    expected_reaction: null,
    observed_reaction: null,
    divergence: "UNRESOLVED",
    current_explanation: "Prior explanation.",
    competing_explanations: [],
    research_next: "Keep testing.",
    status: "open",
    linked_story_ids: ["story:fed_easing"],
    linked_thesis_ids: [],
  }];

  const output = createValidOutput(packet);
  output.investigations[0].expected_reaction = "Retroactively invented expectation.";

  const preserved = preservePriorInvestigationExpectedReactions(output, packet) as ResearchBrainOutputV1;
  assert.equal(preserved.investigations[0].expected_reaction, null);
});

test("6L. New investigation may define a new expected reaction", () => {
  const packet = createValidBasePacket();
  packet.prior_analytical_state.prior_investigations = [{
    investigation_id: "inv:old-question",
    question: "Old question",
    expected_reaction: "Old expectation.",
    observed_reaction: null,
    divergence: "UNRESOLVED",
    current_explanation: "Old explanation.",
    competing_explanations: [],
    research_next: "Old next step.",
    status: "open",
    linked_story_ids: [],
    linked_thesis_ids: [],
  }];

  const output = createValidOutput(packet);
  output.investigations[0].expected_reaction = "New investigation expectation.";

  const preserved = preservePriorInvestigationExpectedReactions(output, packet) as ResearchBrainOutputV1;
  assert.equal(preserved.investigations[0].expected_reaction, "New investigation expectation.");
});

test("7. Main Thread & Stock Radar Linkage Validation", () => {
  const packet = createValidBasePacket();
  const output = createValidOutput(packet);

  // Stock radar LINKED_MAIN_THREAD mismatch rejected
  output.stock_radar[0].linkage_type = "LINKED_MAIN_THREAD";
  output.stock_radar[0].linked_main_thread_or_story_id = "thread:WRONG_ID";

  const val = validateResearchBrainOutput(output, packet);
  assert.equal(val.isValid, false);
  assert.ok(val.errors.some((e) => e.includes("does not match main_thread.thread_id")));
});

test("7A. Deterministic Stock Radar linkage normalization fixes clerical type mismatch", () => {
  const packet = createValidBasePacket();
  const output = createValidOutput(packet);

  output.stock_radar[0].linkage_type = "LINKED_MAIN_THREAD";
  output.stock_radar[0].linked_main_thread_or_story_id = output.major_stories[0].story_id;

  const normalized = normalizeResearchBrainOutputReferences(output) as ResearchBrainOutputV1;
  assert.equal(normalized.stock_radar[0].linkage_type, "LINKED_MAJOR_STORY");

  const val = validateResearchBrainOutput(normalized, packet);
  assert.equal(val.isValid, true);
});

test("7B. Deterministic Stock Radar normalization does not hide unknown IDs", () => {
  const packet = createValidBasePacket();
  const output = createValidOutput(packet);

  output.stock_radar[0].linkage_type = "LINKED_MAIN_THREAD";
  output.stock_radar[0].linked_main_thread_or_story_id = "story:unknown";

  const normalized = normalizeResearchBrainOutputReferences(output) as ResearchBrainOutputV1;
  assert.equal(normalized.stock_radar[0].linkage_type, "LINKED_MAIN_THREAD");

  const val = validateResearchBrainOutput(normalized, packet);
  assert.equal(val.isValid, false);
  assert.ok(val.errors.some((e) => e.includes("does not match main_thread.thread_id")));
});

test("7C. Invalid optional Stock Radar evidence refs are pruned to canonical observed evidence", () => {
  const packet = createValidBasePacket();
  const output = createValidOutput(packet);
  const validRef = output.stock_radar[0].evidence_references[0];

  output.stock_radar[0].evidence_references = [
    validRef,
    "research-intake:not-observed-evidence",
  ];

  const pruned = pruneInvalidStockRadarEvidenceReferences(
    output,
    packet,
  ) as ResearchBrainOutputV1;

  assert.deepEqual(pruned.stock_radar[0].evidence_references, [validRef]);
  const val = validateResearchBrainOutput(pruned, packet);
  assert.equal(val.isValid, true, val.errors.join("\n"));
});

test("7D. Stock Radar clerical prune avoids spending the repair model pass", async () => {
  const packet = createValidBasePacket();
  const output = createValidOutput(packet);
  output.stock_radar[0].evidence_references.push(
    "research-intake:not-observed-evidence",
  );

  const stages: string[] = [];
  const runner: ModelRunner = async (input) => {
    stages.push(input.stageKey);
    return { data: structuredClone(output) };
  };

  const result = await executeResearchBrain(
    {
      contract_version: RESEARCH_BRAIN_INPUT_CONTRACT_VERSION,
      as_of: packet.as_of,
      packet,
    },
    { modelRunner: runner, allowRepair: true },
  );

  assert.deepEqual(stages, ["research_brain_primary"]);
  assert.equal(result.diagnostics.degraded, false);
  assert.equal(result.diagnostics.model_repair_used, false);
  assert.equal(
    result.stock_radar[0].evidence_references.includes(
      "research-intake:not-observed-evidence",
    ),
    false,
  );
});

test("7E. Research gap blocker relations must resolve to canonical conclusions", () => {
  const packet = createValidBasePacket();
  const output = createValidOutput(packet);
  output.research_gaps = [{
    gap_id: "gap:orphan",
    category: "rates",
    description: "Missing evidence is claimed to block an unknown Story.",
    severity: "MATERIAL",
    gap_class: "BLOCKER",
    blocking_refs: ["STORY:missing"],
  }];

  const val = validateResearchBrainOutput(output, packet);
  assert.equal(val.isValid, false);
  assert.ok(val.errors.some((error) => /unknown canonical conclusion/i.test(error)));
});

test("7F. Refinements cannot carry blocker references", () => {
  const packet = createValidBasePacket();
  const output = createValidOutput(packet);
  output.research_gaps = [{
    gap_id: "gap:refinement",
    category: "energy",
    description: "PADD2 flow detail would refine durability.",
    severity: "INFORMATIONAL",
    gap_class: "REFINEMENT",
    blocking_refs: ["MAIN_THREAD"],
  }];

  const val = validateResearchBrainOutput(output, packet);
  assert.equal(val.isValid, false);
  assert.ok(val.errors.some((error) => /REFINEMENT must not block/i.test(error)));
});

test("7G. A structured material blocker linked to Main Thread is valid", () => {
  const packet = createValidBasePacket();
  const output = createValidOutput(packet);
  output.research_gaps = [{
    gap_id: "gap:pricing",
    category: "PRICE_DATA",
    description: "Current pricing is unavailable for the Main Thread conclusion.",
    severity: "MATERIAL",
    gap_class: "BLOCKER",
    blocking_refs: ["MAIN_THREAD"],
  }];

  const val = validateResearchBrainOutput(output, packet);
  assert.equal(val.isValid, true, val.errors.join("\n"));
});

test("8. Bounded Reference Index in Structural Repair Prompt", () => {
  const packet = createValidBasePacket();
  const errors = ["major_stories[0] fails Firewall: missing what_changed."];

  const repairPrompt = buildResearchBrainRepairPrompt({}, errors, packet);
  assert.ok(repairPrompt.boundedInput.allowed_reference_index);
  const refIndex = repairPrompt.boundedInput.allowed_reference_index as Record<string, unknown>;

  assert.equal(refIndex.packet_id, packet.packet_id);
  assert.ok(Array.isArray(refIndex.valid_observed_evidence_ids));
  assert.ok((refIndex.valid_observed_evidence_ids as string[]).includes("ev:cpi:2026-09"));
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

test("9A. Primary model path cannot rewrite a continued investigation expectation", async () => {
  const packet = createValidBasePacket();
  packet.prior_analytical_state.prior_investigations = [{
    investigation_id: "inv:oil_risk",
    question: "Will Middle East supply disruptions impact Q4 oil prices?",
    expected_reaction: "Frozen pre-event expectation.",
    observed_reaction: null,
    divergence: "UNRESOLVED",
    current_explanation: "Prior explanation.",
    competing_explanations: [],
    research_next: "Keep testing.",
    status: "open",
    linked_story_ids: ["story:fed_easing"],
    linked_thesis_ids: [],
  }];
  const output = createValidOutput(packet);
  output.investigations[0].expected_reaction = "Rewritten by model.";

  const result = await executeResearchBrain(
    { as_of: packet.as_of, packet },
    { modelRunner: async () => ({ data: structuredClone(output) }) },
  );

  assert.equal(result.diagnostics.degraded, false);
  assert.equal(result.investigations[0].expected_reaction, "Frozen pre-event expectation.");
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

test("10A0. Structural repair path cannot rewrite a continued investigation expectation", async () => {
  const packet = createValidBasePacket();
  packet.prior_analytical_state.prior_investigations = [{
    investigation_id: "inv:oil_risk",
    question: "Will Middle East supply disruptions impact Q4 oil prices?",
    expected_reaction: "Frozen pre-event expectation.",
    observed_reaction: null,
    divergence: "UNRESOLVED",
    current_explanation: "Prior explanation.",
    competing_explanations: [],
    research_next: "Keep testing.",
    status: "open",
    linked_story_ids: ["story:fed_easing"],
    linked_thesis_ids: [],
  }];

  const invalidOutput = createValidOutput(packet);
  invalidOutput.major_stories[0].what_changed = "";
  const repairedOutput = createValidOutput(packet);
  repairedOutput.investigations[0].expected_reaction = "Repair pass rewrote expectation.";

  let calls = 0;
  const runner: ModelRunner = async () => {
    calls++;
    return { data: calls === 1 ? structuredClone(invalidOutput) : structuredClone(repairedOutput) };
  };

  const result = await executeResearchBrain(
    { as_of: packet.as_of, packet },
    { modelRunner: runner, allowRepair: true },
  );

  assert.equal(calls, 2);
  assert.equal(result.diagnostics.degraded, false);
  assert.equal(result.diagnostics.model_repair_used, true);
  assert.equal(result.investigations[0].expected_reaction, "Frozen pre-event expectation.");
});

test("10A. Compact recovery handles primary max_output_tokens without raising the primary budget", async () => {
  const packet = createValidBasePacket();
  const recoveredOutput = createValidOutput(packet);
  const stages: string[] = [];

  const mockRunner: ModelRunner = async (inp) => {
    stages.push(inp.stageKey);
    if (stages.length === 1) {
      throw new OpenAIStageError("OpenAI response was incomplete (max_output_tokens).", {
        code: "incomplete_provider_response",
        incompleteReason: "max_output_tokens",
        outputTokens: 16_000,
      });
    }
    return { data: recoveredOutput };
  };

  const result = await executeResearchBrain(
    { as_of: packet.as_of, packet },
    { modelRunner: mockRunner, allowRepair: true },
  );

  assert.deepEqual(stages, ["research_brain_primary", "research_brain_repair"]);
  assert.equal(result.diagnostics.degraded, false);
  assert.equal(result.diagnostics.model_repair_used, true);
  assert.ok(result.diagnostics.notes.some((note) => note.includes("Compact recovery")));
});

test("10B. Compact recovery prompt trims low-priority context and demands terse completion", () => {
  const packet = createValidBasePacket();
  packet.research_leads = Array.from({ length: 20 }, (_, index) => ({
    ...packet.research_leads[0],
    lead_id: `lead:compact:${index}`,
    claim_or_question: `Compact recovery lead ${index}`,
  }));

  const prompt = buildResearchBrainCompactRecoveryPrompt({
    contract_version: RESEARCH_BRAIN_INPUT_CONTRACT_VERSION,
    as_of: packet.as_of,
    packet,
  });

  assert.match(prompt.instructions, /COMPACT RECOVERY MODE/);
  assert.match(prompt.instructions, /complete concise object/);
  assert.equal((prompt.boundedInput.research_leads as unknown[]).length, 12);
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


function motionAttentionFixture(packet: ReturnType<typeof createValidBasePacket>) {
  return [{
    motion_id: "motion:rates:1",
    headline: "Long-end yields resist the softer inflation impulse",
    what_happened: "The Motion framing says long-end pressure persisted despite softer inflation.",
    market_reaction: "Rates remained elevated.",
    why_interesting: "It tests whether the active rates regime is broader than inflation/Fed alone.",
    big_picture_bridge: "Softer inflation -> persistent duration pressure -> funding costs -> valuation.",
    next_test: "Separate real-yield, term-premium and supply channels.",
    primary_story_id: "story:fed_easing",
    primary_regime_slug: "global-cost-of-capital",
    packet_evidence_id: packet.observed_evidence[0].evidence_id,
    verification_state: "REPORTED" as const,
    materiality: 92,
    relevance: 94,
    novelty: 84,
  }];
}

test("Research Brain treats Motion framing as attention context rather than evidence", () => {
  const packet = createValidBasePacket();
  const motionAttention = motionAttentionFixture(packet);
  const validated = validateResearchBrainInput({
    contract_version: RESEARCH_BRAIN_INPUT_CONTRACT_VERSION,
    as_of: packet.as_of,
    packet,
    motion_attention: motionAttention,
  });
  const prompt = buildResearchBrainPrompt(validated);
  const bounded = prompt.boundedInput as { motion_attention?: Array<Record<string, unknown>> };

  assert.equal(validated.motion_attention?.length, 1);
  assert.equal(bounded.motion_attention?.[0]?.motion_id, "motion:rates:1");
  assert.equal(bounded.motion_attention?.[0]?.packet_evidence_id, packet.observed_evidence[0].evidence_id);
  assert.match(prompt.instructions, /MOTION ATTENTION IS NOT EVIDENCE/);
  assert.match(prompt.instructions, /ACCEPT only when current canonical evidence supports the Motion framing/);
  assert.match(prompt.instructions, /do not themselves mutate a Story, Regime, thesis, or Motion lifecycle/);
});

test("Research Brain rejects Motion attention that does not resolve to current packet evidence", () => {
  const packet = createValidBasePacket();
  const motionAttention = motionAttentionFixture(packet);
  motionAttention[0].packet_evidence_id = "ev:not-in-packet";

  assert.throws(
    () => validateResearchBrainInput({
      contract_version: RESEARCH_BRAIN_INPUT_CONTRACT_VERSION,
      as_of: packet.as_of,
      packet,
      motion_attention: motionAttention,
    }),
    /packet_evidence_id.*current packet evidence/i,
  );
});

test("Motion attention assessment must cite exact canonical evidence and cover every supplied Motion", () => {
  const packet = createValidBasePacket();
  const motionAttention = motionAttentionFixture(packet);
  const output = createValidOutput(packet);
  output.motion_attention_assessments = [{
    motion_id: motionAttention[0].motion_id,
    decision: "REFINE",
    reason: "The underlying development is observed, but the broader causal framing remains too strong.",
    evidence_references: [motionAttention[0].packet_evidence_id],
    story_implication: "Narrow the rates explanation to the evidence-supported channel.",
    regime_implication: null,
    investigation_next: "Test whether the long end remains firm after controlling for the inflation impulse.",
    refined_headline: "Long-end yields stay firm after softer inflation evidence",
    refined_why_interesting: "The move keeps a duration-pressure question alive without proving the cause.",
    refined_big_picture_bridge: "Softer inflation -> persistent long-end pressure -> test supply, real-yield and term-premium channels.",
  }];

  const valid = validateResearchBrainOutput(output, packet, motionAttention);
  assert.equal(valid.isValid, true, valid.errors.join("\n"));

  const missing = structuredClone(output);
  delete missing.motion_attention_assessments;
  const missingValidation = validateResearchBrainOutput(missing, packet, motionAttention);
  assert.equal(missingValidation.isValid, false);
  assert.ok(missingValidation.errors.some((error) => /motion_attention_assessments is required/i.test(error)));

  const wrongEvidence = structuredClone(output);
  wrongEvidence.motion_attention_assessments![0].evidence_references = [packet.observed_evidence[1].evidence_id];
  const wrongEvidenceValidation = validateResearchBrainOutput(wrongEvidence, packet, motionAttention);
  assert.equal(wrongEvidenceValidation.isValid, false);
  assert.ok(wrongEvidenceValidation.errors.some((error) => /exact canonical packet evidence/i.test(error)));

  const missingRefinement = structuredClone(output);
  missingRefinement.motion_attention_assessments![0].refined_headline = null;
  const missingRefinementValidation = validateResearchBrainOutput(missingRefinement, packet, motionAttention);
  assert.equal(missingRefinementValidation.isValid, false);
  assert.ok(missingRefinementValidation.errors.some((error) => /REFINE requires corrected headline/i.test(error)));
});

test("executeResearchBrain passes Motion attention to System 2 and persists its bounded assessment", async () => {
  const packet = createValidBasePacket();
  const motionAttention = motionAttentionFixture(packet);
  const output = createValidOutput(packet);
  output.motion_attention_assessments = [{
    motion_id: motionAttention[0].motion_id,
    decision: "ACCEPT",
    reason: "Current canonical evidence supports using the Motion as a live analytical prompt.",
    evidence_references: [motionAttention[0].packet_evidence_id],
    story_implication: "The current Story should explicitly test the broader duration-pressure channel.",
    regime_implication: "The rates regime remains restrictive pending stronger cross-asset confirmation.",
    investigation_next: null,
    refined_headline: null,
    refined_why_interesting: null,
    refined_big_picture_bridge: null,
  }];

  let seenAttention: unknown = null;
  const result = await executeResearchBrain({
    contract_version: RESEARCH_BRAIN_INPUT_CONTRACT_VERSION,
    as_of: packet.as_of,
    packet,
    motion_attention: motionAttention,
  }, {
    allowRepair: false,
    modelRunner: async ({ boundedInput }) => {
      seenAttention = boundedInput.motion_attention;
      return { data: output };
    },
  });

  assert.ok(Array.isArray(seenAttention));
  assert.equal((seenAttention as Array<{ motion_id: string }>)[0]?.motion_id, motionAttention[0].motion_id);
  assert.equal(result.motion_attention_assessments?.[0]?.decision, "ACCEPT");
});

test("degraded Research Brain leaves Motion attention unresolved rather than accepting it", () => {
  const packet = createValidBasePacket();
  const motionAttention = motionAttentionFixture(packet);
  const degraded = produceDegradedOutput(packet, "forced failure", false, motionAttention);

  assert.equal(degraded.motion_attention_assessments?.[0]?.decision, "UNRESOLVED");
  assert.deepEqual(
    degraded.motion_attention_assessments?.[0]?.evidence_references,
    [motionAttention[0].packet_evidence_id],
  );
});


test("B2 Motion assessment cannot invent a Story or Regime route absent from Motion attention", () => {
  const packet = createValidBasePacket();
  const motionAttention = motionAttentionFixture(packet);
  motionAttention[0].primary_story_id = null;
  motionAttention[0].primary_regime_slug = "global-cost-of-capital";

  const output = createValidOutput(packet);
  output.motion_attention_assessments = [{
    motion_id: motionAttention[0].motion_id,
    decision: "ACCEPT",
    reason: "The development matters, but the Motion has no exact Story identity.",
    evidence_references: [motionAttention[0].packet_evidence_id],
    story_implication: "Invented Story implication should fail.",
    regime_implication: null,
    investigation_next: null,
    refined_headline: null,
    refined_why_interesting: null,
    refined_big_picture_bridge: null,
  }];

  const storyValidation = validateResearchBrainOutput(output, packet, motionAttention);
  assert.equal(storyValidation.isValid, false);
  assert.ok(storyValidation.errors.some((error) => /without an exact primary_story_id/i.test(error)));

  output.motion_attention_assessments[0].story_implication = null;
  output.motion_attention_assessments[0].regime_implication = "Exact rate-regime implication is allowed.";
  const regimeValidation = validateResearchBrainOutput(output, packet, motionAttention);
  assert.equal(regimeValidation.isValid, true, regimeValidation.errors.join("\n"));
});
