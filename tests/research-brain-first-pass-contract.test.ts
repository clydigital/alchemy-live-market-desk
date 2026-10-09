import assert from "node:assert/strict";
import { test } from "node:test";
import { THESIS_LEDGER_V2_CONTRACT_VERSION } from "../lib/dossier-v2/research-brain-contracts.ts";
import {
  buildResearchBrainSystemInstructions,
  getResearchBrainJsonSchema,
} from "../lib/dossier-v2/research-brain-prompt.ts";

test("Research Brain first-pass instructions keep reference arrays ID-only", () => {
  const instructions = buildResearchBrainSystemInstructions();

  assert.match(instructions, /REFERENCE FIELDS ARE ID-ONLY/);
  assert.match(instructions, /market_evidence\.unresolved may contain ONLY supplied packet\.observed_evidence\.evidence_id values or packet\.research_leads\.lead_id values/);
  assert.match(instructions, /Never place prose, missing-data descriptions, chart questions, or invented IDs in those arrays/);
  assert.match(instructions, /Put missing-data prose in investigations\[\*\]\.missing_evidence, research_now, or research_gaps instead/);
  assert.match(instructions, /NEVER write raw evidence IDs, source IDs, UUIDs, filenames, ingestion keys, provider handles/);
  assert.match(instructions, /ASDA-file/);
  assert.match(instructions, /provenance is rendered separately by Live\/Hybrid/);
});

test("Research Brain first-pass instructions enforce valid evolved thesis lineage", () => {
  const instructions = buildResearchBrainSystemInstructions();

  assert.match(instructions, /THESIS LEDGER V2/);
  assert.match(instructions, /Use state "evolved" ONLY when both predecessor and successor entries are present in the output ledger/);
  assert.match(instructions, /successor\.parent_thesis_id points back to the predecessor/);
  assert.match(instructions, /Otherwise do not use "evolved"/);
});

test("Research Brain JSON schema pins thesis ledger contract versions to V2", () => {
  const schema = getResearchBrainJsonSchema() as any;
  const ledger = schema.properties.thesis_ledger;
  const entry = ledger.properties.entries.items;

  assert.deepEqual(
    ledger.properties.contract_version.enum,
    [THESIS_LEDGER_V2_CONTRACT_VERSION],
  );
  assert.deepEqual(
    entry.properties.contract_version.enum,
    [THESIS_LEDGER_V2_CONTRACT_VERSION],
  );
});


