import test from "node:test";
import assert from "node:assert/strict";
import {buildDivergenceRadar} from "../lib/bluebelly-divergence-radar.ts";
import {scheduledUsEquityCloseHourET} from "../lib/bluebelly-us-equity-trading-calendar.ts";
import type {MarketMonitorRow} from "../lib/market-monitor.ts";
const now=new Date("2026-11-24T10:00:00Z");
const sessions=Array.from({length:100},(_,i)=>new Date(Date.parse("2026-11-23T00:00:00Z")-(99-i)*86400000).toISOString().slice(0,10)).filter(d=>scheduledUsEquityCloseHourET(d)!==null);
const days=sessions.slice(-11);
function row(id:string,values:number[],dates=days):MarketMonitorRow{
 return {id,symbol:id.toUpperCase(),label:id,sourceName:"Test source",sourceUrl:"https://example.com/"+id,frequency:"daily",type:"Sector",asOf:dates.at(-1),last:values.at(-1),points:dates.map((date,i)=>({time:Date.parse(date)/1000,close:values[i]}))} as MarketMonitorRow;
}
test("adjacent equal five-session windows, not overlapping return subtraction",()=>{
 const a=row("xlp",[100,101,102,103,104,105,104,103,102,101,100]),b=row("xlk",Array(11).fill(100));
 const result=buildDivergenceRadar([a,b],[],now),lead=result.leads.find(x=>x.id==="defensive")!;
 assert.ok(lead);
 assert.equal(lead.metrics.find(x=>x.label==="Prior 5")?.value,5);
 assert.equal(lead.metrics.find(x=>x.label==="Latest 5")?.value,-4.76);
 assert.equal(lead.metrics.find(x=>x.label==="5-session acceleration")?.value,-9.76);
 assert.match(lead.summary,/reversed/);
});
test("mismatched, stale, missing scheduled sessions and unfinished daily candles are not signals",()=>{
 const a=row("xlp",Array.from({length:11},(_,i)=>100+i)),b=row("xlk",Array(11).fill(100));
 const dates=days.slice(0,-1).concat("2026-11-24");
 assert.ok(!buildDivergenceRadar([a,row("xlk",Array(11).fill(100),dates)],[],now).leads.some(x=>x.id==="defensive"));
 const old=sessions.slice(-21,-10);
 assert.ok(!buildDivergenceRadar([row("xlp",Array(11).fill(100),old),row("xlk",Array(11).fill(100),old)],[],now).leads.some(x=>x.id==="defensive"));
 const gap=sessions.slice(-12).filter((_,i)=>i!==5);
 assert.ok(!buildDivergenceRadar([row("xlp",Array.from({length:11},(_,i)=>100+i),gap),row("xlk",Array(11).fill(100),gap)],[],now).leads.some(x=>x.id==="defensive"));
 assert.ok(!buildDivergenceRadar([{...a,frequency:"monthly"},b],[],now).leads.some(x=>x.id==="defensive"));
});
test("breadth acceleration measures percentage points and sparse series stay unavailable",()=>{
 const values=[69.06,68,67,66,65,64.87,57.68,56.29,49.10,42.71,52.30];
 const series={symbol:"S5FI",sourceUrl:"https://example.com/breadth",sourceName:"Test breadth",points:days.map((date,i)=>({date,value:values[i]}))};
 const out=buildDivergenceRadar([], [series],now),r=out.leads.find(x=>x.id==="breadth-S5FI")!;
 assert.equal(r.metrics.find(x=>x.label==="Latest 5")?.value,-12.57);
 assert.equal(r.metrics.find(x=>x.label==="Prior 5")?.value,-4.19);
 assert.equal(r.metrics.find(x=>x.label==="Acceleration")?.value,-8.38);
 assert.equal(r.metrics.find(x=>x.label==="1 session")?.value,9.59);
 assert.equal(buildDivergenceRadar([],[{...series,points:series.points.slice(-1)}],now).leads.length,0);
});
test("correlation compares two distinct 20-return samples, not nested windows",()=>{
 const dates=sessions.slice(-41),a=[100],b=[100];
 for(let i=1;i<=40;i++){const r=i%2===0?0.02:-0.01;a.push(a.at(-1)!*(1+r));b.push(b.at(-1)!*(1+(i<=20?r:-r)));}
 const lead=buildDivergenceRadar([row("xlp",a,dates),row("xlk",b,dates)],[],now).leads.find(x=>x.id==="defensive-corr")!;
 assert.ok(lead);assert.equal(lead.metrics.find(x=>x.label==="Prior 20")?.value,1);assert.equal(lead.metrics.find(x=>x.label==="Latest 20")?.value,-1);
});
test("credit level changes are basis points, not percentage returns",()=>{
 const r=buildDivergenceRadar([row("hy-oas",[3,3,3,3,3,3,3.1,3.2,3.3,3.4,3.5])],[],now).leads.find(x=>x.id==="hy-oas")!;
 assert.ok(r);assert.equal(r.metrics.find(x=>x.label==="Latest 5")?.unit,"bp");assert.equal(r.metrics.find(x=>x.label==="Latest 5")?.value,50);
});

