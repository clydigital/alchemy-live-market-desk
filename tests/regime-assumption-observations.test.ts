import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildRegimeAssumptionObservationReport,
  REGIME_ASSUMPTION_OBSERVATIONS_VERSION,
  type CanonicalMeasuredRow,
} from "../lib/regime-assumption-observations.ts";

const AS_OF = "2026-10-10T18:51:09.076Z";
const DOSSIER = "8af1f9f7-1552-41cf-85a9-d8667c8311e8";
const SOURCE = "0ca0e9ad-c74b-4ffd-9652-8258fba0a2aa";
const NORMALISED = "c8d88e70-bc98-420e-b368-69d8b1a93344";
const VALUES = {
  hy_oas_20s: { value: 45, unit: "basis_points", date: "2026-10-08", base: "2026-09-10",
    urls: ["https://fred.stlouisfed.org/series/BAMLH0A0HYM2"] },
  ig_oas_20s: { value: 2, unit: "basis_points", date: "2026-10-08", base: "2026-09-10",
    urls: ["https://fred.stlouisfed.org/series/BAMLC0A0CM"] },
  smh_qqq_20s: { value: 1.03, unit: "percentage_points", date: "2026-10-09", base: "2026-09-11",
    urls: ["https://www.nasdaq.com/market-activity/etf/smh/historical", "https://www.nasdaq.com/market-activity/etf/qqq/historical"] },
  xlf_spx_20s: { value: -6.42, unit: "percentage_points", date: "2026-10-09", base: "2026-09-11",
    urls: ["https://www.nasdaq.com/market-activity/etf/xlf/historical", "https://fred.stlouisfed.org/series/SP500"] },
  rsp_spx_20s: { value: -2.87, unit: "percentage_points", date: "2026-10-09", base: "2026-09-11",
    urls: ["https://www.nasdaq.com/market-activity/etf/rsp/historical", "https://fred.stlouisfed.org/series/SP500"] },
} as const;

function makeRow(key: keyof typeof VALUES, override: Partial<CanonicalMeasuredRow> = {}): CanonicalMeasuredRow {
  const v = VALUES[key];
  return {
    id: "69dfaa87-cab9-4a5b-be09-fe78c0c0d198",
    source_id: SOURCE,
    normalised_observation_id: NORMALISED,
    external_evidence_id: "market-crack:" + key + ":" + v.base + ":" + v.date,
    observed_value: v.value,
    measurement_unit: v.unit,
    event_at: v.date + "T23:59:59.999Z",
    available_at: "2026-10-10T09:03:11.700Z",
    received_at: "2026-10-10T09:03:38.550Z",
    content_hash: "a".repeat(64),
    provenance_urls: [...v.urls],
    structured_payload: { evidenceNature: "derived_market_measurement", methodologyVersion: "market-crack-measured-v1" },
    ...override,
  };
}
function fiveRows() {
  return (Object.keys(VALUES) as Array<keyof typeof VALUES>).map((key) => makeRow(key));
}
function result(rows: CanonicalMeasuredRow[] = fiveRows(), asOf = AS_OF) {
  return buildRegimeAssumptionObservationReport({
    dossierId: DOSSIER,
    asOf,
    rows,
    dossierEvidenceIds: [VALUES.hy_oas_20s && makeRow("hy_oas_20s").external_evidence_id!, makeRow("smh_qqq_20s").external_evidence_id!],
  });
}

test("C1 production-shaped five canonical market changes carry evidence identity and exact time basis", () => {
  const read = result();
  assert.equal(read.contractVersion, REGIME_ASSUMPTION_OBSERVATIONS_VERSION);
  assert.equal(read.dossierId, DOSSIER);
  assert.equal(read.currentMetricCount, 5);
  assert.equal(read.measuredMetricCount, 5);
  assert.equal(read.interpretationAuthority, "READ_ONLY_MEASUREMENT_QUALITY");
  const a3 = read.assumptions.find((a) => a.assumptionId === "A3")!;
  const a5 = read.assumptions.find((a) => a.assumptionId === "A5")!;
  const b3 = read.assumptions.find((a) => a.assumptionId === "B3")!;
  assert.equal(a3.observationQuality, "CURRENT");
  assert.equal(a3.interpretation, "UNRESOLVED");
  assert.deepEqual(a3.metrics.map((m) => m.value), [45, 2]);
  assert.equal(a3.metrics[0].unit, "basis_points");
  assert.ok(a3.evidenceLimitation.includes("market-wide"));
  assert.equal(a5.observationQuality, "CURRENT");
  assert.deepEqual(a5.metrics.map((m) => m.value), [1.03, -2.87]);
  assert.equal(a5.metrics[0].basis, "PRICE_RETURN_DIFFERENCE_NOT_TOTAL_RETURN");
  assert.equal(b3.metrics.length, 3);
  assert.deepEqual(b3.metrics.map((m) => m.value), [45, 2, -6.42]);
  assert.equal(a3.metrics[0].evidenceUuid, "69dfaa87-cab9-4a5b-be09-fe78c0c0d198");
  assert.equal(a3.metrics[0].citedInDossier, true);
  assert.equal(a3.metrics[1].citedInDossier, false);
  assert.equal(a3.metrics[0].sourceReleaseAt, null, "provider release clock is unknown");
});

