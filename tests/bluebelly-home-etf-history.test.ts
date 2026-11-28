import test from "node:test";
import assert from "node:assert/strict";
import {parseHomeEtfChart,expectedHomeEtfSession,fetchHomeEtfHistory} from "../lib/bluebelly-home-etf-history.ts";
const now=new Date("2026-11-17T00:00:00Z");
function payload(){
 const dates=["09","10","11","12","13","16"];
 return {chart:{error:null,result:[{meta:{symbol:"QQQ",currency:"USD",instrumentType:"ETF",exchangeTimezoneName:"America/New_York"},
  timestamp:dates.map(d=>Date.parse("2026-11-"+d+"T14:30:00Z")/1000),
  indicators:{quote:[{close:[700,690,695,688,680,662]}]}}]}};
}
test("Monday completion makes Friday tape behind; weekend and holiday stay on last session",()=>{
 assert.equal(expectedHomeEtfSession(now),"2026-11-16");
 assert.equal(expectedHomeEtfSession(new Date("2026-11-16T20:59:00Z")),"2026-11-13");
 assert.equal(expectedHomeEtfSession(new Date("2026-11-16T21:14:00Z")),"2026-11-13");
 assert.equal(expectedHomeEtfSession(new Date("2026-11-16T21:15:00Z")),"2026-11-16");
 assert.equal(expectedHomeEtfSession(new Date("2026-11-15T12:00:00Z")),"2026-11-13");
 assert.equal(expectedHomeEtfSession(new Date("2026-11-26T23:00:00Z")),"2026-11-25");
});
test("secondary completed ETF closes retain actual session dates and whole-source returns",()=>{
 const bars=parseHomeEtfChart(payload(),"QQQ",now);
 assert.equal(bars.length,6);
 assert.equal(bars.at(-1)?.time,Date.parse("2026-11-16T00:00:00Z")/1000);
 assert.equal(bars.at(-1)?.close,662);
 assert.equal(bars.at(-2)?.close,680);
});
test("wrong identity, stale history, intraday bar and malformed closes fail closed",()=>{
 const bad=payload();bad.chart.result[0].meta.symbol="SPY";
 assert.throws(()=>parseHomeEtfChart(bad,"QQQ",now),/identity/);
 const currency=payload();currency.chart.result[0].meta.currency="CAD";
 assert.throws(()=>parseHomeEtfChart(currency,"QQQ",now),/identity/);
 const stale=payload();stale.chart.result[0].timestamp.pop();stale.chart.result[0].indicators.quote[0].close.pop();
 assert.throws(()=>parseHomeEtfChart(stale,"QQQ",now));
 assert.throws(()=>parseHomeEtfChart(payload(),"QQQ",new Date("2026-11-16T20:00:00Z")));
 const missing=payload();missing.chart.result[0].indicators.quote[0].close[5]=NaN;
 assert.throws(()=>parseHomeEtfChart(missing,"QQQ",now));
});
test("fallback HTTP failure is not success or a fabricated zero",async()=>{
 const fail=(async()=>new Response("",{status:503})) as typeof fetch;
 await assert.rejects(()=>fetchHomeEtfHistory("QQQ",now,fail),/unavailable/);
});

test("home ETF fetch uses completed-session cache identity across Black Friday and weekend",async()=>{
 const urls:string[]=[];
 const capture=(async(url:unknown)=>{urls.push(String(url));return new Response("",{status:503})}) as typeof fetch;
 const times=["2026-11-27T17:59:00Z","2026-11-27T18:15:00Z","2026-11-28T04:00:00Z","2026-11-29T04:00:00Z"];
 for(const t of times)await assert.rejects(()=>fetchHomeEtfHistory("SMH",new Date(t),capture));
 const end=(url:string)=>Number(new URL(url).searchParams.get("period2"));
 assert.equal(end(urls[0]),Date.parse("2026-11-26")/1000);
 assert.equal(end(urls[1]),Date.parse("2026-11-28")/1000);
 assert.notEqual(urls[0],urls[1]);
 assert.equal(urls[1],urls[2]);
 assert.equal(urls[2],urls[3]);
});
