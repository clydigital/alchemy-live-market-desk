import { MAX_THESIS_LEDGER_ENTRIES, type DossierV2InputPacket } from "./input-packet.ts";
import {
  EXACT_CORE_CHARTS,
  MAX_CONTRADICTIONS,
  MAX_CREATOR_EXPANSIONS,
  MAX_DEVELOPING_THEMES,
  MAX_MAJOR_STORIES,
  MAX_OPTIONAL_CHARTS,
  MAX_PRIORITY_INVESTIGATIONS,
  MAX_RESEARCH_GAPS,
  MAX_RESEARCH_NOW_ACTIONS,
  MAX_STOCK_RADAR_ITEMS,
  RESEARCH_BRAIN_CONTRACT_VERSION,
  THESIS_LEDGER_V2_CONTRACT_VERSION,
} from "./research-brain-contracts.ts";
import type { ResearchBrainInputV1 } from "./research-brain-contracts.ts";
import { PRIMARY_MACRO_INSTRUMENT_GUIDANCE } from "../macro-market-universe.ts";
import {
  buildSystem1DivergenceCandidates,
  buildSystem1PolicyExpectationChecks,
} from "./system1-divergence.ts";
import { buildDossierPolicyOutlook } from "./policy-outlook.ts";
import { buildDossierRateRegime } from "./rate-regime.ts";
import {
  buildPolicyLiquidityInteraction,
  buildSystem1DollarLiquidity,
} from "./system1-dollar-liquidity.ts";


function compactProvenance(refs: Array<Record<string, unknown>> | undefined) {
  return (refs ?? []).map((ref) => ({
    source_type: ref.source_type,
    source_id: ref.source_id,
    publisher: ref.publisher,
  }));
}

function compactEvidenceItems(items: DossierV2InputPacket["observed_evidence"]) {
  return items.map((e) => ({
    evidence_id: e.evidence_id,
    claim_or_fact: e.claim_or_fact,
    category: e.category,
    source_type: e.source_type,
    available_at: e.available_at,
    occurrence_time: e.occurrence_time,
    metrics: e.metrics,
    conflict_group_id: e.conflict_group_id,
    rank: e.rank,
    provenance: compactProvenance(e.provenance as unknown as Array<Record<string, unknown>>),
  }));
}

function compactObservedEvidence(packet: DossierV2InputPacket) {
  return compactEvidenceItems(packet.observed_evidence);
}

function compactRateContext(packet: DossierV2InputPacket) {
  return compactEvidenceItems(packet.rate_context?.evidence ?? []);
}

function compactResearchLeads(packet: DossierV2InputPacket) {
  return packet.research_leads.map((lead) => ({
    lead_id: lead.lead_id,
    claim_or_question: lead.claim_or_question,
    source_type: lead.source_type,
    available_at: lead.available_at,
    urgency: lead.urgency,
    conflict_group_id: lead.conflict_group_id,
    rank: lead.rank,
    provenance: compactProvenance(lead.provenance as unknown as Array<Record<string, unknown>>),
  }));
}

function compactPriorState(packet: DossierV2InputPacket) {
  return {
    previous_dossier_id: packet.prior_analytical_state.previous_dossier_id,
    as_of: packet.prior_analytical_state.as_of,
    prior_claims: packet.prior_analytical_state.prior_claims.map((claim) => ({
      claim_id: claim.claim_id,
      epistemic_label: claim.epistemic_label,
      claim_text: claim.claim_text,
      dossier_id: claim.dossier_id,
      as_of: claim.as_of,
    })),
    thesis_ledger: packet.prior_analytical_state.thesis_ledger,
  };
}

