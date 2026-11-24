import "server-only";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {BREADTH_HISTORY_URL,parseBreadthDailyDataset,REVIEWED_BREADTH_SEED,REVIEWED_BREADTH_PROXY_SNAPSHOT,parsePublishedSp500Breadth,parseCurrentBreadthTable,parseBreadthHistoricalTable,sourceDateFresh,type BreadthSeries} from "./bluebelly-breadth-dated";
const SOURCE_URL="https://www.thetrading.tools/stocks-above-moving-average";
const HISTORICAL=[
 ["S5FI","https://www.investing.com/indices/s-p-500-stocks-above-50-day-average-historical-data"],
 ["S5TH","https://www.investing.com/indices/sp-500-stocks-above-200-day-average-historical-data"],
] as const;
async function read(url:string){
 try{
  const response=await fetch(url,{headers:{accept:"text/html","user-agent":"Bluebelly-Market-Research/1.0"},next:{revalidate:7200},signal:AbortSignal.timeout(7500)});
  return response.ok?await response.text():"";
 }catch{return "";}
}
async function authorizedResearchHistory():Promise<boolean>{
 try{
  const session=await createSupabaseServerClient();
  const {data:{user},error}=await session.auth.getUser();
  if(error||!user?.email)return false;
  const {data:access,error:denied}=await session.from("app_access_allowlist").select("email").eq("email",user.email.toLowerCase().trim()).eq("active",true).maybeSingle();
  return !denied&&Boolean(access);
 }catch{return false;}
}
async function readResearchHistory(now:Date){
 try{
  const r=await fetch(BREADTH_HISTORY_URL,{headers:{accept:"application/json"},next:{revalidate:7200},signal:AbortSignal.timeout(10000)});
  if(!r.ok)return [];
  const body=await r.text();
  if(body.length>10000000)return [];
  return parseBreadthDailyDataset(JSON.parse(body),now);
 }catch{return [];}
}
export async function getSourceDatedBreadth(includeResearchHistory=false):Promise<{series:BreadthSeries[];retrievalStatus:"refreshed"|"fallback"|"mixed";researchHistory?:boolean}>{
 const now=new Date();
 const researchAllowed=includeResearchHistory&&await authorizedResearchHistory();
 const [research,html,...history]=await Promise.all([researchAllowed?readResearchHistory(now):Promise.resolve([]),read(SOURCE_URL),...HISTORICAL.map(([,url])=>read(url))]);
 const freshProxy=parseCurrentBreadthTable(html,now)??parsePublishedSp500Breadth(html,now);
 const freshHistory=HISTORICAL.map(([symbol,url],i)=>parseBreadthHistoricalTable(history[i],symbol,url,now)).filter((s):s is BreadthSeries=>s!==null);
 const seeds=REVIEWED_BREADTH_PROXY_SNAPSHOT.filter(s=>sourceDateFresh(s.points.at(-1)!.date,now));
 const merged=new Map<string,BreadthSeries>();
 for(const series of [...REVIEWED_BREADTH_SEED,...seeds,...(freshProxy??[]),...freshHistory,...research]){
  const previous=merged.get(series.symbol);
  if(!previous||series.points.at(-1)!.date>=previous.points.at(-1)!.date)merged.set(series.symbol,series);
 }
 if(research.length)return {series:[...merged.values()],retrievalStatus:"refreshed",researchHistory:true};
 if(freshProxy?.length||freshHistory.length)return {series:[...merged.values()],retrievalStatus:freshProxy?.length&&freshHistory.length===2?"refreshed":"mixed"};
 return {series:[...merged.values()],retrievalStatus:"fallback"};
}
