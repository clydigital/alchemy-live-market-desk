/**
 * Source-explicit, bounded, private read of the original Legacy Evidence rows.
 * This is NOT canonical Dossier Evidence, source rights approval or public
 * publication. Its sole consumer is an approved owner-authenticated Hybrid
 * instance with a dedicated machine bearer. IDs and content are preserved to
 * avoid rewriting EvidenceGame user reviews.
 */
export const LEGACY_EVIDENCE_CONTRACT = "legacy-owner-evidence/1";
export const LEGACY_EVIDENCE_ROW_LIMIT = 240;
export const LEGACY_EVIDENCE_COLUMNS = [
  "id", "story_id", "source_id", "evidence_type", "claim", "detail",
  "strength", "created_at", "ai_price_stance", "ai_price_reason",
  "chart_series", "judged_asset", "is_active",
] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type EvidenceRow = {
  [K in (typeof LEGACY_EVIDENCE_COLUMNS)[number]]: unknown;
};

export function projectLegacyOwnerEvidence(raw: unknown): {
  contractVersion: typeof LEGACY_EVIDENCE_CONTRACT;
  scope: "OWNER_PRIVATE_ONLY";
  sourceRights: "UNREVIEWED";
  evidenceKind: "LEGACY_NON_CANONICAL";
  rows: EvidenceRow[];
  unlinkedSourceCount: number;
} {
  if (!Array.isArray(raw) || raw.length > LEGACY_EVIDENCE_ROW_LIMIT) {
    throw new Error("Invalid legacy Evidence record count.");
  }
  const seen = new Set<string>();
  const rows: EvidenceRow[] = [];
  let unlinkedSourceCount = 0;
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Invalid legacy Evidence row.");
    const record = item as Record<string, unknown>;
    if (typeof record.id !== "string" || !UUID.test(record.id)
      || typeof record.story_id !== "string" || !UUID.test(record.story_id)
      || (record.source_id != null && (typeof record.source_id !== "string" || !UUID.test(record.source_id)))
      || typeof record.claim !== "string" || !record.claim.trim()
      || typeof record.evidence_type !== "string"
      || typeof record.strength !== "number" || !Number.isFinite(record.strength)
      || typeof record.created_at !== "string" || !Number.isFinite(Date.parse(record.created_at))
      || record.is_active !== true
      || (record.detail != null && typeof record.detail !== "string")
      || (record.ai_price_stance != null && typeof record.ai_price_stance !== "string")
      || (record.ai_price_reason != null && typeof record.ai_price_reason !== "string")
      || (record.judged_asset != null && typeof record.judged_asset !== "string")
      || !Array.isArray(record.chart_series)
      || !record.chart_series.every((v: unknown) => typeof v === "string")
      || seen.has(record.id)) {
      throw new Error("Invalid, duplicated, or inactive legacy Evidence row.");
    }
    seen.add(record.id);
    if (record.source_id == null) unlinkedSourceCount++;
    // Strip unknown database columns. Do not manufacture an original source.
    rows.push(Object.fromEntries(LEGACY_EVIDENCE_COLUMNS.map(field => [field, record[field] ?? null])) as EvidenceRow);
  }
  return {
    contractVersion: LEGACY_EVIDENCE_CONTRACT,
    scope: "OWNER_PRIVATE_ONLY",
    sourceRights: "UNREVIEWED",
    evidenceKind: "LEGACY_NON_CANONICAL",
    rows,
    unlinkedSourceCount,
  };
}

export async function getLegacyOwnerEvidenceRows(): Promise<ReturnType<typeof projectLegacyOwnerEvidence>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Private Evidence source unavailable.");
  const endpoint = new URL("/rest/v1/evidence", url);
  endpoint.searchParams.set("select", LEGACY_EVIDENCE_COLUMNS.join(","));
  endpoint.searchParams.set("is_active", "eq.true");
  endpoint.searchParams.set("order", "strength.desc,created_at.desc");
  endpoint.searchParams.set("limit", String(LEGACY_EVIDENCE_ROW_LIMIT));
  const response = await fetch(endpoint, {
    headers: { apikey: key, Authorization: "Bearer " + key },
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error("Private Evidence source request unavailable.");
  const payload: unknown = await response.json();
  return projectLegacyOwnerEvidence(payload);
}
