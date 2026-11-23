import {getUsEconStatWatch} from "@/lib/bluebelly-us-econ-stat-watch-server";
import {buildUsEconWatchHealthReceipt} from "@/lib/bluebelly-us-econ-watch-health";
import {acceptsResearchAuthorization} from "@/lib/research-auth";

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
  const logger=receipt.state==="HEALTHY"?console.info:console.warn;
  logger(JSON.stringify(receipt));
  return Response.json(receipt,{
   status:receipt.state==="CRITICAL"?503:200,
   headers:{"Cache-Control":"no-store"},
  });
 }catch{
  console.error("us_econ_watch_health_unavailable");
  return Response.json({state:"CRITICAL",error:"source_health_check_unavailable"},
   {status:503,headers:{"Cache-Control":"no-store"}});
 }
}
