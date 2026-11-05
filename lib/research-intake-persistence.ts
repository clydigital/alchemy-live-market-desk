/**
 * Bounded, replay-safe persistence for the EXISTING research intake ledger.
 *
 * A single 50-250 item PostgREST POST previously failed with PGRST102,
 * dropping every acquired source from that run. Persist original-source
 * receipts first, then small batches; a partial failure is still a failed
 * run, never a success. The unique item_key remains the database authority.
 */
export type IntakePersistRow={item_key:string;run_id:string;[field:string]:unknown};
export type IntakeRest=<T>(path:string,init?:RequestInit)=>Promise<T>;
const BATCH_ROWS=12;
const BATCH_BYTES=100_000;
// Dedicated video handoffs can carry a source transcript larger than one
// ordinary news batch. Isolate such a row; never silently lose it.
const MAX_SINGLE_ROW_BYTES=2_000_000;
const MAX_ROWS=250;
export const RESEARCH_INTAKE_BATCH_LIMITS={rows:BATCH_ROWS,bytes:BATCH_BYTES} as const;

function sourceFirst(item:IntakePersistRow){
 return item.item_key.startsWith("official-press:")||
   item.item_key.startsWith("issuer-results:")||
   item.item_key.startsWith("material-sec-")?0:1;
}
function chunkRows(rows:readonly IntakePersistRow[]):IntakePersistRow[][]{
 const chunks:IntakePersistRow[][]=[];
 let batch:IntakePersistRow[]=[];
 for(const row of rows){
  const projected=[...batch,row];
  if(batch.length && (projected.length>BATCH_ROWS||
     Buffer.byteLength(JSON.stringify(projected),"utf8")>BATCH_BYTES)){
    chunks.push(batch);batch=[row];
  }else batch=projected;
  if(Buffer.byteLength(JSON.stringify([row]),"utf8")>MAX_SINGLE_ROW_BYTES)
    throw new Error("Single research intake item exceeds publisher payload safety limit");
 }
 if(batch.length)chunks.push(batch);
 return chunks;
}
function isMalformedJsonReply(error:unknown){
 return error instanceof Error &&
   /Database request failed \(400\)/.test(error.message) &&
   /PGRST102|Empty or invalid json/i.test(error.message);
}
async function commitBatch(rows:readonly IntakePersistRow[],rest:IntakeRest):Promise<void>{
 try{
  await rest("research_intake_items?on_conflict=item_key",{
   method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},
   body:JSON.stringify(rows),
  });
 }catch(error){
  // One bounded binary split only for the observed body-validation failure.
  // No blind unbounded retries; a bad single record must fail visibly.
  if(!isMalformedJsonReply(error)||rows.length<=1)throw error;
  const mid=Math.ceil(rows.length/2);
  await commitBatch(rows.slice(0,mid),rest);
  await commitBatch(rows.slice(mid),rest);
 }
}
export async function persistResearchIntakeBatches(input:{
 rows:readonly IntakePersistRow[];runId:string;rest:IntakeRest;
}):Promise<{persisted:number;batchCount:number}>{
 const {rows,runId,rest}=input;
 if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(runId))
   throw new Error("Invalid research run identity");
 if(rows.length>MAX_ROWS)throw new Error("Research intake exceeds canonical run limit");
 if(!rows.length)return {persisted:0,batchCount:0};
 const keys=new Set<string>();
 for(const row of rows){
  if(row.run_id!==runId||!row.item_key||row.item_key.length>200||
    keys.has(row.item_key))throw new Error("Invalid or repeated research intake identity");
  keys.add(row.item_key);
 }
 const ordered=[...rows].sort((a,b)=>sourceFirst(a)-sourceFirst(b));
 const batches=chunkRows(ordered);
 for(const batch of batches)await commitBatch(batch,rest);
 // A 2xx from PostgREST is not enough: prove every intake identity belongs
 // to the claimed run before opening the canonical Motion admission path.
 const stored=await rest<Array<{item_key:string}>>(
  "research_intake_items?run_id=eq."+encodeURIComponent(runId)+
  "&select=item_key&limit="+MAX_ROWS,
 );
 const saved=new Set(Array.isArray(stored)?stored.map(row=>row.item_key):[]);
 const missing=[...keys].filter(key=>!saved.has(key));
 if(missing.length)
  throw new Error("Research intake readback missing "+missing.length+
   " of "+rows.length+" item keys; canonical admission withheld");
 return {persisted:rows.length,batchCount:batches.length};
}
