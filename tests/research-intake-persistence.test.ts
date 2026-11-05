import assert from "node:assert/strict";
import test from "node:test";
import {
 persistResearchIntakeBatches,RESEARCH_INTAKE_BATCH_LIMITS,
 type IntakePersistRow,type IntakeRest,
} from "../lib/research-intake-persistence.ts";
const runId="96666666-2222-4444-8888-000000000001";
const row=(item_key:string,extra:Record<string,unknown>={}):IntakePersistRow=>
 ({item_key,run_id:runId,title:item_key,source_quality:95,...extra});

test("source-first bounded persistence avoids one giant PostgREST JSON write and verifies readback",async()=>{
 const received:string[]=[];
 const stored=new Map<string,IntakePersistRow>();
 const rest: IntakeRest=async <T>(path:string,init?:RequestInit):Promise<T>=>{
  if(init?.method==="POST"){
   const body=String(init.body),batch=JSON.parse(body) as IntakePersistRow[];
   assert.ok(batch.length<=RESEARCH_INTAKE_BATCH_LIMITS.rows);
   assert.ok(Buffer.byteLength(body,"utf8")<=RESEARCH_INTAKE_BATCH_LIMITS.bytes);
   for(const item of batch){received.push(item.item_key);stored.set(item.item_key,item);}
   return undefined as T;
  }
  assert.match(path,/research_intake_items\?run_id=eq\./);
  return [...stored.values()].map(item=>({item_key:item.item_key})) as T;
 };
 const input=[
  ...Array.from({length:35},(_,i)=>row("lead:"+i)),
  row("official-press:a4"),row("official-press:a5"),row("issuer-results:c6"),
 ];
 const result=await persistResearchIntakeBatches({rows:input,runId,rest});
 assert.equal(result.persisted,38);
 assert.ok(result.batchCount>=4);
 assert.deepEqual(received.slice(0,3),["official-press:a4","official-press:a5","issuer-results:c6"]);
 assert.equal(stored.size,38);
});
test("PGRST102 large-batch response triggers bounded split and exact readback",async()=>{
 const stored=new Map<string,IntakePersistRow>();
 let malformed=0;
 const rest:IntakeRest=async <T>(path:string,init?:RequestInit):Promise<T>=>{
  if(init?.method==="POST"){
   const batch=JSON.parse(String(init.body)) as IntakePersistRow[];
   if(batch.length>2){
    malformed++;
    throw new Error('Database request failed (400): {"code":"PGRST102","message":"Empty or invalid json"}');
   }
   batch.forEach(item=>stored.set(item.item_key,item));
   return undefined as T;
  }
  return [...stored.values()].map(x=>({item_key:x.item_key})) as T;
 };
 const rows=Array.from({length:9},(_,i)=>row("official-press:"+i));
 assert.equal((await persistResearchIntakeBatches({rows,runId,rest})).persisted,9);
 assert.ok(malformed>0);
 assert.equal(stored.size,9);
});
test("an unrelated failed batch must never be presented as a completed intake",async()=>{
 const stored=new Map<string,IntakePersistRow>();
 let attempts=0;
 const rest:IntakeRest=async <T>(path:string,init?:RequestInit):Promise<T>=>{
  if(init?.method==="POST"){
   attempts++;
   const batch=JSON.parse(String(init.body)) as IntakePersistRow[];
   if(attempts===2)throw new Error('Database request failed (503): upstream unavailable');
   batch.forEach(item=>stored.set(item.item_key,item));
  }
  return [] as T;
 };
 const rows=[row("official-press:priority"),
  ...Array.from({length:21},(_,i)=>row("lead:"+i))];
 await assert.rejects(persistResearchIntakeBatches({rows,runId,rest}),/503/);
 assert.ok(stored.has("official-press:priority"));
 assert.equal(attempts,2);
});
test("a fake 2xx without database receipts fails readback before canonical admission",async()=>{
 const rest:IntakeRest=async <T>()=>undefined as T;
 await assert.rejects(
  persistResearchIntakeBatches({rows:[row("official-press:abc")],runId,rest}),
  /readback missing 1 of 1 item keys/,
 );
});
test("duplicate IDs, wrong run owner and unbounded rows reject before any IO",async()=>{
 let called=0;
 const rest:IntakeRest=async <T>()=>{called++;return [] as T;};
 await assert.rejects(persistResearchIntakeBatches({
  rows:[row("lead:1"),row("lead:1")],runId,rest,
 }),/repeated/);
 await assert.rejects(persistResearchIntakeBatches({
  rows:[row("lead:1",{run_id:"96666666-2222-4444-8888-000000000002"})],
  runId,rest,
 }),/Invalid/);
 await assert.rejects(persistResearchIntakeBatches({
  rows:Array.from({length:251},(_,i)=>row("lead:"+i)),runId,rest,
 }),/limit/);
 assert.equal(called,0);
});

test("long existing video transcripts are isolated, not silently rejected by news batch target",async()=>{
 const payloadSizes:number[]=[];
 const stored=new Map<string,IntakePersistRow>();
 const rest:IntakeRest=async <T>(path:string,init?:RequestInit):Promise<T>=>{
  if(init?.method==="POST"){
   const body=String(init.body),batch=JSON.parse(body) as IntakePersistRow[];
   payloadSizes.push(Buffer.byteLength(body,"utf8"));
   batch.forEach(item=>stored.set(item.item_key,item));
   return undefined as T;
  }
  return [...stored.values()].map(x=>({item_key:x.item_key})) as T;
 };
 const items=[row("feed:before"),
   row("video:long",{item_type:"video",transcript_text:"A".repeat(225_000)}),
   row("feed:after")];
 const result=await persistResearchIntakeBatches({rows:items,runId,rest});
 assert.equal(result.persisted,3);
 assert.equal(stored.size,3);
 assert.deepEqual(payloadSizes.length,3);
 assert.ok(payloadSizes.some(size=>size>RESEARCH_INTAKE_BATCH_LIMITS.bytes));
 assert.ok(payloadSizes.every(size=>size<2_000_000));
});
