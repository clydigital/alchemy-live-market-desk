export const MARKET_DOSSIER_V2_CONTRACT_VERSION = "market-dossier-v2/1";

export interface MarketDossierV2Input {
  id?: string;
  contract_version?: string;
  previous_dossier_id?: string | null;
  as_of: string;
  freshness: Record<string, unknown>;
  research_gaps: unknown[];
  payload: Record<string, unknown>;
}

export interface MarketDossierV2 {
  id: string;
  contract_version: string;
  previous_dossier_id: string | null;
  as_of: string;
  freshness: Record<string, unknown>;
  research_gaps: unknown[];
  payload: Record<string, unknown>;
  created_at: string;
}
