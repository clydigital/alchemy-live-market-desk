import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {projectRegimeResearchClocks} from "../lib/bluebelly-regime-research-clocks.ts";
import type {PublicSourceObservation} from "../lib/blue-desk-source-observations-projector.ts";

const now=new Date("2026-11-12T01:45:00+08:00");
const shadow={
  available:true, latestRunStatus:"completed", latestCompletedAt:"2026-11-06T15:09:22Z",
  currentProjectionCount:5,expectedProjectionCount:5,
} as const;
const source:PublicSourceObservation={
  id:"9cc82d53-7045-4cfd-bb4c-a9678ad13259",kind:"MARKET_OBSERVATION",
  description:"This market observation identifies a dated 20-session price-return divergence, not a live thesis.",
  eventAt:"2026-11-10T23:59:59Z",recordedAt:"2026-11-11T13:33:32Z",
  sourceName:"Nasdaq/FRED",sourceUrl:"https://fred.stlouisfed.org/series/SP500",sourceTier:1,
};

test("new source clock cannot overwrite old editorial review or shadow projection",()=>{
  const result=projectRegimeResearchClocks({
    sources:[source],editorialReviewedOn:"2026-10-30",shadow,now,
  });
  assert.equal(result.sourceState,"DATED");
  assert.equal(result.sourceEventAt,source.eventAt);
  assert.equal(result.sourceRecordedAt,source.recordedAt);
  assert.equal(result.editorialReviewedOn,"2026-10-30");
  assert.equal(result.unreviewedNewSource,true);
  assert.equal(result.shadowCompletedAt,shadow.latestCompletedAt);
  assert.equal(result.shadowState,"COMPLETED");
  assert.equal(result.shadowCoverage,"5/5");
});

test("future observations and received-after-now records cannot make a clock current",()=>{
  const result=projectRegimeResearchClocks({
    sources:[
      {...source,eventAt:"2026-11-13T13:30:00Z",recordedAt:"2026-11-11T13:33:32Z"},
      {...source,eventAt:"2026-11-11T14:00:00Z",recordedAt:"2026-11-12T14:01:00Z"},
    ],editorialReviewedOn:"2026-10-30",shadow,now,
  });
  assert.equal(result.sourceState,"EMPTY");
  assert.equal(result.unreviewedNewSource,false);
  assert.equal(result.sourceEventAt,null);
});

test("source reader unavailable differs from a valid zero-event public sample",()=>{
  const absent=projectRegimeResearchClocks({sources:null,editorialReviewedOn:"2026-10-30",shadow:null,now});
  const empty=projectRegimeResearchClocks({sources:[],editorialReviewedOn:"2026-10-30",shadow,now});
  assert.equal(absent.sourceState,"UNAVAILABLE");
  assert.equal(absent.shadowState,"UNAVAILABLE");
  assert.equal(empty.sourceState,"EMPTY");
  assert.equal(empty.shadowState,"COMPLETED");
});

test("incomplete or future shadow runs are not treated as completed snapshots",()=>{
  const incomplete=projectRegimeResearchClocks({
    sources:[source],editorialReviewedOn:"2026-10-30",
    shadow:{...shadow,latestRunStatus:"running"},now,
  });
  const future=projectRegimeResearchClocks({
    sources:[source],editorialReviewedOn:"2026-10-30",
    shadow:{...shadow,latestCompletedAt:"2026-11-13T10:00:00Z"},now,
  });
  assert.equal(incomplete.shadowState,"NOT_COMPLETED");
  assert.equal(incomplete.shadowCompletedAt,null);
  assert.equal(future.shadowState,"NOT_COMPLETED");
});

test("public Bluebelly Regime, lens, and cross-regime reader have identical three-clock boundaries",()=>{
  const component=readFileSync("components/blue-desk/RegimeResearchClocks.tsx","utf8");
  assert.match(component,/data-regime-research-clocks="original-editorial-shadow-v1"/);
  assert.match(component,/Original source observation/);
  assert.match(component,/Reviewed lens outlook/);
  assert.match(component,/Persisted Regime shadow run/);
  assert.match(component,/does not automatically run Story\/Regime reasoning/);
  for(const path of [
    "app/blue-desk/regime-watch/page.tsx",
    "app/blue-desk/regime-watch/[lensId]/page.tsx",
    "app/blue-desk/crash-opportunity/page.tsx",
  ]){
    const page=readFileSync(path,"utf8");
    assert.match(page,/RegimeResearchClocks/,path);
    assert.match(page,/getRegimeShadowHealth\(\)/,path);
    assert.match(page,/getPublicSourceObservations/,path);
  }
});
