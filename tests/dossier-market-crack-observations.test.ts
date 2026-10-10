import assert from "node:assert/strict";
import test from "node:test";

import { deriveMarketCrackObservations, type MarketCrackSeries } from "../lib/dossier-v2/market-crack-observations.ts";
import { augmentCandidateSnapshotWithMarketMonitor, buildCandidateSnapshotFromCanonicalEvidence } from "../lib/dossier-v2/canonical-snapshot.ts";

const AS_OF = "2026-10-10T07:00:00.000Z";
const sessions: string[] = [];
for (let i = 0; i <= 32; i++) {
  const d = new Date(Date.UTC(2026, 8, 11 + i));
  if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) sessions.push(d.toISOString().slice(0, 10));
  if (sessions.length === 21) break;
}
assert.equal(sessions.length, 21);
assert.equal(sessions[0], "2026-09-11");
assert.equal(sessions.at(-1), "2026-10-09");

function series(id: string, symbol: string, start: number, end: number, overrides: Partial<MarketCrackSeries> = {}): MarketCrackSeries {
  const isFred = id === "hy-oas" || id === "ig-oas" || id === "spx";
  const values = sessions.map((date, index) => ({
    time: Date.parse(date + "T00:00:00Z") / 1000,
    close: start + (end - start) * index / 20,
  }));
  return {
    id, symbol, label: id, asOf: sessions.at(-1)!, last: end, frequency: "daily",
    sourceName: isFred ? "Federal Reserve Economic Data" : "Nasdaq official etf history",
    sourceUrl: "https://example.com/" + id, points: values, ...overrides,
  };
}

function universe(): MarketCrackSeries[] {
  return [
    series("hy-oas", "BAMLH0A0HYM2", 3, 3.5),
    series("ig-oas", "BAMLC0A0CM", 1.0, 1.1),
    series("smh", "SMH", 100, 110),
    series("ndx", "QQQ", 100, 105),
    series("xlf", "XLF", 100, 90),
    series("spx", "SP500", 100, 98),
    series("rsp", "RSP", 100, 101),
  ];
}

test("20-session measured OAS changes are in bps, never percent returns", () => {
  const checks = deriveMarketCrackObservations(universe(), AS_OF);
  const hy = checks.find((item) => item.key === "hy_oas_20s")!;
  const ig = checks.find((item) => item.key === "ig_oas_20s")!;
  assert.equal(hy.status, "OK");
  assert.equal(ig.status, "OK");
  assert.equal(hy.unit, "basis_points");
  assert.equal(hy.observedValue, 50);
  assert.equal(ig.observedValue, 10);
  assert.equal(hy.sessions, 20);
  assert.equal(hy.baselineDate, "2026-09-11");
  assert.equal(hy.lastDate, "2026-10-09");
});

test("SMH/QQQ, XLF/SPX and RSP/SPX comparisons use the exact same 21 dates", () => {
  const checks = deriveMarketCrackObservations(universe(), AS_OF);
  assert.equal(checks.find((item) => item.key === "smh_qqq_20s")!.observedValue, 5);
  assert.equal(checks.find((item) => item.key === "xlf_spx_20s")!.observedValue, -8);
  assert.equal(checks.find((item) => item.key === "rsp_spx_20s")!.observedValue, 3);
  assert.ok(checks.every((item) => item.status === "OK"));
});

test("an unpaired extra last session must not compare mismatched dates", () => {
  const rows = universe();
  const smh = rows.find((item) => item.id === "smh")!;
  smh.points!.push({ time: Date.parse("2026-10-10T00:00:00Z") / 1000, close: 1000 });
  smh.asOf = "2026-10-10";
  const measured = deriveMarketCrackObservations(rows, AS_OF);
  const result = measured.find((item) => item.key === "smh_qqq_20s")!;
  assert.equal(result.status, "OK");
  assert.equal(result.lastDate, "2026-10-09");
  assert.equal(result.observedValue, 5);
  const qqq = rows.find((item) => item.id === "ndx")!;
  qqq.points!.splice(8, 1);
  const insufficient = deriveMarketCrackObservations(rows, AS_OF).find((item) => item.key === "smh_qqq_20s")!;
  assert.equal(insufficient.status, "UNAVAILABLE");
  assert.equal(insufficient.reason, "INSUFFICIENT_MATCHED_SESSIONS");
  assert.equal(insufficient.observedValue, null);
});

