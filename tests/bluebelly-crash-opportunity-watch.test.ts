import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildCrashWatchView,CRASH_HISTORY,CRASH_LINKS} from "../lib/bluebelly-crash-opportunity.ts";
import {blueDeskHostAccess,blueDeskPresentationTarget} from "../lib/blue-desk-host.ts";
import type {MarketMonitorRow} from "../lib/market-monitor.ts";

const NOW=new Date("2026-10-30T04:00:00Z");
const FRED_HY="https://fred.stlouisfed.org/series/BAMLH0A0HYM2";
const times=["2026-10-22","2026-10-23","2026-10-26","2026-10-27","2026-10-28","2026-10-29"]
  .map(day=>Date.parse(day+"T00:00:00Z")/1000);
function marketRow(id:string,change5d:number,opts:{
  asOf?:string;last?:number;sourceUrl?:string;points?:{time:number;close:number}[];
  frequency?:"daily"|"monthly";
}={}):MarketMonitorRow{
  const isCredit=id==="hy-oas";
  return {
    id,symbol:id,label:id,type:isCredit?"Credit / Risk":"Major Index",
    benchmark:null,last:opts.last??(isCredit?3.15:100),
    previousClose:100,sessionOpen:null,dayChange:-0.3,gapChange:null,
    change3d:null,change5d,relative5d:null,rsi:null,stochRsi:null,
    volPercentile:null,attentionScore:0,hot:false,contradiction:false,tags:[],
    asOf:opts.asOf??"2026-10-29",frequency:opts.frequency??"daily",
    sourceName:isCredit?"Federal Reserve Economic Data":"S&P Dow Jones Indices",
    sourceUrl:opts.sourceUrl??(isCredit?FRED_HY:"https://fred.stlouisfed.org/series/SP500"),
    points:opts.points??[],
  };
}
function creditRow(start:number,end:number,opts:{asOf?:string;sourceUrl?:string}={}){
  return marketRow("hy-oas",0,{...opts,last:end,points:times.map((time,i)=>({
    time,close:i===0?start:i===times.length-1?end:start+(end-start)*i/(times.length-1)
  }))});
}

test("source-independent blank snapshot is contested and does not pretend no risk",()=>{
  const v=buildCrashWatchView(null,NOW);
  assert.equal(v.position,"CONTESTED");
  assert.equal(v.sourceStatus,"UNAVAILABLE");
  assert.equal(v.measurementCoverage,0);
  assert.equal(v.pillars.length,7);
  assert.ok(v.readings.every(r=>r.status==="MISSING"));
});

test("two independent same-window signals can produce a conditional opportunity lean",()=>{
  const rows=[marketRow("spx",-0.5),marketRow("rsp",2),creditRow(3.5,3.1)];
  const v=buildCrashWatchView(rows,NOW);
  assert.equal(v.position,"BULL_LEAN");
  assert.equal(v.confidence,"MEDIUM");
  assert.equal(v.pillars[0].signal,"BULL");
  assert.equal(v.pillars[1].signal,"BULL");
  assert.match(v.pillars[1].basis,/bp/);
  assert.match(v.pillars[0].basis,/ETF/);
});

test("five-session breadth weakness and widening high yield produce conditional crash-risk lean",()=>{
  const rows=[marketRow("spx",1),marketRow("rsp",-2),creditRow(3.1,3.65)];
  const v=buildCrashWatchView(rows,NOW);
  assert.equal(v.position,"BEAR_LEAN");
  assert.equal(v.pillars[0].signal,"BEAR");
  assert.equal(v.pillars[1].signal,"BEAR");
});

test("opposing observations remain contested, not average-to-one narrative",()=>{
  const v=buildCrashWatchView([marketRow("spx",-1),marketRow("rsp",1),creditRow(3.1,3.7)],NOW);
  assert.equal(v.position,"CONTESTED");
  assert.equal(v.confirmedSignals,2);
  assert.equal(v.confidence,"MEDIUM");
});

test("different cash close dates fail the matched breadth comparison",()=>{
  const v=buildCrashWatchView([marketRow("spx",-1),marketRow("rsp",2,{asOf:"2026-10-28"}),creditRow(3.5,3.1)],NOW);
  assert.equal(v.pillars[0].signal,"UNKNOWN");
  assert.equal(v.position,"CONTESTED");
});

test("stale and monthly observations never count as fresh signals",()=>{
  const v=buildCrashWatchView([
    marketRow("spx",-1,{asOf:"2026-10-17"}),
    marketRow("rsp",3,{asOf:"2026-10-17"}),
    marketRow("hy-oas",0,{frequency:"monthly",sourceUrl:FRED_HY})
  ],NOW);
  assert.equal(v.position,"CONTESTED");
  assert.equal(v.readings.find(r=>r.id==="spx")?.status,"STALE");
  assert.equal(v.pillars[1].signal,"UNKNOWN");
});

test("credit provider spoofing and HYG ETFs cannot become original high-yield OAS",()=>{
  const spoof=creditRow(3.5,3.1,{sourceUrl:"https://other.example/series/BAMLH0A0HYM2"});
  const v=buildCrashWatchView([marketRow("spx",0),marketRow("rsp",3),spoof,marketRow("hyg",8)],NOW);
  assert.equal(v.pillars[1].signal,"UNKNOWN");
  assert.equal(v.position,"CONTESTED");
});

test("spread basis is in bp, not price returns, and requires last point reconciliation",()=>{
  const invalid=creditRow(3.5,3.1);
  invalid.last=2.2;
  const v=buildCrashWatchView([invalid],NOW);
  assert.equal(v.readings.find(r=>r.id==="hy-oas")?.fiveSessionChange,null);
  assert.equal(v.pillars[1].signal,"UNKNOWN");
});

test("historical mirrors retain recovery caveats and include recoveries and prolonged bears",()=>{
  assert.equal(CRASH_HISTORY.length,7);
  assert.ok(CRASH_HISTORY.some(h=>h.id==="2020"&&h.recovered.includes("2020")));
  assert.ok(CRASH_HISTORY.some(h=>h.id==="2008"&&h.recovered.includes("2013")));
  assert.ok(CRASH_HISTORY.every(h=>h.source.startsWith("https://")&&h.caution.length>15));
  assert.equal(CRASH_LINKS.length,5);
});

test("only the exact public crash-opportunity route is opened, without a new API",()=>{
  const host="bluebelly-desk.vercel.app";
  assert.equal(blueDeskHostAccess("/crash-opportunity",host),"public");
  assert.equal(blueDeskHostAccess("/blue-desk/crash-opportunity",host),"public");
  assert.equal(blueDeskPresentationTarget("/crash-opportunity",host),"/blue-desk/crash-opportunity");
  for(const path of ["/crash-opportunity/api","/crash-opportunity/owner","/crash-opportunity/anything","/api/crash-opportunity"]){
    assert.equal(blueDeskHostAccess(path,host),"blocked",path);
  }
  assert.equal(blueDeskHostAccess("/crash-opportunity","alchemy-blue-desk.vercel.app"),"blocked");
});

test("reader is linked from existing regime directory, without an added scheduler",()=>{
  const landing=readFileSync("app/blue-desk/regime-watch/page.tsx","utf-8");
  const page=readFileSync("app/blue-desk/crash-opportunity/page.tsx","utf-8");
  assert.match(landing,/data-crash-watch-entry/);
  assert.match(page,/data-crash-opportunity="source-dated-research-view"/);
  assert.match(page,/buildCrashWatchView/);
  assert.match(page,/CRASH_HISTORY/);
  assert.doesNotMatch(page,/service_role|createClient|insert\(|update\(/i);
});
