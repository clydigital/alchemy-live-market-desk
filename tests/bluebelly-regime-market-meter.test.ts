import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {projectRegimeMeterReadings} from "../lib/bluebelly-regime-market-meter.ts";
import type {PublicMarketObservation} from "../lib/blue-desk-public-markets.ts";
import type {BondPressureMonitor,BondMetric} from "../lib/bluebelly-bond-pressure.ts";
const now=new Date("2026-11-13T09:30:00Z");
function market(id:string,changes:[number|null,number|null,number|null],asOf="2026-11-12"):PublicMarketObservation{
 const rates=id==="us2y",breadth=id==="breadth:S5FI",crude=id==="brent"||id==="wti";
 return {id,symbol:rates?"DGS2":breadth?"S5FI":crude?id==="brent"?"BZ=F":"CL=F":id.toUpperCase(),
  label:id,type:rates?"Rates":breadth?"Breadth":crude?"Energy":"AI / Semis",
  last:breadth?69.6:rates?4.4:crude?92.14:154.99,change:changes[0],change3d:changes[1],change5d:changes[2],
  changeUnit:rates?"bp":breadth?"pp":"%",asOf,frequency:"daily",sourceName:"Source-labelled fixture",
  sourceUrl:"https://example.com/original",dataStatus:"SOURCE_DATED_SECONDARY"};
}
function bond(state:BondPressureMonitor["state"]="LAST_REPORTED"):BondPressureMonitor{
 const metric=(id:string):BondMetric=>({id,label:id,kind:"yield",last:id==="us10y-fred"?5.1:5.3,
  asOf:"2026-11-12",sourceName:"Federal Reserve Economic Data",
  sourceUrl:"https://fred.stlouisfed.org/series/"+(id==="us10y-fred"?"DGS10":"DGS30"),
  changes:{"1D":12,"3D":15,"5D":20}});
 return {state,asOf:"2026-11-12",calendarLagDays:1,curve:[metric("us10y-fred"),metric("us30y-fred")],
  drivers:[],etfs:[],spreads:[],tltConfirmation:"NOT_COMPARABLE",headline:"Dated yields",
  notice:"Latest session is 12 Nov",
  windows:[{label:"1D",trend:"worse",tenYearBp:12,thirtyYearBp:9,from:"2026-11-10",to:"2026-11-12"},
   {label:"3D",trend:"worse",tenYearBp:15,thirtyYearBp:11,from:"2026-11-06",to:"2026-11-12"},
   {label:"5D",trend:"worse",tenYearBp:20,thirtyYearBp:19,from:"2026-11-04",to:"2026-11-12"}]};
}
const rows=[market("brent",[2.2,1.4,-.8],"2026-11-11"),market("us2y",[12,15,20]),
 market("soxx",[-.26,-1.1,2.6])];
test("market dials recover fresh dated changes without converting them to Regime decisions",()=>{
 const o=projectRegimeMeterReadings(rows,market("breadth:S5FI",[null,null,6.9]),bond(),now);
 assert.deepEqual(Object.keys(o),["energy","fed","bonds","ai","breadth"]);
 assert.equal(o.energy.direction,1);assert.equal(o.energy.observedAt,"2026-11-11");
 assert.equal(o.fed.direction,1);assert.match(o.fed.scope,/not FedWatch odds/);
 assert.equal(o.ai.direction,-1);assert.match(o.ai.caveat,/cash returns/);
 assert.equal(o.breadth.direction,1);assert.equal(o.breadth.needlePeriod,"5D");
 assert.deepEqual(o.breadth.windows.map(w=>w.readout),["NOT SUPPLIED","NOT SUPPLIED","+6.90 pp"]);
 assert.equal(o.bonds.state,"last_reported");assert.equal(o.bonds.direction,1);
 assert.match(o.bonds.windows[0].readout,/10Y \+12.0 bp/);
});
test("latest official Treasury session works on non-trading day but partial/stale dates never become direction",()=>{
 for(const state of ["PARTIAL","STALE","UNAVAILABLE"] as const){
  const r=projectRegimeMeterReadings([],null,bond(state),now).bonds;
  assert.equal(r.direction,null,state);assert.equal(r.state,"unavailable",state);
 }
 const r=projectRegimeMeterReadings([],null,bond("READY"),now).bonds;
 assert.equal(r.state,"observed");assert.equal(r.direction,1);
});
test("dated market admission rejects stale, future, missing and non-HTTPS market sources",()=>{
 for(const [asOf,url,status] of [["2026-10-30","https://example.com","SOURCE_DATED_SECONDARY"],
 ["2026-11-21","https://example.com","SOURCE_DATED_SECONDARY"],
 ["2026-11-12","http://example.com","SOURCE_DATED_SECONDARY"],
 ["2026-11-12","https://example.com","UNAVAILABLE_OR_STALE"]] as const){
  const item=market("brent",[2,null,null],asOf);item.sourceUrl=url;item.dataStatus=status;
  const result=projectRegimeMeterReadings([item],null,bond("STALE"),now).energy;
  assert.equal(result.direction,null,JSON.stringify([asOf,url,status]));
 }
});
test("an unavailable preferred Brent series can fall back to a sourced WTI reading without relabelling it",()=>{
 const stale=market("brent",[1,2,3],"2026-10-30");
 const wti=market("wti",[-1,null,null],"2026-11-12");
 const result=projectRegimeMeterReadings([stale,wti],null,bond("STALE"),now).energy;
 assert.equal(result.direction,-1);assert.equal(result.label,"wti");assert.equal(result.observedAt,"2026-11-12");
});
test("no fabricated 1D reading when the only provider window is 5D",()=>{
 const item=market("breadth:S5FI",[null,null,null]);
 const result=projectRegimeMeterReadings(rows,item,bond(),now).breadth;
 assert.equal(result.direction,null);
 assert.equal(result.state,"observed");
 assert.ok(result.windows.every(w=>w.readout==="NOT SUPPLIED"));
});
test("Regime hub retains historical research gate and makes primary-source provenance visible",()=>{
 const page=readFileSync(new URL("../app/blue-desk/regime-watch/page.tsx",import.meta.url),"utf8");
 const src=readFileSync(new URL("../lib/bluebelly-regime-market-meter.ts",import.meta.url),"utf8");
 const compass=readFileSync(new URL("../components/blue-desk/MarketCompass.tsx",import.meta.url),"utf8");
 assert.match(page,/projectRegimeMeterReadings/);
 assert.match(page,/RegimeResearchClocks/);
 assert.match(page,/MarketCompass summary=\{compassSummary\}/);
 assert.match(compass,/data-status=\{item.state\}/);
 assert.match(compass,/item.observedAt/);
 assert.match(page,/HISTORICAL 30 OCT EDITORIAL/);
 assert.match(src,/not FedWatch odds/);
 assert.doesNotMatch(src+page,/\.upsert\(|\.insert\(|supabase\.rpc\(/);
});
