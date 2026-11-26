import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {projectMacroLog,projectGapRun,projectAiMatrix,augmentCreatorLane} from "../lib/my-desk-work-receipt-core.ts";
import {lane} from "../lib/my-desk-health-core.ts";
import type {CreatorDigest} from "../lib/bluebelly-creator-signals.ts";
const now=new Date("2026-11-26T05:30:00Z");
const rich=(s:string)=>({rich_text:[{plain_text:s}]});
const title=(s:string)=>({title:[{plain_text:s}]});
const select=(name:string)=>({select:{name}});
const date=(start:string)=>({date:{start}});
const receipt=(properties:object)=>({created_time:"2026-11-26T04:52:00Z",properties});
const log=(id:string,slot:string,status:string,post:string|null)=>receipt({"Pulse ID":rich(id),"MYT Slot":rich(slot),"Date Key":rich("2026-11-26"),Status:select(status),"Post URL":{url:post},"Source Count":{number:2},"Published At":date("2026-11-26T04:50:00Z")});
test("MacroPulse uses scheduled Log, not manual runs; a link is not consumer verification",()=>{
 const r=projectMacroLog({results:[log("MP-20261126-MANUAL-1300","13:00","PUBLISHED","https://example.com"),log("MP-20261126-1000","10:00","PUBLISHED","https://example.com"),log("MP-20261126-1200","12:00","UNPUBLISHED",null)]},now);
 assert.equal(r.state,"degraded");assert.match(r.execution,/UNPUBLISHED/);assert.equal(r.attempt,null);assert.match(r.gaps,/unsaved slots/);
 assert.equal(projectMacroLog({results:[log("MP-20261126-1000","10:00","PUBLISHED","https://example.com")]},now).state,"unknown");
 assert.equal(projectMacroLog({results:[]},now).state,"unknown");
});
const run=(name:string,session:string,status:string,coverage:string)=>receipt({Run:title(name),Session:select(session),Status:select(status),Coverage:select(coverage),"Input Health":select("PARTIAL"),"Research Quality":select("DEGRADED"),"Run At":date("2026-11-26T04:47:00Z")});
test("Material Events and investigation receipt identities remain separate, with manual recovery labelled",()=>{
 const raw={results:[run("2026-11-26 AM — actual investigation","AM","PARTIAL","PARTIAL"),run("ME-20261126-1221","MANUAL","PARTIAL","PARTIAL")]};
 const me=projectGapRun(raw,"Material Events",now),ri=projectGapRun(raw,"Research Investigation",now);
 assert.match(me.execution,/MANUAL/);assert.match(me.gaps,/scheduled execution not established/);
 assert.match(ri.execution,/AM/);assert.equal(ri.state,"degraded");assert.equal(ri.attempt,"2026-11-26T04:47:00Z");
 assert.equal(projectGapRun({results:[run("ME-20261126-1015","AM","FAILED","MATERIAL GAP")]},"Material Events",now).state,"failed");
});
const block=(type:string,text:string)=>({type,[type]:{rich_text:[{plain_text:text}]}});
test("AI matrix counts are independent; no stale, malformed or future marker becomes healthy",()=>{
 const body=block("paragraph","row_count=16; ORIGINAL_SOURCE_CHECKS_COMPLETED=0/16");
 const r=projectAiMatrix({results:[block("heading_2","AI16 DAILY MATRIX 2026-11-26 0803 MYT V1"),body]},now);
 assert.equal(r.state,"degraded");assert.equal(r.success,"2026-11-26T08:03:00+08:00");assert.match(r.coverage,/16\/16 rows.*0\/16 original/);
 assert.equal(projectAiMatrix({results:[block("heading_2","AI16 DAILY MATRIX 2026-11-27 0803 MYT V1"),body]},now).state,"unknown");
 assert.equal(projectAiMatrix({results:[block("heading_2","unrelated"),body]},now).state,"unknown");
});
test("digest handoff is not canonical transcript or fallback proof",()=>{
 const base=lane("Creator discovery / transcripts",{coverage:"0/1 canonical",success:null});
 const digest={generatedAt:"2026-11-26T05:15:00Z",coverage:"PARTIAL; ScrapeCreators last verified balance 40",creators:[{sourceStatus:"handoff_reviewed",changed:"RECOVERED — private caption receipt"}]} as unknown as CreatorDigest;
 const r=augmentCreatorLane(base,digest,now);
 assert.equal(r.state,"degraded");assert.equal(r.success,null);assert.match(r.budget,/40/);assert.match(r.gaps,/canonical intake/);assert.equal(r.backupRecovered,false);assert.match(r.backup,/1 private recovery reported/);
});
test("Work receipt reader remains owner guarded, bounded and read only",()=>{
 const server=readFileSync(new URL("../lib/my-desk-work-receipt-server.ts",import.meta.url),"utf8");
 assert.match(server,/auth\.getUser\(\)/);assert.match(server,/app_access_allowlist/);
 assert.match(server,/page_size:24/);assert.match(server,/page_size=2/);
 assert.doesNotMatch(server,/\.insert\(|\.update\(|\.upsert\(|cron\.schedule/);
});
