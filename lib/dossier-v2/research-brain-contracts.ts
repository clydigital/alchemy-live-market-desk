import type {
  DossierV2InputPacket,
  ResearchGap,
  ThesisArgument,
  ThesisState,
} from "./input-packet.ts";

export const RESEARCH_BRAIN_CONTRACT_VERSION = "research-brain/1";
export const RESEARCH_BRAIN_INPUT_CONTRACT_VERSION = "research-brain-input/1";
export const THESIS_LEDGER_V2_CONTRACT_VERSION = "thesis-ledger/2";

export const MAX_MAJOR_STORIES = 6;
export const MAX_CLAIMS_PER_STORY = 10;
export const MAX_CAUSAL_LINKS_PER_STORY = 8;
export const MAX_INVESTIGATIONS = 8;
export const MAX_CHART_TASKS_PER_INVESTIGATION = 5;
export const MAX_STOCK_RADAR_ITEMS = 10;
export const MAX_DEVELOPING_THEMES = 8;
export const MAX_CREATOR_EXPANSIONS = 5;
export const MAX_CONTRADICTIONS = 10;
export const MAX_RESEARCH_GAPS = 12;
export const MAX_CLAIM_TEXT_LENGTH = 1000;
export const MAX_SUMMARY_TEXT_LENGTH = 2000;
export const MAX_OUTPUT_BYTES = 150000;

export type EpistemicLabel = "OBSERVED" | "SUPPORTED" | "INFERRED" | "SPECULATIVE";

export interface AnalyticalClaim {
  claim_id: string;
  epistemic_label: EpistemicLabel;
  claim_text: string;
  evidence_ids: string[];
  prior_claim_ids?: string[];
  reasoning_summary?: string;
}

export interface CausalLink {
  link_id: string;
  cause_claim_id: string;
  effect_claim_id: string;
  mechanism_summary: string;
  evidence_ids: string[];
}

export interface MajorStory {
  story_id: string;
  title: string;
  summary: string;
  core_claims: AnalyticalClaim[];
  causal_links: CausalLink[];
  catalysts?: string[];
  tripwires?: string[];
  confidence_score?: number;
  evidence_ids: string[];
}

export interface MainThread {
  thread_id: string;
  title: string;
  summary: string;
  primary_story_ids: string[];
  dominant_macro_driver?: string;
}

export interface ChartInvestigation {
  chart_id: string;
  symbol_or_instrument: string;
  timeframe: string;
  metric_or_relationship: string;
  hypothesis_to_test: string;
}

export interface Investigation {
  investigation_id: string;
  title: string;
  trigger_reason: string;
  key_questions: string[];
  evidence_ids: string[];
  leads_referenced?: string[];
  chart_tasks?: ChartInvestigation[];
}

export interface MarketVerdict {
  verdict_id: string;
  regime_summary: string;
  dominant_drivers: string[];
  key_risks: string[];
}

export interface ResearchNow {
  summary_now: string;
  actionable_takeaways: string[];
  immediate_catalysts: string[];
}

export interface StockRadarItem {
  symbol: string;
  company_or_asset: string;
  radar_type: "BULLISH" | "BEARISH" | "WATCH" | string;
  thesis_summary: string;
  supporting_claim_ids: string[];
  evidence_ids: string[];
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
  title: string;
  statement: string;
  state: ThesisState;
  version: number;
  created_at: string;
  updated_at: string;
  lineage: string[];
  supporting_claim_ids: string[];
  counter_claim_ids: string[];
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

export interface ResearchBrainOutputV1 {
  contract_version: typeof RESEARCH_BRAIN_CONTRACT_VERSION | string;
  as_of: string;
  is_degraded?: boolean;
  degraded_reason?: string;
  main_thread: MainThread | null;
  major_stories: MajorStory[];
  investigations: Investigation[];
  market_verdict: MarketVerdict;
  research_now: ResearchNow;
  stock_radar: StockRadarItem[];
  developing_themes: DevelopingTheme[];
  creator_theme_expansions: CreatorThemeExpansion[];
  thesis_ledger: ThesisLedgerV2;
  contradictions_detected: ContradictionDetected[];
  research_gaps: ResearchGap[];
}

export interface ResearchBrainInputV1 {
  contract_version?: typeof RESEARCH_BRAIN_INPUT_CONTRACT_VERSION | string;
  as_of: string;
  packet: DossierV2InputPacket;
}
