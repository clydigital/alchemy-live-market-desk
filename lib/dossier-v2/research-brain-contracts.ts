import type { DossierV2InputPacket, ThesisState } from "./input-packet.ts";

export const RESEARCH_BRAIN_CONTRACT_VERSION = "dossier-v2-research-brain/1" as const;
export const RESEARCH_BRAIN_MAX_OUTPUT_BYTES = 120_000;
export const RESEARCH_BRAIN_MAX_OUTPUT_TOKENS = 12_000;
export const RESEARCH_BRAIN_MAX_MAJOR_STORIES = 4;
export const RESEARCH_BRAIN_MAX_INVESTIGATIONS = 2;
export const RESEARCH_BRAIN_MAX_RESEARCH_NOW = 3;
export const RESEARCH_BRAIN_CORE_CHARTS = 3;
export const RESEARCH_BRAIN_MAX_OPTIONAL_CHARTS = 2;
export const RESEARCH_BRAIN_MAX_STOCK_RADAR = 3;
export const RESEARCH_BRAIN_MIN_DEVELOPING_THEMES = 3;
export const RESEARCH_BRAIN_MAX_DEVELOPING_THEMES = 5;
export const RESEARCH_BRAIN_MAX_CREATOR_EXPANSIONS = 2;
export const RESEARCH_BRAIN_MAX_STORY_EVIDENCE = 6;

export type EpistemicLabel = "OBSERVED" | "SUPPORTED" | "INFERRED" | "SPECULATIVE";
export type ClaimStatus = "active" | "unresolved" | "contradicted";
export type InvestigationStatus = "open" | "strengthened" | "weakened" | "resolved" | "parked";

export type EvidenceRef =
  | { kind: "observed_evidence"; id: string }
  | { kind: "research_lead"; id: string }
  | { kind: "prior_claim"; id: string }
  | { kind: "thesis"; id: string; version?: number }
  | { kind: "catalyst"; id: string };

