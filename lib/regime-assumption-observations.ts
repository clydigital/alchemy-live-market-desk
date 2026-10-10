/**
 * Versioned, read-only observation quality for named Regime assumptions.
 *
 * This is not System 2. An observed 20-session market change cannot by itself
 * accept/refine a Motion, change a Story thesis, or establish that a private AI
 * issuer's cash flows or the bubble Regime have broken.
 */
export const REGIME_ASSUMPTION_OBSERVATIONS_VERSION = "regime-assumption-observations/1" as const;
export const REGIME_OBSERVATION_STATES = [
  "CURRENT", "UNCHANGED_EXPECTED", "EXPECTED_NOT_RELEASED", "STALE", "MISSING",
  "DEFINITION_MISMATCH", "CONFLICTED", "UNVERIFIED", "NOT_APPLICABLE",
] as const;

export type RegimeObservationState = typeof REGIME_OBSERVATION_STATES[number];
export type RegimeInferenceState = "REINFORCES" | "CHALLENGES" | "NO_MATERIAL_CHANGE" | "UNRESOLVED";

type MarketMetricKey = "hy_oas_20s" | "ig_oas_20s" | "smh_qqq_20s" | "xlf_spx_20s" | "rsp_spx_20s";

export type CanonicalMeasuredRow = {
  id: string;
  source_id: string | null;
  normalised_observation_id: string | null;
  external_evidence_id: string | null;
  content_hash: string | null;
  observed_value: string | number | null;
  measurement_unit: string | null;
  event_at: string | null;
  available_at: string | null;
  received_at: string | null;
  provenance_urls: string[] | null;
  structured_payload: Record<string, unknown> | null;
};

export type RegimeMetricRead = {
  key: MarketMetricKey;
  label: string;
  quality: RegimeObservationState;
  reason: string;
  value: number | null;
  unit: "basis_points" | "percentage_points";
  observationAt: string | null;
  availableAt: string | null;
  sourceReleaseAt: null;
  /** True only where a current Dossier expressly references this stable Evidence ID. */
  citedInDossier: boolean;
  evidenceUuid: string | null;
  stableEvidenceId: string | null;
  sourceUrls: string[];
  windowSessions: 20;
  basis: "OAS_LEVEL_CHANGE" | "PRICE_RETURN_DIFFERENCE_NOT_TOTAL_RETURN";
};

export type AssumptionObservationRead = {
  assumptionId: "A1" | "A2" | "A3" | "A4" | "A5" | "B1" | "B2" | "B3" | "B4";
  regime: "AI" | "US_RATES";
  title: string;
  observationQuality: RegimeObservationState;
  /** Never inferred from a price or credit number; use exact canonical A2 elsewhere. */
  interpretation: RegimeInferenceState;
  metrics: RegimeMetricRead[];
  evidenceLimitation: string;
};

export type RegimeAssumptionObservationReport = {
  contractVersion: typeof REGIME_ASSUMPTION_OBSERVATIONS_VERSION;
  dossierId: string;
  asOf: string;
  assumptions: AssumptionObservationRead[];
  measuredMetricCount: number;
  currentMetricCount: number;
  interpretationAuthority: "READ_ONLY_MEASUREMENT_QUALITY";
};

const MAX_AGE_MS = 5 * 86_400_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const METRICS: Record<MarketMetricKey, {
  label: string;
  unit: RegimeMetricRead["unit"];
  basis: RegimeMetricRead["basis"];
  expectedSources: number;
}> = {
  hy_oas_20s: { label: "High-yield OAS, 20-session change", unit: "basis_points", basis: "OAS_LEVEL_CHANGE", expectedSources: 1 },
  ig_oas_20s: { label: "Investment-grade OAS, 20-session change", unit: "basis_points", basis: "OAS_LEVEL_CHANGE", expectedSources: 1 },
  smh_qqq_20s: { label: "SMH minus QQQ, 20-session price return", unit: "percentage_points", basis: "PRICE_RETURN_DIFFERENCE_NOT_TOTAL_RETURN", expectedSources: 2 },
  xlf_spx_20s: { label: "XLF minus S&P 500 cash, 20-session price return", unit: "percentage_points", basis: "PRICE_RETURN_DIFFERENCE_NOT_TOTAL_RETURN", expectedSources: 2 },
  rsp_spx_20s: { label: "RSP minus S&P 500 cash, 20-session price return", unit: "percentage_points", basis: "PRICE_RETURN_DIFFERENCE_NOT_TOTAL_RETURN", expectedSources: 2 },
};

