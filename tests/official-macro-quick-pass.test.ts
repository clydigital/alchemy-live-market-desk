import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {officialActualQuickPass} from "../lib/macro/official-actual-quick-pass.ts";
import type {OfficialActualIngestionResult} from "../lib/macro/official-actuals.ts";

const clock=new Date("2026-11-03T15:12:00.000Z");
const uri="https://bluebelly-desk.vercel.app/api/cron/research/official-actuals";
const request=(token?:string)=>new Request(uri,token?{headers:{authorization:"Bearer "+token}}:undefined);
const outcome=(patch:Partial<OfficialActualIngestionResult>={}):OfficialActualIngestionResult=>({
 attempted:1,completed:1,failed:0,skipped:0,
 completedReleaseIds:["us-bea-2026-10-29-personal-income-outlays-sep-2026"],
 failedReleaseIds:[],note:"Existing collector returned verified original",...patch,
});
test("cron endpoint is not accessible to anonymous or wrong-key public requests",async()=>{
 let runs=0;
 const ingest=(async()=>{runs++;return outcome()}) as typeof import("../lib/macro/official-actuals.ts").ingestOfficialMacroActuals;
 for(const req of [request(),request("bad-token")]){
  const response=await officialActualQuickPass(req,{
   now:()=>clock,cronSecret:"test-cron-secret",scheduleEnabled:true,ingest,
  });
  assert.equal(response.status,401);
  assert.deepEqual(await response.json(),{error:"unauthorized"});
 }
 assert.equal(runs,0,"no calendar, network or database operation before authorization");
});
test("disabled research schedule cannot trigger an ingest retry",async()=>{
 let runs=0;
 const response=await officialActualQuickPass(request("test-cron-secret"),{
  now:()=>clock,cronSecret:"test-cron-secret",scheduleEnabled:false,
  ingest:(async()=>{runs++;return outcome()}) as typeof import("../lib/macro/official-actuals.ts").ingestOfficialMacroActuals,
 });
 assert.equal(response.status,503);
 assert.equal(runs,0);
});
test("authorised quick pass reuses the same first-party collector and emits exact audit IDs",async()=>{
 let calls=0,logs:string[]=[];
 const response=await officialActualQuickPass(request("test-cron-secret"),{
  now:()=>clock,cronSecret:"test-cron-secret",scheduleEnabled:true,
  ingest:(async(options={})=>{
   calls++;assert.equal(options.now?.toISOString(),clock.toISOString());
   return outcome();
  }) as typeof import("../lib/macro/official-actuals.ts").ingestOfficialMacroActuals,
  logger:entry=>logs.push(entry),
 });
 assert.equal(response.status,200);
 const data=await response.json();
 assert.equal(data.kind,"official_macro_actual_quick_pass");
 assert.equal(data.status,"completed");
 assert.equal(data.checkedAt,clock.toISOString());
 assert.deepEqual(data.completedReleaseIds,outcome().completedReleaseIds);
 assert.ok(!JSON.stringify(data).includes("0.5% m/m"),"no source data leak or frontend interpretation");
 assert.equal(calls,1);
 assert.equal(logs.length,1);
});
test("failed first-party actual remains retryable, never a successful ingestion receipt",async()=>{
 const response=await officialActualQuickPass(request("test-cron-secret"),{
  now:()=>clock,cronSecret:"test-cron-secret",scheduleEnabled:true,
  ingest:(async()=>outcome({
   attempted:1,completed:0,failed:1,completedReleaseIds:[],
   failedReleaseIds:["us-bea-2026-10-29-personal-income-outlays-sep-2026"],
  })) as typeof import("../lib/macro/official-actuals.ts").ingestOfficialMacroActuals,
  logger:()=>{},
 });
 assert.equal(response.status,502);
 const body=await response.json();
 assert.equal(body.status,"partial");
 assert.equal(body.failed,1);
});
test("upstream failures return a non-success status, sanitized diagnostic and no report",async()=>{
 const output:string[]=[];
 const response=await officialActualQuickPass(request("test-cron-secret"),{
  now:()=>clock,cronSecret:"test-cron-secret",scheduleEnabled:true,
  ingest:(async()=>{throw new Error("private secret must not appear")}) as typeof import("../lib/macro/official-actuals.ts").ingestOfficialMacroActuals,
  logger:x=>output.push(x),
 });
 assert.equal(response.status,503);
 assert.equal((await response.json()).status,"collector_unavailable");
 assert.ok(!output.join("").includes("private secret"));
});
test("three existing Vercel first-party US macro windows, no new ChatGPT automation",()=>{
 const vercel=JSON.parse(readFileSync(new URL("../vercel.json",import.meta.url),"utf8"));
 const path="/api/cron/research/official-actuals";
 assert.deepEqual(vercel.crons.filter((row:{path:string;schedule:string})=>row.path===path).map((r:{path:string;schedule:string})=>r.schedule),[
  "42 12 * * *", // 08:42 ET summer: 08:30 release plus ~12m source lag
  "12 14 * * *", // 10:12 ET summer / 09:12 ET winter
  "12 15 * * *", // 10:12 ET winter
 ]);
 assert.ok(vercel.crons.some((x:{path:string;schedule:string})=>x.path==="/api/cron/research/evening"&&x.schedule==="30 13 * * *"),
 "Existing winter 08:30 ET official-macro collector run is retained");
 const handler=readFileSync(new URL("../app/api/cron/research/official-actuals/route.ts",import.meta.url),"utf8");
 assert.match(handler,/officialActualQuickPass\(request\)/);
 assert.match(handler,/maxDuration=120/);
 const core=readFileSync(new URL("../lib/macro/official-actual-quick-pass.ts",import.meta.url),"utf8");
 assert.match(core,/ingestOfficialMacroActuals/);
 assert.match(core,/acceptsResearchAuthorization/);
 assert.doesNotMatch(core,/publishResearchUpdate|createSupabaseAdminClient|openai|process\.env\.SUPABASE_SERVICE/);
});
