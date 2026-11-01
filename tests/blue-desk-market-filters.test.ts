import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { filterPublicMarketObservations, sortPublicMarketColumns, type PublicMarketFilters } from "../lib/blue-desk-market-filters.ts";
import type { PublicMarketObservation } from "../lib/blue-desk-public-markets.ts";

function row(id: string, change: number | null, unit: "%" | "bp" = "%"): PublicMarketObservation {
  return {
    id, symbol: id.toUpperCase(), label: id, type: unit === "bp" ? "Rates" : "Major Index",
    last: 100, change, change3d: change === null ? null : change * 2,
    change5d: change === null ? null : change * 3, changeUnit: unit, asOf: "2026-10-29",
    frequency: "daily", sourceName: "Public source", sourceUrl: "https://example.org/data",
  };
}

const rows = [
  row("rise", 2.1), row("fall", -3.2), row("small", 0.4),
  row("unchanged", 0), row("missing", null), row("yield", 12, "bp"),
];

const defaults: PublicMarketFilters = {
  query: "", window: "1D", unit: "all", direction: "all", minMove: 0, sort: "source",
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

test("3D and 5D thresholds, direction and sorting use the selected sessions, not 1D", () => {
  const multi = [
    { ...row("reversal", -0.4), change3d: 2.8, change5d: -5 },
    { ...row("rally", 1.8), change3d: -1.2, change5d: 7 },
    { ...row("unavailable", 2.2), change3d: null, change5d: null },
  ];
  const up3 = filterPublicMarketObservations(multi, { ...defaults, window: "3D", unit: "%", direction: "up", minMove: 2 });
  assert.deepEqual(up3.map(x => x.id), ["reversal"]);
  const down5 = filterPublicMarketObservations(multi, { ...defaults, window: "5D", unit: "%", direction: "down", minMove: 3 });
  assert.deepEqual(down5.map(x => x.id), ["reversal"]);
  const magnitude5 = filterPublicMarketObservations(multi, { ...defaults, window: "5D", sort: "magnitude" });
  assert.deepEqual(magnitude5.map(x => x.id), ["rally", "reversal", "unavailable"]);
});

test("rate changes remain in bp across sessions and absent windows are not treated as zero", () => {
  const yieldRow = { ...row("yield", 12, "bp"), change3d: -8, change5d: 20 };
  const match = filterPublicMarketObservations([yieldRow], { ...defaults, window: "5D", unit: "bp", minMove: 15 });
  assert.equal(match.length, 1);
  assert.equal(filterPublicMarketObservations([yieldRow], { ...defaults, window: "3D", unit: "bp", minMove: 10 }).length, 0);
});

test("clickable columns sort both directions, keep missing observations last and do not mix units",()=>{
  const ordered=sortPublicMarketColumns(rows,"1D",false);
  assert.deepEqual(ordered.map(x=>x.id),["rise","small","unchanged","fall","yield","missing"]);
  const reverse=sortPublicMarketColumns(rows,"1D",true);
  assert.deepEqual(reverse.map(x=>x.id),["fall","unchanged","small","rise","yield","missing"]);
  const levels=sortPublicMarketColumns([row("unknown",null),{...row("expensive",1),last:500}], "last", false);
  assert.equal(levels[0].id,"expensive");
  assert.deepEqual(sortPublicMarketColumns(rows,"instrument",true).map(x=>x.id),
    ["fall","missing","rise","small","unchanged","yield"]);
  const ui=readFileSync(new URL("../components/blue-desk/PublicMarketScreener.tsx", import.meta.url),"utf8");
  assert.match(ui,/sortPublicMarketColumns\(filtered, columnSort, ascending\)/);
  assert.match(ui,/onClick=\{\(\)=>sortColumn\(period\)\}/);
  assert.match(ui,/aria-sort=/);
});


test("search can find breadth tickers and Power Stack-only holdings even with null prices", () => {
  const breadth = { ...row("breadth", null), type: "Breadth" as const, label: "S&P 500 above 50D", symbol: "S5FI", last: null };
  const holding = { ...row("holding", null), type: "Power Stack" as const, symbol: "DAYANG", label: "Dayang Enterprise", last: null, researchRole: "holding" as const };
  assert.deepEqual(filterPublicMarketObservations([breadth, holding], {...defaults, query:"S5FI"}).map(x=>x.symbol), ["S5FI"]);
  assert.deepEqual(filterPublicMarketObservations([breadth, holding], {...defaults, query:"DAYANG"}).map(x=>x.symbol), ["DAYANG"]);
  assert.equal(filterPublicMarketObservations([breadth, holding], {...defaults, unit:"%", minMove:1}).length, 0);
});