const ASSUMPTIONS: Array<{
  assumptionId: AssumptionObservationRead["assumptionId"];
  regime: AssumptionObservationRead["regime"];
  title: string;
  keys: MarketMetricKey[];
  limitation: string;
}> = [
  { assumptionId: "A1", regime: "AI", title: "Paid AI demand monetises at scale", keys: [], limitation: "Primary paid revenue, comparable segment margin, usage and consensus-vintage evidence are not in the measured market-series set." },
  { assumptionId: "A2", regime: "AI", title: "Capex produces sustainable cash returns", keys: [], limitation: "Comparable issuer CFO, cash PP&E, simple FCF and lease/commitment evidence require dated SEC/IR filings." },
  { assumptionId: "A3", regime: "AI", title: "AI infrastructure funding is resilient", keys: ["hy_oas_20s", "ig_oas_20s"], limitation: "Index OAS movements are market-wide CONTEXT, not an AI issuer's spread, maturity coverage or cash interest cost." },
  { assumptionId: "A4", regime: "AI", title: "Supplier orders reflect paid customer pull-through", keys: [], limitation: "Actual contract/order disclosure and verifiable customer exposure are missing; cannot invent counterparty identity." },
  { assumptionId: "A5", regime: "AI", title: "Equity optimism and required growth remain defensible", keys: ["smh_qqq_20s", "rsp_spx_20s"], limitation: "Relative price moves measure perception only, not forward EPS revisions, reverse DCF or AI revenues. Prices are not dividend-adjusted total returns." },
  { assumptionId: "B1", regime: "US_RATES", title: "Fed expected policy path", keys: [], limitation: "Need dated policy-futures, 2Y/real-rate and pre-event economic-consensus observations." },
  { assumptionId: "B2", regime: "US_RATES", title: "Duration, fiscal supply and inflation premium", keys: [], limitation: "Treasury and ACM may appear as contextual Dossier facts, but there is no comparable, validated quantified metric in this five-series projection." },
  { assumptionId: "B3", regime: "US_RATES", title: "Credit and financial stability transmission", keys: ["hy_oas_20s", "ig_oas_20s", "xlf_spx_20s"], limitation: "Broad OAS and financial-sector relative PRICE return are context; MOVE and instrument-level refinancing/liquidity are still unmeasured." },
  { assumptionId: "B4", regime: "US_RATES", title: "Dollar and foreign-demand transmission", keys: [], limitation: "Actual DXY/FX basis, hedged yield and dated TIC-flow observations are not provided by the five canonical market-crack series." },
];

