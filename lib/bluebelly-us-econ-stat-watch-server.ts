import "server-only";
import {createSupabaseAdminClient} from "./supabase/admin";
import {getEconomicCalendar} from "./calendar";
import {projectUsEconStatWatch,type EconInput,type EconMetricInput,type EconScheduleInput} from "./bluebelly-us-econ-stat-watch";

/**
 * Live reader, not a new collector. Canonical official actuals come from the
 * already-scheduled morning/evening research jobs plus official-actual quick passes.
 * A bad read fails closed. Official calendar discovery can only contribute dates,
 * not prefilled actuals, surprised forecasts or macro conclusions.
 */
export async function getUsEconStatWatch(now=new Date()){
 const from=new Date(now.getTime()-35*86400000).toISOString();
 const to=new Date(now.getTime()+21*86400000).toISOString();
 const calendarPromise=getEconomicCalendar(now)
  .then(events=>({events,available:true}))
  .catch(()=>({events:[] as Awaited<ReturnType<typeof getEconomicCalendar>>,available:false}));
 let releases:EconInput[]=[],metrics:EconMetricInput[]=[],sourceUnavailable=false;
 try{
  const db=createSupabaseAdminClient();
  const res=await db.from("macro_releases")
   .select("id,release_name,release_date,agency,reference_period,source_url,source_classification,actual,released_at,actual_retrieved_at,status,ingestion_attempt_status")
   .gte("release_date",from).lte("release_date",to)
   .order("release_date",{ascending:false}).limit(120);
  if(res.error){sourceUnavailable=true;}
  else{
   releases=(res.data??[]) as EconInput[];
   const ids=releases.map(x=>String(x.id)).filter(x=>x.startsWith("us-"));
   if(ids.length){
    const result=await db.from("macro_release_metrics")
     .select("release_id,metric_key,label,unit,actual,previous,revised_previous,consensus,consensus_source,consensus_captured_at,source_url,retrieved_at,metadata")
     .in("release_id",ids).limit(600);
    if(result.error)sourceUnavailable=true;
    else metrics=(result.data??[]) as EconMetricInput[];
   }
  }
 }catch{sourceUnavailable=true;}
 const calendar=await calendarPromise;
 const schedule:(EconScheduleInput[])=calendar.events
  .filter(event=>event.country==="United States"&&event.status==="Scheduled")
  .map(row=>({id:row.id,event:row.event,date:row.date,timeLabel:row.timeLabel,
   country:row.country,referencePeriod:row.referencePeriod,sourceName:row.sourceName,
   sourceUrl:row.sourceUrl,sourceKind:row.sourceKind}));
 return projectUsEconStatWatch({releases:sourceUnavailable?[]:releases,
  metrics:sourceUnavailable?[]:metrics,schedule,now,sourceUnavailable,
  calendarUnavailable:!calendar.available,
  consensusProviderConfigured:Boolean(process.env.TRADING_ECONOMICS_API_KEY?.trim())});
}
