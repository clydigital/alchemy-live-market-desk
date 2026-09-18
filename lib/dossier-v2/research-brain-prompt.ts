import type { ResearchBrainInputV1 } from "./research-brain-contracts.ts";
import { RESEARCH_BRAIN_CONTRACT_VERSION } from "./research-brain-contracts.ts";

export const RESEARCH_BRAIN_PROMPT_VERSION = "research-brain-prompt/1" as const;
export const RESEARCH_BRAIN_INSTRUCTIONS = `You are the Dossier V2 Research Brain. Perform one bounded analytical pass and return only the requested JSON schema.

Epistemic firewall:
- Current facts come only from packet.observed_evidence and are OBSERVED.
- packet.research_leads are questions or leads, never facts and never current evidence.
- packet.prior_analytical_state and packet.thesis_ledger are historical analytical state, never current evidence.
- Every material analytical claim must cite supplied IDs. Never invent IDs or market reactions.
- Preserve conflicting evidence visibly. If evidence is weak, use INFERRED or SPECULATIVE and move the matter to an investigation or unresolved contradiction.
- Do not output numerical probabilities or trade recommendations.

Attention limits: one Main Thread; at most four Major Stories; at most two Investigations; at most three Research Now actions; three core chart tasks and at most two optional tasks; at most three Stock Radar names; three to five developing themes; at most two creator expansions. Do not include transcript bodies, raw acquisition payloads, or legacy multi-stage outputs.`;

export function buildResearchBrainModelContext(input: ResearchBrainInputV1) {
  const packet = input.packet;
  return { contract_version: RESEARCH_BRAIN_CONTRACT_VERSION, prompt_version: RESEARCH_BRAIN_PROMPT_VERSION, as_of: packet.as_of, packet_id: packet.packet_id, observed_evidence: packet.observed_evidence, research_leads: packet.research_leads, prior_analytical_state: packet.prior_analytical_state, development_clusters: packet.development_clusters, creator_themes: packet.creator_themes.map(({ claims: _claims, ...theme }) => theme), catalysts: packet.catalysts, freshness_warnings: packet.freshness_warnings, research_gaps: packet.research_gaps, diagnostics: packet.diagnostics, limits: { main_thread: 1, major_stories: 4, investigations: 2, research_now: 3, core_charts: 3, optional_charts: 2, stock_radar: 3, developing_themes: [3, 5], creator_expansions: 2 } };
}

export const RESEARCH_BRAIN_JSON_SCHEMA: Record<string, unknown> = { type: "object", additionalProperties: true, required: ["contract_version", "packet_id", "as_of", "main_thread", "major_stories", "investigations", "chart_investigation_queue", "market_verdict", "research_now", "scheduled_catalysts", "thesis_tripwires", "investigation_triggers", "stock_radar", "developing_themes", "creator_theme_expansions", "thesis_ledger", "unresolved_contradictions", "diagnostics"], properties: {} };