function numericTime(input: string | null) {
  const ms = input ? Date.parse(input) : NaN;
  return Number.isFinite(ms) ? ms : null;
}
function number(input: string | number | null): number | null {
  if (input === null || input === "" || typeof input === "boolean") return null;
  const value = Number(input);
  return Number.isFinite(value) ? value : null;
}
function metricKey(value: string | null): { key: MarketMetricKey; observedDate: string } | null {
  if (!value) return null;
  const match = /^market-crack:(hy_oas_20s|ig_oas_20s|smh_qqq_20s|xlf_spx_20s|rsp_spx_20s):\d{4}-\d{2}-\d{2}:(\d{4}-\d{2}-\d{2})$/.exec(value);
  if (!match) return null;
  return { key: match[1] as MarketMetricKey, observedDate: match[2] };
}
function valueSourceUrls(row: CanonicalMeasuredRow): string[] {
  return Array.isArray(row.provenance_urls)
    ? row.provenance_urls.filter((u): u is string => typeof u === "string" && /^https:\/\//.test(u))
    : [];
}

function qualityFor(row: CanonicalMeasuredRow, key: MarketMetricKey, expectedDay: string, asOfMs: number): {
  status: RegimeObservationState; reason: string;
} {
  const config = METRICS[key];
  if (!UUID.test(row.id) || !UUID.test(row.source_id ?? "")
    || !UUID.test(row.normalised_observation_id ?? "")
    || !/^[a-f0-9]{64}$/i.test(row.content_hash ?? "")
    || valueSourceUrls(row).length !== config.expectedSources
    || row.structured_payload?.evidenceNature !== "derived_market_measurement"
    || row.structured_payload?.methodologyVersion !== "market-crack-measured-v1"
    || number(row.observed_value) === null) {
    return { status: "UNVERIFIED", reason: "Canonical UUID, recorded value, source URLs or methodology provenance is missing or inconsistent." };
  }
  if (row.measurement_unit !== config.unit) {
    return { status: "DEFINITION_MISMATCH", reason: "Measurement unit does not match the metric definition." };
  }
  const eventMs = numericTime(row.event_at);
  if (eventMs === null || new Date(eventMs).toISOString().slice(0, 10) !== expectedDay) {
    return { status: "DEFINITION_MISMATCH", reason: "The metric observation day conflicts with its stable measured-window reference." };
  }
  return asOfMs - eventMs > MAX_AGE_MS
    ? { status: "STALE", reason: "Dated market observation is older than the five-calendar-day diagnostic freshness gate." }
    : { status: "CURRENT", reason: "Dated 20-session diagnostic, not issuer cash-flow proof or a live threshold trigger." };
}

export function buildRegimeAssumptionObservationReport(input: {
  dossierId: string;
  asOf: string;
  rows: CanonicalMeasuredRow[];
  dossierEvidenceIds: string[];
}): RegimeAssumptionObservationReport {
  const asOfMs = numericTime(input.asOf);
  const admitted = new Set(input.dossierEvidenceIds);
  const metrics = {} as Record<MarketMetricKey, RegimeMetricRead>;
  for (const key of Object.keys(METRICS) as MarketMetricKey[]) {
    const definition = METRICS[key];
    const relevant = input.rows
      .filter((row) => {
        const parsed = metricKey(row.external_evidence_id);
        if (parsed?.key !== key) return false;
        const eventMs = numericTime(row.event_at);
        const availableMs = numericTime(row.available_at);
        const receivedMs = numericTime(row.received_at);
        return asOfMs !== null && eventMs !== null && availableMs !== null && receivedMs !== null
          && eventMs <= asOfMs && availableMs <= asOfMs && receivedMs <= asOfMs;
      })
      .sort((a, b) => (numericTime(b.event_at) ?? 0) - (numericTime(a.event_at) ?? 0));
    const latest = relevant[0] ?? null;
    const sameDay = latest
      ? relevant.filter((r) => numericTime(r.event_at) === numericTime(latest.event_at))
      : [];
    const conflicts = new Set(sameDay.map((r) => r.content_hash)).size > 1;
    const parsed = latest ? metricKey(latest.external_evidence_id) : null;
    const validity = latest && parsed && asOfMs !== null
      ? qualityFor(latest, key, parsed.observedDate, asOfMs)
      : { status: "MISSING" as RegimeObservationState, reason: "No point-in-time canonical measured series for this metric." };
    const state: RegimeObservationState = conflicts ? "CONFLICTED" : validity.status;
    metrics[key] = {
      key, label: definition.label,
      quality: state,
      reason: conflicts ? "Two canonical revisions occupy the same metric observation day; adjudicate rather than select a convenient value." : validity.reason,
      value: state === "CURRENT" || state === "STALE" ? number(latest!.observed_value) : null,
      unit: definition.unit,
      observationAt: latest?.event_at ?? null,
      availableAt: latest?.available_at ?? null,
      sourceReleaseAt: null, // The producer records synthetic end-of-day; not an issuer's actual public release clock.
      citedInDossier: Boolean(latest && admitted.has(latest.external_evidence_id ?? "")),
      evidenceUuid: latest && (state === "CURRENT" || state === "STALE") ? latest.id : null,
      stableEvidenceId: latest?.external_evidence_id ?? null,
      sourceUrls: latest ? valueSourceUrls(latest) : [],
      windowSessions: 20,
      basis: definition.basis,
    };
  }
  const assumptions: AssumptionObservationRead[] = ASSUMPTIONS.map((assumption) => {
    const selected = assumption.keys.map((key) => metrics[key]);
    const states = selected.map((metric) => metric.quality);
    const observationQuality: RegimeObservationState = !selected.length ? "MISSING"
      : states.includes("CONFLICTED") ? "CONFLICTED"
      : states.includes("DEFINITION_MISMATCH") ? "DEFINITION_MISMATCH"
      : states.includes("UNVERIFIED") ? "UNVERIFIED"
      : states.includes("MISSING") ? "MISSING"
      : states.includes("STALE") ? "STALE"
      : "CURRENT";
    return {
      assumptionId: assumption.assumptionId,
      regime: assumption.regime,
      title: assumption.title,
      observationQuality,
      interpretation: "UNRESOLVED" as const,
      metrics: selected,
      evidenceLimitation: assumption.limitation,
    };
  });
  const all = Object.values(metrics);
  return {
    contractVersion: REGIME_ASSUMPTION_OBSERVATIONS_VERSION,
    dossierId: input.dossierId,
    asOf: input.asOf,
    assumptions,
    measuredMetricCount: all.filter((item) => item.quality !== "MISSING").length,
    currentMetricCount: all.filter((item) => item.quality === "CURRENT").length,
    interpretationAuthority: "READ_ONLY_MEASUREMENT_QUALITY",
  };
}
