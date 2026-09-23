import type { DossierV2InputPacket } from "./input-packet.ts";
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
import { buildSystem1DivergenceCandidates } from "./system1-divergence.ts";


function compactProvenance(refs: Array<Record<string, unknown>> | undefined) {
  return (refs ?? []).map((ref) => ({
    source_type: ref.source_type,
    source_id: ref.source_id,
    publisher: ref.publisher,
  }));
}

function compactObservedEvidence(packet: DossierV2InputPacket) {
  return packet.observed_evidence.map((e) => ({
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
1. Current facts come ONLY from packet.observed_evidence.
2. Research leads (packet.research_leads) are questions/leads, NOT facts. Do not convert leads to facts without corresponding observed_evidence.
3. Prior analytical claims and prior Thesis Ledger entries are historical state, NOT current facts.
4. Every material analytical claim must reference supplied evidence_ids from packet.observed_evidence.
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
12. OUTPUT DISCIPLINE: this is a bounded decision dossier, not a transcript. Keep prose compact and non-repetitive. Most narrative fields should be one or two sentences. Evidence/source IDs belong ONLY in dedicated reference arrays and audit metadata. NEVER write raw evidence IDs, source IDs, UUIDs, filenames, ingestion keys, provider handles, or strings such as "ASDA-file..." into reader-facing prose fields. Do not add parenthetical source-key dumps after sentences. Write the analytical point in normal language; provenance is rendered separately by Live/Hybrid. Do not repeat the same causal explanation across main_thread, major_stories, market_verdict, investigations and developing_themes unless the field requires a distinct conclusion.\n13. SYSTEM 1 DIVERGENCE SCREEN: system1_divergence_candidates are deterministic triage signals derived from simple expected-vs-observed relationships. They are NOT independent facts, causal conclusions or proof of mispricing. Use them only to prioritise investigation when both referenced evidence IDs support the setup. Do not force an explanation; UNKNOWN or unresolved remains valid. An absent candidate does not mean the relationship was confirmed.\n14. REFERENCE FIELDS ARE ID-ONLY: major_stories[*].market_evidence.confirming and .contradicting may contain ONLY IDs copied verbatim from packet.observed_evidence.evidence_id. major_stories[*].market_evidence.unresolved may contain ONLY supplied packet.observed_evidence.evidence_id values or packet.research_leads.lead_id values. Never place prose, missing-data descriptions, chart questions, or invented IDs in those arrays. Put missing-data prose in investigations[*].missing_evidence, research_now, or research_gaps instead.\n15. THESIS LEDGER V2: output thesis_ledger.contract_version and every thesis_ledger.entries[*].contract_version MUST equal "${THESIS_LEDGER_V2_CONTRACT_VERSION}", even when prior packet state uses thesis-ledger/1. Use state "evolved" ONLY when both predecessor and successor entries are present in the output ledger, predecessor.successor_thesis_id points to the successor, successor.parent_thesis_id points back to the predecessor, both share root_thesis_id, and successor.version is greater than predecessor.version. Otherwise do not use "evolved"; use the evidence-supported non-evolved state and keep successor_thesis_id null.\n16. DIVERGENCE V1 LIVES ONLY INSIDE PRIORITY INVESTIGATIONS: expected_reaction is the conventional or packet-supported market reaction being tested, not an observed fact. observed_reaction must describe only supplied market/pricing evidence and must be NULL when such evidence is unavailable. Set divergence to MATERIAL only when the observed reaction materially conflicts with the expected reaction, PARTIAL when the reaction is mixed/incomplete, NONE only when both expectation and observed reaction are present and materially aligned, and UNRESOLVED when either side cannot be established reliably. A System 1 candidate may prioritise the investigation but must not force a divergence label or causal explanation.`;
}

export function buildResearchBrainPrompt(input: ResearchBrainInputV1): {
  instructions: string;
  boundedInput: Record<string, unknown>;
} {
  const packet = input.packet;

  const boundedContext = {
    packet_id: packet.packet_id,
    as_of: packet.as_of,
    previous_dossier_id: packet.previous_dossier_id,
    observed_evidence: compactObservedEvidence(packet),
    system1_divergence_candidates: buildSystem1DivergenceCandidates(packet),
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
    valid_observed_evidence_ids: Array.isArray(packet.observed_evidence)
      ? packet.observed_evidence.map((e) => e.evidence_id)
      : [],
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
        items: {
          type: "object",
          properties: {
            gap_id: { type: "string" },
            category: { type: "string" },
            description: { type: "string" },
            severity: { type: "string" },
          },
          required: ["gap_id", "category", "description", "severity"],
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