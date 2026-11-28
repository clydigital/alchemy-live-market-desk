import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("shared aggregate separates scheduled acquisition, verification and publication",()=>{
 const reader=read("lib/bluebelly-absorption-health.ts");
 const view=read("components/blue-desk/AbsorptionHealth.tsx");
 assert.match(reader,/freshness_gate_passed,evidence_gate_passed,required_sources_complete/);
 assert.match(reader,/\.order\("scheduled_for",\{ascending:false\}\)/);
 assert.match(reader,/latest\?\.freshness_gate_passed\?\?null/);
 assert.match(reader,/freshness_gate_passed===false/);
 assert.match(view,/value===true\?"Passed":value===false\?"Not passed":"Unverified"/);
 assert.match(view,/not an overall research-health score/);
 assert.match(view,/data-absorption-stage="scheduled-research"/);
 assert.match(view,/data-absorption-stage="downstream"/);
 assert.match(view,/does not establish a no-material-change decision or a delivery failure/);
 assert.match(view,/Last completed scheduled acquisition/);
 assert.doesNotMatch(view,/Last successful research run/);
 assert.doesNotMatch(reader,/getOwnerWorkReceiptLanes|story_thesis_versions|intelligence_evidence/);
});
test("private owner health compares actual canonical records and does not infer publication",()=>{
 const source=read("lib/my-desk-health-server.ts");
 for(const table of ["intelligence_evidence","story_updates","story_thesis_versions"]) assert.ok(source.includes('readLatest("'+table+'","created_at")'));
 assert.match(source,/Actual canonical table timestamps; Work receipts are separate/);
 assert.match(source,/Read unavailable/);
 assert.match(source,/Stale canonical revisions do not prove failed agent-led research or a material change/);
 assert.match(source,/fresh:null,coverageComplete:null/);
 assert.match(read("middleware.ts"),/from\("app_access_allowlist"\)/);
});

test("owner acquisition exposes a failed gate without treating completed run as healthy",()=>{
 const source=read("lib/my-desk-health-server.ts");
 assert.match(source,/r\?\.freshness_gate_passed===false\?false:fresh/);
 assert.match(source,/partial:failedGates\.length>0/);
 assert.match(source,/Gate not passed:/);
});
test("gap-case maintenance cannot impersonate canonical handoff",()=>{
 const source=read("lib/my-desk-health-server.ts");
 assert.match(source,/\.order\("handed_off_at",\{ascending:false\}\)/);
 assert.match(source,/status>=200&&status<300/);
 assert.match(source,/Modification is not a new handoff/);
 assert.match(source,/cases currently marked HANDED_OFF/);
});
