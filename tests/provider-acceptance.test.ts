import assert from "node:assert/strict";
import test from "node:test";
import { providerAcceptanceReceipt } from "../lib/provider-acceptance.ts";
import type { FredReadResult } from "../lib/providers/fred-api-v1.ts";
import type { FmpReadResult } from "../lib/providers/fmp-rest.ts";
import type { BeaSnapshot } from "../lib/providers/bea.ts";

test("operational receipt exposes dates, units and entitlement, without raw records or credentials", () => {
  const fred: FredReadResult = {
    state: "ready", seriesId: "DGS10", sourceUrl: "https://fred.stlouisfed.org/series/DGS10",
    retrievedAt: "2026-10-15T00:00:00Z", vintageDate: null,
    observations: [{ date: "2026-10-14", value: 3.99, realtimeStart: "2026-10-15", realtimeEnd: "2026-10-15" }], note: null,
  };
  const fmp: FmpReadResult = {
    state: "restricted", endpoint: "earnings-calendar", sourceUrl: "https://example.test/?apikey=secret",
    symbol: null, records: [{ date: "2026-10-16", confidential: "private-provider-data" }],
    retrievedAt: null, note: "FMP_ACCESS_DENIED_403",
  };
  const bea: BeaSnapshot = {
    state: "ready", sourceName: "U.S. Bureau of Economic Analysis",
    sourceUrl: "https://apps.bea.gov/api/data?UserID=secret", retrievedAt: "2026-10-15T00:00:00Z", note: null,
    observations: [{ metric: "gdp", tableName: "T10101", lineNumber: "1", seriesId: "NIPA:T10101:1",
      label: "GDP", period: "2026Q2", value: 31000, unit: "Billions of dollars", frequency: "Q" }],
  };
  const receipt = providerAcceptanceReceipt({ at: "2026-10-15T00:00:00Z", nominal10Y: fred,
    breakeven10Y: { ...fred, seriesId: "T10YIE" }, earningsCalendar: fmp, bea });
  assert.equal(receipt.fred.DGS10.observationDate, "2026-10-14");
  assert.equal(receipt.fmp.earningsCalendar.httpOrEntitlement, "FMP_ACCESS_DENIED_403");
  assert.equal(receipt.canonicalEvidenceWritten, false);
  assert.deepEqual(receipt.bea.observations, [{ metric: "gdp", period: "2026Q2", unit: "Billions of dollars" }]);
  assert.doesNotMatch(JSON.stringify(receipt), /private-provider-data|secret|31000|3\.99|apikey|UserID/);
});
