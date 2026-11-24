import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
test("Markets overview reuses existing observations and keeps native screener, compare and divergence",()=>{
 const page=readFileSync("app/blue-desk/markets/page.tsx","utf8");
 const overview=readFileSync("components/blue-desk/MarketMoversOverview.tsx","utf8");
 assert.match(page,/buildScannerDiscovery\(monitoredRows,now,/);
 for(const marker of ["<MarketMoversOverview","<PublicMarketScreener","<PublicAssetCatalogue","<MarketDivergenceWatch","mode=compare","mode=watch","/blue-desk/markets/scanner"])assert.ok(page.includes(marker),marker);
 for(const marker of ["Top gainers","Top losers","Smallest moves","XL sector performance","same-session observations","tracked universe","d.sectors.map"])assert.ok(overview.includes(marker),marker);
 assert.doesNotMatch(overview,/getMarketMonitor|fetch\(/);
});
