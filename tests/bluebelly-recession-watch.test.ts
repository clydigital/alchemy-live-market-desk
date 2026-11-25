import test from "node:test";
import assert from "node:assert/strict";
import {ACTIVE_RECESSION_SERIES,RECESSION_INDICATORS,projectRecessionWatch} from "../lib/bluebelly-recession-watch.ts";
import type {FredReadResult,FredObservation} from "../lib/providers/fred-api-v1.ts";
import {blueDeskHostAccess,blueDeskPresentationTarget} from "../lib/blue-desk-host.ts";
const now=new Date("2026-11-26T00:00:00Z");
const obs=(date:string,value:number,rt="2026-11-25"):FredObservation=>({date,value,realtimeStart:rt,realtimeEnd:rt});
const read=(seriesId:string,observations:FredObservation[]):FredReadResult=>({seriesId,state:"ready",sourceUrl:"https://fred.stlouisfed.org/series/"+seriesId,retrievedAt:"2026-11-25T22:00:00Z",vintageDate:null,observations,note:null});
test("fixed unique registry and no false recession conclusion from missing data",()=>{
 const a=projectRecessionWatch([],now);
 assert.equal(new Set(RECESSION_INDICATORS.map(x=>x.id)).size,RECESSION_INDICATORS.length);
 assert.equal(a.coverage.observed,0);assert.equal(a.core.total,6);assert.equal(a.core.eligible,0);
 assert.ok(ACTIVE_RECESSION_SERIES.length<=16);
 assert.equal(a.assessment,"NO_AUTOMATIC_RECESSION_VERDICT");
});
test("Sahm threshold uses published measure and does not issue a verdict",()=>{
 const r=projectRecessionWatch([read("SAHMREALTIME",[obs("2026-10-01",0.5)])],now).rows.find(x=>x.id==="SAHMREALTIME")!;
 assert.equal(r.threshold,"Published Sahm threshold reached");
 const stale=projectRecessionWatch([read("SAHMREALTIME",[obs("2026-06-01",0.8)])],now).rows.find(x=>x.id==="SAHMREALTIME")!;
 assert.equal(stale.state,"AGED");assert.equal(stale.threshold,null);
});
test("three-month comparison requires matching months; missing or old values never vote",()=>{
 const a=projectRecessionWatch([read("PAYEMS",[obs("2026-10-01",99),obs("2026-07-01",100)]),read("CE16OV",[obs("2026-10-01",100),obs("2026-08-01",99)]),read("INDPRO",[obs("2026-06-01",90),obs("2026-03-01",100)])],now);
 assert.equal(a.core.eligible,1);assert.equal(a.core.negative,1);
});
test("future data, future retrieval and newest conflicting values do not qualify",()=>{
 const a=projectRecessionWatch([read("PAYEMS",[obs("2026-10-01",100),obs("2026-10-01",99)]),read("UNRATE",[obs("2026-12-01",4)]),{...read("ICSA",[obs("2026-11-21",190000)]),retrievedAt:"2026-11-27T00:00:00Z"}],now);
 assert.equal(a.coverage.observed,0);
});
test("exact public recession route; no arbitrary child routes",()=>{
 const h="bluebelly-desk.vercel.app";
 assert.equal(blueDeskHostAccess("/regime-watch/recession",h),"public");
 assert.equal(blueDeskPresentationTarget("/regime-watch/recession",h),"/blue-desk/regime-watch/recession");
 assert.equal(blueDeskHostAccess("/regime-watch/recession/private",h),"blocked");
});
