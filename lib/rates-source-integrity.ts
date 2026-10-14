/** Read-only cross-layer source integrity: provider -> monitor -> persisted Dossier. */
export const RATES_SOURCE_INTEGRITY_VERSION = "rates-source-integrity/1" as const;
export const NOMINAL_TENOR_IDS = ["us2y", "us5y-fred", "us10y-fred", "us20y-fred", "us30y-fred"] as const;
export type NominalTenorId = (typeof NOMINAL_TENOR_IDS)[number];
export type TenorState = "COMPLETE" | "PENDING_REBASE" | "DOWNSTREAM_LOSS" | "UPSTREAM_STALE" | "UPSTREAM_UNAVAILABLE";
export type RatesSourceState = "OK" | "WATCH" | "ACTION_REQUIRED";
export type MonitorRateRow = { id: string; asOf: string | null; last: number | null; sourceName: string; sourceUrl: string; sourceUpdatedAt?: string | null };
export type RatesIntegrityInput = {
  asOf: string;
  dossierId: string;
  dossierAsOf: string;
  dossierCurveEvidenceRefs: string[];
  dossierCoveragePresent: number | null;
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
  primaryDealers: { state: "OK" | "UPSTREAM_STALE" | "UPSTREAM_UNAVAILABLE"; asOf: string | null; sourceUrl: string; warnings: string[] };
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
  const complete = tenorStates.filter((item) => item.state === "COMPLETE").length;
  if (input.dossierCoveragePresent !== null && input.dossierCoveragePresent !== 5)
    alerts.push({ code: "PERSISTED_RATE_COVERAGE_INCOMPLETE",
      severity: tenorStates.some((item) => item.state === "DOWNSTREAM_LOSS") ? "ACTION_REQUIRED" : "WATCH",
      detail: "The stored Dossier rate-regime coverage is below five required inputs; distinguish missing upstream data or newer releases from lost admitted evidence." });
  return {
    contractVersion: RATES_SOURCE_INTEGRITY_VERSION, generatedAt: input.asOf,
    operationalStatus: alerts.some((item) => item.severity === "ACTION_REQUIRED") ? "ACTION_REQUIRED"
      : alerts.length || tenorStates.some((item) => item.state === "PENDING_REBASE") ? "WATCH" : "OK",
    dossier: { id: input.dossierId, asOf: input.dossierAsOf, storedTreasuryCoverage: input.dossierCoveragePresent },
    treasury: { complete, required: 5, states: tenorStates },
    primaryDealers: { state: dealerState, asOf: input.dealer.asOf, sourceUrl: input.dealer.sourceUrl, warnings: input.dealer.warnings },
    inaccessibleDirectFeeds: [
      { id: "CME_FEDWATCH_INTRADAY", state: "NOT_ENTITLED_OR_NOT_INTEGRATED", reason: "An official intraday FedWatch entitlement and evidence adapter have not been verified." },
      { id: "ICE_MOVE", state: "NOT_ENTITLED_OR_NOT_INTEGRATED", reason: "A licensed direct MOVE feed and canonical evidence adapter have not been verified." },
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
