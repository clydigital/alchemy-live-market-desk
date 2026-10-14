import assert from "node:assert/strict";
import test from "node:test";

import {
  assembleDossierV2InputPacket,
  type CandidateSnapshot,
} from "../lib/dossier-v2/input-packet.ts";

const SUNDAY_AS_OF = "2026-10-11T19:09:59.440Z";

function rate(
  id: string,
  observationDate = "2026-10-09",
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    evidence_id: `market-monitor:${id}:${observationDate}`,
    canonical_record_backed: false,
    category: "Rates",
    claim_or_fact: `FRED ${id} was 4.25% on ${observationDate}.`,
    source_type: "MARKET_DATA",
    grouping_key: `market-monitor:${id}`,
    available_at: `${observationDate}T23:59:59.999Z`,
    occurrence_time: `${observationDate}T00:00:00.000Z`,
    metrics: {
      last: 4.25,
      symbol: id === "us10y-fred" ? "DGS10" : id === "us10y-breakeven" ? "T10YIE" : "DGS2",
      frequency: "daily",
      provider: "Federal Reserve Economic Data",
      provider_as_of: observationDate,
      is_canonical_evidence: false,
      measurement_unit: "percentage_points",
    },
    provenance: [{
      source_type: "FRED",
      source_id: `market-monitor:${id}`,
      url: "https://fred.stlouisfed.org/series/DGS10",
      publisher: "Federal Reserve Economic Data",
    }],
    ...overrides,
  };
}

function packet(items: Record<string, unknown>[], asOf = SUNDAY_AS_OF) {
  return assembleDossierV2InputPacket(
    { as_of: asOf },
    {
      observed_evidence: items,
      price_data: { status: "OK", available_at: asOf },
      macro_data: { status: "OK", available_at: asOf },
    } as CandidateSnapshot,
  );
}

test("Friday official FRED 10Y rates survive in Sunday's bounded rate context, not fresh news", () => {
  const p = packet([
    rate("us10y-fred"),
    rate("us10y-breakeven"),
    rate("us2y"),
  ]);
  const protectedIds = new Set((p.rate_context?.evidence ?? []).map((item) => item.evidence_id));
  assert.ok(protectedIds.has("market-monitor:us10y-fred:2026-10-09"));
  assert.ok(protectedIds.has("market-monitor:us10y-breakeven:2026-10-09"));
  assert.ok(protectedIds.has("market-monitor:us2y:2026-10-09"));
  assert.equal(p.observed_evidence.some((item) => item.evidence_id.startsWith("market-monitor:")), false);
  const tenYear = p.rate_context?.evidence.find((item) => item.evidence_id === "market-monitor:us10y-fred:2026-10-09");
  assert.equal(tenYear?.available_at, "2026-10-09T23:59:59.999Z");
  assert.equal(tenYear?.metrics?.is_canonical_evidence, false);
});

test("stale, non-rate, untrusted and post-as-of rows cannot enter protected context", () => {
  const rows = [
    rate("us10y-fred", "2026-10-03"),  // older than five days
    rate("spx"),                      // non-rate monitor
    rate("us10y-breakeven", "2026-10-09", { metrics: {
      last: 2.34, frequency: "daily", provider: "Unknown Provider",
      provider_as_of: "2026-10-09", is_canonical_evidence: false,
    } }),
    rate("us2y", "2026-10-13"),      // future as-of
  ];
  const p = packet(rows);
  assert.equal(p.rate_context?.evidence.some((item) => item.evidence_id.startsWith("market-monitor:")), false);
  assert.equal(p.observed_evidence.some((item) => item.evidence_id.startsWith("market-monitor:")), false);
});

test("five-day expiry cannot make old observations look freshly observed", () => {
  const p = packet([rate("us10y-fred")], "2026-10-16T19:09:59.440Z");
  assert.equal(p.rate_context?.evidence.some((item) => item.evidence_id.startsWith("market-monitor:")), false);
});

test("all five eligible Treasury tenors survive a saturated rate context budget", () => {
  const asOf = "2026-10-14T20:00:00.000Z";
  const tenors = ["us2y", "us5y-fred", "us10y-fred", "us20y-fred", "us30y-fred"];
  const crowdedReports = Array.from({ length: 32 }, (_, i) => ({
    evidence_id: "verified-macro:cpi-" + i,
    claim_or_fact: "Official CPI observed data point " + i + " for September.",
    category: "Macro", source_type: "OFFICIAL_DATA", grouping_key: "official-cpi-" + i,
    available_at: "2026-10-14T12:00:00.000Z", occurrence_time: "2026-10-14T12:00:00.000Z",
    metrics: { signal_kind: "economic_release", observed_value: 1 + i },
    provenance: [{ source_type: "OFFICIAL_DATA", source_id: "cpi-" + i, url: "https://www.bls.gov/news.release/cpi.toc.htm" }],
  }));
  const p = packet([...tenors.map((id) => rate(id, "2026-10-13")), ...crowdedReports], asOf);
  const ids = new Set(p.rate_context?.evidence.map((item) => item.evidence_id) ?? []);
  for (const id of tenors) assert.ok(ids.has("market-monitor:" + id + ":2026-10-13"), id);
  assert.ok((p.rate_context?.evidence.length ?? 0) <= 24);
});

test("official Treasury observations are protected as dated rates context within five days", () => {
  const ids = ["us2y", "us5y-fred", "us10y-fred", "us20y-fred", "us30y-fred"];
  const rows = ids.map((id) => rate(id, "2026-10-09", {
    metrics: { last: 4.5, frequency: "daily", provider: "U.S. Department of the Treasury",
      provider_as_of: "2026-10-09", is_canonical_evidence: false },
    provenance: [{ source_type: "MARKET_DATA", source_id: "market-monitor:" + id,
      url: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/textview",
      publisher: "U.S. Department of the Treasury" }],
  }));
  const sunday = packet(rows);
  for (const id of ids) assert.ok(sunday.rate_context?.evidence.some((item) =>
    item.evidence_id === "market-monitor:" + id + ":2026-10-09"), id);
  const stale = packet(rows, "2026-10-16T20:00:00.000Z");
  assert.equal(stale.rate_context?.evidence.some((item) => item.evidence_id.startsWith("market-monitor:")), false);
});
