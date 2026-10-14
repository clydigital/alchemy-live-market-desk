import assert from "node:assert/strict";
import test from "node:test";
import { augmentCandidateSnapshotWithMarketMonitor, verifiedLiveFredSameDayAvailability, type CanonicalSnapshotResult } from "../lib/dossier-v2/canonical-snapshot.ts";
import { assembleDossierV2InputPacket } from "../lib/dossier-v2/input-packet.ts";

const day = "2026-10-14";
const asOf = "2026-10-14T21:50:53.517Z";
const observedAt = "2026-10-14T21:50:30.000Z";
const row = { id: "us10y-breakeven", asOf: day, frequency: "daily" as const, sourceName: "Federal Reserve Economic Data" };

test("verified near-live FRED retrieval admits a daily dated breakeven without inventing publication time", () => {
  const actual = verifiedLiveFredSameDayAvailability(row, observedAt, asOf, Date.parse(asOf));
  assert.equal(actual, observedAt);
  assert.equal(verifiedLiveFredSameDayAvailability({ ...row, id: "us10y-real" }, observedAt, asOf, Date.parse(asOf)), observedAt);
});

test("FRED receipt admission rejects historical replay, wrong day, future retrieval and untrusted sources", () => {
  assert.equal(verifiedLiveFredSameDayAvailability(row, observedAt, asOf, Date.parse("2026-10-16T21:50:53Z")), null);
  assert.equal(verifiedLiveFredSameDayAvailability(row, "2026-10-14T21:51:00Z", asOf, Date.parse(asOf)), null);
  assert.equal(verifiedLiveFredSameDayAvailability(row, "2026-10-14T20:20:00Z", asOf, Date.parse(asOf)), null);
  assert.equal(verifiedLiveFredSameDayAvailability({ ...row, asOf: "2026-10-13" }, observedAt, asOf, Date.parse(asOf)), null);
  assert.equal(verifiedLiveFredSameDayAvailability({ ...row, id: "us2y" }, observedAt, asOf, Date.parse(asOf)), null);
  assert.equal(verifiedLiveFredSameDayAvailability({ ...row, sourceName: "Unknown Provider" }, observedAt, asOf, Date.parse(asOf)), null);
});

test("live monitoring of same-day breakeven carries the actual receipt into rates context metadata", () => {
  const now = new Date();
  const currentAsOf = now.toISOString();
  const receivedAt = new Date(now.getTime() - 1000).toISOString();
  if (receivedAt.slice(0, 10) !== currentAsOf.slice(0, 10)) return;
  const observationDate = currentAsOf.slice(0, 10);
  const base: CanonicalSnapshotResult = {
    snapshot: { observed_evidence: [] },
    diagnostics: { rows_considered: 0, observed_count: 0, lead_count: 0, catalyst_count: 0,
      skipped_future_count: 0, skipped_expired_scheduled_count: 0, latest_available_at: null,
      price_data_status: "MISSING", macro_data_status: "MISSING" },
  };
  const output = augmentCandidateSnapshotWithMarketMonitor(base, {
    updatedAt: receivedAt,
    rows: [{ id: "us10y-breakeven", symbol: "T10YIE", label: "US 10Y Breakeven Inflation",
      type: "Rates", last: 2.35, dayChange: null, change5d: null, asOf: observationDate,
      frequency: "daily", sourceName: "Federal Reserve Economic Data",
      sourceUrl: "https://fred.stlouisfed.org/series/T10YIE",
      points: [{time: Date.parse(observationDate + "T00:00:00Z") / 1000, close: 2.35}] }],
    breadth: [],
  }, { asOf: currentAsOf });
  const evidence = (output.snapshot.observed_evidence ?? []).find((item) => item.evidence_id === "market-monitor:us10y-breakeven:" + observationDate);
  assert.ok(evidence, "The same-day FRED reading must survive the canonical monitor gate.");
  assert.equal(evidence.available_at, receivedAt);
  assert.equal((evidence.metrics as Record<string, unknown>)?.availability_basis, "verified_live_monitor_retrieval");
  assert.equal(output.snapshot.macro_data?.available_at, receivedAt);
  const packet = assembleDossierV2InputPacket({ as_of: currentAsOf }, output.snapshot);
  assert.ok(packet.rate_context?.evidence.some((item) => item.evidence_id === evidence.evidence_id),
    "The FRED breakeven must survive Dossier rate-context selection, not just market monitor admission.");
});
