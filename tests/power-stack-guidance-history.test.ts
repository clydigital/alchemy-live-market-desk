import test from "node:test";
import assert from "node:assert/strict";
import {compareGuidance,REVIEWED_GUIDANCE} from "../lib/power-stack-guidance-history.ts";
const now=new Date("2026-11-26T00:00:00Z");
test("same-fiscal-period guidance comparisons preserve GAAP, non-GAAP and floor",()=>{
 const rows=compareGuidance(REVIEWED_GUIDANCE,now);
 assert.equal(rows.length,3);
 const ci=rows.find(r=>r.latest.ticker==="CI")!;
 assert.equal(ci.latest.kind,"FLOOR");assert.equal(ci.prior?.value,30.45);
 const dell=rows.filter(r=>r.latest.ticker==="DELL");
 assert.equal(dell.length,2);
 assert.ok(dell.some(r=>r.latest.value===29.68&&r.prior?.value===25.5));
 assert.ok(dell.some(r=>r.latest.value===28.24&&r.prior?.value===24.37));
});
test("date-only guidance is not known on release day",()=>{
 const rows=compareGuidance(REVIEWED_GUIDANCE,new Date("2026-11-24T23:59:00Z"));
 assert.ok(rows.filter(r=>r.latest.ticker==="DELL").every(r=>r.latest.releaseDay==="2026-09-01"));
});
test("conflicting same-day observations rejected; floors not matched to points",()=>{
 const first=REVIEWED_GUIDANCE[0];
 assert.equal(compareGuidance([first,{...first,value:32}],now).length,0);
 const r=compareGuidance([first,{...first,kind:"POINT",releaseDay:"2026-11-05"}],now);
 assert.equal(r.length,2);assert.ok(r.every(x=>x.prior===null));
});
