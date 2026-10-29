import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { PUBLIC_MARKET_GROUPS, publicMarketGroup, publicMarketObservations } from "../lib/blue-desk-public-markets.ts";
import type { MarketMonitorRow } from "../lib/market-monitor.ts";

function marketRow(partial: Partial<MarketMonitorRow> & Pick<MarketMonitorRow, "id" | "type">): MarketMonitorRow {
  const { id, type, ...remaining } = partial;
  return {
    id, type,
    label: partial.label || id,
    symbol: partial.symbol || partial.id.toUpperCase(),
    last: 4.42, previousClose: 4.37, dayChange: 1.21,
    gapChange: 0.4, change3d: 3.1, change5d: 5.1, rsi: 71,
    stochRsi: 79, volPercentile: 93, attentionScore: 999,
    hot: true, contradiction: true, tags: ["PRIVATE RESEARCH"],
    benchmark: null, sessionOpen: null, relative5d: null,
    asOf: "2026-10-19", frequency: "daily",
    sourceName: "Federal Reserve", sourceUrl: "https://fred.stlouisfed.org/series/DGS10",
    points: [{ time: 1, close: 3 }, { time: 2, close: 4 }],
    ...remaining,
  };
}

test("public group selector defaults to all on unsupported or repeated values", () => {
  assert.equal(publicMarketGroup("rates"), "rates");
  assert.equal(publicMarketGroup("ai"), "ai");
  assert.equal(publicMarketGroup("oil"), "all");
  assert.equal(publicMarketGroup(["rates", "fx"]), "all");
  assert.equal(publicMarketGroup(undefined), "all");
  assert.equal(new Set(PUBLIC_MARKET_GROUPS.map(item => item.id)).size, PUBLIC_MARKET_GROUPS.length);
});

test("public Markets projection excludes internal signals, history, and private research attributes", () => {
  const raw = marketRow({ id: "us10y", type: "Rates" });
  const [publicRow] = publicMarketObservations([raw], "rates");
  assert.ok(publicRow);
  assert.equal(publicRow.last, 4.42);
  assert.ok(Math.abs((publicRow.change || 0) - 5) < 1e-6);
  assert.equal(publicRow.changeUnit, "bp");
  assert.equal(publicRow.change3d, null); // No 4-session history in the fixture
  assert.equal(publicRow.change5d, null);
  assert.equal(publicRow.asOf, "2026-10-19");
  assert.equal(publicRow.sourceUrl, "https://fred.stlouisfed.org/series/DGS10");
  for (const forbidden of ["points", "hot", "attentionScore", "contradiction",
    "tags", "rsi", "stochRsi", "benchmark", "volPercentile", "researchTriggers"]) {
    assert.equal(Object.hasOwn(publicRow, forbidden), false, forbidden);
  }
  assert.deepEqual(publicMarketObservations([raw], "energy"), []);
});

test("monthly fallback yields expose a level but no daily or intraday move", () => {
  const [row] = publicMarketObservations([marketRow({
    id: "jpy-10y", type: "Rates", frequency: "monthly", asOf: "2026-09-30",
  })], "rates");
  assert.equal(row.last, 4.42);
  assert.equal(row.change, null);
  assert.equal(row.change3d, null);
  assert.equal(row.change5d, null);
  assert.equal(row.frequency, "monthly");
});

test("missing or invalid provider values cannot become observed numbers or unsafe source links", () => {
  const [row] = publicMarketObservations([marketRow({
    id: "brent", type: "Energy", last: NaN, dayChange: Infinity,
    sourceUrl: "http://localhost/internal", asOf: null,
  })], "energy");
  assert.equal(row.last, null);
  assert.equal(row.change, null);
  assert.equal(row.sourceUrl, null);
  assert.equal(row.asOf, null);
  assert.equal(row.changeUnit, "%");
});

test("source-dated public Markets is server-rendered, bounded, and preserves old private terminal", () => {
  const page = readFileSync(new URL("../app/blue-desk/markets/page.tsx", import.meta.url), "utf8");
  const presenter = readFileSync(new URL("../app/owner/markets/page.tsx", import.meta.url), "utf8");
  const host = readFileSync(new URL("../lib/blue-desk-host.ts", import.meta.url), "utf8");
  assert.match(page, /getMarketMonitor\(\)\.catch\(\(\) => null\)/);
  assert.match(page, /publicMarketObservations\(monitor\?\.rows \|\| \[\], group\)/);
  const screener = readFileSync(new URL("../components/blue-desk/PublicMarketScreener.tsx", import.meta.url), "utf8");
  assert.match(page, /<PublicMarketScreener key=/);
  assert.match(screener, /row\.sourceUrl/);
  assert.match(screener, /row\.asOf/);
  assert.match(screener, /row\.frequency/);
  assert.match(screener, /data-market-change-screener="read-only"/);
  assert.doesNotMatch(page + screener, /createSupabaseAdminClient|service_role|updateStory|researchTriggers|MarketMonitor monitor=/);
  assert.match(presenter, /<MarketsMonitor monitor=\{monitor\} flows=\{flows\} \/>/);
  assert.doesNotMatch(presenter, /LiveDeskShell/);
  assert.match(host, /pathname === "\/markets"/);
  assert.match(host, /pathname === "\/blue-desk\/markets"/);
});

test("three and five-session changes use existing summary values for daily securities", () => {
  const [row] = publicMarketObservations([marketRow({
    id: "nvda", type: "MAG7", last: 140, previousClose: 138,
    dayChange: 1.45, change3d: -2.7, change5d: 8.9,
  })], "all");
  assert.equal(row.change, 1.45);
  assert.equal(row.change3d, -2.7);
  assert.equal(row.change5d, 8.9);
  assert.equal(row.changeUnit, "%");
  assert.equal(Object.hasOwn(row, "points"), false);
  assert.equal(Object.hasOwn(row, "attentionScore"), false);
});

test("government-rate 1D/3D/5D changes are differences in bp, not rate-level percent returns", () => {
  const points = [4.0, 4.1, 4.2, 4.3, 4.4, 4.41]
    .map((close, index) => ({ time: 1792800000 + index * 86400, close }));
  const [row] = publicMarketObservations([marketRow({
    id: "us10y", type: "Rates", last: 4.41, previousClose: 4.4,
    points, change3d: 99, change5d: 99,
  })], "rates");
  assert.ok(Math.abs((row.change || 0) - 1) < 1e-6);
  assert.equal(row.change3d, 21);
  assert.equal(row.change5d, 41);
  assert.equal(row.changeUnit, "bp");
  assert.equal(Object.hasOwn(row, "points"), false);
  const [tooShort] = publicMarketObservations([marketRow({
    id: "us10y", type: "Rates", last: 4.41, points: points.slice(-2),
  })], "rates");
  assert.equal(tooShort.change3d, null);
  assert.equal(tooShort.change5d, null);
});
