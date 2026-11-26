import test from "node:test";
import assert from "node:assert/strict";
import {assessArgumentQuality} from "../lib/bluebelly-argument-quality.ts";
import type {Gem,RegistryRow} from "../lib/bluebelly-hypothesis-registry.ts";
const date="2026-11-26T00:00:00Z";
const gem=(id:string,overrides:Partial<Gem>={}):Gem=>({id,label:id,role:"CONFIRMS",observation:"Recorded observation",sourceUrl:"https://example.com/"+id,sourceDate:"2026-11-25",state:"RETAINED_SOURCE_RECEIPT",premise:"Premise "+id,canonicalReceipt:{status:"MATCHED",receivedAt:"2026-11-25"},...overrides});
const row=(gems:Gem[]):RegistryRow=>({id:"rg",pageId:"page",title:"Test",state:"ACTIVE",theme:"",currentRead:"mixed",nextTrigger:"test",lastChecked:null,lastEdited:null,snapshot:{version:"evidence-gems/1",hypothesisId:"rg",reviewedOn:"2026-11-25",currentRead:"mixed",conditional:"IF condition THEN outcome",nextTest:"Next release",gems}});
test("same source or exact premise groups transitively; mixed evidence is not netted",()=>{
 const r=assessArgumentQuality(row([gem("a"),gem("b",{sourceUrl:"https://example.com/a?utm_source=x#section"}),gem("c",{premise:" PREMISE B ",role:"WEAKENS"}),gem("d")]),date);
 assert.equal(r.groupCount,2);assert.equal(r.mixed,1);assert.equal(r.support,1);assert.equal(r.challenge,0);assert.equal(r.receiptBacked,4);
});
test("attributed, pending, missing and mismatched receipts never count as directional corroboration",()=>{
 const r=assessArgumentQuality(row([gem("a",{state:"ATTRIBUTED"}),gem("b",{state:"PENDING"}),gem("c",{canonicalReceipt:{status:"MISSING",receivedAt:null}}),gem("d",{canonicalReceipt:{status:"PROVENANCE_MISMATCH",receivedAt:null}})]),date);
 assert.equal(r.support,0);assert.equal(r.unverified,4);assert.equal(r.receiptBacked,0);assert.equal(r.status,"NO_MATCHED_DIRECTIONAL_GROUP");
});
test("conditional and amplifying evidence are modifiers rather than directional votes",()=>{
 const r=assessArgumentQuality(row([gem("a",{role:"CONDITIONAL"}),gem("b",{role:"AMPLIFIES"}),gem("c",{role:"INVALIDATES"})]),date);
 assert.equal(r.modifiers,2);assert.equal(r.challenge,1);assert.equal(r.support,0);assert.equal(r.counterargumentRecorded,true);
});
test("review age and source date age differ; stale and missing snapshot are explicit",()=>{
 const r=assessArgumentQuality({...row([gem("a",{sourceDate:"2026-11-20"}),gem("b",{sourceDate:null})]),state:"STALE"},date);
 assert.equal(r.status,"STALE_REVIEW");assert.equal(r.reviewAgeDays,1);assert.equal(r.oldestSourceAgeDays,6);assert.equal(r.undated,1);assert.equal(r.receiptBacked,1);
 assert.equal(assessArgumentQuality({...row([]),snapshot:null},date).status,"SNAPSHOT_UNAVAILABLE");
 assert.equal(assessArgumentQuality(row([gem("a")]),null).reviewAgeDays,null);
});
