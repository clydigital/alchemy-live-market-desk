import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {projectRegistryRows,parseHypothesisSnapshot,readFirstSnapshot,canonicalGemIds,projectCanonicalGemReceipts} from "../lib/bluebelly-hypothesis-registry.ts";
const now=new Date("2026-11-26T00:00:00Z");
const rich=(s:string)=>({rich_text:[{plain_text:s}]});
const record={id:"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",last_edited_time:"2026-11-25T22:00:00Z",properties:{"Investigation ID":rich("RG-TEST-1"),Gap:{title:[{plain_text:"Test hypothesis"}]},Status:{select:{name:"ACTIVE"}},"Current Read":rich("Mixed"),"Next Trigger":rich("Next release")}};
const row=projectRegistryRows({results:[record]},now)[0];
const snapshot={version:"evidence-gems/1",hypothesisId:"RG-TEST-1",reviewedOn:"2026-11-26",currentRead:"Mixed",conditional:"IF demand holds THEN cash may improve UNLESS funding fails",nextTest:"Next report",gems:[{id:"source-1",label:"Cash",role:"WEAKENS",observation:"Dated observation",sourceUrl:"https://example.com/release",sourceDate:"2026-11-25",state:"RETAINED_SOURCE_RECEIPT",premise:"Challenges broad collapse"}]};
test("registry projects only stable active IDs, deduplicates and rejects archived rows",()=>{assert.equal(projectRegistryRows({results:[record,record,{...record,archived:true}]},now).length,1);assert.equal(row.currentRead,"Mixed");assert.equal(row.snapshot,null);});
test("snapshot requires matching current read, original source and nonfuture date",()=>{assert.equal(parseHypothesisSnapshot(snapshot,row,now)?.gems[0].role,"WEAKENS");assert.equal(parseHypothesisSnapshot({...snapshot,currentRead:"Old"},row,now),null);assert.equal(parseHypothesisSnapshot({...snapshot,hypothesisId:"other"},row,now),null);assert.equal(parseHypothesisSnapshot({...snapshot,reviewedOn:"2026-11-27"},row,now),null);assert.equal(parseHypothesisSnapshot({...snapshot,gems:[{...snapshot.gems[0],sourceUrl:"javascript:alert(1)"}]},row,now),null);assert.equal(parseHypothesisSnapshot({...snapshot,gems:[snapshot.gems[0],snapshot.gems[0]]},row,now),null);});
test("only designated first JSON block, no old snapshot fallback",()=>{const b={type:"code",code:{language:"json",rich_text:[{plain_text:JSON.stringify(snapshot)}]}};assert.ok(readFirstSnapshot({results:[b]},row,now));assert.equal(readFirstSnapshot({results:[{type:"paragraph"},b]},row,now),null);});
test("registry reads only after independent active owner guard, no public integration",()=>{const source=readFileSync(new URL("../lib/bluebelly-hypothesis-registry-server.ts",import.meta.url),"utf8");assert.ok(source.indexOf("if(accessError||!access)")<source.indexOf("const token="));assert.match(source,/cache:"no-store"/);assert.match(source,/slice\(0,4\)/);const page=readFileSync(new URL("../app/owner/research/page.tsx",import.meta.url),"utf8");assert.match(page,/getOwnerHypothesisRegistry\(\)/);});

