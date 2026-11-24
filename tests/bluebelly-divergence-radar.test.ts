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
