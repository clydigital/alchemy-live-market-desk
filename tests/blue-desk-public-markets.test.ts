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

test("source-dated public Markets keeps its server projection and private owner terminal", () => {
  const page = readFileSync(new URL("../app/blue-desk/markets/page.tsx", import.meta.url), "utf8");
  const reader = readFileSync(new URL("../app/blue-desk/markets/BlueDeskMarketReader.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/blue-desk/markets/markets-reader.module.css", import.meta.url), "utf8");
  const presenter = readFileSync(new URL("../app/owner/markets/page.tsx", import.meta.url), "utf8");
  const host = readFileSync(new URL("../lib/blue-desk-host.ts", import.meta.url), "utf8");

  // Only the existing authorised, capped public projection reaches the client.
  assert.match(page, /getMarketMonitor\(\)\.catch\(\(\) => null\)/);
  assert.match(page, /publicMarketObservations\(monitor\?\.rows \|\| \[\], group\)/);
  assert.match(page, /<BlueDeskMarketReader observations=\{observations\} \/>/);
  assert.match(page, /PUBLIC_MARKET_GROUPS\.map/);
  assert.doesNotMatch(page, /createSupabaseAdminClient|service_role|updateStory|researchTriggers|MarketMonitor monitor=/);
  assert.match(reader, /"use client"/);
  assert.match(reader, /readonly PublicMarketObservation\[\]/);
  assert.doesNotMatch(reader, /fetch\(|createSupabaseAdminClient|service_role|use server|points:|\\.points\b|\\.hot\b|\\.rsi\b|\\.contradiction\b/);

  // Browser controls do not manufacture dates, price moves, or unlike-unit rankings.
  for (const field of ["row.label", "row.symbol", "row.type", "row.sourceName",
    "row.asOf", "row.frequency", "row.sourceUrl", "row.changeUnit"]) {
    assert.ok(reader.includes(field), field);
  }
  assert.match(reader, /frequency !== "all" && row\.frequency !== frequency/);
  assert.match(reader, /row\.change !== null && row\.change > 0/);
  assert.match(reader, /row\.change !== null && row\.change < 0/);
  assert.match(reader, /row\.change === null \|\| row\.change === 0/);
  assert.match(reader, /dateValue\(b\.asOf\) - dateValue\(a\.asOf\)/);
  assert.match(reader, /row\.changeUnit === "bp"/);
  assert.match(reader, /aria-live="polite"/);
  assert.match(reader, /aria-hidden="true"/);
  assert.match(reader, /rel="noreferrer"/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /max-width: 560px/);
  assert.match(css, /prefers-reduced-motion/);

  // Existing owner markets and host access policy are untouched.
  assert.match(presenter, /<MarketsMonitor monitor=\{monitor\} flows=\{flows\} \/>/);
  assert.doesNotMatch(presenter, /LiveDeskShell/);
  assert.match(host, /pathname === "\/markets"/);
  assert.match(host, /pathname === "\/blue-desk\/markets"/);
});
