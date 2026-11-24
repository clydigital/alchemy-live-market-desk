import "server-only";
type EmbeddingLane = "evidence"|"creator"|"thesis"|"motion";
type BatchResult = {requested:number;embedded:number;failed:number;model:string};
const LANES:EmbeddingLane[][]=[["evidence"],["creator"],["thesis"],["motion"]];
/** Derived search cache only. Never mutates canonical evidence or gates a research run. */
export async function refreshResearchEmbeddings(now=new Date()){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/,"");
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return {status:"unavailable",reason:"server_configuration_missing",embedded:0};
 const start=now.getUTCHours()%LANES.length;
 const deadline=Date.now()+42000;
 let embedded=0,failed=0,requested=0,batches=0;
 for(let i=0;i<2;i++){
  const remaining=deadline-Date.now();
  if(remaining<3000)break;
  try{
   const response=await fetch(url+"/functions/v1/bb-research-retrieval",{
    method:"POST",cache:"no-store",headers:{"Content-Type":"application/json",Authorization:"Bearer "+key,apikey:key},
    body:JSON.stringify({action:"backfill",batch_size:8,lanes:LANES[(start+i)%LANES.length]}),
    signal:AbortSignal.timeout(Math.min(20000,remaining))
   });
   if(!response.ok){failed++;break;}
   const data=await response.json() as Partial<BatchResult>;
   if(data.model!=="gte-small-v1"||!Number.isInteger(data.requested)||!Number.isInteger(data.embedded)||!Number.isInteger(data.failed)||data.requested!<0||data.requested!>8||data.embedded!<0||data.failed!<0||data.embedded!+data.failed!>data.requested!){failed++;break;}
   requested+=data.requested!;embedded+=data.embedded!;failed+=data.failed!;batches++;
  }catch{failed++;break;}
 }
 return {status:failed?(embedded?"partial":"unavailable"):batches?"checked":"not_attempted",embedded,requested,failed,batches};
}
/** Join the existing cron at its authenticated boundary; no new schedule. */
export async function withResearchEmbeddingRefresh<T>(research:Promise<T>,now:Date):Promise<T>{
 const refresh=refreshResearchEmbeddings(now).catch(()=>({status:"unavailable",embedded:0}));
 try{return await research;}finally{
  const result=await refresh;
  console.info(JSON.stringify({event:"bluebelly_research_embedding_refresh",asOf:now.toISOString(),...result}));
 }
}
