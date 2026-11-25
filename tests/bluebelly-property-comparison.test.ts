import test from "node:test";
import assert from "node:assert/strict";
import {propertyComparison} from "../lib/bluebelly-property-comparison.ts";
const now=new Date("2026-11-26T00:00:00Z");
test("REITs and builders use distinct source-dated metrics",()=>{
 const [maa,invh,phm,ess]=propertyComparison(["MAA","INVH","PHM","ESS"],now);
 const cell=(c:typeof maa,key:string)=>c.cells.find(x=>x.key===key)!;
 assert.equal(cell(maa,"affo").value,1.79);assert.equal(cell(invh,"affo").value,.38);
 assert.equal(cell(maa,"noi_yoy").value,-1.8);assert.equal(cell(invh,"noi_yoy").value,1.1);
 assert.equal(cell(phm,"orders").value,6208);assert.equal(cell(phm,"gross_margin").value,24.8);
 assert.equal(cell(phm,"affo").state,"NOT_APPLICABLE");assert.equal(cell(maa,"orders").state,"NOT_APPLICABLE");
 assert.equal(cell(maa,"p_affo").state,"NOT_VERIFIED");assert.equal(cell(ess,"affo").state,"NOT_VERIFIED");
 assert.equal(cell(phm,"backlog").scope,"PERIOD_END");
 assert.equal(cell(phm,"cancellations").value,null);
 assert.equal(maa.periodEnd,"2026-09-30");
});
test("future availability and aged receipts never become current data",()=>{
 for(const at of ["2026-11-01T00:00:00Z","2027-03-01T00:00:00Z"]){
  assert.equal(propertyComparison(["MAA"],new Date(at))[0].cells.find(x=>x.key==="affo")?.value,null);
 }
});
