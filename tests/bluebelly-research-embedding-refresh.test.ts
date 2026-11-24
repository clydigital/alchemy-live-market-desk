import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";

// Exercise the real server-only source with a mocked fetch and no real secrets.
test("embedding refresh keeps research independent and bounded", async (t) => {
 const source=readFileSync(new URL("../lib/bluebelly-research-embedding-refresh.ts",import.meta.url),"utf8").replace(/^import "server-only";\r?\n/,"");
 const {refreshResearchEmbeddings,withResearchEmbeddingRefresh}=await import("data:text/javascript;base64,"+Buffer.from(stripTypeScriptTypes(source)).toString("base64"));
 const keys=["NEXT_PUBLIC_SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","NEXT_PUBLIC_RESEARCH_SCHEDULE_ENABLED"] as const;
 const saved=keys.map(key=>[key,process.env[key]] as const);
 const oldFetch=globalThis.fetch;
 t.after(()=>{globalThis.fetch=oldFetch;for(const [key,value] of saved){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
 process.env.NEXT_PUBLIC_SUPABASE_URL="https://example.invalid";
 process.env.SUPABASE_SERVICE_ROLE_KEY="mock-only";
 process.env.NEXT_PUBLIC_RESEARCH_SCHEDULE_ENABLED="true";
 const ok=()=>Response.json({model:"gte-small-v1",requested:8,embedded:8,failed:0});
 const morning=new Date("2026-11-24T02:20:00Z");
 await t.test("four lane allocation and bounds",async()=>{
  const calls:Array<{lanes:string[];batch_size:number}>=[];
  globalThis.fetch=async(_url,options)=>{calls.push(JSON.parse(String(options?.body)));return ok();};
  assert.equal((await refreshResearchEmbeddings(morning)).embedded,16);
  assert.equal((await refreshResearchEmbeddings(new Date("2026-11-24T15:00:00Z"))).embedded,16);
  assert.deepEqual(calls.map(c=>c.lanes[0]),["evidence","creator","motion","thesis"]);
  assert.ok(calls.every(c=>c.batch_size===8));
 });
 await t.test("disabled schedule avoids network",async()=>{
  process.env.NEXT_PUBLIC_RESEARCH_SCHEDULE_ENABLED="false";
  globalThis.fetch=()=>{throw Error("unexpected");};
  assert.equal((await refreshResearchEmbeddings(morning)).status,"disabled");
  process.env.NEXT_PUBLIC_RESEARCH_SCHEDULE_ENABLED="true";
 });
 await t.test("missing config fails closed",async()=>{
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert.equal((await refreshResearchEmbeddings(morning)).status,"unavailable");
  process.env.SUPABASE_SERVICE_ROLE_KEY="mock-only";
 });
 await t.test("invalid accounting is rejected",async()=>{
  globalThis.fetch=async()=>Response.json({model:"gte-small-v1",requested:8,embedded:1,failed:0});
  assert.equal((await refreshResearchEmbeddings(morning)).status,"unavailable");
 });
 await t.test("worker failure preserves primary result",async()=>{
  globalThis.fetch=async()=>{throw Error("unavailable");};
  const response={ok:true};
  assert.equal(await withResearchEmbeddingRefresh(Promise.resolve(response),morning),response);
 });
 await t.test("primary error preserved",async()=>{
  globalThis.fetch=async()=>ok();
  await assert.rejects(withResearchEmbeddingRefresh(Promise.reject(Error("primary failed")),morning),/primary failed/);
 });
});