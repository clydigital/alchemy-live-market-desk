import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {projectBondPressure} from "../lib/bluebelly-bond-pressure.ts";
import type {MarketMonitorRow,MarketMonitorType} from "../lib/market-monitor.ts";
const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const dates=["2026-10-30","2026-11-02","2026-11-03","2026-11-04",
 "2026-11-05","2026-11-06","2026-11-09","2026-11-10"];
function row(id:string,values:number[],type:MarketMonitorType="Rates",sourceName="U.S. Department of the Treasury",
 dateList=dates):MarketMonitorRow{
 const isEtf=type==="Bond ETF",symbol=isEtf?id.toUpperCase():id==="us10y-fred"?"DGS10":id==="us30y-fred"?"DGS30":"DGS2";
 const series=values.map((close,index)=>({close,time:Date.parse(dateList[index]+"T00:00:00Z")/1000}));
 return {id,symbol,label:id,type,benchmark:null,
  last:values.at(-1)!,previousClose:values.at(-2)!,sessionOpen:null,
  dayChange:null,gapChange:null,change3d:null,change5d:null,
  rsi:null,stochRsi:null,volPercentile:null,relative5d:null,
  attentionScore:0,hot:false,contradiction:false,tags:[],
  asOf:dateList.at(-1)!,frequency:"daily",
  sourceName,
  sourceUrl:isEtf?"https://www.nasdaq.com/market-activity/etf/"+id:
   sourceName==="Federal Reserve Economic Data"?"https://fred.stlouisfed.org/series/"+symbol:
   "https://home.treasury.gov/resource-center/data-chart-center/interest-rates",
  points:series};
}
const yields=[
 row("us2y",[3.71,3.72,3.73,3.74,3.77,3.78,3.80,3.95]),
 row("us10y-fred",[4.00,4.01,4.02,4.03,4.06,4.08,4.10,4.20]),
 row("us30y-fred",[4.30,4.33,4.34,4.35,4.37,4.40,4.41,4.50])
];
const now=new Date("2026-11-12T00:30:00Z");

test("11 November US fixed-income holiday retains source-dated 10 November moves",()=>{
 const x=projectBondPressure(yields,now);
 assert.equal(x.state,"LAST_REPORTED");
 assert.equal(x.asOf,"2026-11-10");
 assert.deepEqual(x.windows.map(w=>w.trend),["worse","worse","worse"]);
 assert.equal(x.windows[0].tenYearBp,10);
 assert.equal(x.windows[0].thirtyYearBp,9);
 assert.equal(x.windows[0].from,"2026-11-09");
 assert.equal(x.windows[0].to,"2026-11-10");
 assert.match(x.notice,/11 Nov 2026 US fixed-income holiday/);
 assert.equal(x.spreads.find(s=>s.label==="30Y − 2Y")?.bp,55);
});
test("10Y/30Y duration trend becomes neutral on source mismatch, stale period or insufficient history",()=>{
 const mismatched=row("us30y-fred",[4.3,4.33,4.34,4.35,4.37,4.40,4.41,4.50],"Rates",
 "U.S. Department of the Treasury",dates.map((d,i)=>i===7?"2026-11-09":d));
 const mismatch=projectBondPressure([yields[1],mismatched],now);
 assert.equal(mismatch.state,"PARTIAL");
 assert.ok(mismatch.windows.every(w=>w.trend==="unknown"));
 const stale=projectBondPressure(yields,new Date("2026-11-16T10:00:00Z"));
 assert.equal(stale.state,"STALE");
 assert.ok(stale.windows.every(w=>w.trend==="unknown"));
 const missing=projectBondPressure(null,now);
 assert.equal(missing.state,"UNAVAILABLE");
 assert.ok(missing.windows.every(w=>w.tenYearBp===null));
});
test("TLT price confirmation needs exactly the same observation session as official yields",()=>{
 const tlt=row("tlt",[97,97.1,97.2,96.9,96.8,96.6,96.3,95.5],"Bond ETF","Nasdaq");
 const confirmed=projectBondPressure([...yields,tlt],now);
 assert.equal(confirmed.tltConfirmation,"CONFIRMED");
 assert.equal(confirmed.etfs[0].changes["1D"],Number(((95.5/96.3-1)*100).toFixed(2)));
 const nextDayEtf=row("tlt",[97.1,97.2,96.9,96.8,96.6,96.3,95.5,95.7],"Bond ETF","Nasdaq",
  [...dates.slice(1),"2026-11-11"]);
 const notComparable=projectBondPressure([...yields,nextDayEtf],now);
 assert.equal(notComparable.tltConfirmation,"NOT_COMPARABLE");
});
test("source family admission refuses third-party yield substitutes and doesn't treat MOVE as bp",()=>{
 const spoof=row("us10y-fred",[4.00,4.01,4.02,4.03,4.06,4.08,4.10,4.20],"Rates","Market gossip");
 const invalid=projectBondPressure([spoof,yields[2]],now);
 assert.equal(invalid.state,"PARTIAL");
 const move=row("move",[98,99,99,100,101,102,104,105],"Rates","ICE BofA");
 const genuine=projectBondPressure([...yields,move],now);
 assert.equal(genuine.drivers.find(d=>d.id==="move")?.changes["1D"],1);
});
test("public Bonds page renders custom source-session monitor ahead of old editorial archive",()=>{
 const detail=read("app/blue-desk/regime-watch/[lensId]/page.tsx");
 const hub=read("app/blue-desk/regime-watch/page.tsx");
 const comp=read("components/blue-desk/BondPressureMonitor.tsx");
 const projection=read("lib/bluebelly-bond-pressure.ts");
 assert.match(detail,/projectBondPressure\(marketMonitor\?\.rows\?\?null,now\)/);
 assert.match(detail,/BondPressureMonitor reading=\{bondPressure\}/);
 assert.match(detail,/data-regime-editorial-archive="collapsed-by-default"/);
 assert.ok(detail.indexOf("<BondPressureMonitor")<detail.indexOf('id="editorial-archive"'));
 assert.match(hub,/projectRegimeMeterReadings/);
 const meter=read("lib/bluebelly-regime-market-meter.ts");
 assert.match(meter,/bonds\.windows/);
 assert.match(meter,/LAST_REPORTED/);
 assert.match(hub,/data-regime-overview-editorial="collapsed-by-default"/);
 assert.match(hub,/HISTORICAL 30 OCT EDITORIAL/);
 assert.match(comp,/data-bond-pressure-monitor="market-series-v1"/);
 assert.match(comp,/data-tlt-confirmation/);
 assert.match(comp,/getBondPressure|BondPressureMonitor/);
 assert.doesNotMatch(projection+detail+hub,/\.insert\(|supabase\.rpc\(|\.upsert\(/);
});