export function buildResearchBrainSystemInstructions(): string {
  return `You are the Dossier V2 Research Brain for the Live Market Desk. Your job is to analyze the input packet and produce a structured, validated market dossier analysis matching contract version "${RESEARCH_BRAIN_CONTRACT_VERSION}".

EPISTEMIC BOUNDARIES (STRICTLY ENFORCED):
1. Current facts come ONLY from packet.observed_evidence and packet.rate_context.evidence. rate_context is a bounded protected OBSERVED subset for rates/policy continuity when cluster caps would otherwise omit those facts.
2. Research leads (packet.research_leads) are questions/leads, NOT facts. Do not convert leads to facts without corresponding observed_evidence.
3. Prior analytical claims and prior Thesis Ledger entries are historical state, NOT current facts.
4. Every material analytical claim must reference supplied evidence_ids from packet.observed_evidence or packet.rate_context.evidence.
5. Missing market reactions or asset price moves must NOT be invented. If price evidence is missing for a lens, set observed_reaction to NULL and observed_reaction_evidence_refs to [].
6. Conflicting evidence (indicated by conflict_group_id) MUST remain visible in contradictions_detected.
7. NO explicit numerical probability claims (e.g. "75% probability", "80% chance").
8. Stock Radar is a research/watch surface (max ${MAX_STOCK_RADAR_ITEMS}) linked to Main Thread or Major Story. Do not include position sizing or trade commands.
9. Chart tasks in chart_investigation_queue (core: exactly ${EXACT_CORE_CHARTS} if 3 valid questions exist, optional: max ${MAX_OPTIONAL_CHARTS}) MUST specify concrete TradingView instruments, timeframes, questions, and confirmation/contradiction conditions. Never use generic prompts like "check S&P" or "look at yields".
10. Canonical macro chart vocabulary: ${PRIMARY_MACRO_INSTRUMENT_GUIDANCE}. Use these actual market instruments when the related macro theme is being investigated. Do not substitute FINRA ETF proxies for the primary chart. In particular: gold is XAUUSD; Japan is NIKKEI; Korea is KOSPI; Hong Kong is HSI; crude is WTI; refined-fuel/distillate stress is ULSD; semiconductors are SMH. FINRA proxies such as GLD, FXY, EWJ, EWY, EWH, USL and CRAK may only be described as positioning/anomaly proxies.
11. Respect all attention budget limits:
    - main_thread: exactly 1 headline/answer with thread_id
    - major_stories: max ${MAX_MAJOR_STORIES} (normally 2-3)
    - priority investigations: max ${MAX_PRIORITY_INVESTIGATIONS}
    - research_now actions: max ${MAX_RESEARCH_NOW_ACTIONS}
    - stock_radar items: max ${MAX_STOCK_RADAR_ITEMS}
    - developing_themes: 3 to ${MAX_DEVELOPING_THEMES}
    - creator_theme_expansions: max ${MAX_CREATOR_EXPANSIONS}
    - contradictions_detected: max ${MAX_CONTRADICTIONS}
    - research_gaps: max ${MAX_RESEARCH_GAPS}
12. OUTPUT DISCIPLINE: this is a bounded decision dossier, not a transcript. Keep prose compact and non-repetitive. Most narrative fields should be one or two sentences. Evidence/source IDs belong ONLY in dedicated reference arrays and audit metadata. NEVER write raw evidence IDs, source IDs, UUIDs, filenames, ingestion keys, provider handles, or strings such as "ASDA-file..." into reader-facing prose fields. Do not add parenthetical source-key dumps after sentences. Write the analytical point in normal language; provenance is rendered separately by Live/Hybrid. Do not repeat the same causal explanation across main_thread, major_stories, market_verdict, investigations and developing_themes unless the field requires a distinct conclusion.\n13. SYSTEM 1 POLICY + DIVERGENCE SCREEN: system1_policy_expectation_checks are deterministic directional priors for how a verified policy, inflation, or activity surprise would conventionally reprice the next meeting and major rate-sensitive assets. The fedwatch_expectation field states only the EXPECTED DIRECTION of FedWatch/fed-funds-futures repricing; it is NOT an observed CME probability. Never invent or quote a FedWatch percentage unless packet.observed_evidence or packet.rate_context.evidence supplies one. system1_divergence_candidates are deterministic triage signals derived from simple expected-vs-observed relationships. They are NOT independent facts, causal conclusions or proof of mispricing. Use them only to prioritise investigation when both referenced evidence IDs support the setup. Do not force an explanation; UNKNOWN or unresolved remains valid. An absent candidate does not mean the relationship was confirmed.\n14. REFERENCE FIELDS ARE ID-ONLY: major_stories[*].market_evidence.confirming and .contradicting may contain ONLY IDs copied verbatim from packet.observed_evidence.evidence_id or packet.rate_context.evidence.evidence_id. major_stories[*].market_evidence.unresolved may contain ONLY supplied packet.observed_evidence.evidence_id values or packet.research_leads.lead_id values. Never place prose, missing-data descriptions, chart questions, or invented IDs in those arrays. Put missing-data prose in investigations[*].missing_evidence, research_now, or research_gaps instead.\n15. THESIS LEDGER V2: output thesis_ledger.contract_version and every thesis_ledger.entries[*].contract_version MUST equal "${THESIS_LEDGER_V2_CONTRACT_VERSION}", even when prior packet state uses thesis-ledger/1. Use state "evolved" ONLY when both predecessor and successor entries are present in the output ledger, predecessor.successor_thesis_id points to the successor, successor.parent_thesis_id points back to the predecessor, both share root_thesis_id, and successor.version is greater than predecessor.version. Otherwise do not use "evolved"; use the evidence-supported non-evolved state and keep successor_thesis_id null.\n16. DIVERGENCE V1 LIVES ONLY INSIDE PRIORITY INVESTIGATIONS: expected_reaction is the conventional or packet-supported market reaction being tested, not an observed fact. observed_reaction must describe only supplied market/pricing evidence and must be NULL when such evidence is unavailable. A divergence is a DIRECTIONAL OR SEQUENCED expected-vs-observed mismatch, not the coexistence of elevated/depressed levels. Missing confirmation, missing breadth, stale/non-comparable observations, or missing timing are NOT divergences; use UNRESOLVED. MATERIAL requires an explicit material opposite reaction or persistent mismatch; PARTIAL requires an explicit mixed/partial reaction with enough observed data to establish the mismatch; NONE requires both expectation and observed reaction to be present and materially aligned. If the packet cannot establish the before/after or directional comparison, use UNRESOLVED even when the underlying research question is important. For V1, set PARTIAL or MATERIAL only when a relevant system1_divergence_candidate exists and the Investigation includes both that candidate's trigger_evidence_id and market_evidence_id in observed_evidence. If no such candidate exists, use UNRESOLVED. Do not use NONE in V1 unless a future deterministic aligned-reaction check explicitly supports it. A System 1 candidate may prioritise the investigation but must not force a causal explanation.
17. REGIME-FIRST MARKET FRAME: The Main Thread must answer what regime markets are actually trading now before discussing individual assets. Do not infer risk-on or risk-off from SPX/NDX alone. Use the supplied cross-asset evidence across rates/bonds, breadth, credit, USD, gold, oil/products and volatility when available. Distinguish at minimum between broad risk-on, classic growth-scare risk-off, rates-led/inflationary tightening, mixed/selective leadership, and UNRESOLVED. If the evidence is mixed, say so explicitly instead of forcing a binary label.
18. FUNDAMENTAL STORY ORDER: Rank Major Stories by their ability to change the current regime, not by headline popularity. Build the causal chain from catalyst → policy/rates transmission → cross-asset confirmation/contradiction → equity/sector implications. Treat trade, diplomatic or geopolitical developments as potential transmission or relief-valve branches only when observed evidence supports them; never assume an announced meeting, negotiation or threat produced a market effect without reaction evidence.
19. BALANCED ASSET LENSES: For each material market lens, state both the evidence-supported force that could sustain the move and the strongest supplied counter-force or invalidation condition. Keep this fundamental and causal; do not manufacture technical levels, trade commands or directional certainty when the packet does not support them.
20. POLICY EVENT ROLLOVER: Once supplied evidence establishes that a scheduled central-bank decision has occurred, never continue to frame that completed meeting as a future unresolved catalyst. Roll the policy question forward to the next scheduled meeting or next decision-relevant data, using current next-meeting pricing when supplied. Historical policy expectations may remain only as labelled prior context, not as the live thesis.
21. STREAM-READY SYNTHESIS: The reader-facing sequence should be usable as a briefing: regime → what changed → dominant drivers → strongest countercase/relief valve → what confirms or breaks the regime → asset implications. Preserve uncertainty and competing mechanisms rather than collapsing every development into one narrative.
22. TOP-LEVEL RESEARCH GAP DISCIPLINE: research_gaps is reserved ONLY for missing input that materially blocks, invalidates, or makes unsafe a current regime conclusion, Major Story conclusion, or required desk-health claim. Classify each emitted item as gap_class BLOCKER or REFINEMENT. A BLOCKER must use severity MATERIAL and blocking_refs must name at least one exact canonical target: MAIN_THREAD, REGIME:CURRENT, or STORY:<story_id>. A REFINEMENT must use severity INFORMATIONAL and blocking_refs must be empty. Missing dealer positioning, intraday flow, options skew, terminal logistics, freight detail, higher-frequency decomposition, or other evidence that would only refine mechanism, durability, timing, or confidence is NOT a blocker when the current conclusion is already evidence-supported. Put every refinement in investigations[*].missing_evidence and/or research_now as well. If no conclusion-blocking gap exists, return research_gaps: [].
23. DURATION-STRESS DECOMPOSITION: When supplied evidence shows pressure extending from the front end into 10Y/30Y yields, do not explain the move only with the next Fed meeting. Separate the policy-path channel from long-end real-yield, inflation-compensation, term-premium/fiscal-supply and global-sovereign channels. A 30Y breakout is first-class evidence that duration pressure has broadened, but do not claim a specific decomposition unless the packet supplies it.
24. GLOBAL LABEL DISCIPLINE: Use "global duration shock" only when supplied non-US sovereign evidence confirms comparable long-end pressure. With strong US evidence but incomplete foreign sovereign confirmation, prefer "US-led duration stress", "duration stress broadening", or similarly bounded language. Put JGB/Bund/gilt confirmation in research_now rather than research_gaps unless the global label itself is required for a material conclusion.
25. CREDIT-BREADTH-VOL CONFIRMATION: Do not equate a Treasury sell-off with systemic risk-off. Test whether credit spreads/proxies, breadth and equity volatility confirm transmission. High MOVE alongside contained VIX and still-tight credit is evidence of a rates-volatility shock with incomplete transmission, not proof of a credit event. Treat surviving AI/semiconductor leadership as a counterweight when supplied evidence supports it.
26. ENERGY-INFLATION TRANSMISSION: When crude and refined-product stress coexist, distinguish geopolitical crude premium from physical product tightness using supplied cracks, curve/backwardation, inventories, refinery utilisation and freight/flow evidence. Rising crude plus product stress can reinforce the inflation/rates channel; do not infer physical scarcity from crude price alone.
27. GOLD-USD CROSS-CHECK: When same-session evidence shows geopolitical risk elevated while gold weakens and USD/real yields strengthen, treat that as evidence that rates/USD are dominating safe-haven demand at that moment. Do not generalise beyond the supplied observation window.
28. RESEARCH-NOW PRIORITY: If the current regime is already defensible, unresolved yield decomposition, MOVE/VIX divergence, HY/IG confirmation, breadth, global sovereign confirmation, oil curve/cracks and summit implementation details belong in investigations[*].missing_evidence and/or research_now, not top-level research_gaps.
29. REGIME FAMILY: main_thread.regime_family is the canonical teaching state for downstream Hybrid. Use RATES_LED_TIGHTENING when rising long/real yields and bond volatility dominate while credit/VIX transmission is incomplete; GROWTH_SCARE_RISK_OFF when falling long yields accompany credit stress, weak breadth and defensive leadership; MIXED_TRANSITION when the evidence is moving between or materially combines those patterns; otherwise UNRESOLVED. This field is Live-owned and must match the prose regime implication.
30. BUNDLED INVESTIGATION AGENDA: One investigation equals one market question, not one dataset. When relevant, use no more than two bundled investigations: (1) whether duration stress is broadening or beginning to transmit, checked with 30Y/curve/real yields, MOVE/VIX, credit, breadth, gold/USD and foreign sovereigns; (2) whether energy keeps the inflation/rates impulse alive, checked with crude curves, cracks, inventories/utilisation, physical stress and verified high-impact event implementation. Use the three Research Now slots for (1) policy-path versus real-yield/inflation/term-premium decomposition, (2) credit/breadth/volatility transmission, and (3) energy structure plus event implementation. Do not publish unverified political outcomes as facts.
31. SYSTEM 1 DOLLAR LIQUIDITY: system1_rate_regime and system1_dollar_liquidity are independent deterministic compression layers. Treat them as triage/context, not standalone facts. Any material conclusion drawn from them must be supported by their supplied underlying evidence_refs. Compare policy/rates with dollar liquidity instead of assuming Fed policy and monetary conditions are identical. A hawkish rate regime plus tightening dollar liquidity is confirmation; a dovish rate regime plus tightening dollar liquidity is a policy/liquidity divergence and should be investigated. If credit remains neutral while rates/USD/funding tighten, describe transmission as incomplete rather than calling a systemic dollar shortage.
32. LIQUIDITY ESCALATION DISCIPLINE: system1_policy_liquidity_interaction tells you whether the compressed state is worth System-2 attention. When escalateToBrain is false, do not create a Major Story or Investigation solely because plumbing data exists. When true, use the supplied question to focus causal reasoning and competing explanations. OFFSHORE_USD is explicitly unresolved until cross-currency-basis/FX-swap evidence exists; never label the current state a complete eurodollar-system measurement.`;
}