test("C1 missing issuer fundamentals and policy-futures do not become synthetic risk scores", () => {
  const read = result();
  for (const id of ["A1", "A2", "A4", "B1", "B2", "B4"]) {
    const a = read.assumptions.find((item) => item.assumptionId === id)!;
    assert.equal(a.observationQuality, "MISSING");
    assert.equal(a.interpretation, "UNRESOLVED");
    assert.equal(a.metrics.length, 0);
  }
  assert.ok(read.assumptions.every((assumption) => assumption.interpretation === "UNRESOLVED"));
  assert.equal(read.assumptions.length, 9);
});

test("C1 a late-arriving observation is unavailable to historical Dossier as-of", () => {
  const rows = fiveRows();
  rows[0] = makeRow("hy_oas_20s", { received_at: "2026-10-11T09:00:00Z" });
  const r = result(rows);
  const hy = r.assumptions.find((a) => a.assumptionId === "A3")!.metrics[0];
  assert.equal(hy.quality, "MISSING");
  assert.equal(hy.value, null);
  assert.equal(hy.evidenceUuid, null);
});

test("C1 no missing-as-zero, and old observations are labelled stale", () => {
  const missing = result([]);
  assert.equal(missing.currentMetricCount, 0);
  const a3 = missing.assumptions.find((a) => a.assumptionId === "A3")!;
  assert.equal(a3.metrics[0].quality, "MISSING");
  assert.equal(a3.metrics[0].value, null);

  const stale = result(fiveRows(), "2026-10-20T18:00:00Z");
  assert.equal(stale.currentMetricCount, 0);
  assert.equal(stale.assumptions.find((a) => a.assumptionId === "A3")!.metrics[0].quality, "STALE");
  assert.equal(stale.assumptions.find((a) => a.assumptionId === "A3")!.metrics[0].value, 45);
  const zero = result([makeRow("hy_oas_20s", { observed_value: 0 })]);
  assert.equal(zero.assumptions.find((a) => a.assumptionId === "A3")!.metrics[0].value, 0);
});

test("C1 same-day contradictory revision cannot be selected as a true price observation", () => {
  const a = makeRow("hy_oas_20s");
  const b = makeRow("hy_oas_20s", { id: "a3e7bc90-1111-4111-8111-111111111111", content_hash: "b".repeat(64), observed_value: 50 });
  const r = result([a, b]);
  const hy = r.assumptions.find((x) => x.assumptionId === "A3")!.metrics[0];
  assert.equal(hy.quality, "CONFLICTED");
  assert.equal(hy.value, null);
  assert.equal(hy.evidenceUuid, null);
});

test("C1 reject wrong unit, spoofed source URL and broken canonical provenance", () => {
  let r = result([makeRow("hy_oas_20s", { measurement_unit: "percentage_points" })]);
  assert.equal(r.assumptions.find((x) => x.assumptionId === "A3")!.metrics[0].quality, "DEFINITION_MISMATCH");
  r = result([makeRow("hy_oas_20s", { provenance_urls: ["https://example.com/fake"] })]);
  assert.equal(r.assumptions.find((x) => x.assumptionId === "A3")!.metrics[0].quality, "UNVERIFIED");
  r = result([makeRow("hy_oas_20s", { normalised_observation_id: null })]);
  assert.equal(r.assumptions.find((x) => x.assumptionId === "A3")!.metrics[0].quality, "UNVERIFIED");
});

test("C1 reader and API are exact Dossier, bounded and cannot write Story or inferred thresholds", () => {
  const pure = readFileSync(new URL("../lib/regime-assumption-observations.ts", import.meta.url), "utf8");
  const reader = readFileSync(new URL("../lib/regime-assumption-observation-reader.ts", import.meta.url), "utf8");
  const api = readFileSync(new URL("../app/api/regime-assumption-observations/route.ts", import.meta.url), "utf8");
  const page = readFileSync(new URL("../app/hybrid-output/page.tsx", import.meta.url), "utf8");
  assert.match(reader, /getMarketDossierV2ById\(dossierId, client\)/);
  assert.match(reader, /\.like\("external_evidence_id", "market-crack:%"\)/);
  assert.match(reader, /\.limit\(60\)/);
  assert.match(api, /REGIME_ASSUMPTION_OBSERVATIONS_VERSION/);
  assert.match(page, /loadRegimeAssumptionObservationReport\(/);
  assert.doesNotMatch(pure, /supabase|story_thesis_versions|update\(|upsert\(/);
  assert.doesNotMatch(reader, /\.upsert\(|\.update\(|story_thesis_versions/);
  assert.doesNotMatch(api, /story_thesis_versions|modelRunner|A2Decision/);
});
