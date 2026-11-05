import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const lib = readFileSync(new URL("../lib/bluebelly-sector-divergences.ts", import.meta.url), "utf8");
const feature = readFileSync(new URL("../components/blue-desk/SectorDivergenceFeature.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../components/blue-desk/SectorDivergenceFeature.module.css", import.meta.url), "utf8");
const newsroom = readFileSync(new URL("../app/blue-desk/newsroom/page.tsx", import.meta.url), "utf8");
const markets = readFileSync(new URL("../app/blue-desk/markets/page.tsx", import.meta.url), "utf8");

test("each public sector snapshot has an exact session, named winners and laggards, and three periods", () => {
  assert.match(lib, /4 November 2026 \(US close\)/);
  for (const ticker of ["XLY", "XLK", "XLP", "XLRE", "XLE"]) {
    assert.match(lib, new RegExp('etf: "' + ticker + '"'));
  }
  assert.match(lib, /oneDay:.*fiveDay:.*twentyDay:/);
  assert.match(lib, /leaders:/);
  assert.match(lib, /laggards:/);
  assert.match(feature, /selected names, not a complete constituent ranking/i);
});

test("Solarvest identity, original financial source and Bursa/US clock separation are explicit", () => {
  assert.match(lib, /ticker: "SLVEST"/);
  assert.match(lib, /code: "0215"/);
  assert.match(lib, /fy26RevenueRmMillion: 758\.9/);
  assert.match(lib, /unbilledOrderBookRmMillion: 2371/);
  assert.match(feature, /not US-listed SLV/);
  assert.match(feature, /not simultaneous market sessions/i);
  assert.match(feature, /SOLARVEST_RESEARCH\.q1ReportUrl/);
});

test("markets and newsroom use the same dated public feature without altering source admission", () => {
  assert.match(markets, /<SectorDivergenceFeature mode="markets"/);
  assert.match(newsroom, /<SectorDivergenceFeature mode="newsroom"/);
  assert.match(feature, /data-price-session="2026-11-04"/);
  assert.match(feature, /not live quotes/i);
  assert.doesNotMatch(feature, /createSupabaseAdminClient|\.insert\(|\.upsert\(|fetch\(/);
  assert.match(css, /@media\(max-width:800px\)/);
  assert.match(newsroom, /<BluebellyNewsWire news=\{news\}/);
  assert.match(markets, /<PublicMarketScreener/);
});
