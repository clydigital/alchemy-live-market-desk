import test from "node:test";
import assert from "node:assert/strict";
import {buildMacroResearchCharts} from "../lib/bluebelly-research-charts.ts";
import type {MarketMonitorRow} from "../lib/market-monitor.ts";
const now=new Date("2026-11-24T09:00:00Z");
const point=(date:string,close:number)=>({time:Date.parse(date+"T00:00:00Z")/1000,close});
const row={id:"us2y",type:"Rates",frequency:"daily",sourceName:"FRED",sourceUrl:"https://fred.stlouisfed.org/series/DGS2",points:[point("2026-11-02",3.8),point("2026-11-20",3.9),point("2026-11-23",3.85),point("2026-11-25",9)]} as MarketMonitorRow;
test("macro history renders only admitted dates and preserves gaps",()=>{
 const charts=buildMacroResearchCharts([row],now), c=charts[0];
 assert.equal(c.status,"READY");
 assert.equal(c.asOf,"2026-11-23");
 assert.equal(c.unit,"%");
 assert.equal(c.marks.length,3);
 assert.equal(c.segments?.length,2);
 assert.match(c.svg!,/no extrapolation or gap filling/);
 assert.equal(charts[1].svg,null);
 assert.equal(charts[2].status,"UNAVAILABLE");
 assert.equal(c.dataHash,buildMacroResearchCharts([row],new Date("2026-11-24T12:00:00Z"))[0].dataHash);
});
test("stale or unproven histories are not rendered",()=>{
 const stale=buildMacroResearchCharts([{...row,points:[point("2026-10-20",3.8),point("2026-10-21",3.9)]}],now)[0];
 assert.equal(stale.status,"UNAVAILABLE");
 assert.equal(stale.svg,null);
 const noSource=buildMacroResearchCharts([{...row,sourceUrl:""}],now)[0];
 assert.equal(noSource.svg,null);
});