test("quiet relationships retain full matched return statistics independently of alerts",()=>{
 const result=buildDivergenceRadar([row("xlp",Array(11).fill(100)),row("xlk",Array(11).fill(100))],[],now);
 const check=result.checks.find(c=>c.id==="defensive")!;
 assert.ok(check.historyAvailable);
 assert.deepEqual(check.windows.map(w=>w.window),["1D","3D","5D"]);
 assert.equal(check.windows[2].left,0);assert.equal(check.windows[2].right,0);assert.equal(check.windows[2].gap,0);
 assert.ok(!result.leads.some(l=>l.id==="defensive"));
});
test("short matched histories remain inspectable without qualifying a historical lead",()=>{
 const dates=days.slice(-4);
 const out=buildDivergenceRadar([row("xlp",[100,101,102,103],dates),row("xlk",[100,100,100,100],dates)],[],now);
 const check=out.checks.find(c=>c.id==="defensive")!;
 assert.equal(check.historyAvailable,false);
 assert.deepEqual(check.windows.map(w=>w.window),["1D","3D"]);
 assert.equal(check.windows.find(w=>w.window==="3D")?.gap,3);
 assert.ok(!out.leads.some(l=>l.id==="defensive"));
});
test("all qualifying alerts have a corresponding visible relationship check",()=>{
 const a=row("xlp",[100,101,102,103,104,105,104,103,102,101,100]),b=row("xlk",Array(11).fill(100));
 const result=buildDivergenceRadar([a,b],[],now);
 for(const lead of result.leads)assert.ok(result.checks.some(c=>c.id===(lead.kind==="CORRELATION"?lead.id.replace(/-corr$/,""):lead.id)));
});

