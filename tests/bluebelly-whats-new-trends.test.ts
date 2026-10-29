import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import type {MarketMonitorRow} from "../lib/market-monitor.ts";
import {projectWhatsNewTrends,trendPolyline,WHATS_NEW_ASSETS} from "../lib/blue-desk-whats-new-trends.ts";
import {blueDeskHostAccess,blueDeskPresentationTarget} from "../lib/blue-desk-host.ts";

const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const now=new Date("2026-10-27T12:00:00.000Z");
const dates=Array.from({length:12},(_,i)=>Date.parse("2026-10-15T00:00:00Z")/1000+i*86400);
function row(id:string,label:string,type:"Rates"|"Major Index"|"AI / Semis"|"Energy"|"FX",origin=4){
 return {
  id,label,type,frequency:"daily",sourceName:"Official source",sourceUrl:"https://example.org/dated-series",
  asOf:"2026-10-26",last:origin+11*0.05,previousClose:origin+10*0.05,
  points:dates.map((time,i)=>({time,close:origin+i*0.05})),
 } as MarketMonitorRow;
}
test("real completed-session yields are in bp; shares and other assets in percent",()=>{
 const a=projectWhatsNewTrends([
  row("us2y","2Y nominal Treasury","Rates"),
  row("spx","S&P 500 Cash","Major Index",100),
  row("smh","SMH ETF","AI / Semis",50),
 ],now);
 assert.equal(a.length,6);
 const bond=a.find(x=>x.key==="rates-short")!;
 const stocks=a.find(x=>x.key==="equities")!;
 assert.equal(bond.status,"ready");assert.equal(bond.label,"2Y nominal Treasury");
 assert.equal(bond.unit,"bp");
 assert.deepEqual(bond.changes,{d1:5,d3:15,d5:25});
 assert.equal(stocks.status,"ready");assert.equal(stocks.unit,"%");
 assert.equal(stocks.changes.d1,0.05);
 assert.ok(stocks.points.length>=6);
 assert.equal(stocks.sourceUrl,"https://example.org/dated-series");
 assert.ok(a.find(x=>x.key==="energy")?.status==="unavailable");
});
test("monthly, empty, short, future-dated, unlinked and inconsistent history fails closed",()=>{
 const monthly={...row("us2y","yield","Rates"),frequency:"monthly" as const};
 const short={...row("us2y","yield","Rates"),points:row("us2y","yield","Rates").points.slice(-4)};
 const unlinked={...row("us2y","yield","Rates"),sourceUrl:"javascript:alert(1)"};
 const future={...row("us2y","yield","Rates"),asOf:"2026-10-28"};
 for(const x of [monthly,short,unlinked,future]){
  const card=projectWhatsNewTrends([x],now)[0];
  assert.equal(card.status,"unavailable");
  assert.equal(card.points.length,0);
 }
});
test("stale complete observations remain explicitly stale and cannot become live on refresh",()=>{
 const stale={...row("brent","Brent spot","Energy",100),
  points:dates.map((time,i)=>({time:time-20*86400,close:100+i})),
  asOf:"2026-10-06"};
 const item=projectWhatsNewTrends([stale],now).find(x=>x.key==="energy")!;
 assert.equal(item.status,"stale");
 assert.equal(item.asOf,"2026-10-06");
 assert.ok(trendPolyline(item.points)?.includes(","));
 assert.equal(trendPolyline([]),null);
 assert.equal(trendPolyline([{time:1,close:1}]),null);
});
test("ETF and FX proxies retain the original source identity",()=>{
 const price=row("spx-proxy","S&P 500 · SPY proxy","Major Index",100);
 const yen=row("jpy","Japanese Yen · FXY proxy","FX",100);
 const cards=projectWhatsNewTrends([price,yen],now);
 assert.match(cards[2].label||"",/proxy/);
 assert.match(cards[5].label||"",/proxy/);
 assert.equal(new Set(WHATS_NEW_ASSETS.map(x=>x.key)).size,6);
});
test("homepage mounts source-date charts, not a second private route or provider",()=>{
 const page=read("app/blue-desk/page.tsx");
 const chart=read("components/blue-desk/WhatsNewTrendDashboard.tsx");
 const projection=read("lib/blue-desk-whats-new-trends.ts");
 assert.match(page,/projectWhatsNewTrends\(monitor\?\.rows\|\|\[\],now\)/);
 assert.match(page,/<WhatsNewTrendDashboard/);
 assert.match(page,/verifiedNews\.slice\(0,4\)/);
 assert.match(chart,/id="motion-title">What's New/);
 assert.match(chart,/source-dated-charts/);
 assert.match(chart,/Source date: /);
 assert.match(chart,/completed source sessions/);
 assert.doesNotMatch(chart,/getMarketMonitor|createSupabaseAdminClient|setInterval|fetch\(/);
 assert.doesNotMatch(projection,/getMarketMonitor|createSupabaseAdminClient|generateContent/);
 assert.equal(blueDeskHostAccess("/markets","bluebelly-desk.vercel.app"),"public");
 assert.equal(blueDeskPresentationTarget("/markets","bluebelly-desk.vercel.app"),"/blue-desk/markets");
 assert.equal(blueDeskHostAccess("/whats-new","bluebelly-desk.vercel.app"),"blocked");
});
