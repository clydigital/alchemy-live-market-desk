import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildCrashEvidenceBalance} from "../lib/bluebelly-crash-evidence-balance.ts";
import type {CrashSignal,CrashWatchView} from "../lib/bluebelly-crash-opportunity.ts";
import type {MarketCompassSummary,CompassState} from "../lib/bluebelly-market-compass.ts";

const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
function fixture(b:CrashSignal,c:CrashSignal,t:CompassState,dates=true):[CrashWatchView,MarketCompassSummary]{
 const observed=dates?"2026-11-13":null;
 const view:CrashWatchView={position:"CONTESTED",confidence:"LOW",
  lastReviewed:"2026-11-14T00:00:00Z",confirmedSignals:0,measurementCoverage:2,sourceStatus:"PARTIAL",caveat:"Measured",
  pillars:[
   {id:"breadth",name:"Breadth",signal:b,basis:"RSP minus SPX is weaker",
    nextTest:"Cross-check",watchId:"breadth",observedAt:observed},
   {id:"credit",name:"Credit",signal:c,basis:"High-yield OAS five-observation change",
    nextTest:"Cross-check",watchId:"bonds",observedAt:observed}
  ],
  readings:[{id:"hy-oas",label:"High-yield",symbol:"BAMLH0A0HYM2",status:dates?"DATED":"MISSING",
   value:3.5,dayChange:null,fiveSessionChange:null,unit:"spread-percent",
   asOf:observed,sourceName:"FRED",sourceUrl:"https://fred.stlouisfed.org/series/BAMLH0A0HYM2",
   note:"OAS in percentage points"}]
 };
 const compass:MarketCompassSummary={state:t,title:"Measured tape",
  sourceSession:observed,evidenceCount:dates?4:0,
  explanation:"Matched sessions",contradiction:"Countercase",nextTest:"Verify",
  note:"Source-dated 1D ETF tape"};
 return [view,compass];
}
test("four and half research units tilt crash pan down when all three are bearish",()=>{
 const x=buildCrashEvidenceBalance(...fixture("BEAR","BEAR","RISK_OFF"));
 assert.equal(x.crashUnits,4.5);
 assert.equal(x.opportunityUnits,0);
 assert.equal(x.neutralUnits,0);
 assert.equal(x.unknownUnits,0);
 assert.equal(x.angle,13);
 assert.equal(x.lean,"CRASH_RISK");
 assert.equal(x.eligibleCount,3);
});
test("counterweights can coexist and change which side is heavier",()=>{
 const x=buildCrashEvidenceBalance(...fixture("BEAR","BULL","RISK_ON"));
 assert.equal(x.crashUnits,1.5);
 assert.equal(x.opportunityUnits,3);
 assert.equal(x.lean,"OPPORTUNITY");
 assert.ok(x.angle<0);
 const y=buildCrashEvidenceBalance(...fixture("BULL","BEAR","RISK_ON"));
 assert.equal(y.crashUnits,2);
 assert.equal(y.opportunityUnits,2.5);
 assert.ok(y.angle<0);
 const z=buildCrashEvidenceBalance(...fixture("BEAR","BEAR","RISK_ON"));
 assert.equal(z.crashUnits,3.5);
 assert.equal(z.opportunityUnits,1);
 assert.ok(z.angle>0);
});
test("neutral credit and missing inputs cannot falsely load opportunity or crash trays",()=>{
 const x=buildCrashEvidenceBalance(...fixture("BEAR","MIXED","RISK_OFF"));
 assert.equal(x.crashUnits,2.5);
 assert.equal(x.opportunityUnits,0);
 assert.equal(x.neutralUnits,2);
 assert.equal(x.angle,Number((13*2.5/4.5).toFixed(2)));
 const [v,c]=fixture("BEAR","BEAR","RISK_OFF",false);
 const y=buildCrashEvidenceBalance(v,c);
 assert.equal(y.lean,"UNMEASURED");
 assert.equal(y.angle,0);
 assert.equal(y.unknownUnits,4.5);
 assert.equal(y.latestSession,null);
});
test("credit observation must be date-aligned to its own qualified FRED reading",()=>{
 const [v,c]=fixture("BULL","BEAR","RISK_ON");
 const changed:CrashWatchView={...v,
  readings:[{...v.readings[0],status:"STALE",asOf:"2026-11-06"}]};
 const x=buildCrashEvidenceBalance(changed,c);
 assert.equal(x.unknownUnits,2);
 assert.equal(x.weights.find(w=>w.id==="credit")?.side,"UNKNOWN");
 assert.equal(x.opportunityUnits,2.5);
});
test("page shows accessible, animating two-sided instrument and clear provenance limitations",()=>{
 const page=read("app/blue-desk/crash-opportunity/page.tsx");
 const component=read("components/blue-desk/CrashEvidenceSeesaw.tsx");
 const css=read("components/blue-desk/CrashEvidenceSeesaw.module.css");
 assert.match(page,/buildCrashEvidenceBalance\(watch,compass,transcriptScore\)/);
 assert.match(page,/<CrashEvidenceSeesaw balance=\{balance\}/);
 assert.match(component,/data-crash-evidence-seesaw="source-dated-v1"/);
 assert.match(component,/role="img" aria-label=\{label\}/);
 assert.match(component,/data-pan=\{side\}/);
 assert.match(component,/data-weight-source=\{w.id\}/);
 assert.match(component,/not calibrated probabilities/);
 assert.match(css,/@keyframes seesawSettle/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.doesNotMatch(page,/\.upsert\(|\.insert\(|schedule\(/);
});
