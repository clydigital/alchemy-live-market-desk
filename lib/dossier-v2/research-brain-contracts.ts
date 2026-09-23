import type {
  DossierV2InputPacket,
  ResearchGap,
  ThesisArgument,
} from "./input-packet.ts";

export const RESEARCH_BRAIN_CONTRACT_VERSION = "research-brain/1";
export const RESEARCH_BRAIN_INPUT_CONTRACT_VERSION = "research-brain-input/1";
export const THESIS_LEDGER_V2_CONTRACT_VERSION = "thesis-ledger/2";

// Reconciled attention budget caps matching accepted Task 7 design
export const MAX_MAJOR_STORIES = 4;
export const MAX_PRIORITY_INVESTIGATIONS = 2;
export const MAX_RESEARCH_NOW_ACTIONS = 3;
export const EXACT_CORE_CHARTS = 3;
export const MAX_OPTIONAL_CHARTS = 2;
export const MAX_STOCK_RADAR_ITEMS = 3;
export const MIN_DEVELOPING_THEMES = 3;
export const MAX_DEVELOPING_THEMES = 5;
export const MAX_CREATOR_EXPANSIONS = 2;
export const MAX_CONTRADICTIONS = 10;
export const MAX_RESEARCH_GAPS = 12;
export const MAX_OUTPUT_BYTES = 150000;

export type EpistemicLabel = "OBSERVED" | "SUPPORTED" | "INFERRED" | "SPECULATIVE";
export type ThesisStateV2 = "confirmed" | "weakened" | "invalidated" | "unresolved" | "evolved";
export type InvestigationStatus = "open" | "strengthened" | "weakened" | "resolved" | "parked";
export type InvestigationDivergence = "NONE" | "PARTIAL" | "MATERIAL" | "UNRESOLVED";

export interface MainThread {
  thread_id: string;
  headline: string;
  answer: string;
  regime_implication: string;
  epistemic_label: EpistemicLabel;
  evidence_references: string[];
  supporting_story_ids: string[];
  contradiction_references: string[];
  what_would_change_mind: string;
}

export interface MarketEvidenceDecomposition {
  confirming: string[];
  contradicting: string[];
  unresolved: string[];
}

export interface MajorStory {
  story_id: string;
  title: string;
  what_changed: string;
  why_it_matters: string;
  headline_decomposition: string;
  causal_mechanism: string;
  market_evidence: MarketEvidenceDecomposition;
  conclusion: string;
  what_would_change_mind: string;
  linked_thesis_ids: string[];
  linked_investigation_ids: string[];
  linked_chart_task_ids: string[];
  epistemic_label: EpistemicLabel;
  evidence_ids: string[];
}

export interface ChartTask {
  chart_id: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  is_required: boolean;
  ticker_or_instrument: string;
  instrument_type: "EQUITY" | "BOND" | "COMMODITY" | "FX" | "CRYPTO" | "SPREAD" | "RATIO" | "YIELD" | string;
  timeframe: string;
  exact_question: string;
  overlay_or_comparison?: string;
  confirmation_condition: string;
  contradiction_condition: string;
  linked_story_ids: string[];
  linked_investigation_ids: string[];
}

export interface ChartInvestigationQueue {
  core: ChartTask[];
  optional: ChartTask[];
}

export interface MarketLens {
  lens_name: "US_RATES" | "BONDS" | "TECH_AI" | "OIL_WAR_INFLATION" | "USD" | "GOLD" | "CREDIT" | "BREADTH" | string;
  observed_reaction: string | null;
  observed_reaction_evidence_refs: string[];
  interpretation: string;
  contradiction_references: string[];
  unresolved_signals: string[];
}

export interface MarketVerdict {
  verdict_id: string;
  lenses: Record<string, MarketLens>;
  cross_asset_readthrough: string;
  epistemic_label: EpistemicLabel;
  dominant_confirmation: string;
  dominant_contradiction: string;
}

export interface Investigation {
  investigation_id: string;
  question: string;
  why_it_matters: string;
  current_explanation: string;
  expected_reaction: string | null;
  observed_reaction: string | null;
  divergence: InvestigationDivergence;
  competing_explanations: string[];
  observed_evidence: string[];
  missing_evidence: string[];
  research_next: string;
  chart_task_links: string[];
  confirmation_condition: string;
  invalidation_condition: string;
  status: InvestigationStatus;
  linked_story_ids: string[];
  linked_thesis_ids: string[];
  leads_referenced?: string[];
}

export interface StockRadarItem {
  symbol: string;
  company_name: string;
  why_relevant: string;
  research_question: string;
  linkage_type: "LINKED_MAIN_THREAD" | "LINKED_MAJOR_STORY";
  linked_main_thread_or_story_id: string;
  confirming_signal: string;
  invalidating_signal: string;
  evidence_references: string[];
}

export interface DevelopingTheme {
  theme_id: string;
  title: string;
  summary: string;
  supporting_evidence_ids: string[];
}

export interface CreatorThemeExpansion {
  theme_id: string;
  creator_claims_referenced: string[];
  synthesis_or_expansion: string;
  epistemic_assessment: string;
}

export interface ThesisLedgerEntryV2 {
  thesis_id: string;
  contract_version: typeof THESIS_LEDGER_V2_CONTRACT_VERSION | string;
  root_thesis_id: string;
  parent_thesis_id: string | null;
  successor_thesis_id: string | null;
  title: string;
  statement: string;
  state: ThesisStateV2;
  version: number;
  created_at: string;
  updated_at: string;
  lineage: string[];
  state_reason: string;
  current_evidence_refs: string[];
  observed_market_reaction: string | null;
  next_catalyst_or_tripwire: string;
  arguments?: ThesisArgument[];
}

export interface ThesisLedgerV2 {
  contract_version: typeof THESIS_LEDGER_V2_CONTRACT_VERSION | string;
  entries: ThesisLedgerEntryV2[];
}

export interface ContradictionDetected {
  conflict_group_id: string;
  summary: string;
  conflicting_evidence_ids: string[];
}

export interface ResearchNowAction {
  rank: number;
  action: string;
  reason: string;
  expected_information_gain: string;
  linked_investigations: string[];
  linked_stories: string[];
  blocking_evidence: string[];
}

export interface ResearchBrainDiagnostics {
  degraded: boolean;
  degradation_reasons: string[];
  omitted_or_demoted_items: string[];
  missing_input_categories: string[];
  model_repair_used: boolean;
  notes: string[];
}

export interface ResearchBrainOutputV1 {
  contract_version: typeof RESEARCH_BRAIN_CONTRACT_VERSION | string;
  packet_id: string;
  as_of: string;
  main_thread: MainThread;
  major_stories: MajorStory[];
  chart_investigation_queue: ChartInvestigationQueue;
  investigations: Investigation[];
  market_verdict: MarketVerdict;
  research_now: ResearchNowAction[];
  stock_radar: StockRadarItem[];
  developing_themes: DevelopingTheme[];
  creator_theme_expansions: CreatorThemeExpansion[];
  thesis_ledger: ThesisLedgerV2;
  contradictions_detected: ContradictionDetected[];
  research_gaps: ResearchGap[];
  diagnostics: ResearchBrainDiagnostics;
}

export interface ResearchBrainInputV1 {
  contract_version?: typeof RESEARCH_BRAIN_INPUT_CONTRACT_VERSION | string;
  as_of: string;
  packet: DossierV2InputPacket;
}