export interface AnalyticalClaim { claim_id: string; text: string; epistemic_label: EpistemicLabel; evidence_refs: EvidenceRef[]; status: ClaimStatus; caveat?: string; }
export interface CausalLink { link_id: string; from: string; relationship: string; to: string; epistemic_label: EpistemicLabel; evidence_refs: EvidenceRef[]; contradiction_refs: EvidenceRef[]; what_would_change_mind: string; }
export interface MainThread { thread_id: string; headline: string; answer: string; regime_implication: string; epistemic_label: EpistemicLabel; evidence_refs: EvidenceRef[]; supporting_story_ids: string[]; contradiction_refs: EvidenceRef[]; what_would_change_mind: string; }
export interface MajorStory { story_id: string; rank: number; title: string; what_changed: AnalyticalClaim; why_it_matters: AnalyticalClaim; headline_decomposition: AnalyticalClaim[]; causal_mechanism: CausalLink[]; market_evidence: { confirming: AnalyticalClaim[]; contradicting: AnalyticalClaim[]; unresolved: AnalyticalClaim[] }; conclusion: AnalyticalClaim; what_would_change_mind: string; linked_thesis_ids: string[]; linked_investigation_ids: string[]; linked_chart_task_ids: string[]; }
export interface Investigation { investigation_id: string; priority: 1 | 2; question: string; why_it_matters: string; current_explanation: AnalyticalClaim | null; competing_explanations: AnalyticalClaim[]; observed_evidence_refs: EvidenceRef[]; missing_evidence: string[]; research_next: string[]; chart_task_ids: string[]; confirmation_condition: string; invalidation_condition: string; status: InvestigationStatus; linked_story_ids: string[]; linked_thesis_ids: string[]; }
export interface ChartInvestigation { chart_task_id: string; priority: number; required: boolean; instrument: string; instrument_type: "ticker" | "ratio" | "spread" | "yield" | "index" | "commodity" | "fx"; timeframe: string; exact_question: string; overlay_or_comparison: string[]; confirm_if: string; contradict_if: string; linked_story_ids: string[]; linked_investigation_ids: string[]; }
export type MarketLens = "us_rates" | "bonds" | "tech_ai" | "oil_war_inflation" | "usd" | "gold" | "credit" | "breadth";
export interface MarketLensVerdict { lens: MarketLens; observed_reaction: AnalyticalClaim | null; interpretation: AnalyticalClaim | null; contradiction_refs: EvidenceRef[]; unresolved_signals: string[]; }
export interface MarketVerdict { summary: string; lenses: MarketLensVerdict[]; cross_asset_readthrough: AnalyticalClaim[]; overall_confidence: EpistemicLabel; dominant_confirmation: string | null; dominant_contradiction: string | null; }
export interface ResearchNow { action_id: string; rank: 1 | 2 | 3; action: string; reason: string; expected_information_gain: string; linked_investigation_ids: string[]; linked_story_ids: string[]; blocking_evidence: string[]; }
export interface ScheduledCatalyst { catalyst_id: string; title: string; event_time: string; why_it_matters: string; linked_story_ids: string[]; linked_thesis_ids: string[]; evidence_refs: EvidenceRef[]; }
export interface ThesisTripwire { tripwire_id: string; description: string; expected_signal: string; linked_thesis_id: string; confirmation_or_invalidation: "confirmation" | "invalidation" | "either"; evidence_refs: EvidenceRef[]; }
export interface InvestigationTrigger { trigger_id: string; description: string; condition: string; linked_investigation_id: string; evidence_refs: EvidenceRef[]; }
export interface StockRadarItem { radar_id: string; rank: 1 | 2 | 3; symbol: string; company_or_name: string; why_relevant: string; research_question: string; linkage_type: "main_thread" | "major_story"; linked_thread_or_story_id: string; confirming_signal: string; invalidating_signal: string; evidence_refs: EvidenceRef[]; recommendation_disclaimer: "research_watch_candidate_not_trade_recommendation"; }
export interface DevelopingTheme { theme_id: string; title: string; description: string; epistemic_label: EpistemicLabel; evidence_refs: EvidenceRef[]; linked_story_ids: string[]; }
export interface CreatorThemeExpansion { theme_id: string; title: string; reason_to_expand_later: string; evidence_refs: EvidenceRef[]; }
export interface ThesisLedgerEntryV2 { thesis_id: string; version: number; name: string; original_view: string; original_evidence_refs: EvidenceRef[]; supporting_arguments: AnalyticalClaim[]; opposing_arguments: AnalyticalClaim[]; what_had_to_happen: string; deciding_catalyst: string | null; current_state: ThesisState; state_reason: AnalyticalClaim; latest_evidence_update: AnalyticalClaim; observed_market_reaction: AnalyticalClaim | null; next_catalyst: string | null; next_tripwire: ThesisTripwire | null; lineage: { root_thesis_id: string; parent_thesis_id: string | null; successor_thesis_id: string | null }; created_at: string; state_changed_at: string; updated_at: string; }
export interface ThesisLedgerV2 { contract_version: "thesis-ledger/2"; entries: ThesisLedgerEntryV2[]; }

export interface ResearchBrainInputV1 { contract_version: typeof RESEARCH_BRAIN_CONTRACT_VERSION; packet: DossierV2InputPacket; runtime?: { model_name?: string; prompt_version?: string; max_output_bytes?: number; max_output_tokens?: number; request_timeout_ms?: number; allow_repair_retry?: boolean }; }
export interface ResearchBrainOutputV1 { contract_version: typeof RESEARCH_BRAIN_CONTRACT_VERSION; packet_id: string; as_of: string; main_thread: MainThread; major_stories: MajorStory[]; investigations: Investigation[]; chart_investigation_queue: { core: ChartInvestigation[]; optional: ChartInvestigation[] }; market_verdict: MarketVerdict; research_now: ResearchNow[]; scheduled_catalysts: ScheduledCatalyst[]; thesis_tripwires: ThesisTripwire[]; investigation_triggers: InvestigationTrigger[]; stock_radar: StockRadarItem[]; developing_themes: DevelopingTheme[]; creator_theme_expansions: CreatorThemeExpansion[]; thesis_ledger: ThesisLedgerV2; unresolved_contradictions: AnalyticalClaim[]; diagnostics: { degraded: boolean; degradation_reasons: string[]; omitted_or_demoted_items: string[]; missing_input_categories: string[]; model_repair_used: boolean; }; }