test("coverage includes every primary check, even if all sources are unavailable",()=>{
 const r=buildDivergenceRadar([],[],now);
 assert.equal(r.checks.length,r.coverage.checked);
 assert.equal(r.coverage.eligible,0);
 assert.ok(r.checks.every(c=>!c.historyAvailable));
 assert.equal(new Set(r.checks.map(c=>c.id)).size,r.checks.length);
});
test("a fresh breadth snapshot remains visible without fabricating historical change",()=>{
 const r=buildDivergenceRadar([],[{symbol:"S5FI",sourceUrl:"https://example.com/breadth",sourceName:"Test breadth",points:[{date:days.at(-1)!,value:52.3}]}],now);
 const c=r.checks.find(c=>c.id==="breadth-S5FI")!;
 assert.equal(c.historyAvailable,false);
 assert.deepEqual(c.metrics,[{label:"Level",value:52.3,unit:"%"}]);
 assert.ok(!r.leads.some(l=>l.id===c.id));
});
test("gold and real-yield co-movement compares native units without a fake gap",()=>{
 const rateDays=sessions.filter(d=>d!=="2026-11-11").slice(-11);
 const r=buildDivergenceRadar([row("gold-proxy",[100,100,100,100,100,100,101,102,103,104,105],rateDays),row("us10y-real",[2,2,2,2,2,2,2.03,2.06,2.09,2.12,2.15],rateDays)],[],now);
 const c=r.checks.find(c=>c.id==="gold-real-yield")!;
 assert.equal(c.metrics.find(m=>m.label==="5D price return")?.value,5);
 assert.equal(c.metrics.find(m=>m.label==="5D level change")?.value,15);
 assert.equal(c.metrics.find(m=>m.label==="5D level change")?.unit,"bp");
 assert.equal(c.windows.length,0);
 assert.ok(r.leads.some(l=>l.id===c.id));
});
test("a matched FRED 30Y series can supply the curve without mixing histories",()=>{
 const rateDays=sessions.filter(d=>d!=="2026-11-11").slice(-11);
 const r=buildDivergenceRadar([row("us2y",[4,4,4,4,4,4,4.1,4.2,4.3,4.4,4.5],rateDays),row("us30y-fred",Array(11).fill(5),rateDays)],[],now);
 const c=r.checks.find(c=>c.id==="yield-curve")!;
 assert.ok(c.historyAvailable);assert.equal(c.metrics.find(m=>m.label==="Latest 5")?.value,50);
 assert.equal(c.metrics.find(m=>m.label==="Spread")?.value,-50);
});

test("latest common completed session recovers reporting skew without mixing dates",()=>{
 const date="2026-11-24",later=new Date("2026-11-25T00:00:00Z");
 const a=row("xlp",[100,101,102,103,104,105,106,107,108,109,110,120],[...days,date]);
 const b=row("xlk",Array(11).fill(100),days);
 const r=buildDivergenceRadar([a,b],[],later),check=r.checks.find(c=>c.id==="defensive")!;
 assert.equal(check.asOf,days.at(-1));assert.equal(check.latestSourceDates?.left,date);
 assert.equal(check.windows.find(w=>w.window==="5D")?.left,4.76);
 assert.equal(check.historyAvailable,true);
});
test("latest common close cannot conceal gaps or excessive reporting skew",()=>{
 const later=new Date("2026-11-28T00:00:00Z");
 const dates=[...days,"2026-11-24","2026-11-25","2026-11-27"];
 const a=row("xlp",dates.map((_,i)=>100+i),dates);
 const b=row("xlk",Array(11).fill(100),days);
 assert.equal(buildDivergenceRadar([a,b],[],later).checks.find(c=>c.id==="defensive")?.historyAvailable,false);
 const gap=days.filter((_,i)=>i!==7);
 const x=row("xlp",gap.map((_,i)=>100+i),gap);
 assert.equal(buildDivergenceRadar([x,b],[],now).checks.find(c=>c.id==="defensive")?.historyAvailable,false);
});

test("Treasury comparisons exclude verified bond-only holidays, without relaxing equity pairs",()=>{
 const eqDays=sessions.slice(-13),rateDays=eqDays.filter(d=>d!=="2026-11-11");
 assert.ok(eqDays.includes("2026-11-11"));
 const rates=row("us2y",rateDays.map((_,i)=>4+i/100),rateDays);
 const thirty=row("us30y-fred",rateDays.map(()=>5),rateDays);
 const gold=row("gold-proxy",eqDays.map((_,i)=>100+i),eqDays);
 const real=row("us10y-real",rateDays.map((_,i)=>2+i/100),rateDays);
 const r=buildDivergenceRadar([rates,thirty,gold,real,row("xlp",eqDays.map((_,i)=>100+i),eqDays),row("xlk",rateDays.map(()=>100),rateDays)],[],now);
 assert.ok(r.checks.find(c=>c.id==="yield-curve")?.historyAvailable);
 assert.ok(r.checks.find(c=>c.id==="gold-real-yield")?.historyAvailable);
 assert.equal(r.checks.find(c=>c.id==="defensive")?.historyAvailable,false);
});
