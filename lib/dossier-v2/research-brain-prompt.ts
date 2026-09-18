import type { DossierV2InputPacket } from "./input-packet.ts";
import {
  MAX_CAUSAL_LINKS_PER_STORY,
  MAX_CHART_TASKS_PER_INVESTIGATION,
  MAX_CLAIMS_PER_STORY,
  MAX_CONTRADICTIONS,
  MAX_CREATOR_EXPANSIONS,
  MAX_DEVELOPING_THEMES,
  MAX_INVESTIGATIONS,
  MAX_MAJOR_STORIES,
  MAX_RESEARCH_GAPS,
  MAX_STOCK_RADAR_ITEMS,
  RESEARCH_BRAIN_CONTRACT_VERSION,
} from "./research-brain-contracts.ts";
import type { ResearchBrainInputV1 } from "./research-brain-contracts.ts";

export function buildResearchBrainSystemInstructions(): string {
  return `You are the Dossier V2 Research Brain for the Live Market Desk. Your job is to analyze the input packet and produce a structured, validated market dossier analysis matching contract version "${RESEARCH_BRAIN_CONTRACT_VERSION}".

EPISTEMIC BOUNDARIES (STRICTLY ENFORCED):
1. Current facts come ONLY from packet.observed_evidence.
2. Research leads (packet.research_leads) are questions/leads, NOT facts. You must NOT treat research leads or questions as facts or convert them directly to OBSERVED evidence without corresponding observed_evidence IDs.
3. Prior analytical claims (packet.prior_analytical_state.prior_claims) and prior Thesis Ledger entries are historical analytical state, NOT current facts.
4. Every material analytical claim must reference supplied evidence_ids from packet.observed_evidence or prior_claim_ids from packet.prior_analytical_state.
5. Missing market reactions or asset price moves must NOT be invented. If price data is absent or stale, state that market reaction is unobserved/unverified.
6. Conflicting evidence (indicated by conflict_group_id) MUST remain visible in contradictions_detected. Do not silently suppress or resolve conflicts without new evidence.
7. NO numerical probability claims (e.g. "75% probability", "80% chance", "p=0.05"). Express uncertainty using epistemic labels (OBSERVED, SUPPORTED, INFERRED, SPECULATIVE) or qualitative terms.
8. Stock radar items MUST link to supporting claim IDs or evidence IDs.
9. Chart tasks in investigations MUST specify concrete instruments, timeframes, metrics, and testable hypotheses. Never use vague placeholders like "TBD", "chart", "N/A", or "TODO".
10. Respect all attention budget limits:
    - major_stories: max ${MAX_MAJOR_STORIES}
    - core_claims per story: max ${MAX_CLAIMS_PER_STORY}
    - causal_links per story: max ${MAX_CAUSAL_LINKS_PER_STORY}
    - investigations: max ${MAX_INVESTIGATIONS}
    - chart_tasks per investigation: max ${MAX_CHART_TASKS_PER_INVESTIGATION}
    - stock_radar items: max ${MAX_STOCK_RADAR_ITEMS}
    - developing_themes: max ${MAX_DEVELOPING_THEMES}
    - creator_theme_expansions: max ${MAX_CREATOR_EXPANSIONS}
    - contradictions_detected: max ${MAX_CONTRADICTIONS}
    - research_gaps: max ${MAX_RESEARCH_GAPS}`;
}

