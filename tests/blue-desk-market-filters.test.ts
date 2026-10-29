import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { filterPublicMarketObservations, type PublicMarketFilters } from "../lib/blue-desk-market-filters.ts";
import type { PublicMarketObservation } from "../lib/blue-desk-public-markets.ts";

function row(id: string, change: number | null, unit: "%" | "bp" = "%"): PublicMarketObservation {
  return {
    id, symbol: id.toUpperCase(), label: id, type: unit === "bp" ? "Rates" : "Major Index",
    last: 100, change, changeUnit: unit, asOf: "2026-10-29",
    frequency: "daily", sourceName: "Public source", sourceUrl: "https://example.org/data",
  };
}

const rows = [
  row("rise", 2.1), row("fall", -3.2), row("small", 0.4),
  row("unchanged", 0), row("missing", null), row("yield", 12, "bp"),
];

const defaults: PublicMarketFilters = {
  query: "", unit: "all", direction: "all", minMove: 0, sort: "source",
};

test("unchanged screener displays the full source-qualified public selection, including missing changes", () => {
  assert.deepEqual(filterPublicMarketObservations(rows, defaults).map(x => x.id), rows.map(x => x.id));
});

test("percentage thresholds handle rising, falling and absolute magnitude correctly", () => {
  const up = filterPublicMarketObservations(rows, { ...defaults, unit: "%", direction: "up", minMove: 1 });
  assert.deepEqual(up.map(x => x.id), ["rise"]);
  const down = filterPublicMarketObservations(rows, { ...defaults, unit: "%", direction: "down", minMove: 3 });
  assert.deepEqual(down.map(x => x.id), ["fall"]);
  const absolute = filterPublicMarketObservations(rows, { ...defaults, unit: "%", minMove: 2 });
  assert.deepEqual(absolute.map(x => x.id), ["rise", "fall"]);
});

test("basis point changes are independent; no percentage-vs-bp comparison or fabricated zero", () => {
  const bps = filterPublicMarketObservations(rows, { ...defaults, unit: "bp", minMove: 10 });
  assert.deepEqual(bps.map(x => x.id), ["yield"]);
  const missing = filterPublicMarketObservations(rows, { ...defaults, unit: "%", minMove: 0.01 });
  assert.equal(missing.some(x => x.id === "missing"), false);
  assert.deepEqual(filterPublicMarketObservations(rows, { ...defaults, unit: "%", direction: "up" }).map(x => x.id), ["rise", "small"]);
});

test("largest move sorting keeps units in independent blocks and null values last", () => {
  const ranked = filterPublicMarketObservations(rows, { ...defaults, sort: "magnitude" }).map(x => x.id);
  assert.deepEqual(ranked, ["fall", "rise", "small", "unchanged", "yield", "missing"]);
  assert.deepEqual(filterPublicMarketObservations(rows, { ...defaults, query: "RISE", sort: "name" }).map(x => x.id), ["rise"]);
});

test("invalid threshold does not suppress rows, and all filters remain UI-only", () => {
  assert.equal(filterPublicMarketObservations(rows, { ...defaults, minMove: Number.NaN }).length, rows.length);
  const ui = readFileSync(new URL("../components/blue-desk/PublicMarketScreener.tsx", import.meta.url), "utf8");
  assert.match(ui, /Up ≥1%/);
  assert.match(ui, /Rates ≥10 bp/);
  assert.match(ui, /type="number"/);
  assert.doesNotMatch(ui, /fetch\(|supabase|service_role|submit\(/i);
});
