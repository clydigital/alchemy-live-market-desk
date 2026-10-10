import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildRegimeAssumptionObservationReport,
  type CanonicalMeasuredRow,
} from "../lib/regime-assumption-observations.ts";
import {
  buildProvisionalRegimeWatchReport,
  REGIME_WATCH_ASSESSMENT_VERSION,
} from "../lib/regime-provisional-watch-assessments.ts";

const asOf = "2026-10-10T18:51:09.076Z";
const hyRef = "market-crack:hy_oas_20s:2026-09-10:2026-10-08";
const smhRef = "market-crack:smh_qqq_20s:2026-09-11:2026-10-09";
const xlfRef = "market-crack:xlf_spx_20s:2026-09-11:2026-10-09";
const uuid = "69dfaa87-cab9-4a5b-be09-fe78c0c0d198";
const source = "0ca0e9ad-c74b-4ffd-9652-8258fba0a2aa";
const norm = "c8d88e70-bc98-420e-b368-69d8b1a93344";
function row(ref: string, value: number, urls: string[], unit: string, day: string): CanonicalMeasuredRow {
  return {
    id: uuid, source_id: source, normalised_observation_id: norm,
    external_evidence_id: ref, content_hash: "a".repeat(64),
    observed_value: value, measurement_unit: unit,
    event_at: day + "T23:59:59.999Z",
    available_at: "2026-10-10T09:03:11Z", received_at: "2026-10-10T09:03:38Z",
    provenance_urls: urls,
    structured_payload: {
      evidenceNature: "derived_market_measurement",
      methodologyVersion: "market-crack-measured-v1",
    },
  };
}
const originals = () => [
  row(hyRef,45,["https://fred.stlouisfed.org/series/BAMLH0A0HYM2"],"basis_points","2026-10-08"),
  row(smhRef,1.03,[
    "https://www.nasdaq.com/market-activity/etf/smh/historical",
    "https://www.nasdaq.com/market-activity/etf/qqq/historical",
  ],"percentage_points","2026-10-09"),
  row(xlfRef,-6.42,[
    "https://www.nasdaq.com/market-activity/etf/xlf/historical",
    "https://fred.stlouisfed.org/series/SP500",
  ],"percentage_points","2026-10-09"),
];
function watch(rows=originals(), dossierAsOf=asOf) {
  const measured = buildRegimeAssumptionObservationReport({
    dossierId: "8af1f9f7-1552-41cf-85a9-d8667c8311e8",
    asOf: dossierAsOf,
    rows, dossierEvidenceIds: [hyRef],
  });
  return buildProvisionalRegimeWatchReport(measured);
}
test("C2 measured +45bp is 5bp below provisional +50bp broad credit watch; no causality implied", () => {
  const out = watch();
  assert.equal(out.contractVersion, REGIME_WATCH_ASSESSMENT_VERSION);
  assert.equal(out.automaticRegimeChanges, false);
  assert.equal(out.documentation, "RESEARCH_WATCH_ONLY_NOT_A_CALIBRATED_SIGNAL");
  const hy = out.checks.find((item) => item.id === "credit-hy-oas-20s-watch")!;
  assert.equal(hy.status, "BELOW_PROVISIONAL_WATCH");
  assert.equal(hy.observedValue, 45);
  assert.equal(hy.distanceToThreshold, -5);
  assert.equal(hy.canonicalEvidenceUuid, uuid);
  assert.equal(hy.dossierCited, true);
  assert.equal(hy.calibratedProbability, null);
  assert.equal(hy.interpretation, "UNADJUDICATED");
});
test("C2 50bp crossing is investigation-only; not a confirmed Story or credit contagion", () => {
  const rows = originals();rows[0].observed_value = 50;
  const hy = watch(rows).checks[0];
  assert.equal(hy.status, "MET_RESEARCH_WATCH_ONLY");
  assert.equal(hy.distanceToThreshold, 0);
  assert.ok(hy.missingRequirements.some((x) => x.includes("Independent")));
  assert.equal(hy.calibratedProbability, null);
  rows[0].observed_value = 75;
  assert.equal(watch(rows).checks[0].distanceToThreshold, 25);
});
test("C2 SMH 20s price and XLF/SP500 cash are NOT comparable to proposed total-return tripwires", () => {
  const out = watch();
  const smh = out.checks.find((x) => x.id === "ai-equity-leadership-divergence")!;
  const xlf = out.checks.find((x) => x.id === "xlf-relative-leadership")!;
  assert.equal(smh.status, "NOT_COMPARABLE");
  assert.equal(smh.nonComparableContext, 1.03);
  assert.equal(smh.observedValue, null);
  assert.equal(smh.distanceToThreshold, null);
  assert.equal(smh.canonicalEvidenceUuid, null);
  assert.equal(smh.threshold, -5);
  assert.equal(xlf.status, "NOT_COMPARABLE");
  assert.equal(xlf.nonComparableContext, -6.42);
  assert.equal(xlf.observedValue, null);
  assert.ok(xlf.missingRequirements.some((s) => s.includes("SPY")));
  assert.equal(xlf.calibratedProbability, null);
});
test("C2 missing issuer two-quarter CFO, capex and absolute spread levels never guessed", () => {
  const out = watch();
  const capex = out.checks.find((x) => x.id === "ai-capex-cash-coverage")!;
  const absolute = out.checks.find((x) => x.id === "broad-credit-spread-levels")!;
  assert.equal(capex.status, "DATA_GAP");
  assert.equal(capex.observedValue, null);
  assert.equal(absolute.status, "DATA_GAP");
  assert.equal(absolute.threshold, null);
  assert.ok(absolute.missingRequirements.some((s) => s.includes("spread levels")));
});
test("C2 wrong units, absent UUID and stale or future-dated data do not satisfy research watch", () => {
  let r=originals();r[0].measurement_unit="percentage_points";
  assert.equal(watch(r).checks[0].status, "STALE_OR_INVALID");
  r=originals();r[0].id="not-canonical-uuid";
  assert.equal(watch(r).checks[0].status, "STALE_OR_INVALID");
  assert.equal(watch([]).checks[0].status, "DATA_GAP");
  assert.equal(watch(originals(),"2026-10-20T18:51:09.076Z").checks[0].status, "STALE_OR_INVALID");
  assert.equal(watch(originals(),"2026-10-09T23:00:00.000Z").checks[0].status, "DATA_GAP");
});
test("C2 read-only code, exact selected Dossier contract, no Story, AI adjudication or independent engine", () => {
  const pure = readFileSync(new URL("../lib/regime-provisional-watch-assessments.ts",import.meta.url),"utf8");
  const api = readFileSync(new URL("../app/api/regime-watch-assessments/route.ts",import.meta.url),"utf8");
  const page=readFileSync(new URL("../app/hybrid-output/page.tsx",import.meta.url),"utf8");
  const live=readFileSync(new URL("../components/live-desk/RegimeTriggerLadder.tsx",import.meta.url),"utf8");
  assert.match(api,/getDossierV2PresentationSelection/);
  assert.match(api,/loadRegimeAssumptionObservationReport/);
  assert.match(page,/buildProvisionalRegimeWatchReport/);
  assert.match(page,/Evidence-gated Regime watch checks/);
  assert.doesNotMatch(pure,/story_thesis_versions|\.upsert\(|\.update\(|modelRunner|computeProbability/);
  assert.doesNotMatch(api,/story_thesis_versions|\.upsert\(|\.update\(|modelRunner/);
  assert.match(live,/NOT live triggered readings or probabilities/);
});