export function buildResearchBrainPrompt(input: ResearchBrainInputV1): {
  instructions: string;
  boundedInput: Record<string, unknown>;
} {
  const packet = input.packet;
  const system1PolicyOutlook = buildDossierPolicyOutlook(packet);
  const system1RateRegime = buildDossierRateRegime(packet, system1PolicyOutlook);
  const system1DollarLiquidity = buildSystem1DollarLiquidity(packet);
  const system1PolicyLiquidityInteraction = buildPolicyLiquidityInteraction(
    system1RateRegime,
    system1DollarLiquidity,
  );

  const boundedContext = {
    packet_id: packet.packet_id,
    as_of: packet.as_of,
    previous_dossier_id: packet.previous_dossier_id,
    observed_evidence: compactObservedEvidence(packet),
    rate_context: { evidence: compactRateContext(packet) },
    system1_policy_expectation_checks: buildSystem1PolicyExpectationChecks(packet),
    system1_divergence_candidates: buildSystem1DivergenceCandidates(packet),
    system1_rate_regime: {
      state: system1RateRegime.state,
      score: system1RateRegime.score,
      confidence: system1RateRegime.confidence,
      summary: system1RateRegime.summary,
      curve: system1RateRegime.curve,
      drivers: system1RateRegime.drivers.slice(0, 3),
      contradictions: system1RateRegime.contradictions.slice(0, 2),
      evidence_refs: system1RateRegime.evidenceRefs.slice(0, 8),
    },
    system1_dollar_liquidity: {
      state: system1DollarLiquidity.state,
      score: system1DollarLiquidity.score,
      confidence: system1DollarLiquidity.confidence,
      summary: system1DollarLiquidity.summary,
      components: system1DollarLiquidity.components.map((item) => ({
        key: item.key,
        direction: item.direction,
        score: item.score,
        detail: item.detail,
        evidence_refs: item.evidenceRefs,
      })),
      drivers: system1DollarLiquidity.drivers.slice(0, 3),
      contradictions: system1DollarLiquidity.contradictions.slice(0, 2),
      coverage: system1DollarLiquidity.coverage,
      gaps: system1DollarLiquidity.gaps.slice(0, 2),
      evidence_refs: system1DollarLiquidity.evidenceRefs.slice(0, 8),
    },
    system1_policy_liquidity_interaction: system1PolicyLiquidityInteraction,
    research_leads: compactResearchLeads(packet),
    prior_analytical_state: compactPriorState(packet),
    development_clusters: packet.development_clusters.map((c) => ({
      cluster_id: c.cluster_id,
      grouping_key: c.grouping_key,
      title: c.title,
      summary: c.summary,
      evidence_ids: c.evidence.map((e) => e.evidence_id),
      lead_ids: c.leads.map((l) => l.lead_id),
      conflict_group_id: c.conflict_group_id,
    })),
    creator_themes: packet.creator_themes.map((theme) => ({
      theme_id: theme.theme_id,
      theme_name: theme.theme_name,
      expand_later: theme.expand_later,
      claims: theme.claims.map((claim) => ({
        claim_id: claim.claim_id,
        text: claim.text,
        creator_id: claim.creator_id,
        available_at: claim.available_at,
        provenance: compactProvenance(claim.provenance as unknown as Array<Record<string, unknown>>),
      })),
    })),
    catalysts: packet.catalysts.map((catalyst) => ({
      catalyst_id: catalyst.catalyst_id,
      title: catalyst.title,
      event_time: catalyst.event_time,
      available_at: catalyst.available_at,
      impact_level: catalyst.impact_level,
      rank: catalyst.rank,
      provenance: compactProvenance(catalyst.provenance as unknown as Array<Record<string, unknown>>),
    })),
    thesis_ledger: packet.thesis_ledger,
    freshness_warnings: packet.freshness_warnings,
    research_gaps: packet.research_gaps,
  };

  return {
    instructions: buildResearchBrainSystemInstructions(),
    boundedInput: boundedContext,
  };
}

