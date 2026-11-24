import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {blueDeskHostAccess,blueDeskPresentationTarget,BLUEBELLY_PRESENTATION_HOST} from "../lib/blue-desk-host.ts";
test("Earnings is a sibling directly after Markets",()=>{
 assert.equal(blueDeskPresentationTarget("/earnings",BLUEBELLY_PRESENTATION_HOST),"/blue-desk/earnings");
 assert.equal(blueDeskHostAccess("/earnings",BLUEBELLY_PRESENTATION_HOST),"public");
 assert.equal(blueDeskHostAccess("/earnings/private",BLUEBELLY_PRESENTATION_HOST),"blocked");
 assert.equal(blueDeskHostAccess("/markets/earnings",BLUEBELLY_PRESENTATION_HOST),"blocked");
 const nav=readFileSync("components/blue-desk/BlueDeskHeader.tsx","utf8");
 assert.match(nav,/\["Markets", "\/markets"\],\s*\["Earnings", "\/blue-desk\/earnings"\]/);
});
test("market instruments, visible category filters, watch and comparisons remain native",()=>{
 const markets=readFileSync("app/blue-desk/markets/page.tsx","utf8");
 for(const marker of ["<PublicMarketScreener","<PublicAssetCatalogue","<MarketDivergenceWatch","<PublicTreasuryLadder","<RatesPolicyMonitor","<TradingViewChart","All Assets","Compare","Divergence Watch","<details open className={legibility.categoryDisclosure}","/blue-desk/markets/scanner"])assert.ok(markets.includes(marker),marker);
 assert.doesNotMatch(markets,/<EarningsFundamentals|<EarningsInvestorDeepDive/);
 assert.match(markets,/if\(detail\)redirect/);
 const earnings=readFileSync("app/blue-desk/earnings/page.tsx","utf8");
 for(const marker of ["<IssuerEarningsBoard","<RecentEarningsScorecards","<EarningsWeekGrid","<EarningsFundamentals","<EarningsInvestorDeepDive","/blue-desk/earnings-week"])assert.ok(earnings.includes(marker),marker);
});
