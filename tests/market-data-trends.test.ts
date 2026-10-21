import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { marketTrend } from "../lib/market-trend-series.ts";
import { publicGovernmentRateTrends, publicMarketObservations } from "../lib/blue-desk-public-markets.ts";
import type { MarketMonitorRow } from "../lib/market-monitor.ts";

const NOW = new Date("2026-10-21T15:00:00Z");
const point = (date: string, close: number) => ({ time: Date.parse(date + "T00:00:00Z") / 1000, close });
const rates = { type: "Rates", frequency: "daily", points: [
  point("2026-09-01", 3.5),
  point("2026-09-02", 3.6),
  point("2026-09-03", 3.7),
  point("2026-10-18", 3.8),
  point("2026-10-20", 3.9),
] } as const;

test("market trend uses actual chronological dated observations, excludes future/bad values", () => {
  const trend = marketTrend({
    ...rates, points: [...rates.points, point("2026-10-22", 5), point("2026-10-21", Infinity),
      point("2026-10-20", 3.9)].reverse(),
  }, "MAX", NOW);
  assert.equal(trend.points.length, 5);
  assert.equal(trend.netChange, 40.000000000000036);
  assert.equal(trend.netChangeUnit, "bp");
  assert.equal(trend.sourceDate, "2026-10-20");
  assert.equal(trend.stale, false);
  assert.equal(trend.segments.length, 2, "A 45-day data gap must not be bridged by a fake continuous line");
  assert.deepEqual(trend.segments.map(x=>x.length),[3,2]);
});

test("range controls use the requested current calendar window, not last stale point", () => {
  const recent = marketTrend(rates, "30D", NOW);
  assert.deepEqual(recent.points.map(p=>p.close),[3.8,3.9]);
  const stale = marketTrend({ ...rates, points:rates.points.slice(0,3) }, "30D", NOW);
  assert.equal(stale.missing, true);
  assert.equal(stale.points.length, 0);
  assert.equal(stale.stale, true);
  assert.equal(stale.netChange, null);
  assert.equal(marketTrend({ ...rates, points:[] }, "MAX", NOW).missing,true);
});

test("monthly rates remain monthly, not mislabelled as daily RSI or session changes", () => {
  const history=marketTrend({type:"Rates",frequency:"monthly",points:[
    point("2026-07-01",2.2),point("2026-08-01",2.3),point("2026-09-01",2.4),
  ]}, "MAX", NOW);
  assert.equal(history.stale,false);
  assert.equal(history.segments.length,1);
  assert.equal(history.netChangeUnit,"bp");
  assert.ok(Math.abs((history.netChange??0)-20)<0.001);
});

function marketRow(input:Partial<MarketMonitorRow>):MarketMonitorRow {
  return {
    id:"us10y",symbol:"DGS10",label:"US 10Y Yield",type:"Rates",benchmark:null,
    last:3.9,previousClose:3.8,sessionOpen:null,dayChange:null,gapChange:null,
    change3d:null,change5d:null,rsi:null,stochRsi:null,volPercentile:null,
    relative5d:null,attentionScore:0,hot:false,contradiction:false,tags:[],
    asOf:"2026-10-20",frequency:"daily",
    sourceName:"Federal Reserve Economic Data",sourceUrl:"https://fred.stlouisfed.org/series/DGS10",
    points:rates.points.map(p=>({...p})),
    ...input,
  };
}

test("public market-data trend admits only exact Treasury/government nominal sources", () => {
  const fred=marketRow({});
  const treasury=marketRow({id:"us2y",symbol:"US2Y",sourceName:"U.S. Department of the Treasury",
    sourceUrl:"https://home.treasury.gov/resource-center/data-chart-center/interest-rates"});
  const rejected=marketRow({id:"nvda",symbol:"NVDA",type:"MAG7",sourceName:"Nasdaq official stocks history",
    sourceUrl:"https://www.nasdaq.com/market-activity/stocks/nvda/historical"});
  const faked=marketRow({id:"us10y",symbol:"DGS10",sourceName:"Unverified social feed",sourceUrl:"https://example.com"});
  const empty=marketRow({id:"us30y-fred",symbol:"DGS30",points:[]});
  const only=publicGovernmentRateTrends([fred,treasury,rejected,faked,empty]);
  assert.deepEqual(only.map(r=>r.id),["us10y","us2y"]);
  assert.deepEqual(only[0].points,fred.points);
  assert.equal("attentionScore" in only[0],false);
  assert.equal("researchTriggers" in only[0],false);
  assert.equal("points" in publicMarketObservations([fred],"all")[0],false,
    "Base public row contract remains unchanged; source-chart history is separately allowlisted.");
});

test("private Markets, public source-gated Markets and Macro Data all render trend components",()=>{
  const file=(name:string)=>readFileSync(new URL(name,import.meta.url),"utf8");
  const markets=file("../components/live-desk/MarketsMonitor.tsx");
  const blue=file("../app/blue-desk/markets/page.tsx");
  const macro=file("../app/data/macro/page.tsx");
  assert.match(markets,/<MarketTrendChart rows=\{monitor\.rows\}/);
  assert.match(markets,/setTrendSelectedId\(row\.id\)/);
  assert.match(blue,/<PublicGovernmentRateTrendChart series=\{officialRateTrends\}/);
  assert.match(blue,/publicGovernmentRateTrends\(monitor\?\.rows \|\| \[\]\)/);
  assert.match(macro,/<MacroTrendMonitor observations=\{data\.macroObservations\}/);
  assert.match(macro,/macroHistoryStale/);
});