export function buildResearchBrainRepairPrompt(
  invalidOutput: unknown,
  validationErrors: string[],
  packet: DossierV2InputPacket,
): {
  instructions: string;
  boundedInput: Record<string, unknown>;
} {
  const allowedReferenceIndex = {
    packet_id: packet.packet_id,
    as_of: packet.as_of,
    valid_observed_evidence_ids: Array.from(new Set([
      ...(Array.isArray(packet.observed_evidence) ? packet.observed_evidence.map((e) => e.evidence_id) : []),
      ...(Array.isArray(packet.rate_context?.evidence) ? packet.rate_context.evidence.map((e) => e.evidence_id) : []),
    ])),
    valid_research_lead_ids: Array.isArray(packet.research_leads)
      ? packet.research_leads.map((l) => l.lead_id)
      : [],
    valid_prior_claim_ids: Array.isArray(packet.prior_analytical_state?.prior_claims)
      ? packet.prior_analytical_state.prior_claims.map((pc) => pc.claim_id)
      : [],
    valid_thesis_ids: Array.isArray(packet.thesis_ledger?.entries)
      ? packet.thesis_ledger!.entries.map((te) => te.thesis_id)
      : Array.isArray(packet.prior_analytical_state?.thesis_ledger?.entries)
        ? packet.prior_analytical_state.thesis_ledger!.entries.map((te) => te.thesis_id)
        : [],
    valid_creator_claim_ids: Array.isArray(packet.creator_themes)
      ? packet.creator_themes.flatMap((t) => (Array.isArray(t.claims) ? t.claims.map((c) => c.claim_id) : []))
      : [],
    valid_catalyst_ids: Array.isArray(packet.catalysts) ? packet.catalysts.map((c) => c.catalyst_id) : [],
    valid_conflict_group_ids: Array.isArray(packet.observed_evidence)
      ? Array.from(new Set(packet.observed_evidence.map((e) => e.conflict_group_id).filter(Boolean) as string[]))
      : [],
  };

  const repairInstructions = `${buildResearchBrainSystemInstructions()}

REPAIR TASK (STRUCTURAL ONLY):
Your previous output failed deterministic validation with the following ${validationErrors.length} error(s):
${validationErrors.map((err, idx) => `${idx + 1}. ${err}`).join("\n")}

Perform STRUCTURAL REPAIR ONLY on the existing output to fix all listed validation errors.
Use ONLY IDs from the provided allowed_reference_index. Do NOT create new evidence IDs, do NOT reinterpret the market, and do NOT add new analytical claims unless required solely to make existing structure valid.`;

  return {
    instructions: repairInstructions,
    boundedInput: {
      invalid_previous_output: invalidOutput,
      validation_errors: validationErrors,
      allowed_reference_index: allowedReferenceIndex,
    },
  };
}

