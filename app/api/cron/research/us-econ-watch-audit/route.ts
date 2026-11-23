import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {acceptsResearchAuthorization} from "@/lib/research-auth";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=60;
/**
 * Independent next-day audit of the 15:40 UTC ingestion-health receipt.
 * It cannot deliver email on its own. A missing run is durable and returns 503,
 * rather than vanishing when the transient deployment logs expire.
 */
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret||!acceptsResearchAuthorization(request.headers.get("authorization"),[secret]))
  return Response.json({error:"unauthorized"},{status:401,headers:{"Cache-Control":"no-store"}});
 if(process.env.NEXT_PUBLIC_RESEARCH_SCHEDULE_ENABLED!=="true")
  return Response.json({status:"disabled"},{status:503,headers:{"Cache-Control":"no-store"}});
 const now=new Date();
 const previousDay=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())-86400000);
 const scheduledFor=previousDay.toISOString().slice(0,10)+"T15:40:00.000Z";
 // Do not flag a missed run before this watchdog was originally deployed.
 if(Date.parse(scheduledFor)<Date.parse("2026-11-24T15:40:00Z"))
  return Response.json({status:"NOT_DUE",scheduledFor},{headers:{"Cache-Control":"no-store"}});
 try{
  const db=createSupabaseAdminClient();
  const {data,error}=await db.from("us_econ_watch_health_runs")
   .select("id,state,checked_at").eq("run_kind","DAILY_CHECK")
   .eq("scheduled_for",scheduledFor)
   .order("checked_at",{ascending:false}).limit(1);
  if(error)throw new Error("US_ECON_WATCH_AUDIT_READ_FAILED");
  if(data?.length){
   return Response.json({status:"RECEIPT_FOUND",scheduledFor,checkedAt:data[0].checked_at,
    state:data[0].state},{headers:{"Cache-Control":"no-store"}});
  }
  const {error:writeError}=await db.from("us_econ_watch_health_runs").insert({
   run_kind:"MISSED_RUN_AUDIT",scheduled_for:scheduledFor,checked_at:now.toISOString(),
   state:"MISSED",source_status:"SOURCE_UNAVAILABLE",consensus_provider:"UNKNOWN",
   warning_codes:["EXPECTED_DAILY_HEALTH_RUN_MISSING"],critical_count:1,
  });
  if(writeError&&writeError.code!=="23505")throw new Error("US_ECON_WATCH_AUDIT_WRITE_FAILED");
  console.error("US_ECON_WATCH_DAILY_RUN_MISSED",scheduledFor);
  return Response.json({status:"MISSED",scheduledFor,written:!writeError},{status:503,
   headers:{"Cache-Control":"no-store"}});
 }catch(error){
  console.error("us_econ_watch_missing_run_audit_unavailable",error instanceof Error?error.message:"unavailable");
  return Response.json({status:"SOURCE_UNAVAILABLE"},{status:503,headers:{"Cache-Control":"no-store"}});
 }
}
