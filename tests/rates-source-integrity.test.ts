import assert from "node:assert/strict";
import test from "node:test";
import { assessRatesSourceIntegrity, NOMINAL_TENOR_IDS } from "../lib/rates-source-integrity.ts";

const AS_OF = "2026-10-14T21:00:00.000Z";
const DOSS_AS_OF = "2026-10-14T20:55:22.057Z";
const UPSTREAM_UPDATED_AT = "2026-10-14T15:54:40Z";
function input(overrides: Record<string, unknown> = {}) {
  return {
    asOf: AS_OF, dossierId: "dossier-canonical-uuid", dossierAsOf: DOSS_AS_OF,
    dossierCoveragePresent: 5,
    dossierCurveEvidenceRefs: NOMINAL_TENOR_IDS.map((id) => "market-monitor:" + id + ":2026-10-14"),
    monitorRows: NOMINAL_TENOR_IDS.map((id) => ({ id, asOf: "2026-10-14", last: 5.1,
      sourceName: "U.S. Department of the Treasury", sourceUrl: "https://home.treasury.gov/rates",
      sourceUpdatedAt: UPSTREAM_UPDATED_AT })),
    dealer: { status: "STALE", asOf: "2026-09-30", sourceUrl: "https://markets.newyorkfed.org/api/pd", warnings: ["Weekly source delayed"] },
    ...overrides,
  };
}

test("complete five-tenor production snapshot warns only about stale upstream dealer publication", () => {
  const actual = assessRatesSourceIntegrity(input());
  assert.equal(actual.treasury.complete, 5);
  assert.equal(actual.operationalStatus, "WATCH");
  assert.ok(actual.treasury.states.every((item) => item.state === "COMPLETE"));
  assert.equal(actual.primaryDealers.state, "UPSTREAM_STALE");
  assert.ok(actual.alerts.every((alert) => alert.severity === "WATCH"));
});

test("loss of US 2Y after official publication is a downstream operational failure", () => {
  const x = input();
  x.dossierCurveEvidenceRefs = x.dossierCurveEvidenceRefs.filter((id) => !id.startsWith("market-monitor:us2y:"));
  x.dossierCoveragePresent = 4;
  const actual = assessRatesSourceIntegrity(x);
  assert.equal(actual.operationalStatus, "ACTION_REQUIRED");
  assert.equal(actual.treasury.states.find((item) => item.id === "us2y")?.state, "DOWNSTREAM_LOSS");
  assert.equal(actual.treasury.complete, 4);
  assert.ok(actual.alerts.some((alert) => alert.code === "PERSISTED_RATE_COVERAGE_INCOMPLETE"));
});

test("fresh source released after Dossier as-of must not be called downstream loss", () => {
  const x = input({ dossierAsOf: "2026-10-14T15:00:00.000Z" });
  x.dossierCurveEvidenceRefs = x.dossierCurveEvidenceRefs.filter((id) => !id.startsWith("market-monitor:us2y:"));
  const actual = assessRatesSourceIntegrity(x);
  assert.equal(actual.treasury.states.find((item) => item.id === "us2y")?.state, "PENDING_REBASE");
});

test("older-than-five-day source data is upstream stale rather than invented fresh evidence", () => {
  const x = input();
  x.monitorRows = x.monitorRows.map((row) => row.id === "us30y-fred" ? { ...row, asOf: "2026-10-05", sourceUpdatedAt: null } : row);
  const actual = assessRatesSourceIntegrity(x);
  assert.equal(actual.treasury.states.find((item) => item.id === "us30y-fred")?.state, "UPSTREAM_STALE");
});

test("missing monitor rows distinguish provider outage from lost Dossier evidence", () => {
  const x = input();
  x.monitorRows = x.monitorRows.filter((row) => row.id !== "us5y-fred");
  const actual = assessRatesSourceIntegrity(x);
  assert.equal(actual.treasury.states.find((item) => item.id === "us5y-fred")?.state, "UPSTREAM_UNAVAILABLE");
  assert.equal(actual.operationalStatus, "WATCH");
});

test("alternative historical ten-year market-monitor ID is recognized without fabricating it", () => {
  const x = input();
  x.dossierCurveEvidenceRefs = x.dossierCurveEvidenceRefs.map((ref) => ref.startsWith("market-monitor:us10y-fred:") ? ref.replace("us10y-fred", "us10y") : ref);
  const actual = assessRatesSourceIntegrity(x);
  assert.equal(actual.treasury.states.find((item) => item.id === "us10y-fred")?.state, "COMPLETE");
  assert.equal(actual.treasury.complete, 5);
});

test("missing licensed MOVE/FedWatch/direct UST are research gaps, not fictional market series", () => {
  const actual = assessRatesSourceIntegrity(input());
  assert.deepEqual(actual.inaccessibleDirectFeeds.map((item) => item.id),
    ["CME_FEDWATCH_INTRADAY", "ICE_MOVE", "INTRADAY_UST_2Y_10Y"]);
  assert.equal(actual.inaccessibleDirectFeeds.every((item) => item.state === "NOT_ENTITLED_OR_NOT_INTEGRATED"), true);
});
