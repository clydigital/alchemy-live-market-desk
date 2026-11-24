import "server-only";
import {unstable_cache} from "next/cache";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {expectedHomeEtfSession} from "./bluebelly-home-etf-history";
import {scheduledUsEquityCloseHourET} from "./bluebelly-us-equity-trading-calendar";
import {SECTOR_TICKERS,BENCHMARK_TICKERS,FX_TICKERS,parseMassiveDay,parseTwelveDaily,rankClose,type WidgetRow} from "./bluebelly-provider-widget-data";

async function ownerAllowed():Promise<boolean>{
 try{
  const session=await createSupabaseServerClient();
  const {data:{user},error}=await session.auth.getUser();
  if(error||!user?.id||!user.email)return false;
  const {data:access,error:accessError}=await session.from("app_access_allowlist").select("email")
   .eq("email",user.email.toLowerCase().trim()).eq("active",true).maybeSingle();
  return !accessError&&!!access;
 }catch{return false;}
}
async function readJson(url:URL,headers?:HeadersInit):Promise<unknown>{
 try{
  const response=await fetch(url,{headers,cache:"no-store",signal:AbortSignal.timeout(8000)});
  return response.ok?await response.json():null;
 }catch{return null;}
}
function priorUsSession(day:string):string|null{
 const date=new Date(day+"T12:00:00Z");
 for(let i=0;i<10;i++){
  date.setUTCDate(date.getUTCDate()-1);
  const prior=date.toISOString().slice(0,10);
  if(scheduledUsEquityCloseHourET(prior)!==null)return prior;
 }
 return null;
}
const readMassive=unstable_cache(async(day:string):Promise<WidgetRow[]>=>{
 const key=process.env.MASSIVE_API_KEY?.trim();if(!key)return [];
 const prior=priorUsSession(day);if(!prior)return [];
 const fetchDay=async(d:string)=>{
  const url=new URL("https://api.massive.com/v2/aggs/grouped/locale/us/market/stocks/"+d);
  url.searchParams.set("adjusted","true");url.searchParams.set("include_otc","false");
  return parseMassiveDay(await readJson(url,{Authorization:"Bearer "+key}),d);
 };
 const [latest,previous]=await Promise.all([fetchDay(day),fetchDay(prior)]);
 return [...SECTOR_TICKERS,...BENCHMARK_TICKERS].flatMap(symbol=>{
  if(!latest[symbol])return [];
  const row=rankClose(symbol,[{day,close:latest[symbol]},...(previous[symbol]?[{day:prior,close:previous[symbol]}]:[])]);
  return row?[row]:[];
 });
},["bluebelly-massive-private-daily-v1"],{revalidate:3600});
const readTwelve=unstable_cache(async(beforeDay:string):Promise<WidgetRow[]>=>{
 const key=process.env.TWELVEDATA_API_KEY?.trim();if(!key)return [];
 const rows=await Promise.all(FX_TICKERS.map(async symbol=>{
  const url=new URL("https://api.twelvedata.com/time_series");
  url.searchParams.set("symbol",symbol);url.searchParams.set("interval","1day");
  url.searchParams.set("outputsize","8");url.searchParams.set("timezone","UTC");
  url.searchParams.set("apikey",key);
  const row=parseTwelveDaily(await readJson(url),symbol,beforeDay);
  return row&&Date.parse(beforeDay)-Date.parse(row.day)<=4*86400000?row:null;
 }));
 return rows.filter((row):row is WidgetRow=>row!==null);
},["bluebelly-twelve-private-daily-v1"],{revalidate:3600});
export async function readPrivateProviderWidgets(now=new Date()){
 // Auth must happen BEFORE cached provider retrieval; never serialize licensed
 // provider results into anonymous public routes.
 if(!await ownerAllowed())return null;
 const expected=expectedHomeEtfSession(now);
 const [massive,twelve]=await Promise.all([
  expected?readMassive(expected).catch(()=>[]):Promise.resolve([]),
  readTwelve(now.toISOString().slice(0,10)).catch(()=>[]),
 ]);
 return {massive,twelve,expected};
}