test("missing, stale, monthly, misidentified OAS and insufficient histories fail closed", () => {
  const rows = universe();
  assert.equal(deriveMarketCrackObservations(rows.filter((r) => r.id !== "hy-oas"), AS_OF)[0].reason, "MISSING_PROVIDER_SERIES");
  assert.ok(deriveMarketCrackObservations(rows, "2026-10-20T07:00:00Z").every((r) => r.status === "UNAVAILABLE"));
  const wrong = rows.map((r) => r.id === "hy-oas" ? { ...r, symbol: "HYG" } : r);
  assert.equal(deriveMarketCrackObservations(wrong, AS_OF)[0].reason, "UNVERIFIED_OAS_SERIES");
  const monthly = rows.map((r) => r.id === "ig-oas" ? { ...r, frequency: "monthly" as const } : r);
  assert.equal(deriveMarketCrackObservations(monthly, AS_OF)[1].reason, "NONDAILY_SERIES");
  const incomplete = rows.map((r) => r.id === "smh" ? { ...r, points: r.points!.slice(-6) } : r);
  assert.equal(deriveMarketCrackObservations(incomplete, AS_OF)[2].observedValue, null);
  const invalid = rows.map((r) => r.id === "xlf" ? { ...r, points: r.points!.map((p, i) => i === 0 ? { ...p, close: Number.NaN } : p) } : r);
  assert.equal(deriveMarketCrackObservations(invalid, AS_OF)[3].reason, "INSUFFICIENT_MATCHED_SESSIONS");
});

test("Dossier market monitor adds only explicitly noncanonical dated quantitative observations", () => {
  const base = buildCandidateSnapshotFromCanonicalEvidence([], { asOf: AS_OF });
  const rows = universe().map((row) => ({
    ...row, type: row.id.includes("oas") ? "Credit / Risk" : row.id === "spx" || row.id === "ndx" ? "Major Index" : "AI / Semis",
    dayChange: 7, change5d: 12, attentionScore: 70,
  }));
  const result = augmentCandidateSnapshotWithMarketMonitor(base, { updatedAt: AS_OF, rows, limitations: [] }, { asOf: AS_OF });
  const derived = result.snapshot.observed_evidence!.filter((row) => String(row.evidence_id).startsWith("market-monitor-measured:"));
  assert.equal(derived.length, 5);
  assert.ok(derived.every((item) => item.canonical_record_backed === false && (item.metrics as Record<string, unknown>).is_canonical_evidence === false));
  assert.ok(derived.every((item) => item.available_at === "2026-10-09T23:59:59.999Z"));
  const hy = derived.find((row) => String(row.evidence_id).includes("hy_oas"))!;
  assert.equal((hy.metrics as Record<string, unknown>).observed_value, 50);
  assert.equal((hy.metrics as Record<string, unknown>).measurement_unit, "basis_points");
  assert.equal((hy.provenance as unknown[]).length, 1);
  const smh = derived.find((row) => String(row.evidence_id).includes("smh_qqq"))!;
  assert.equal((smh.provenance as unknown[]).length, 2);
  assert.equal(result.snapshot.sources_status?.market_crack_diagnostics?.status, "OK");

  const rawHy = result.snapshot.observed_evidence!.find((row) => row.evidence_id === "market-monitor:hy-oas:2026-10-09")!;
  const rawMetrics = rawHy.metrics as Record<string, unknown>;
  assert.equal(rawMetrics.change_5d_bp, null);
  assert.equal(rawMetrics.measurement_unit, "percentage_points");
  assert.equal(rawMetrics.change_5d_pct, undefined);
  assert.equal(rawHy.available_at, "2026-10-09T23:59:59.999Z");
  assert.equal(result.snapshot.macro_data?.available_at, "2026-10-09T23:59:59.999Z");
});

test("stale monitor closes do not masquerade as today's price evidence or health", () => {
  const base = buildCandidateSnapshotFromCanonicalEvidence([], { asOf: AS_OF });
  const rows = universe().map((row) => ({
    ...row, asOf: "2026-09-30", points: row.points!.slice(0, 14),
    type: "Rates", dayChange: 25, change5d: 25,
  }));
  const result = augmentCandidateSnapshotWithMarketMonitor(base, { updatedAt: AS_OF, rows }, { asOf: AS_OF });
  assert.equal(result.snapshot.sources_status?.market_monitor?.status, "WARNING");
  assert.equal(result.snapshot.observed_evidence?.length, 0);
  assert.notEqual(result.snapshot.price_data?.status, "OK");
  assert.notEqual(result.snapshot.macro_data?.status, "OK");
});
