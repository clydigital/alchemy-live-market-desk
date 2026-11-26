import test from "node:test";
import assert from "node:assert/strict";
import {evaluatePointInTime,type Input,type Session,type Timed} from "../lib/research/point-in-time-validation.ts";
const make=(n=200):Input=>{
 const sessions:Session[]=Array.from({length:n},(_,i)=>{
  const date=new Date(Date.UTC(2020,0,1+i)).toISOString().slice(0,10),closeAt=date+"T20:00:00Z";
  const stamp=<T>(value:T):Timed<T>=>({value,observedAt:closeAt,availableAt:closeAt,sourceId:"synthetic"});
  return {date,closeAt,price:100+i,benchmark:100,signal:stamp(i%4===0),modifier:stamp(i%8===0),trend:stamp(true),regime:stamp("synthetic-regime"),var95:stamp(2),var99:stamp(3)};
 });
 return {instrument:"synthetic",benchmarkInstrument:"synthetic-flat",signalDefinition:"fixture",modifierDefinition:"fixture",trendDefinition:"fixture",regimeDefinition:"fixture",priceBasis:"fixture",sourceManifest:"synthetic only",calendarAttestation:"synthetic sessions",frozenAt:"2021-01-01T00:00:00Z",trainEnd:sessions[79].date,minSample:20,sessions};
};
test("fixed nonoverlap, holdout purge, comparable cohort and next-close return",()=>{
 const r=evaluatePointInTime(make()),h=r.horizons[0];
 assert.equal(h.holdout.overall.all.n,59);
 assert.equal(h.holdout.overall.all.n,h.holdout.overall.signal.n+h.holdout.overall.noSignal.n);
 assert.ok(h.holdout.overall.signal.meanExcessPct!>0);
 assert.ok(r.horizons[1].coverage.purged>0);
 assert.equal(r.horizons[3].holdout.overall.all.status,"INSUFFICIENT_SAMPLE");
});
test("late or missing information never becomes false signal or imputed outcome",()=>{
 const a=make(),before=evaluatePointInTime(a).horizons[0];
 a.sessions[80].signal!.availableAt=a.sessions[81].closeAt;
 a.sessions[84].modifier=null;
 a.sessions[89].price=null;
 const h=evaluatePointInTime(a).horizons[0];
 assert.equal(h.holdout.overall.all.n,before.holdout.overall.all.n-3);
 assert.equal(h.coverage.unavailable,3);
});
test("risk exception rate uses same holdout cohort, independent of direction signals",()=>{
 const a=make();a.sessions[81].signal=null;a.sessions[82].price=140;
 const r=evaluatePointInTime(a).riskCalibration;
 assert.equal(r.var95.n,119);assert.equal(r.var99.n,119);
 assert.equal(r.var95.exceptions,1);assert.equal(r.var99.exceptions,1);
 a.sessions[81].var99!.value=1;
 assert.equal(evaluatePointInTime(a).riskCalibration.unavailable,1);
});
test("invalid chronology, incomplete metadata and post-freeze close rejected",()=>{
 const a=make();assert.throws(()=>evaluatePointInTime({...a,sessions:[...a.sessions].reverse()}));
 assert.throws(()=>evaluatePointInTime({...a,sourceManifest:""}));
 assert.throws(()=>evaluatePointInTime({...a,frozenAt:a.sessions[10].closeAt}));
});
