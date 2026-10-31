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


test("missing runtime credentials cannot be misreported as missing Vercel Shared Environment Variables", () => {
  const fred: FredReadResult = {
    state: "unconfigured", seriesId: "DGS10", sourceUrl: "https://fred.stlouisfed.org/series/DGS10",
    retrievedAt: null, vintageDate: null, observations: [], note: "FRED_API_NOT_CONFIGURED",
  };
  const fmp: FmpReadResult = {
    state: "unconfigured", endpoint: "earnings-calendar",
    sourceUrl: "https://site.financialmodelingprep.com/developer/docs/stable/earnings-calendar",
    symbol: null, records: [], retrievedAt: null, note: "FMP_API_NOT_CONFIGURED",
  };
  const bea: BeaSnapshot = {
    state: "unconfigured", sourceName: "U.S. Bureau of Economic Analysis",
    sourceUrl: "https://apps.bea.gov/api/data", retrievedAt: null,
    observations: [], note: "BEA_API_KEY is not configured.",
  };
  const receipt = providerAcceptanceReceipt({
    at: "2026-10-31T00:00:00Z", nominal10Y: fred,
    breakeven10Y: { ...fred, seriesId: "T10YIE" }, earningsCalendar: fmp, bea,
    runtimeKeys: { fred: false, fmp: false, bea: false },
  });
  assert.equal(receipt.credentialDiagnostics.inspectionScope, "deployed_server_runtime_only");
  assert.equal(receipt.credentialDiagnostics.teamSharedEnvironmentVariables, "not_inspected");
  assert.equal(receipt.credentialDiagnostics.sharedVariableProjectLinkage, "not_verified");
  assert.equal(receipt.credentialDiagnostics.missingFromVercelClaimSupported, false);
  assert.equal(receipt.credentialDiagnostics.fred, "not_visible_at_runtime");
  assert.equal(receipt.credentialDiagnostics.nextAction,
    "CHECK_TEAM_SHARED_ENV_PROJECT_LINK_PRODUCTION_SCOPE_AND_REDEPLOY");
  assert.equal(receipt.fred.DGS10.httpOrEntitlement, "FRED_CREDENTIAL_NOT_VISIBLE_AT_RUNTIME");
  assert.equal(receipt.fmp.earningsCalendar.httpOrEntitlement,
    "FMP_CREDENTIAL_NOT_VISIBLE_AT_RUNTIME");
  assert.equal(receipt.bea.httpOrEntitlement, "BEA_CREDENTIAL_NOT_VISIBLE_AT_RUNTIME");
  assert.doesNotMatch(JSON.stringify(receipt), /FRED_API_NOT_CONFIGURED|FMP_API_NOT_CONFIGURED|BEA_NOT_CONFIGURED/);
});

test("visible runtime credentials direct failures to provider HTTP and entitlement diagnosis", () => {
  const fred: FredReadResult = {
    state: "unavailable", seriesId: "DGS10",
    sourceUrl: "https://fred.stlouisfed.org/series/DGS10",
    retrievedAt: null, vintageDate: null, observations: [], note: "FRED_HTTP_403",
  };
  const fmp: FmpReadResult = {
    state: "restricted", endpoint: "earnings-calendar", sourceUrl: "https://example.test",
    symbol: null, records: [], retrievedAt: null, note: "FMP_ACCESS_DENIED_403",
  };
  const bea: BeaSnapshot = {
    state: "unavailable", sourceName: "U.S. Bureau of Economic Analysis",
    sourceUrl: "https://apps.bea.gov/api/data", retrievedAt: null,
    observations: [], note: "BEA_REQUEST_FAILED",
  };
  const receipt = providerAcceptanceReceipt({
    at: "2026-10-31T00:00:00Z", nominal10Y: fred,
    breakeven10Y: { ...fred, seriesId: "T10YIE" }, earningsCalendar: fmp, bea,
    runtimeKeys: { fred: true, fmp: true, bea: true },
  });
  assert.equal(receipt.credentialDiagnostics.fred, "visible_at_runtime");
  assert.equal(receipt.credentialDiagnostics.nextAction,
    "CHECK_PROVIDER_HTTP_STATUS_ENTITLEMENT_LIMITS_AND_OBSERVATION_DATES");
  assert.equal(receipt.fmp.earningsCalendar.httpOrEntitlement, "FMP_ACCESS_DENIED_403");
  assert.equal(receipt.credentialDiagnostics.missingFromVercelClaimSupported, false);
});


test("partial BEA results never become an apparently ready API receipt", () => {
  const fred: FredReadResult = {
    state:"ready",seriesId:"DGS10",sourceUrl:"https://fred.stlouisfed.org/series/DGS10",
    retrievedAt:"2026-10-31T00:00:00Z",vintageDate:null,observations:[{
      date:"2026-10-30",value:4,realtimeStart:"2026-10-30",realtimeEnd:"2026-10-30"
    }],note:null
  };
  const receipt=providerAcceptanceReceipt({
    at:"2026-10-31T00:00:00Z",nominal10Y:fred,
    breakeven10Y:{...fred,seriesId:"T10YIE"},
    earningsCalendar:{state:"ready",endpoint:"earnings-calendar",
      sourceUrl:"https://site.financialmodelingprep.com",symbol:null,
      records:[{date:"2026-11-02"}],retrievedAt:"2026-10-31T00:00:00Z",note:null},
    bea:{state:"partial",sourceName:"U.S. Bureau of Economic Analysis",
      sourceUrl:"https://apps.bea.gov/api/data",retrievedAt:"2026-10-31T00:00:00Z",
      observations:[{metric:"gdp",tableName:"T10105",lineNumber:"1",
        seriesId:"NIPA:T10105:1",label:"Gross domestic product (current-dollar level)",
        period:"2026Q3",value:32000,unit:"Current Dollars × 10^9",frequency:"Q"}],
      note:"BEA_TABLES_INCOMPLETE: T20304:BEA_HTTP_503"},
    runtimeKeys:{fred:true,fmp:true,bea:true},
  });
  assert.equal(receipt.bea.state,"partial");
  assert.equal(receipt.bea.httpOrEntitlement,"BEA_PARTIAL_TABLES");
  assert.equal(receipt.canonicalEvidenceWritten,false);
  assert.doesNotMatch(JSON.stringify(receipt),/32000|secret_fixture/);
});
