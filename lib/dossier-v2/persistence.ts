import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "../supabase/admin.ts";
import {
  MARKET_DOSSIER_V2_CONTRACT_VERSION,
  type MarketDossierV2,
  type MarketDossierV2Input,
} from "./contracts.ts";
import {
  isValidUuid,
  validateMarketDossierV2Input,
  validateMarketDossierV2Record,
} from "./validation.ts";

export async function persistMarketDossierV2(
  input: MarketDossierV2Input,
  client?: SupabaseClient,
): Promise<MarketDossierV2> {
  const validated = validateMarketDossierV2Input(input);
  const dbClient = client ?? createSupabaseAdminClient();

  const insertPayload: Record<string, unknown> = {
    contract_version: validated.contract_version ?? MARKET_DOSSIER_V2_CONTRACT_VERSION,
    previous_dossier_id: validated.previous_dossier_id ?? null,
    as_of: validated.as_of,
    freshness: JSON.parse(JSON.stringify(validated.freshness)),
    research_gaps: JSON.parse(JSON.stringify(validated.research_gaps)),
    payload: JSON.parse(JSON.stringify(validated.payload)),
  };

  if (validated.id) {
    insertPayload.id = validated.id;
  }

  const { data, error } = await dbClient
    .from("market_dossiers_v2")
    .insert(insertPayload)
    .select("id, contract_version, previous_dossier_id, as_of, freshness, research_gaps, payload, created_at")
    .single();

  if (error) {
    throw new Error(`Failed to persist MarketDossierV2: ${error.message}`);
  }

  if (!data) {
    throw new Error("Failed to persist MarketDossierV2: No record returned from database.");
  }

  return validateMarketDossierV2Record(data);
}

export async function getMarketDossierV2ById(
  id: string,
  client?: SupabaseClient,
): Promise<MarketDossierV2 | null> {
  if (!isValidUuid(id)) {
    throw new Error(`Invalid dossier ID: expected UUID string, got "${String(id)}".`);
  }

  const dbClient = client ?? createSupabaseAdminClient();

  const { data, error } = await dbClient
    .from("market_dossiers_v2")
    .select("id, contract_version, previous_dossier_id, as_of, freshness, research_gaps, payload, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to retrieve MarketDossierV2 by ID: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return validateMarketDossierV2Record(data);
}
