import assert from "node:assert/strict";
import test from "node:test";
import { publicOfficialMacroTrends, publicMarketObservations } from "../lib/blue-desk-public-markets.ts";
import type { MarketMonitorRow, MarketMonitorType } from "../lib/market-monitor.ts";

const dates=["2026-10-19","2026-10-20","2026-10-21"];
const points=(values:number[])=>values.map((close,index)=>({
  time:Date.parse(dates[index]+"T00:00:00Z")/1000,close,
}));
function row(id:string,symbol:string,type:MarketMonitorType,values:number[],source="Federal Reserve Economic Data"):MarketMonitorRow {
 return {
  id,symbol,label:id,type,benchmark:null,last:values.at(-1)??null,previousClose:values.at(-2)??null,
  sessionOpen:null,dayChange:null,gapChange:null,change3d:null,change5d:null,rsi:null,
  stochRsi:null,volPercentile:null,relative5d:null,attentionScore:0,hot:false,
  contradiction:false,tags:[],asOf:dates.at(-1)!,frequency:"daily",
  sourceName:source,sourceUrl:"https://fred.stlouisfed.org/series/"+symbol,points:points(values),
 };
}
test("official macro chart includes source-matched real yields, breakevens, and credit spreads",()=>{
 const rows=[
  row("us2y","DGS2","Rates",[4.0,4.1,4.2]),
  row("us10y-fred","DGS10","Rates",[4.5,4.6,4.7]),
  row("us30y-fred","DGS30","Rates",[4.8,4.9,5.0]),
  row("us10y-real","DFII10","Rates",[2.3,2.4,2.5]),
  row("us10y-breakeven","T10YIE","Rates",[2.2,2.2,2.2]),
  row("hy-oas","BAMLH0A0HYM2","Credit / Risk",[3.8,4.0,4.3]),
  row("ig-oas","BAMLC0A0CM","Credit / Risk",[1.1,1.2,1.3]),
  row("us5y-real","DFII5","Rates",[1.8,1.9,2.0],"Unverified social feed"),
 ];
 const rates=publicOfficialMacroTrends(rows,"rates");
 assert.ok(rates.some(x=>x.id==="us10y-real"));
 assert.ok(rates.some(x=>x.id==="us10y-breakeven"));
 assert.equal(rates.some(x=>x.id==="us5y-real"),false,"Unsupported source must not leak to public trend");
 const spread=rates.find(x=>x.id==="us2s30s");
 assert.ok(spread);
 assert.deepEqual(spread.points.map(p=>Number(p.close.toFixed(1))),[0.8,0.8,0.8]);
 assert.equal(spread.displayUnit,"bp");
 assert.equal(spread.kind,"Treasury curve spread");
 assert.equal(spread.asOf,dates.at(-1));
 assert.equal(spread.secondSourceUrl,"https://fred.stlouisfed.org/series/DGS2");
 assert.deepEqual(publicOfficialMacroTrends(rows,"credit").map(x=>x.id),["hy-oas","ig-oas"]);
 assert.deepEqual(publicOfficialMacroTrends(rows,"equities"),[]);
});
test("never join Treasury tenors from different observation days",()=>{
 const short=row("us2y","DGS2","Rates",[3.5,3.6,3.7]);
 const long=row("us30y-fred","DGS30","Rates",[4.8,5.0,5.2]);
 long.points=long.points.map(x=>({...x,time:x.time+86400*5}));
 assert.equal(publicOfficialMacroTrends([short,long],"rates").some(x=>x.id==="us2s30s"),false);
});
test("bond ETFs are labelled as price proxies rather than percentage yields",()=>{
 const tlt=row("tlt","TLT","Bond ETF",[89,90,91],"Nasdaq official etf history");
 tlt.dayChange=1.11;tlt.sourceUrl="https://www.nasdaq.com/market-activity/etf/tlt/historical";
 const [publicRow]=publicMarketObservations([tlt],"rates");
 assert.equal(publicRow.type,"Bond ETF");
 assert.equal(publicRow.changeUnit,"%");
 assert.equal(publicRow.last,91);
 assert.deepEqual(publicOfficialMacroTrends([tlt],"rates"),[],"ETF histories are not published as official yields");
});
