import {
  MARKET_DOSSIER_V2_CONTRACT_VERSION,
  type MarketDossierV2,
  type MarketDossierV2Input,
} from "./contracts.ts";

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

export function isValidIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.trim() === "") return false;
  const timestamp = Date.parse(value);
  return !Number.isNaN(timestamp);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function validateMarketDossierV2Input(input: unknown): MarketDossierV2Input {
  if (!isPlainObject(input)) {
    throw new Error("Invalid dossier V2 input: expected a plain object.");
  }

  const contractVersion = input.contract_version ?? MARKET_DOSSIER_V2_CONTRACT_VERSION;
  if (typeof contractVersion !== "string" || contractVersion !== MARKET_DOSSIER_V2_CONTRACT_VERSION) {
    throw new Error(`Invalid contract_version: expected "${MARKET_DOSSIER_V2_CONTRACT_VERSION}", got "${String(contractVersion)}".`);
  }

  if (input.id !== undefined && input.id !== null && !isValidUuid(input.id)) {
    throw new Error(`Invalid id: expected UUID string, got "${String(input.id)}".`);
  }

  const previousDossierId = input.previous_dossier_id ?? null;
  if (previousDossierId !== null && !isValidUuid(previousDossierId)) {
    throw new Error(`Invalid previous_dossier_id: expected UUID string or null, got "${String(previousDossierId)}".`);
  }

  if (!isValidIsoTimestamp(input.as_of)) {
    throw new Error(`Invalid as_of timestamp: expected valid ISO string, got "${String(input.as_of)}".`);
  }

  if (!isPlainObject(input.freshness)) {
    throw new Error("Invalid freshness: expected non-null JSON object.");
  }

  if (!Array.isArray(input.research_gaps)) {
    throw new Error("Invalid research_gaps: expected JSON array.");
  }

  if (!isPlainObject(input.payload)) {
    throw new Error("Invalid payload: expected non-null JSON object.");
  }

  return {
    id: input.id as string | undefined,
    contract_version: contractVersion,
    previous_dossier_id: previousDossierId,
    as_of: input.as_of as string,
    freshness: input.freshness,
    research_gaps: input.research_gaps,
    payload: input.payload,
  };
}

export function validateMarketDossierV2Record(record: unknown): MarketDossierV2 {
  if (!isPlainObject(record)) {
    throw new Error("Invalid dossier V2 record: expected a plain object.");
  }

  if (!isValidUuid(record.id)) {
    throw new Error(`Invalid id: expected UUID string, got "${String(record.id)}".`);
  }

  const validatedInput = validateMarketDossierV2Input(record);

  if (!isValidIsoTimestamp(record.created_at)) {
    throw new Error(`Invalid created_at timestamp: expected valid ISO string, got "${String(record.created_at)}".`);
  }

  return {
    id: record.id,
    contract_version: validatedInput.contract_version ?? MARKET_DOSSIER_V2_CONTRACT_VERSION,
    previous_dossier_id: validatedInput.previous_dossier_id ?? null,
    as_of: validatedInput.as_of,
    freshness: validatedInput.freshness,
    research_gaps: validatedInput.research_gaps,
    payload: validatedInput.payload,
    created_at: record.created_at as string,
  };
}