export function getResearchBrainJsonSchema(): Record<string, unknown> {
  const marketLensSchema = {
    type: "object",
    properties: {
      lens_name: { type: "string" },
      observed_reaction: { type: ["string", "null"] },
      observed_reaction_evidence_refs: { type: "array", items: { type: "string" } },
      interpretation: { type: "string" },
      contradiction_references: { type: "array", items: { type: "string" } },
      unresolved_signals: { type: "array", items: { type: "string" } },
    },
    required: [
      "lens_name",
      "observed_reaction",
      "observed_reaction_evidence_refs",
      "interpretation",
      "contradiction_references",
      "unresolved_signals",
    ],
    additionalProperties: false,
  };

  const marketLensNames = [
    "US_RATES",
    "BONDS",
    "TECH_AI",
    "OIL_WAR_INFLATION",
    "USD",
    "GOLD",
    "CREDIT",
    "BREADTH",
  ];

  const marketLensProperties = Object.fromEntries(
    marketLensNames.map((lensName) => [lensName, marketLensSchema]),
  );

  return {
    type: "object",
    properties: {
      contract_version: { type: "string" },
      packet_id: { type: "string" },
      as_of: { type: "string" },
      main_thread: {
        type: "object",
        properties: {
          thread_id: { type: "string" },
          headline: { type: "string" },
          answer: { type: "string" },
          regime_implication: { type: "string" },
          regime_family: {
            type: "string",
            enum: ["RATES_LED_TIGHTENING", "GROWTH_SCARE_RISK_OFF", "MIXED_TRANSITION", "UNRESOLVED"],
          },
          epistemic_label: {
            type: "string",
            enum: ["OBSERVED", "SUPPORTED", "INFERRED", "SPECULATIVE"],
          },
          evidence_references: { type: "array", items: { type: "string" } },
          supporting_story_ids: { type: "array", items: { type: "string" } },
          contradiction_references: { type: "array", items: { type: "string" } },
          what_would_change_mind: { type: "string" },
        },
        required: [
          "thread_id",
          "headline",
          "answer",
          "regime_implication",
          "regime_family",
          "epistemic_label",
          "evidence_references",
          "supporting_story_ids",
          "contradiction_references",
          "what_would_change_mind",
        ],
        additionalProperties: false,
      },
      major_stories: {
        type: "array",
        maxItems: MAX_MAJOR_STORIES,
        items: {
          type: "object",
          properties: {
            story_id: { type: "string" },
            title: { type: "string" },
            what_changed: { type: "string" },
            why_it_matters: { type: "string" },
            headline_decomposition: { type: "string" },
            causal_mechanism: { type: "string" },
            market_evidence: {
              type: "object",
              properties: {
                confirming: {
                  type: "array",
                  description: "Observed evidence IDs only; copy packet.observed_evidence.evidence_id values verbatim.",
                  items: { type: "string" },
                },
                contradicting: {
                  type: "array",
                  description: "Observed evidence IDs only; copy packet.observed_evidence.evidence_id values verbatim.",
                  items: { type: "string" },
                },
                unresolved: {
                  type: "array",
                  description: "Only supplied observed evidence IDs or research lead IDs. Never prose or invented missing-data IDs.",
                  items: { type: "string" },
                },
              },
              required: ["confirming", "contradicting", "unresolved"],
              additionalProperties: false,
            },
            conclusion: { type: "string" },
            what_would_change_mind: { type: "string" },
            linked_thesis_ids: { type: "array", items: { type: "string" } },
            linked_investigation_ids: { type: "array", items: { type: "string" } },
            linked_chart_task_ids: { type: "array", items: { type: "string" } },
            epistemic_label: {
              type: "string",
              enum: ["OBSERVED", "SUPPORTED", "INFERRED", "SPECULATIVE"],
            },
            evidence_ids: { type: "array", items: { type: "string" } },
          },
          required: [
            "story_id",
            "title",
            "what_changed",
            "why_it_matters",
            "headline_decomposition",
            "causal_mechanism",
            "market_evidence",
            "conclusion",
            "what_would_change_mind",
            "linked_thesis_ids",
            "linked_investigation_ids",
            "linked_chart_task_ids",
            "epistemic_label",
            "evidence_ids",
          ],
          additionalProperties: false,
        },
      },
      chart_investigation_queue: {
        type: "object",
        properties: {
          core: {
            type: "array",
            maxItems: EXACT_CORE_CHARTS,
            items: {
              type: "object",
              properties: {
                chart_id: { type: "string" },
                priority: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
                is_required: { type: "boolean" },
                ticker_or_instrument: { type: "string" },
                instrument_type: { type: "string" },
                timeframe: { type: "string" },
                exact_question: { type: "string" },
                overlay_or_comparison: { type: "string" },
                confirmation_condition: { type: "string" },
                contradiction_condition: { type: "string" },
                linked_story_ids: { type: "array", items: { type: "string" } },
                linked_investigation_ids: { type: "array", items: { type: "string" } },
              },
              required: [
                "chart_id",
                "priority",
                "is_required",
                "ticker_or_instrument",
                "instrument_type",
                "timeframe",
                "exact_question",
                "overlay_or_comparison",
                "confirmation_condition",
                "contradiction_condition",
                "linked_story_ids",
                "linked_investigation_ids",
              ],
              additionalProperties: false,
            },
          },
          optional: {
            type: "array",
            maxItems: MAX_OPTIONAL_CHARTS,
            items: {
              type: "object",
              properties: {
                chart_id: { type: "string" },
                priority: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
                is_required: { type: "boolean" },
                ticker_or_instrument: { type: "string" },
                instrument_type: { type: "string" },
                timeframe: { type: "string" },
                exact_question: { type: "string" },
                overlay_or_comparison: { type: "string" },
                confirmation_condition: { type: "string" },
                contradiction_condition: { type: "string" },
                linked_story_ids: { type: "array", items: { type: "string" } },
                linked_investigation_ids: { type: "array", items: { type: "string" } },
              },
              required: [
                "chart_id",
                "priority",
                "is_required",
                "ticker_or_instrument",
                "instrument_type",
                "timeframe",
                "exact_question",
                "overlay_or_comparison",
                "confirmation_condition",
                "contradiction_condition",
                "linked_story_ids",
                "linked_investigation_ids",
              ],
              additionalProperties: false,
            },
          },
        },
        required: ["core", "optional"],
        additionalProperties: false,
      },
      investigations: {
        type: "array",
        maxItems: MAX_PRIORITY_INVESTIGATIONS,
        items: {
          type: "object",
          properties: {
            investigation_id: { type: "string" },
            question: { type: "string" },
            why_it_matters: { type: "string" },
            current_explanation: { type: "string" },
            expected_reaction: { type: ["string", "null"] },
            observed_reaction: { type: ["string", "null"] },
            divergence: {
              type: "string",
              enum: ["NONE", "PARTIAL", "MATERIAL", "UNRESOLVED"],
            },
            competing_explanations: { type: "array", items: { type: "string" } },
            observed_evidence: { type: "array", items: { type: "string" } },
            missing_evidence: { type: "array", items: { type: "string" } },
            research_next: { type: "string" },
            chart_task_links: { type: "array", items: { type: "string" } },
            confirmation_condition: { type: "string" },
            invalidation_condition: { type: "string" },
            status: {
              type: "string",
              enum: ["open", "strengthened", "weakened", "resolved", "parked"],
            },
            linked_story_ids: { type: "array", items: { type: "string" } },
            linked_thesis_ids: { type: "array", items: { type: "string" } },
            leads_referenced: { type: "array", items: { type: "string" } },
          },
          required: [
            "investigation_id",
            "question",
            "why_it_matters",
            "current_explanation",
            "expected_reaction",
            "observed_reaction",
            "divergence",
            "competing_explanations",
            "observed_evidence",
            "missing_evidence",
            "research_next",
            "chart_task_links",
            "confirmation_condition",
            "invalidation_condition",
            "status",
            "linked_story_ids",
            "linked_thesis_ids",
            "leads_referenced",
          ],
          additionalProperties: false,
        },
      },
      market_verdict: {
        type: "object",
        properties: {
          verdict_id: { type: "string" },
          lenses: {
            type: "object",
            properties: marketLensProperties,
            required: marketLensNames,
            additionalProperties: false,
          },
          cross_asset_readthrough: { type: "string" },
          epistemic_label: {
            type: "string",
            enum: ["OBSERVED", "SUPPORTED", "INFERRED", "SPECULATIVE"],
          },
          dominant_confirmation: { type: "string" },
          dominant_contradiction: { type: "string" },
        },
        required: [
          "verdict_id",
          "lenses",
          "cross_asset_readthrough",
          "epistemic_label",
          "dominant_confirmation",
          "dominant_contradiction",
        ],
        additionalProperties: false,
      },
      research_now: {
        type: "array",
        maxItems: MAX_RESEARCH_NOW_ACTIONS,
        items: {
          type: "object",
          properties: {
            rank: { type: "number" },
            action: { type: "string" },
            reason: { type: "string" },
            expected_information_gain: { type: "string" },
            linked_investigations: { type: "array", items: { type: "string" } },
            linked_stories: { type: "array", items: { type: "string" } },
            blocking_evidence: { type: "array", items: { type: "string" } },
          },
          required: [
            "rank",
            "action",
            "reason",
            "expected_information_gain",
            "linked_investigations",
            "linked_stories",
            "blocking_evidence",
          ],
          additionalProperties: false,
        },
      },
      stock_radar: {
        type: "array",
        maxItems: MAX_STOCK_RADAR_ITEMS,
        items: {
          type: "object",
          properties: {
            symbol: { type: "string" },
            company_name: { type: "string" },
            why_relevant: { type: "string" },
            research_question: { type: "string" },
            linkage_type: {
              type: "string",
              enum: ["LINKED_MAIN_THREAD", "LINKED_MAJOR_STORY"],
            },
            linked_main_thread_or_story_id: { type: "string" },
            confirming_signal: { type: "string" },
            invalidating_signal: { type: "string" },
            evidence_references: { type: "array", items: { type: "string" } },
          },
          required: [
            "symbol",
            "company_name",
            "why_relevant",
            "research_question",
            "linkage_type",
            "linked_main_thread_or_story_id",
            "confirming_signal",
            "invalidating_signal",
            "evidence_references",
          ],
          additionalProperties: false,
        },
      },
      developing_themes: {
        type: "array",
        maxItems: MAX_DEVELOPING_THEMES,
        items: {
          type: "object",
          properties: {
            theme_id: { type: "string" },
            title: { type: "string" },
            summary: { type: "string" },
            supporting_evidence_ids: { type: "array", items: { type: "string" } },
          },
          required: ["theme_id", "title", "summary", "supporting_evidence_ids"],
          additionalProperties: false,
        },
      },
      creator_theme_expansions: {
        type: "array",
        maxItems: MAX_CREATOR_EXPANSIONS,
        items: {
          type: "object",
          properties: {
            theme_id: { type: "string" },
            creator_claims_referenced: { type: "array", items: { type: "string" } },
            synthesis_or_expansion: { type: "string" },
            epistemic_assessment: { type: "string" },
          },
          required: ["theme_id", "creator_claims_referenced", "synthesis_or_expansion", "epistemic_assessment"],
          additionalProperties: false,
        },
      },
      thesis_ledger: {
        type: "object",
        properties: {
          contract_version: {
            type: "string",
            enum: [THESIS_LEDGER_V2_CONTRACT_VERSION],
          },
          entries: {
            type: "array",
            maxItems: MAX_THESIS_LEDGER_ENTRIES,
            items: {
              type: "object",
              properties: {
                thesis_id: { type: "string" },
                contract_version: {
                  type: "string",
                  enum: [THESIS_LEDGER_V2_CONTRACT_VERSION],
                },
                root_thesis_id: { type: "string" },
                parent_thesis_id: { type: ["string", "null"] },
                successor_thesis_id: { type: ["string", "null"] },
                title: { type: "string" },
                statement: { type: "string" },
                state: {
                  type: "string",
                  enum: ["confirmed", "weakened", "invalidated", "unresolved", "evolved"],
                },
                version: { type: "number" },
                created_at: { type: "string" },
                updated_at: { type: "string" },
                lineage: { type: "array", items: { type: "string" } },
                state_reason: { type: "string" },
                current_evidence_refs: { type: "array", items: { type: "string" } },
                observed_market_reaction: { type: ["string", "null"] },
                next_catalyst_or_tripwire: { type: "string" },
              },
              required: [
                "thesis_id",
                "contract_version",
                "root_thesis_id",
                "parent_thesis_id",
                "successor_thesis_id",
                "title",
                "statement",
                "state",
                "version",
                "created_at",
                "updated_at",
                "lineage",
                "state_reason",
                "current_evidence_refs",
                "observed_market_reaction",
                "next_catalyst_or_tripwire",
              ],
              additionalProperties: false,
            },
          },
        },
        required: ["contract_version", "entries"],
        additionalProperties: false,
      },
      contradictions_detected: {
        type: "array",
        maxItems: MAX_CONTRADICTIONS,
        items: {
          type: "object",
          properties: {
            conflict_group_id: { type: "string" },
            summary: { type: "string" },
            conflicting_evidence_ids: { type: "array", items: { type: "string" } },
          },
          required: ["conflict_group_id", "summary", "conflicting_evidence_ids"],
          additionalProperties: false,
        },
      },
      research_gaps: {
        type: "array",
        maxItems: MAX_RESEARCH_GAPS,
        items: {
          type: "object",
          properties: {
            gap_id: { type: "string" },
            category: { type: "string" },
            description: { type: "string" },
            severity: { type: "string", enum: ["MATERIAL", "INFORMATIONAL"] },
            gap_class: { type: "string", enum: ["BLOCKER", "REFINEMENT"] },
            blocking_refs: { type: "array", items: { type: "string" } },
          },
          required: ["gap_id", "category", "description", "severity", "gap_class", "blocking_refs"],
          additionalProperties: false,
        },
      },
      diagnostics: {
        type: "object",
        properties: {
          degraded: { type: "boolean" },
          degradation_reasons: { type: "array", items: { type: "string" } },
          omitted_or_demoted_items: { type: "array", items: { type: "string" } },
          missing_input_categories: { type: "array", items: { type: "string" } },
          model_repair_used: { type: "boolean" },
          notes: { type: "array", items: { type: "string" } },
        },
        required: [
          "degraded",
          "degradation_reasons",
          "omitted_or_demoted_items",
          "missing_input_categories",
          "model_repair_used",
          "notes",
        ],
        additionalProperties: false,
      },
    },
    required: [
      "contract_version",
      "packet_id",
      "as_of",
      "main_thread",
      "major_stories",
      "chart_investigation_queue",
      "investigations",
      "market_verdict",
      "research_now",
      "stock_radar",
      "developing_themes",
      "creator_theme_expansions",
      "thesis_ledger",
      "contradictions_detected",
      "research_gaps",
      "diagnostics",
    ],
    additionalProperties: false,
  };
}
