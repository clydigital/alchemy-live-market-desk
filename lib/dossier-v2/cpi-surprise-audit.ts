import type { DossierV2InputPacket, ObservedEvidence } from "./input-packet.ts";

export type CpiSurpriseAuditItem = {
  evidence_id: string;
  measure: "HEADLINE_MOM" | "CORE_MOM" | "UNCLASSIFIED";
  observed_pct: number;
  expected_pct: number | null;
  previous_pct: number | null;
  actual_minus_expected_pp: number | null;
  actual_minus_previous_pp: number | null;
  outcome: "ABOVE_FORECAST" | "MET_FORECAST" | "BELOW_FORECAST" | "UNKNOWN_NO_COMPARATOR";
  comparator_vintage: "NOT_SEPARATELY_VERIFIED";
  source_tier: number | null;
  event_at: string | null;
  available_at: string;
};

/** Descriptive arithmetic only. A previous monthly reading is NOT a forecast. */
function numberMetric(item: ObservedEvidence, key: string): number | null {
  const value = item.metrics?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function classifyMeasure(claim: string): CpiSurpriseAuditItem["measure"] {
  // Require explicit CPI + the described statistic. "Inflation accelerated"
  // without a measure cannot determine surprise relative to a comparator.
  if (/\b(?:core\s+(?:cpi|consumer prices?)|(?:cpi|consumer price index)\s+(?:ex(?:cluding)?\s+(?:food|energy)))\b/i.test(claim)
      && /\b(?:m\/m|month[- ]on[- ]month|monthly)\b/i.test(claim)) return "CORE_MOM";
  if (/\b(?:headline\s+(?:cpi|inflation)|cpi-u)\b/i.test(claim)
      && /\b(?:m\/m|month[- ]on[- ]month|monthly)\b/i.test(claim)) return "HEADLINE_MOM";
  return "UNCLASSIFIED";
}

export function auditCpiSurprises(packet: DossierV2InputPacket): CpiSurpriseAuditItem[] {
  const records = new Map<string, ObservedEvidence>();
  for (const item of [...packet.observed_evidence, ...(packet.rate_context?.evidence ?? [])]) {
    if (!records.has(item.evidence_id)) records.set(item.evidence_id, item);
  }
  const asOfMs = Date.parse(packet.as_of);
  return [...records.values()].flatMap(item => {
    const observed = numberMetric(item, "observed_value");
    const expected = numberMetric(item, "expected_value");
    const previous = numberMetric(item, "previous_value");
    const availableMs = Date.parse(item.available_at);
    const eventMs = Date.parse(item.occurrence_time ?? "");
    if (
      item.canonical_record_backed !== true
      || item.metrics?.signal_kind !== "economic_release"
      || item.metrics?.measurement_unit !== "percent"
      || !/\b(?:cpi|consumer price index|consumer prices)\b/i.test(item.claim_or_fact)
      || observed === null
      || !Number.isFinite(asOfMs)
      || !Number.isFinite(availableMs) || availableMs > asOfMs
      || !Number.isFinite(eventMs) || eventMs > asOfMs
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.evidence_id)
    ) return [];

    const measure = classifyMeasure(item.claim_or_fact);
    const difference = expected === null ? null : Math.round((observed - expected) * 1000) / 1000;
    return [{
      evidence_id: item.evidence_id,
      measure,
      observed_pct: observed,
      expected_pct: expected,
      previous_pct: previous,
      actual_minus_expected_pp: difference,
      actual_minus_previous_pp: previous === null ? null : Math.round((observed - previous) * 1000) / 1000,
      outcome: difference === null ? "UNKNOWN_NO_COMPARATOR" as const
        : difference > 0 ? "ABOVE_FORECAST" as const
        : difference < 0 ? "BELOW_FORECAST" as const : "MET_FORECAST" as const,
      // Source snapshots without independent pre-release capture cannot be
      // upgraded to point-in-time consensus by the Dossier narrative.
      comparator_vintage: "NOT_SEPARATELY_VERIFIED" as const,
      source_tier: numberMetric(item, "source_tier"),
      event_at: item.occurrence_time ?? null,
      available_at: item.available_at,
    }];
  }).sort((a, b) =>
    b.available_at.localeCompare(a.available_at)
    || b.event_at!.localeCompare(a.event_at!)
  ).slice(0, 8);
}