test("canonical receipt readback distinguishes exact ID, URL and date from missing or unavailable",()=>{
 const id="aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",g={...snapshot.gems[0],id,state:"ATTRIBUTED",canonicalReceipt:{status:"MATCHED",receivedAt:"spoofed"}};
 const parsed=parseHypothesisSnapshot({...snapshot,gems:[g]},row,now)!;
 assert.equal(parsed.gems[0].canonicalReceipt,undefined);
 const rows=[{...row,snapshot:parsed}],receipt={id,provenance_urls:[g.sourceUrl],event_at:"2026-11-25T12:00:00Z",received_at:"2026-11-25T13:00:00Z"};
 assert.deepEqual(canonicalGemIds([...rows,...rows]),[id]);
 const check=(r:unknown[]|null)=>projectCanonicalGemReceipts(rows,r,now)[0].snapshot!.gems[0];
 assert.equal(check([receipt]).canonicalReceipt?.status,"MATCHED");
 assert.equal(check([receipt]).state,"ATTRIBUTED");
 assert.equal(check([{...receipt,event_at:"2026-11-24"}]).canonicalReceipt?.status,"PROVENANCE_MISMATCH");
 assert.equal(check([{...receipt,provenance_urls:["https://example.com/other"]}]).canonicalReceipt?.status,"PROVENANCE_MISMATCH");
 assert.equal(check([{...receipt,received_at:"2026-11-27"}]).canonicalReceipt?.status,"PROVENANCE_MISMATCH");
 assert.equal(check([]).canonicalReceipt?.status,"MISSING");
 assert.equal(check(null).canonicalReceipt?.status,"UNAVAILABLE");
 assert.deepEqual(canonicalGemIds([{...row,snapshot:parseHypothesisSnapshot(snapshot,row,now)}]),[]);
 assert.equal(parsed.gems[0].canonicalReceipt,undefined);
});
test("canonical readback is bounded, read-only and after the owner gate",()=>{
 const source=readFileSync(new URL("../lib/bluebelly-hypothesis-registry-server.ts",import.meta.url),"utf8");
 assert.ok(source.indexOf("if(accessError||!access)")<source.indexOf('.from("intelligence_evidence")'));
 assert.match(source,/\.in\("id",ids\)\.limit\(32\)/);
 assert.doesNotMatch(source,/\.(insert|upsert|update|delete)\(/);
});

test("private receipt trace checks exact Dossier references and canonical aliases without inferring agreement",()=>{
 const id="aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",alias="market-crack:fixture",did="bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";
 const g={...snapshot.gems[0],id,state:"ATTRIBUTED",canonicalReceipt:{dossierReference:{status:"ANALYTICAL_REFERENCE"}}};
 const parsed=parseHypothesisSnapshot({...snapshot,gems:[g]},row,now)!;
 assert.equal(parsed.gems[0].canonicalReceipt,undefined);
 const rows=[{...row,snapshot:parsed}];
 const receipt={id,external_evidence_id:alias,provenance_urls:[g.sourceUrl],event_at:"2026-11-25T12:00:00Z",received_at:"2026-11-25T13:00:00Z"};
 const make=(analytical_output:unknown,items:unknown[]=[],as_of="2026-11-25T14:00:00Z")=>({id:did,as_of,payload:{analytical_output,evidence_governance:{items}}});
 const check=(dossier:unknown,receipts:unknown[]=[receipt])=>projectCanonicalGemReceipts(rows,receipts,now,dossier)[0].snapshot!.gems[0];
 assert.equal(check(make({main_thread:{evidence_references:[alias]}})).canonicalReceipt?.dossierReference?.status,"ANALYTICAL_REFERENCE");
 assert.equal(check(make({investigations:[{candidate_explanations:[{evidence_against_ids:[id]}]}]})).canonicalReceipt?.dossierReference?.status,"ANALYTICAL_REFERENCE");
 assert.equal(check(make({main_thread:{answer:alias,evidence_references:[alias+"-suffix"]}},[{evidenceId:alias}])).canonicalReceipt?.dossierReference?.status,"GOVERNANCE_ONLY");
 assert.equal(check(make({main_thread:{answer:alias,evidence_references:[alias+"-suffix"]}})).canonicalReceipt?.dossierReference?.status,"NOT_REFERENCED");
 assert.equal(check(make({main_thread:{evidence_references:["ev:"+id]}})).canonicalReceipt?.dossierReference?.status,"ANALYTICAL_REFERENCE");
 assert.equal(check(make({main_thread:{evidence_references:[alias]}},[],"2026-11-25T12:30:00Z")).canonicalReceipt?.dossierReference?.status,"BEFORE_RECEIPT");
 assert.equal(check(make({main_thread:{evidence_references:[alias]}},[],"2026-11-27T00:00:00Z")).canonicalReceipt?.dossierReference?.status,"UNAVAILABLE");
 assert.equal(check(null).canonicalReceipt?.dossierReference?.status,"UNAVAILABLE");
 assert.equal(check(make({main_thread:{evidence_references:[alias]}}),[{...receipt,provenance_urls:["https://example.com/other"]}]).canonicalReceipt?.dossierReference,undefined);
 assert.equal(check(make({main_thread:{evidence_references:[alias]}})).state,"ATTRIBUTED");
});
test("latest Dossier trace is bounded behind owner authorisation",()=>{
 const source=readFileSync(new URL("../lib/bluebelly-hypothesis-registry-server.ts",import.meta.url),"utf8");
 assert.ok(source.indexOf("if(accessError||!access)")<source.indexOf('.from("market_dossiers_v2")'));
 assert.match(source,/\.lte\("as_of",now\.toISOString\(\)\)\.order\("as_of",\{ascending:false\}\)\.limit\(1\)\.maybeSingle\(\)/);
});

test("MYT date-only review is valid before UTC midnight but a future timestamp is not",()=>{
 const clock=new Date("2026-11-26T20:40:16Z");
 assert.ok(parseHypothesisSnapshot({...snapshot,reviewedOn:"2026-11-27"},row,clock));
 assert.equal(parseHypothesisSnapshot({...snapshot,reviewedOn:"2026-11-28"},row,clock),null);
 assert.equal(parseHypothesisSnapshot({...snapshot,reviewedOn:"2026-11-27T00:00:00Z"},row,clock),null);
});
test("Notion rich-text fragment whitespace is preserved in exact assessment and JSON",()=>{
 const r={...record,properties:{...record.properties,"Current Read":{rich_text:[{plain_text:"Mixed "},{plain_text:"evidence"}]}}};
 const current=projectRegistryRows({results:[r]},now)[0];
 assert.equal(current.currentRead,"Mixed evidence");
 const raw=JSON.stringify({...snapshot,currentRead:"Mixed evidence"});
 const cut=raw.indexOf("Mixed evidence")+6;
 const block={type:"code",code:{language:"json",rich_text:[{plain_text:raw.slice(0,cut)},{plain_text:raw.slice(cut)}]}};
 assert.ok(readFirstSnapshot({results:[block]},current,now));
});
