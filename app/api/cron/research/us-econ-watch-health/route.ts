import {getUsEconStatWatch} from "@/lib/bluebelly-us-econ-stat-watch-server";
import {buildUsEconWatchHealthReceipt} from "@/lib/bluebelly-us-econ-watch-health";
import {acceptsResearchAuthorization} from "@/lib/research-auth";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=120;

/** Independent source-health check after the already-scheduled US actual passes.
 * Monitoring only; never dispatches a second collector or writes evidence.
 */
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret||!acceptsResearchAuthorization(request.headers.get("authorization"),[secret]))
  return Response.json({error:"unauthorized"},{status:401,headers:{"Cache-Control":"no-store"}});
 if(process.env.NEXT_PUBLIC_RESEARCH_SCHEDULE_ENABLED!=="true")
  return Response.json({status:"disabled"},{status:503,headers:{"Cache-Control":"no-store"}});
 try{
  const now=new Date();
  const watch=await getUsEconStatWatch(now);
  const receipt=buildUsEconWatchHealthReceipt(watch,now);
  // One durable record per invocation. This is operational telemetry, never
  // publication, canonical Regime evidence or a trade recommendation.
  const day=now.toISOString().slice(0,10);
  const db=createSupabaseAdminClient();
  const {error:writeError}=await db.from("us_econ_watch_health_runs").insert({
   run_kind:"DAILY_CHECK",
   scheduled_for:day+"T15:40:00.000Z",checked_at:receipt.checkedAt,
   state:receipt.state,source_status:receipt.sourceStatus,
   consensus_provider:receipt.provider,
   verified_recent:receipt.verifiedRecent,pending_recent:receipt.pendingRecent,
   last_metric_retrieved_at:receipt.lastMetricRetrievedAt,
   warning_codes:receipt.warningCodes,critical_count:receipt.criticalCount,
  });
  if(writeError)throw new Error("US_ECON_WATCH_HEALTH_RECEIPT_WRITE_FAILED");
  const logger=receipt.state==="HEALTHY"?console.info:console.warn;
  logger(JSON.stringify(receipt));
  return Response.json({...receipt,persisted:true},{
   status:receipt.state==="CRITICAL"?503:200,
   headers:{"Cache-Control":"no-store"},
  });
 }catch(error){
  console.error("us_econ_watch_health_unavailable",error instanceof Error?error.message:"unavailable");
  return Response.json({state:"CRITICAL",error:"source_health_check_unavailable"},
   {status:503,headers:{"Cache-Control":"no-store"}});
 }
}