test("Research Brain Divergence V1 stays inside priority investigations", () => {
  const instructions = buildResearchBrainSystemInstructions();
  const schema = getResearchBrainJsonSchema() as any;
  const investigation = schema.properties.investigations.items;

  assert.match(instructions, /DIVERGENCE V1 LIVES ONLY INSIDE PRIORITY INVESTIGATIONS/);
  assert.match(instructions, /DIRECTIONAL OR SEQUENCED expected-vs-observed mismatch/);
  assert.match(instructions, /Missing confirmation, missing breadth, stale\/non-comparable observations, or missing timing are NOT divergences/);
  assert.match(instructions, /system1_reaction_assessments are deterministic chronology-safe expected-vs-observed comparisons/);
  assert.match(instructions, /reaction_window is 5m, 30m, 4h, close or next_session/);
  assert.match(instructions, /reaction_path is present, preserve its ordered 5m → 30m → 4h → close → next_session sequence/);
  assert.match(instructions, /a reversal across windows is sequencing evidence, not by itself a causal explanation/);
  assert.match(instructions, /If is_proxy=true, observed_instrument is a proxy for instrument/);
  assert.match(instructions, /never rewrite the proxy move as a direct move in the underlying instrument/);
  assert.match(instructions, /relation=ALIGNED may support divergence=NONE only when the Investigation carries that assessment's exact trigger_evidence_id \+ market_evidence_id pair/);
  assert.match(instructions, /set PARTIAL or MATERIAL only when a relevant system1_divergence_candidate exists/);
  assert.match(instructions, /Set NONE only when a relevant system1_reaction_assessment has relation=ALIGNED/);
  assert.match(instructions, /If no qualifying deterministic pair exists, use UNRESOLVED/);
  assert.deepEqual(investigation.properties.divergence.enum, [
    "NONE",
    "PARTIAL",
    "MATERIAL",
    "UNRESOLVED",
  ]);
  assert.ok(investigation.required.includes("expected_reaction"));
  assert.ok(investigation.required.includes("observed_reaction"));
  assert.ok(investigation.required.includes("divergence"));
  assert.ok(investigation.required.includes("candidate_explanations"));
  assert.equal(investigation.properties.candidate_explanations.maxItems, 4);
  assert.deepEqual(
    investigation.properties.candidate_explanations.items.properties.confidence.enum,
    ["HIGH", "MEDIUM", "LOW", "UNRESOLVED"],
  );
  assert.match(instructions, /DIVERGENCE LAB CANDIDATES/);
  assert.match(instructions, /emit 2-4 ranked candidates rather than presenting one post-hoc cause as settled/);
  assert.match(instructions, /evidence_for_ids and evidence_against_ids may contain ONLY IDs already present in that Investigation's observed_evidence/);
});


test("Research Brain keeps mechanical-flow claims evidence-specific and historical statistics contextual", () => {
  const instructions = buildResearchBrainSystemInstructions();

  assert.match(
    instructions,
    /PRICED_IN, SHORT_COVERING, LONG_LIQUIDATION, DEALER_GAMMA, OPTIONS_EXPIRY and CTA_FLOW at MEDIUM or HIGH confidence require mechanism-specific evidence/,
  );
  assert.match(
    instructions,
    /generic price direction alone may establish the move but cannot establish those causes/,
  );
  assert.match(instructions, /HISTORICAL STATISTICS DISCIPLINE/);
  assert.match(
    instructions,
    /Historical base rates, seasonality and event-window analogues are contextual evidence only/,
  );
  assert.match(
    instructions,
    /only when supplied evidence provides the relevant sample window and sample size/,
  );
  assert.match(
    instructions,
    /If those details are absent, keep the historical comparison qualitative/,
  );
});

test("Research Brain uses prior investigation baselines for bounded divergence post-mortems", () => {
  const instructions = buildResearchBrainSystemInstructions();

  assert.match(instructions, /DIVERGENCE POST-MORTEM DISCIPLINE/);
  assert.match(instructions, /prior_analytical_state\.prior_investigations is the bounded previous-Dossier investigation baseline/);
  assert.match(instructions, /same investigation_id or the same explicit linked Story\/Thesis identity/);
  assert.match(instructions, /REUSE its prior investigation_id rather than minting a cosmetic new ID/);
  assert.match(instructions, /reformulating the wording does not justify a new ID/);
  assert.match(instructions, /A similar question, market mechanism, Regime or subgroup alone is NOT enough to inherit a prior expectation/);
  assert.match(instructions, /create a new investigation and leave the old one as historical context/);
  assert.match(instructions, /preserve the PRIOR expected_reaction as historical pre-tape context/);
  assert.match(instructions, /identify the strongest evidence-supported causal link that failed, lagged, was offset, or remains unproven/);
  assert.match(instructions, /research_next name the observable that would discriminate between the leading explanation and its alternatives/);
  assert.match(instructions, /never infer causality from price direction alone/);
  assert.match(instructions, /describe alignment neutrally rather than calling the prior view 'correct'/);
});

test("Research Brain uses evidence-gated investigation lifecycle transitions", () => {
  const instructions = buildResearchBrainSystemInstructions();

  assert.match(instructions, /INVESTIGATION LIFECYCLE DISCIPLINE/);
  assert.match(instructions, /keep status=open when the current packet lacks enough comparable current evidence/);
  assert.match(instructions, /Use strengthened only when new supplied current evidence materially supports/);
  assert.match(instructions, /Use weakened only when new supplied current evidence materially contradicts/);
  assert.match(instructions, /Use resolved only when supplied current evidence answers the market question strongly enough/);
  assert.match(instructions, /Use parked only when the question is no longer currently decision-relevant/);
  assert.match(instructions, /parked is not a substitute for missing evidence, age, or uncertainty/);
  assert.match(instructions, /Do not reopen a prior resolved or parked investigation unless new supplied current evidence materially reactivates/);
  assert.match(instructions, /preserve uncertainty rather than manufacturing a lifecycle transition/);
});

test("Research Brain frames fresh market Motion against ongoing regimes before asset calls", () => {
  const instructions = buildResearchBrainSystemInstructions();

  assert.match(instructions, /MOTION-LED, REGIME-ANCHORED MARKET FRAME/);
  assert.match(instructions, /newest meaningful supported change/);
  assert.match(instructions, /most consequential NEW market behaviour/);
  assert.match(instructions, /Do not infer risk-on or risk-off from SPX\/NDX alone/);
  assert.match(instructions, /higher yields are tightening conditions/);
  assert.match(instructions, /equity strength may be narrow/);
  assert.match(instructions, /If the evidence is mixed, say so explicitly instead of forcing a binary label/);
  assert.match(instructions, /FUNDAMENTAL STORY ORDER/);
  assert.match(instructions, /Rank Major Stories by their ability to change the current regime/);
  assert.match(instructions, /BALANCED ASSET LENSES/);
});

test("Research Brain keeps reader-facing Dossier language concrete and LY-style", () => {
  const instructions = buildResearchBrainSystemInstructions();

  assert.match(instructions, /READER-FACING LY LANGUAGE/);
  assert.match(instructions, /main_thread\.headline must carry the main market conclusion/);
  assert.match(instructions, /Do not use internal regime labels such as "rates-led tightening" as reader-facing headlines or conclusions/);
  assert.match(instructions, /Avoid "transmission", "transmitting", "transmission channel", "incomplete transmission"/);
  assert.match(instructions, /AI stocks can keep pushing despite higher yields as earnings stay strong/);
  assert.match(instructions, /Yields are rising, but credit spreads are still calm/);
});

test("Research Brain rolls completed policy meetings to the next live decision", () => {
  const instructions = buildResearchBrainSystemInstructions();

  assert.match(instructions, /POLICY EVENT ROLLOVER/);
  assert.match(instructions, /never continue to frame that completed meeting as a future unresolved catalyst/);
  assert.match(instructions, /Roll the policy question forward to the next scheduled meeting/);
  assert.match(instructions, /Historical policy expectations may remain only as labelled prior context/);
});

test("Research Brain keeps diplomacy and geopolitics conditional on observed evidence", () => {
  const instructions = buildResearchBrainSystemInstructions();

  assert.match(instructions, /trade, diplomatic or geopolitical developments as potential market-effect or relief-valve branches only when observed evidence supports them/);
  assert.match(instructions, /never assume an announced meeting, negotiation or threat produced a market effect without reaction evidence/);
  assert.match(instructions, /STREAM-READY SYNTHESIS/);
});


test("Research Brain reserves top-level gaps for material blockers", () => {
  const instructions = buildResearchBrainSystemInstructions();
  const schema = getResearchBrainJsonSchema() as any;
  const gap = schema.properties.research_gaps.items;

  assert.match(instructions, /TOP-LEVEL RESEARCH GAP DISCIPLINE/);
  assert.match(instructions, /ONLY for missing input that materially blocks, invalidates, or makes unsafe/);
  assert.match(instructions, /Missing dealer positioning, intraday flow, options skew, terminal logistics, freight detail/);
  assert.match(instructions, /Put every refinement in investigations\[\*\]\.missing_evidence and\/or research_now as well/);
  assert.match(instructions, /If no conclusion-blocking gap exists, return research_gaps: \[\]/);
  assert.deepEqual(gap.properties.severity.enum, ["MATERIAL", "INFORMATIONAL"]);
  assert.deepEqual(gap.properties.gap_class.enum, ["BLOCKER", "REFINEMENT"]);
  assert.ok(gap.required.includes("blocking_refs"));
});


test("Research Brain distinguishes duration stress from systemic risk-off", () => {
  const instructions = buildResearchBrainSystemInstructions();

  assert.match(instructions, /DURATION-STRESS DECOMPOSITION/);
  assert.match(instructions, /30Y breakout is first-class evidence/);
  assert.match(instructions, /GLOBAL LABEL DISCIPLINE/);
  assert.match(instructions, /Use "global duration shock" only when supplied non-US sovereign evidence confirms/);
  assert.match(instructions, /CREDIT-BREADTH-VOL CONFIRMATION/);
  assert.match(instructions, /High MOVE alongside contained VIX and still-tight credit/);
  assert.match(instructions, /ENERGY-INFLATION LINK/);
  assert.match(instructions, /GOLD-USD CROSS-CHECK/);
  assert.match(instructions, /RESEARCH-NOW PRIORITY/);
});

test("AI capex watch prioritises investigation without forcing unsupported canonical state", () => {
  const instructions = buildResearchBrainSystemInstructions();
  assert.match(instructions, /PRIMARY WATCH — AI CAPEX \/ CASH-FLOW \/ CREDIT CYCLE/);
  assert.match(instructions, /FIRST TEST whether CURRENT supplied canonical evidence establishes a material change/);
  assert.match(instructions, /incremental versus replacement \/ inflation-driven capital expenditure/);
  assert.match(instructions, /reasons for capex RISING or FALLING/);
  assert.match(instructions, /efficiency-led lower cost per token increases profitable consumption/);
  assert.match(instructions, /research priority is NOT a market finding/);
  assert.match(instructions, /do not force the main_thread/);
  assert.match(instructions, /Notion\/ChatGPT research notes, Motion, creator commentary/);
  assert.match(instructions, /Use only exact persistent Story bindings and supplied canonical evidence IDs/);
});

test("Research Brain requires measurable market-crack tests, exact cross-company transmission and missing-data honesty", () => {
  const instructions = buildResearchBrainSystemInstructions();
  assert.match(instructions, /QUANTIFIED CRACK TESTS — EVIDENCE BEFORE SCENARIO/);
  assert.match(instructions, /operating profit and free cash flow versus capex/);
  assert.match(instructions, /rating\/duration-matched corporate OAS/);
  assert.match(instructions, /SUPPLIER → CUSTOMER/);
  assert.match(instructions, /require a verified commercial link/);
  assert.match(instructions, /say UNRESOLVED and formulate an exact Research Gap/);
  assert.match(instructions, /Static Live trigger-ladder numbers are research hypotheses/);
});
