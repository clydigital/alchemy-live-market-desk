/** Read-only cross-layer source integrity: provider -> monitor -> persisted Dossier. */
import { deriveMatchedNominalCurveChange, NOMINAL_CURVE_IDS } from "./dossier-v2/treasury-nominal-movement.ts";
export const RATES_SOURCE_INTEGRITY_VERSION = "rates-source-integrity/1" as const;
export const NOMINAL_TENOR_IDS = ["us2y", "us5y-fred", "us10y-fred", "us20y-fred", "us30y-fred"] as const;
export type NominalTenorId = (typeof NOMINAL_TENOR_IDS)[number];
export type TenorState = "COMPLETE" | "PENDING_REBASE" | "DOWNSTREAM_LOSS" | "UPSTREAM_STALE" | "UPSTREAM_UNAVAILABLE";
export type RatesSourceState = "OK" | "WATCH" | "ACTION_REQUIRED";
export type MonitorRateRow = { id: string; asOf: string | null; last: number | null; sourceName: string; sourceUrl: string; sourceUpdatedAt?: string | null; points?: Array<{time: number;close: number}> };
export type RatesIntegrityInput = {
  asOf: string;
  dossierId: string;
  dossierAsOf: string;
  dossierCurveEvidenceRefs: string[];
  dossierCoveragePresent: number | null;
  dossierRequiredRateMissing?: string[];
  /** Market-monitor acquisition time; never substitute API response generation time. */
  monitorUpdatedAt?: string;
  /** Stored deterministic curve values; missing observations must be reported, not inferred. */
  dossierCurveMoves?: Array<{ maturity: string; change5dBp: number | null }>;
  monitorRows: MonitorRateRow[];
  dealer: { status: string; asOf: string | null; sourceUrl: string; warnings: string[] };
};
export type RatesIntegrityResult = {
  contractVersion: typeof RATES_SOURCE_INTEGRITY_VERSION;
  generatedAt: string;
  operationalStatus: RatesSourceState;
  dossier: { id: string; asOf: string; storedTreasuryCoverage: number | null };
  treasury: { complete: number; required: 5; states: Array<{
    id: NominalTenorId; state: TenorState; observationDate: string | null;
    sourceUpdatedAt: string | null; sourceName: string | null; sourceUrl: string | null;
    storedEvidenceRef: string | null; detail: string;
  }> };
  requiredRateInputs: { present: number | null; required: 5; missing: string[]; diagnostics: Array<{ label: string; state: "DOWNSTREAM_LOSS" | "PENDING_REBASE" | "UPSTREAM_UNAVAILABLE" | "UPSTREAM_STALE" | "UNVERIFIED"; sourceDate: string | null }> };
  primaryDealers: { state: "OK" | "UPSTREAM_STALE" | "UPSTREAM_UNAVAILABLE"; asOf: string | null; sourceUrl: string; warnings: string[] };
  fiveSessionCurve: { state: "COMPLETE" | "NOT_COMPUTABLE" | "DOWNSTREAM_MEASUREMENT_MISSING" | "PENDING_REBASE" | "UNASSESSED"; baselineDate: string | null; latestDate: string | null; missingMaturities: string[] };
  move: { state: "OBSERVED" | "STALE" | "ADAPTER_PRESENT_NO_VERIFIED_DATA"; observationDate: string | null; sourceName: string | null; sourceUrl: string | null };
  inaccessibleDirectFeeds: Array<{ id: string; state: "NOT_ENTITLED_OR_NOT_INTEGRATED"; reason: string }>; 
  alerts: Array<{ code: string; severity: "ACTION_REQUIRED" | "WATCH"; detail: string }>;
  rules: string[];
};

const DAY_MS = 86_400_000;
function ageDays(day: string | null, asOfMs: number): number | null {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const at = Date.parse(day + "T00:00:00.000Z");
  return Number.isFinite(at) ? Math.max(0, (asOfMs - at) / DAY_MS) : null;
}
function recognisedEvidenceDate(id: string, refs: string[]) {
  const alternatives = id === "us10y-fred" ? ["us10y-fred", "us10y"] : [id];
  return refs.flatMap((ref) => {
    for (const candidate of alternatives) {
      const prefix = "market-monitor:" + candidate + ":";
      const date = ref.startsWith(prefix) ? ref.slice(prefix.length) : "";
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return [{ ref, date }];
    }
    return [];
  }).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
}

