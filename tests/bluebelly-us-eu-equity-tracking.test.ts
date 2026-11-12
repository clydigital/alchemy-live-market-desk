import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {BLUEBELLY_STOCK_UNIVERSE,ADDITIONAL_US_STOCKS,EUROPE_STOCKS,
 findStockIdentity,stockUniverseCoverage} from "../lib/bluebelly-equity-universe.ts";
import {parseEuropeanStockChart,euroSessionIsCompleted,fetchEuropeanStockHistory} from "../lib/bluebelly-europe-stock-history.ts";
import {projectPublicEquityCoverage} from "../lib/bluebelly-equity-coverage.ts";
import type {MarketMonitorRow} from "../lib/market-monitor.ts";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const now=new Date("2026-11-13T00:00:00Z");
function exampleChart(ticker:string,currency:string,days:string[],closes:number[]){
 return {chart:{error:null,result:[{meta:{symbol:ticker,currency},
  timestamp:days.map(d=>Date.parse(d+"T14:00:00Z")/1000),
  indicators:{quote:[{close:closes,open:closes.map(x=>x),high:closes.map(x=>x*1.01),
   low:closes.map(x=>x*.99),volume:closes.map(()=>1000)}]}}]}};
}
test("stock roster is public curated, uniquely keyed and accurately disambiguated",()=>{
 const c=stockUniverseCoverage();
 assert.deepEqual(c,{total:37,byRegion:{US:25,EU:12}});
 assert.equal(BLUEBELLY_STOCK_UNIVERSE.length,new Set(BLUEBELLY_STOCK_UNIVERSE.map(x=>x.ticker)).size);
 assert.equal(BLUEBELLY_STOCK_UNIVERSE.length,new Set(BLUEBELLY_STOCK_UNIVERSE.map(x=>x.monitorId)).size);
 assert.equal(findStockIdentity("SPCX")?.company,"SpaceX Class A");
 assert.equal(findStockIdentity("ASML.AS")?.currency,"EUR");
 assert.equal(findStockIdentity("NOVO-B.CO")?.currency,"DKK");
 assert.equal(findStockIdentity("ASML")?.region,undefined,"US ADR cannot become Netherlands listing");
 assert(EUROPE_STOCKS.every(x=>x.region==="EU"&&x.timeZone.startsWith("Europe/")));
 assert(ADDITIONAL_US_STOCKS.every(x=>x.region==="US"&&x.ticker!=="SPCX"));
 const source=read("lib/market-monitor.ts");
 assert(source.includes('assetClass: "stocks", label: "SpaceX Class A · SPCX", type: "US Stock"'));
 assert(!source.includes('SPCX New-Issue / SPAC'));
 assert(source.includes("loadEuropeEquities()"));
});
test("completed EU sessions, correct quote currency and no zero/synthetic prices",()=>{
 const asml=findStockIdentity("ASML.AS")!;
 const dates=["2026-11-09","2026-11-10","2026-11-11","2026-11-12","2026-11-13"];
 const p=exampleChart("ASML.AS","EUR",dates,[1050,1055,1060,1080,1120]);
 const before=new Date("2026-11-13T14:20:00Z"); // Amsterdam 15:20
 const bars=parseEuropeanStockChart(p,asml,before);
 assert.equal(bars.length,4);
 assert.equal(new Date(bars.at(-1)!.time*1000).toISOString().slice(0,10),"2026-11-12");
 assert.equal(bars.at(-1)!.close,1080);
 assert.equal(euroSessionIsCompleted("2026-11-13",asml,before),false);
 assert.equal(euroSessionIsCompleted("2026-11-13",asml,new Date("2026-11-13T18:00:00Z")),true);
 assert.throws(()=>parseEuropeanStockChart(exampleChart("ASML","EUR",dates,[1,2,3,4,5]),asml,now),/mismatch/);
 assert.throws(()=>parseEuropeanStockChart(exampleChart("ASML.AS","USD",dates,[1,2,3,4,5]),asml,now),/mismatch/);
 assert.throws(()=>parseEuropeanStockChart(exampleChart("ASML.AS","EUR",dates,[0,0,0,0,0]),asml,now),/sparse/);
});
test("EU connector uses only curated ticker URL and emits source-labelled local history",async()=>{
 const spec=findStockIdentity("SAP.DE")!;
 const dates=["2026-11-09","2026-11-10","2026-11-11","2026-11-12"];
 const json=exampleChart("SAP.DE","EUR",dates,[120,121,125,130]);
 let observed="";
 const fetcher=(async(input:string)=>{
  observed=input;
  return new Response(JSON.stringify(json),{status:200});
 }) as unknown as typeof fetch;
 const result=await fetchEuropeanStockHistory(spec,now,fetcher);
 assert.equal(result.symbol,"SAP.DE");assert.equal(result.currency,"EUR");
 assert.equal(result.type,"Europe Stock");assert.equal(result.points.length,4);
 assert.match(result.sourceName,/secondary/);
 assert(observed.startsWith("https://query1.finance.yahoo.com/v8/finance/chart/SAP.DE?"));
 assert(!observed.includes("apikey"));
});
test("public coverage excludes expired source dates and never reveals any user portfolio details",()=>{
 const asml=findStockIdentity("ASML.AS")!;
 const row={symbol:asml.ticker,id:asml.monitorId,type:"Europe Stock",
  currency:"EUR",frequency:"daily",asOf:"2026-11-12",last:1025,
  dayChange:1.2,sourceName:"Yahoo Finance public daily chart (secondary; delayed)",
  sourceUrl:"https://finance.yahoo.com/quote/ASML.AS/history/"} as unknown as MarketMonitorRow;
 const stale={...row,asOf:"2026-09-30",last:50} as MarketMonitorRow;
 const wrongCurrency={...row,currency:"USD"} as MarketMonitorRow;
 const accepted=projectPublicEquityCoverage([row],now),expired=projectPublicEquityCoverage([stale],now);
 assert.equal(accepted.contractVersion,"bluebelly-equity-coverage/1");
 assert.equal(accepted.coverage.tracked,37);
 assert.equal(accepted.coverage.sourceDated,1);
 assert.equal(accepted.rows.find(x=>x.ticker==="ASML.AS")?.price,1025);
 assert.equal(expired.rows.find(x=>x.ticker==="ASML.AS")?.price,null);
 assert.equal(projectPublicEquityCoverage([wrongCurrency],now).coverage.sourceDated,0);
 const forbidden=/^(owner_user_id|holdings|quantity|broker|account_number|portfolio_id)$/i;
 assert(!Object.keys(accepted).some(k=>forbidden.test(k)));
 assert(accepted.rows.every(stock=>!Object.keys(stock).some(k=>forbidden.test(k))));
 assert(read("app/api/markets/stocks/route.ts").includes('"Access-Control-Allow-Origin":"https://clydigital.github.io"'));
 const ui=read("components/live-desk/MarketsMonitor.tsx");
 assert(ui.includes("European local shares")&&ui.includes("US stock watch"));
 assert(ui.includes("formatPrice(row.last, row.type,row.currency)"));
});
