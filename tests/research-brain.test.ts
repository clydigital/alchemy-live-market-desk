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
  normalizeResearchBrainOutputReferences,
  produceDegradedOutput,
  researchBrainStageRuntime,
} from "../lib/dossier-v2/research-brain.ts";
import type { ModelRunner } from "../lib/dossier-v2/research-brain.ts";


test("Research Brain runtime gives primary synthesis enough output headroom without inflating repair", () => {
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
  assert.equal(repair.maxOutputTokens, 10_000);
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
