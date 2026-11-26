import test from "node:test";
import assert from "node:assert/strict";
import {buildBondRegimeCharts} from "../lib/bluebelly-research-charts.ts";
import type {MarketMonitorRow} from "../lib/market-monitor.ts";
const now=new Date("2026-11-12T00:30:00Z");
const dates=["2026-11-03","2026-11-04","2026-11-05","2026-11-06","2026-11-09","2026-11-10"];
function row(id:string,base:number):MarketMonitorRow{
 const symbol=id==="us2y"?"DGS2":id==="us10y-fred"?"DGS10":"DGS30";
 return {id,symbol,type:"Rates",frequency:"daily",asOf:dates.at(-1)!,sourceName:"Federal Reserve Economic Data",sourceUrl:"https://fred.stlouisfed.org/series/"+symbol,points:dates.map((d,i)=>({time:Date.parse(d+"T00:00:00Z")/1000,close:base+i/10}))} as MarketMonitorRow;
}
test("yield curve and duration charts retain matching official sessions",()=>{
 const rows=[row("us2y",3),row("us10y-fred",4),row("us30y-fred",4.5)];
 const charts=buildBondRegimeCharts(rows,now);
 assert.equal(charts.length,4);
 assert.equal(charts[0].status,"PARTIAL");
 assert.equal(charts[0].asOf,"2026-11-10");
 assert.equal(charts[0].marks.length,3);
 assert.equal(charts[1].status,"READY");
 assert.equal(charts[1].unit,"bp");
 assert.deepEqual(charts[1].marks.map(m=>m.value),[10,10]);
 assert.match(charts[1].window,/2026-11-09 to 2026-11-10/);
 assert.match(charts[1].svg!,/not a regime forecast/);
 assert.equal(charts[3].status,"READY");
 assert.equal(buildBondRegimeCharts(rows,now)[1].dataHash,charts[1].dataHash);
 assert.ok(buildBondRegimeCharts(rows,new Date("2026-11-20T00:00:00Z")).every(c=>c.svg===null));
 const mismatched=[rows[0],rows[1],{...rows[2],asOf:"2026-11-09"}];
 assert.ok(buildBondRegimeCharts(mismatched,now).every(c=>c.svg===null));
});
