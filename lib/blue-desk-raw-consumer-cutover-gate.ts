/**
 * P-1 read-side permission cutover gate. A readiness declaration is never
 * inferred from a green build, a removed public nav item or an empty API
 * response. Every proof is separately attested during release review.
 *
 * No SQL, API route, database mutation or automatic RLS/grant change.
 */
export const RAW_LEGACY_TABLES = [
  "evidence",
  "research_source_registry",
  "research_schedule_slots",
] as const;

export const LEGACY_EVIDENCE_UNAPPROVED_FIELDS = [
  "claim", "detail", "ai_price_reason", "ai_price_stance",
  "chart_series", "judged_asset",
] as const;

export type RawConsumerCutoverProof = {
  liveReadersMigrated: boolean;
  hybridReadersMigrated: boolean;
  gameAndJourneyParityVerified: boolean;
  originalSourceLicencesApproved: boolean;
  currentAndExactArchiveVerified: boolean;
  ownerSessionPositiveVerified: boolean;
  machineBearerPositiveVerified: boolean;
  anonDeniedAndOwnerPermittedVerified: boolean;
  rollbackTested: boolean;
  privilegedGrantOwnerReviewed: boolean;
};

export const REQUIRED_RAW_CUTOVER_PROOFS: readonly (keyof RawConsumerCutoverProof)[] = [
  "liveReadersMigrated",
  "hybridReadersMigrated",
  "gameAndJourneyParityVerified",
  "originalSourceLicencesApproved",
  "currentAndExactArchiveVerified",
  "ownerSessionPositiveVerified",
  "machineBearerPositiveVerified",
  "anonDeniedAndOwnerPermittedVerified",
  "rollbackTested",
  "privilegedGrantOwnerReviewed",
] as const;

export function assessRawConsumerCutover(
  proof: Partial<RawConsumerCutoverProof>,
): { status: "BLOCKED" | "READY_FOR_AUTHORISED_REVIEW"; missing: (keyof RawConsumerCutoverProof)[] } {
  const missing = REQUIRED_RAW_CUTOVER_PROOFS.filter(key => proof[key] !== true);
  return {
    status: missing.length ? "BLOCKED" : "READY_FOR_AUTHORISED_REVIEW",
    missing,
  };
}

/**
 * Diagnostic-only aggregate. Does not return claims, names, source URLs,
 * chart points, AI interpretation text or raw row content.
 */
export function summariseLegacyEvidenceExposure(rows: readonly Record<string, unknown>[]) {
  return {
    totalRows: rows.length,
    activeRows: rows.filter(row => row.is_active === true).length,
    rowsWithoutSourceId: rows.filter(row => row.source_id == null).length,
    rowsWithAIPriceReason: rows.filter(row =>
      typeof row.ai_price_reason === "string" && row.ai_price_reason.trim().length > 0).length,
    rowsWithDetail: rows.filter(row =>
      typeof row.detail === "string" && row.detail.trim().length > 0).length,
    rowsWithChartSeries: rows.filter(row =>
      Array.isArray(row.chart_series) && row.chart_series.length > 0).length,
    publicationApproved: false as const,
  };
}