export function buildResearchBrainPrompt(input: ResearchBrainInputV1): {
  instructions: string;
  boundedInput: Record<string, unknown>;
} {
  const packet = input.packet;

  const boundedContext = {
    as_of: packet.as_of,
    previous_dossier_id: packet.previous_dossier_id,
    observed_evidence: packet.observed_evidence,
    research_leads: packet.research_leads,
    prior_analytical_state: packet.prior_analytical_state,
    development_clusters: packet.development_clusters.map((c) => ({
      cluster_id: c.cluster_id,
      grouping_key: c.grouping_key,
      title: c.title,
      summary: c.summary,
      evidence_ids: c.evidence.map((e) => e.evidence_id),
      lead_ids: c.leads.map((l) => l.lead_id),
      conflict_group_id: c.conflict_group_id,
    })),
    creator_themes: packet.creator_themes,
    catalysts: packet.catalysts,
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
): {
  instructions: string;
  boundedInput: Record<string, unknown>;
} {
  const repairInstructions = `${buildResearchBrainSystemInstructions()}

REPAIR TASK:
Your previous output failed deterministic validation with the following ${validationErrors.length} error(s):
${validationErrors.map((err, idx) => `${idx + 1}. ${err}`).join("\n")}

Repair the existing JSON output to fix ALL validation errors listed above. Maintain the existing analysis where valid, but fix all ID references, epistemic labels, attention caps, or missing fields as instructed. DO NOT perform a second independent analysis; repair the provided output.`;

  return {
    instructions: repairInstructions,
    boundedInput: {
      invalid_previous_output: invalidOutput,
      validation_errors: validationErrors,
    },
  };
}

export function getResearchBrainJsonSchema(): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      contract_version: { type: "string" },
      as_of: { type: "string" },
      is_degraded: { type: "boolean" },
      degraded_reason: { type: "string" },
      main_thread: {
        type: ["object", "null"],
        properties: {
          thread_id: { type: "string" },
          title: { type: "string" },
          summary: { type: "string" },
          primary_story_ids: { type: "array", items: { type: "string" } },
          dominant_macro_driver: { type: "string" },
        },
        required: ["thread_id", "title", "summary", "primary_story_ids"],
        additionalProperties: false,
      },
      major_stories: {
        type: "array",
        items: {
          type: "object",
          properties: {
            story_id: { type: "string" },
            title: { type: "string" },
            summary: { type: "string" },
            confidence_score: { type: "number" },
            evidence_ids: { type: "array", items: { type: "string" } },
            catalysts: { type: "array", items: { type: "string" } },
            tripwires: { type: "array", items: { type: "string" } },
            core_claims: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  claim_id: { type: "string" },
                  epistemic_label: {
                    type: "string",
                    enum: ["OBSERVED", "SUPPORTED", "INFERRED", "SPECULATIVE"],
                  },
                  claim_text: { type: "string" },
                  evidence_ids: { type: "array", items: { type: "string" } },
                  prior_claim_ids: { type: "array", items: { type: "string" } },
                  reasoning_summary: { type: "string" },
                },
                required: ["claim_id", "epistemic_label", "claim_text", "evidence_ids"],
                additionalProperties: false,
              },
            },
            causal_links: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  link_id: { type: "string" },
                  cause_claim_id: { type: "string" },
                  effect_claim_id: { type: "string" },
                  mechanism_summary: { type: "string" },
                  evidence_ids: { type: "array", items: { type: "string" } },
                },
                required: ["link_id", "cause_claim_id", "effect_claim_id", "mechanism_summary", "evidence_ids"],
                additionalProperties: false,
              },
            },
          },
          required: ["story_id", "title", "summary", "evidence_ids", "core_claims", "causal_links"],
          additionalProperties: false,
        },
      },
      investigations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            investigation_id: { type: "string" },
            title: { type: "string" },
            trigger_reason: { type: "string" },
            key_questions: { type: "array", items: { type: "string" } },
            evidence_ids: { type: "array", items: { type: "string" } },
            leads_referenced: { type: "array", items: { type: "string" } },
            chart_tasks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  chart_id: { type: "string" },
                  symbol_or_instrument: { type: "string" },
                  timeframe: { type: "string" },
                  metric_or_relationship: { type: "string" },
                  hypothesis_to_test: { type: "string" },
                },
                required: ["chart_id", "symbol_or_instrument", "timeframe", "metric_or_relationship", "hypothesis_to_test"],
                additionalProperties: false,
              },
            },
          },
          required: ["investigation_id", "title", "trigger_reason", "key_questions", "evidence_ids"],
          additionalProperties: false,
        },
      },
      market_verdict: {
        type: "object",
        properties: {
          verdict_id: { type: "string" },
          regime_summary: { type: "string" },
          dominant_drivers: { type: "array", items: { type: "string" } },
          key_risks: { type: "array", items: { type: "string" } },
        },
        required: ["verdict_id", "regime_summary", "dominant_drivers", "key_risks"],
        additionalProperties: false,
      },
      research_now: {
        type: "object",
        properties: {
          summary_now: { type: "string" },
          actionable_takeaways: { type: "array", items: { type: "string" } },
          immediate_catalysts: { type: "array", items: { type: "string" } },
        },
        required: ["summary_now", "actionable_takeaways", "immediate_catalysts"],
        additionalProperties: false,
      },
      stock_radar: {
        type: "array",
        items: {
          type: "object",
          properties: {
            symbol: { type: "string" },
            company_or_asset: { type: "string" },
            radar_type: { type: "string" },
            thesis_summary: { type: "string" },
            supporting_claim_ids: { type: "array", items: { type: "string" } },
            evidence_ids: { type: "array", items: { type: "string" } },
          },
          required: ["symbol", "company_or_asset", "radar_type", "thesis_summary", "supporting_claim_ids", "evidence_ids"],
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
          contract_version: { type: "string" },
          entries: {
            type: "array",
            items: {
              type: "object",
              properties: {
                thesis_id: { type: "string" },
                contract_version: { type: "string" },
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
                supporting_claim_ids: { type: "array", items: { type: "string" } },
                counter_claim_ids: { type: "array", items: { type: "string" } },
              },
              required: [
                "thesis_id",
                "contract_version",
                "title",
                "statement",
                "state",
                "version",
                "created_at",
                "updated_at",
                "lineage",
                "supporting_claim_ids",
                "counter_claim_ids",
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
    },
    required: [
      "contract_version",
      "as_of",
      "main_thread",
      "major_stories",
      "investigations",
      "market_verdict",
      "research_now",
      "stock_radar",
      "developing_themes",
      "creator_theme_expansions",
      "thesis_ledger",
      "contradictions_detected",
      "research_gaps",
    ],
    additionalProperties: false,
  };
}
