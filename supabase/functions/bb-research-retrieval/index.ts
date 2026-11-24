import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const MODEL="gte-small-v1";
const LANES=["evidence","creator","intake","motion","thesis","x_wire"];
const base=Deno.env.get("SUPABASE_URL")??"";
const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
async function rest(path:string,body:unknown,prefer?:string){
 const headers:Record<string,string>={"apikey":key,"Authorization":"Bearer "+key,"Content-Type":"application/json"};
 if(prefer)headers.Prefer=prefer;
 const r=await fetch(base+"/rest/v1/"+path,{method:"POST",headers,body:JSON.stringify(body)});
 if(!r.ok)throw new Error("database_request_failed_"+r.status);
 const bodyText=await r.text(); return bodyText?JSON.parse(bodyText):null;
}
let session:Supabase.ai.Session|undefined;
async function embed(text:string){
 session??=new Supabase.ai.Session("gte-small");
 const result=await session.run(text,{mean_pool:true,normalize:true});
 const v=Array.from(result as ArrayLike<number>);
 if(v.length!==384||v.some(x=>!Number.isFinite(x))||!v.some(x=>x!==0))throw new Error("invalid_embedding");
 return v;
}
Deno.serve(async req=>{
 if(!base||!key)return reply({error:"server_configuration_unavailable"},503);
 // Existing service-role credentials only; no owner data in unauthenticated routes.
 const serviceAuthorized=req.headers.get("authorization")==="Bearer "+key;
 if(req.method!=="POST")return reply({error:"method_not_allowed"},405);
 try {
  const b=await req.json();
  if(!b||typeof b!=="object"||Array.isArray(b))return reply({error:"invalid_body"},400);
  if(!serviceAuthorized)return reply({error:"forbidden"},403);
  const lanes=b.lanes??null;
  if(lanes!==null&&(!Array.isArray(lanes)||!lanes.length||lanes.length>6||lanes.some((x:unknown)=>typeof x!=="string"||!LANES.includes(x))))return reply({error:"invalid_lanes"},400);
  if(b.action==="search"){
   if(typeof b.query!=="string"||!b.query.trim()||b.query.length>500)return reply({error:"invalid_query"},400);
   const limit=b.limit??20;
   if(!Number.isInteger(limit)||limit<1||limit>50)return reply({error:"invalid_limit"},400);
   const asOf=b.as_of??new Date().toISOString(),since=b.since_at??null;
   if(typeof asOf!=="string"||!Number.isFinite(Date.parse(asOf))||Date.parse(asOf)>Date.now()+60000||since!==null&&(typeof since!=="string"||!Number.isFinite(Date.parse(since))||Date.parse(since)>Date.parse(asOf)))return reply({error:"invalid_dates"},400);
   let vector:number[]|null=null,embedding_error:string|null=null;
   try{vector=await embed(b.query);}catch{embedding_error="query_embedding_unavailable";}
   const rows=await rest("rpc/bb_research_search",{query_text:b.query,lanes,since_at:since,as_of:asOf,match_count:limit,query_embedding:vector});
   return reply({mode:vector&&rows.some((r:{semantic_rank:number|null})=>r.semantic_rank!==null)?"hybrid":"keyword_only",embedding_error,as_of:asOf,rows});
  }
  if(b.action==="backfill"){
   const batch=b.batch_size??5;
   if(!Number.isInteger(batch)||batch<1||batch>10)return reply({error:"invalid_batch"},400);
   const queue=await rest("rpc/bb_research_embedding_queue",{batch_size:batch,lanes:lanes??["evidence","creator","thesis","motion"]});
   const ready=[];let failures=0;
   for(const row of queue){
    try{ready.push({lane:row.lane,record_id:row.record_id,content_hash:row.content_hash,model:MODEL,embedding:await embed(row.embedding_text),embedded_at:new Date().toISOString()});}
    catch{failures++;}
   }
   if(ready.length)await rest("bb_research_vector_cache?on_conflict=lane,record_id,model",ready,"resolution=merge-duplicates,return=minimal");
   return reply({requested:queue.length,embedded:ready.length,failed:failures,model:MODEL});
  }
  return reply({error:"invalid_action"},400);
 }catch{return reply({error:"retrieval_unavailable"},503);}
});