/** No fetch, inference, persistence or mutation is allowed in this classifier. */
export function assessRatesSourceIntegrity(input: RatesIntegrityInput): RatesIntegrityResult {
  const asOfMs = Date.parse(input.asOf);
  const dossierAsOfMs = Date.parse(input.dossierAsOf);
  if (!Number.isFinite(asOfMs) || !Number.isFinite(dossierAsOfMs)) throw new Error("Invalid integrity timestamps");
  const alerts: RatesIntegrityResult["alerts"] = [];
  const tenorStates = NOMINAL_TENOR_IDS.map((id) => {
    const row = input.monitorRows.find((item) => item.id === id) ?? null;
    const saved = recognisedEvidenceDate(id, input.dossierCurveEvidenceRefs);
    const age = ageDays(row?.asOf ?? null, asOfMs);
    const observedMs = row?.asOf ? Date.parse(row.asOf + "T00:00:00.000Z") : NaN;
    const sourceUpdatedMs = row?.sourceUpdatedAt ? Date.parse(row.sourceUpdatedAt) : NaN;
    // Availability is the reported official update timestamp when present;
    // otherwise permit at most the existing conservative following-day gate.
    const sourceAvailableMs = Number.isFinite(sourceUpdatedMs) && sourceUpdatedMs >= observedMs
      ? sourceUpdatedMs : observedMs + DAY_MS;
    let state: TenorState;
    let detail: string;
    if (!row || row.last === null || !Number.isFinite(observedMs)) {
      state = "UPSTREAM_UNAVAILABLE"; detail = "No usable dated market-monitor observation.";
    } else if (age === null || age > 5) {
      state = "UPSTREAM_STALE"; detail = "Source observation exceeds the existing five-calendar-day admission window.";
    } else if (saved?.date === row.asOf) {
      state = "COMPLETE"; detail = "Dated source observation is present in persisted curve evidence.";
    } else if (dossierAsOfMs < sourceAvailableMs) {
      state = "PENDING_REBASE"; detail = "Newer source observation was not available to the persisted Dossier as-of.";
    } else {
      state = "DOWNSTREAM_LOSS"; detail = "Source observation predates Dossier as-of but is absent from the stored curve evidence.";
    }
    if (state === "DOWNSTREAM_LOSS") alerts.push({ code: "RATE_DOSSIER_MISMATCH_" + id.toUpperCase(), severity: "ACTION_REQUIRED", detail });
    else if (state === "UPSTREAM_STALE" || state === "UPSTREAM_UNAVAILABLE")
      alerts.push({ code: "RATE_PROVIDER_" + id.toUpperCase(), severity: "WATCH", detail });
    return { id, state, observationDate: row?.asOf ?? null, sourceUpdatedAt: row?.sourceUpdatedAt ?? null,
      sourceName: row?.sourceName ?? null, sourceUrl: row?.sourceUrl ?? null,
      storedEvidenceRef: saved?.ref ?? null, detail };
  });
  const dealerAge = ageDays(input.dealer.asOf, asOfMs);
  const dealerState: RatesIntegrityResult["primaryDealers"]["state"] =
    input.dealer.status === "UNAVAILABLE" || !input.dealer.asOf
      ? "UPSTREAM_UNAVAILABLE" : dealerAge !== null && dealerAge > 14
        ? "UPSTREAM_STALE" : "OK";
  if (dealerState !== "OK") alerts.push({
    code: "NY_FED_PRIMARY_DEALERS_" + dealerState, severity: "WATCH",
    detail: "Official New York Fed publication is delayed or unavailable; do not substitute stale observations as current.",
  });
  // The direct Barchart $MOVE adapter already exists. Absence of a verified
  // observation is not proof that no adapter was implemented or that a key is
  // absent; the market monitor is the only trusted live-data indicator.
  const moveRow = input.monitorRows.find((item) => item.id === "move") ?? null;
  const moveAge = ageDays(moveRow?.asOf ?? null, asOfMs);
  const trustedMove = moveRow?.sourceName === "Barchart OnDemand · ICE BofA MOVE Index"
    && moveRow.sourceUrl.startsWith("https://www.barchart.com/")
    && typeof moveRow.last === "number" && Number.isFinite(moveRow.last) && moveRow.last > 0;
  const moveState: RatesIntegrityResult["move"]["state"] =
    !trustedMove || !moveRow?.asOf ? "ADAPTER_PRESENT_NO_VERIFIED_DATA"
      : moveAge !== null && moveAge > 5 ? "STALE" : "OBSERVED";
  if (moveState === "STALE") alerts.push({ code: "MOVE_UPSTREAM_STALE", severity: "WATCH",
    detail: "The Barchart MOVE adapter reports an observation older than the five-day rates context window." });

  // A complete 5/5 *level* curve must not silently discard computable
  // five-session absolute bp moves. Check only after all five latest dated
  // sources have entered this Dossier; do not flag a historical baseline
  // or legitimately unobserved/halted sessions.
  const latestNominalDate = input.monitorRows.find((item) => item.id === NOMINAL_CURVE_IDS[0])?.asOf ?? null;
  const matchedCurve = latestNominalDate
    ? deriveMatchedNominalCurveChange(input.monitorRows, latestNominalDate) : null;
  const isStoredCurrent = tenorStates.every((item) => item.state === "COMPLETE");
  const maturities = ["2Y", "5Y", "10Y", "20Y", "30Y"];
  const missingMovements = matchedCurve && isStoredCurrent && input.dossierCurveMoves
    ? maturities.filter((maturity) => input.dossierCurveMoves?.find((p) => p.maturity === maturity)?.change5dBp == null)
    : [];
  const fiveSessionState: RatesIntegrityResult["fiveSessionCurve"]["state"] =
    !matchedCurve ? "NOT_COMPUTABLE" : !isStoredCurrent ? "PENDING_REBASE"
      : !input.dossierCurveMoves ? "UNASSESSED"
        : missingMovements.length ? "DOWNSTREAM_MEASUREMENT_MISSING" : "COMPLETE";
  if (fiveSessionState === "DOWNSTREAM_MEASUREMENT_MISSING") alerts.push({
    code: "TREASURY_FIVE_SESSION_MOVEMENT_LOST", severity: "ACTION_REQUIRED",
    detail: "Five common official sessions exist, but persisted Dossier bp movements are missing for: " + missingMovements.join(", "),
  });

  // "5/5 required rate inputs" is NOT "5/5 nominal Treasury maturities".
  // It includes 2Y, 10Y, 10Y real, 10Y breakeven and effective Fed funds.
  // Canonical real yield evidence may be backed by a UUID, not a monitor ref;
  // only the persisted Dossier's own explicit missing labels identify gaps.
  const requiredRateMissing = input.dossierRequiredRateMissing ?? [];
  const requiredSourceIds: Record<string, string> = {
    "US 2Y": "us2y",
    "US 10Y nominal": "us10y-fred",
    "US 10Y real yield": "us10y-real",
    "US 10Y breakeven": "us10y-breakeven",
    "Effective fed funds": "fed-funds-effective",
  };
  const monitorReceiptMs = input.monitorUpdatedAt ? Date.parse(input.monitorUpdatedAt) : NaN;
  const missingInputDiagnostics: RatesIntegrityResult["requiredRateInputs"]["diagnostics"] = [];
  for (const label of requiredRateMissing) {
    const id = requiredSourceIds[label];
    const row = input.monitorRows.find((candidate) => candidate.id === id);
    const observedMs = row?.asOf ? Date.parse(row.asOf + "T00:00:00Z") : NaN;
    const age = ageDays(row?.asOf ?? null, asOfMs);
    let state: RatesIntegrityResult["requiredRateInputs"]["diagnostics"][number]["state"];
    if (!id) state = "UNVERIFIED";
    else if (!row || row.last === null || !Number.isFinite(observedMs)) state = "UPSTREAM_UNAVAILABLE";
    else if (age === null || age > 5) state = "UPSTREAM_STALE";
    else {
      const sourceMs = row.sourceUpdatedAt ? Date.parse(row.sourceUpdatedAt) : NaN;
      const trustedTimestamp = Number.isFinite(sourceMs) && sourceMs >= observedMs && sourceMs <= dossierAsOfMs;
      // For same-day FRED without a publication clock, only a monitor
      // receipt actually preceding the Dossier as-of can establish availability.
      const provenReceipt = row.sourceName === "Federal Reserve Economic Data"
        && Number.isFinite(monitorReceiptMs)
        && input.monitorUpdatedAt?.slice(0, 10) === row.asOf
        && monitorReceiptMs >= observedMs && monitorReceiptMs <= dossierAsOfMs
        && dossierAsOfMs - monitorReceiptMs <= 15 * 60_000;
      const conservativeNextDayMs = observedMs + DAY_MS;
      const wasAvailable = trustedTimestamp || provenReceipt || conservativeNextDayMs <= dossierAsOfMs;
      state = wasAvailable ? "DOWNSTREAM_LOSS" : "PENDING_REBASE";
    }
    missingInputDiagnostics.push({ label, state, sourceDate: row?.asOf ?? null });
    const actionable = state === "DOWNSTREAM_LOSS";
    alerts.push({
      code: "REQUIRED_RATE_INPUT_" + (id ?? label).toUpperCase().replace(/[^A-Z0-9]+/g, "_"),
      severity: actionable ? "ACTION_REQUIRED" : "WATCH",
      detail: `${label} missing from persisted Dossier. ${actionable
        ? "An eligible dated source observation existed by Dossier as-of; inspect packet admission and rebase."
        : "Source availability is not proven by Dossier as-of or has degraded upstream."}`,
    });
  }
  // A stored 4/5 count without labels is a consistency failure regardless
  // of external providers; do not let a malformed presentation pass as WATCH.
  if (input.dossierCoveragePresent !== null
    && input.dossierCoveragePresent !== 5 && requiredRateMissing.length === 0) {
    alerts.push({ code: "REQUIRED_RATE_COVERAGE_SCHEMA_INCONSISTENT", severity: "ACTION_REQUIRED",
      detail: "Rate regime reports incomplete required coverage but has no missing input names." });
  }
  const complete = tenorStates.filter((item) => item.state === "COMPLETE").length;
  if (input.dossierCoveragePresent !== null && input.dossierCoveragePresent !== 5)
    alerts.push({ code: "PERSISTED_RATE_COVERAGE_INCOMPLETE",
      severity: missingInputDiagnostics.some((item) => item.state === "DOWNSTREAM_LOSS")
        || tenorStates.some((item) => item.state === "DOWNSTREAM_LOSS") ? "ACTION_REQUIRED" : "WATCH",
      detail: "The five REQUIRED rate inputs are incomplete (not the five nominal maturities); review per-input upstream and Dossier availability." });
  return {
    contractVersion: RATES_SOURCE_INTEGRITY_VERSION, generatedAt: input.asOf,
    operationalStatus: alerts.some((item) => item.severity === "ACTION_REQUIRED") ? "ACTION_REQUIRED"
      : alerts.length || tenorStates.some((item) => item.state === "PENDING_REBASE") ? "WATCH" : "OK",
    dossier: { id: input.dossierId, asOf: input.dossierAsOf, storedTreasuryCoverage: input.dossierCoveragePresent },
    treasury: { complete, required: 5, states: tenorStates },
    requiredRateInputs: { present: input.dossierCoveragePresent, required: 5, missing: requiredRateMissing, diagnostics: missingInputDiagnostics },
    primaryDealers: { state: dealerState, asOf: input.dealer.asOf, sourceUrl: input.dealer.sourceUrl, warnings: input.dealer.warnings },
    fiveSessionCurve: { state: fiveSessionState, baselineDate: matchedCurve?.baselineDate ?? null,
      latestDate: matchedCurve?.latestDate ?? null, missingMaturities: missingMovements },
    move: { state: moveState, observationDate: moveRow?.asOf ?? null, sourceName: moveRow?.sourceName ?? null, sourceUrl: moveRow?.sourceUrl ?? null },
    inaccessibleDirectFeeds: [
      { id: "CME_FEDWATCH_INTRADAY", state: "NOT_ENTITLED_OR_NOT_INTEGRATED", reason: "An official intraday FedWatch entitlement and evidence adapter have not been verified." },

      { id: "INTRADAY_UST_2Y_10Y", state: "NOT_ENTITLED_OR_NOT_INTEGRATED", reason: "No validated timestamped direct Treasury cash-yield bars; daily Treasury yields are not intraday bars." },
    ],
    alerts,
    rules: [
      "Do not treat endpoint generation time as a source observation timestamp.",
      "Never treat stale official releases, ETF proxies or delayed daily yields as intraday evidence.",
      "Dossier mismatch is actionable only when an actual source observation was available by the Dossier as-of.",
      "Do not change persisted Dossier or Story state from source-integrity monitoring.",
    ],
  };
}
