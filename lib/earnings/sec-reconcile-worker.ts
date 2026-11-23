/** Bounded, idempotent SEC financial-facts pass for due issuer earnings.
 * Runs inside existing scheduled research, never publishes inferred consensus,
 * AI interpretations, quarter-4 annual totals, or management guidance.
 */
import {createSupabaseAdminClient} from "../supabase/admin.ts";
import {extractSecEarningsQuarter,parseFiscalQuarter} from "./sec-quarter-facts.ts";

const SEC_TICKERS="https://www.sec.gov/files/company_tickers.json";
function validAgent(value:string){
 return /^[^\r\n]{12,200}$/.test(value)&&/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(value);
}
async function secJson(url:string,agent:string,fetchImpl:typeof fetch){
 const response=await fetchImpl(url,{
  headers:{accept:"application/json","user-agent":agent},
  cache:"no-store",signal:AbortSignal.timeout(12000),
 });
 if(!response.ok)throw new Error("SEC_HTTP_"+response.status);
 return response.json() as Promise<unknown>;
}
function cikOf(payload:unknown,ticker:string):number|null{
 if(!payload||typeof payload!=="object"||Array.isArray(payload))return null;
 const matches=Object.values(payload).filter(row=>{
  if(!row||typeof row!=="object")return false;
  return (row as {ticker?:unknown}).ticker===ticker;
 });
 if(matches.length!==1)return null;
 const cik=(matches[0] as {cik_str?:unknown}).cik_str;
 return typeof cik==="number"&&Number.isInteger(cik)&&cik>0?cik:null;
}
type Due={
 ticker:string;fiscal_period:string;state:string;event_at:string|null;
 source_url:string|null;attempt_count:number;next_retry_at:string|null;
};
export type EarningsSecRun={
 status:"ok"|"unconfigured"|"unavailable";checked:number;partial:number;
 reviewRequired:number;unavailable:number;details:string[];
};
export async function reconcileDueSecEarnings(options:{
 now?:Date;fetchImpl?:typeof fetch;maxCompanies?:number;userAgent?:string;
}={}):Promise<EarningsSecRun>{
 const now=options.now??new Date(),fetchImpl=options.fetchImpl??fetch;
 const asOf=now.toISOString(),out:EarningsSecRun={
  status:"ok",checked:0,partial:0,reviewRequired:0,unavailable:0,details:[],
 };
 const agent=options.userAgent??process.env.SEC_USER_AGENT??"";
 if(!validAgent(agent))return {...out,status:"unconfigured",details:["SEC_USER_AGENT_NOT_CONFIGURED"]};
 const db=createSupabaseAdminClient();
 const {data:queue,error:queueError}=await db.from("issuer_earnings_ingestion_state")
  .select("ticker,fiscal_period,state,event_at,source_url,attempt_count,next_retry_at")
  .in("state",["due","source_detected","retry","partial"])
  .or("next_retry_at.is.null,next_retry_at.lte."+asOf)
  .order("event_at",{ascending:true}).limit(Math.max(1,Math.min(5,options.maxCompanies??3)));
 if(queueError)throw new Error("SEC_EARNINGS_QUEUE_READ_FAILED: "+queueError.code);
 const due=(queue||[]) as Due[];
 if(!due.length)return out;
 let registry:unknown;
 try{registry=await secJson(SEC_TICKERS,agent,fetchImpl);}
 catch(error){
  return {...out,status:"unavailable",unavailable:due.length,
   details:["SEC_TICKER_REGISTRY_UNAVAILABLE:"+String(error)]};
 }
 for(const item of due){
  if(!item.event_at||Date.parse(item.event_at)>now.getTime())continue;
  const attempts=item.attempt_count+1,period=parseFiscalQuarter(item.fiscal_period);
  const base=db.from("issuer_earnings_ingestion_state");
  const setState=async(state:string,gap:string|null,retryHours:number|null)=>{
   const {error}=await base.update({
    state,attempt_count:attempts,last_attempt_at:asOf,
    next_retry_at:retryHours===null?null:new Date(now.getTime()+retryHours*3600000).toISOString(),
    gap_reason:gap,updated_at:asOf,
   }).eq("ticker",item.ticker).eq("fiscal_period",item.fiscal_period);
   if(error)throw new Error("SEC_EARNINGS_QUEUE_WRITE_FAILED: "+error.code);
  };
  out.checked++;
  if(!period||period.quarter===4){
   await setState("review_required","Q4 requires quarter-specific issuer financial statement or FY-minus-9M reconciliation; annual totals are not quarter results",null);
   out.reviewRequired++;out.details.push(item.ticker+":Q4_OR_PERIOD_REQUIRES_REVIEW");
   continue;
  }
  const cik=cikOf(registry,item.ticker);
  if(!cik){
   await setState("review_required","Issuer ticker not uniquely mapped to an SEC CIK",null);
   out.reviewRequired++;out.details.push(item.ticker+":CIK_UNRESOLVED");
   continue;
  }
  try{
   const cik10=String(cik).padStart(10,"0");
   const facts=await secJson("https://data.sec.gov/api/xbrl/companyfacts/CIK"+cik10+".json",agent,fetchImpl);
   const extract=extractSecEarningsQuarter({
    payload:facts,cik,ticker:item.ticker,fiscalPeriod:item.fiscal_period,
    dueDay:item.event_at.slice(0,10),asOfDay:asOf.slice(0,10),
   });
   if(!extract){
    if(attempts>=8){
     await setState("review_required","No period-matched SEC 10-Q revenue or diluted EPS after bounded retries",null);
     out.reviewRequired++;
    }else{
     await setState("retry","SEC 10-Q for this fiscal quarter not yet available or quarter facts conflict",12);
     out.unavailable++;
    }
    out.details.push(item.ticker+":SEC_PERIOD_NOT_VERIFIED");continue;
   }
   const resultId=item.ticker+"|"+item.fiscal_period;
   const {data:existing,error:readError}=await db.from("issuer_earnings_results")
    .select("source_url,verification_status").eq("id",resultId).maybeSingle();
   if(readError)throw new Error("RESULT_READ: "+readError.code);
   if(existing?.verification_status==="review_required"||existing?.verification_status==="corrected"){
    await setState("review_required","Existing result requires adjudication; no automatic override",null);
    out.reviewRequired++;continue;
   }
   const {data:prior,error:metricError}=await db.from("issuer_earnings_metrics")
    .select("metric_key,value_numeric,unit,source_url")
    .eq("result_id",resultId).eq("accounting_basis","SEC_US_GAAP")
    .eq("period_basis","fiscal_quarter");
   if(metricError)throw new Error("METRIC_READ: "+metricError.code);
   const conflicts=extract.metrics.filter(metric=>{
    const before=(prior||[]).find(x=>x.metric_key===metric.key);
    return before&&(Number(before.value_numeric)!==metric.value||before.unit!==metric.unit);
   });
   if(conflicts.length){
    await setState("review_required","SEC filing metrics changed; human review required: "+conflicts.map(x=>x.key).join(","),null);
    const {error}=await db.from("issuer_earnings_results").update({
     verification_status:"review_required",
     verification_notes:"Conflicting SEC XBRL metric revision; not auto-published",
     updated_at:asOf,
    }).eq("id",resultId);
    if(error)throw new Error("CONFLICT_WRITE: "+error.code);
    out.reviewRequired++;continue;
   }
   const {error:resultError}=await db.from("issuer_earnings_results").upsert({
    id:resultId,ticker:item.ticker,fiscal_period:item.fiscal_period,
    company_name:extract.company,
    source_url:existing?.source_url||item.source_url||extract.filingUrl,
    source_retrieved_at:asOf,
    verification_status:"partial",
    verification_notes:"SEC 10-Q income-statement facts checked by CIK, fiscal year, quarter, accession and period. Guidance, consensus and cash flow remain separate.",
    published_at:asOf,updated_at:asOf,
   },{onConflict:"id"});
   if(resultError)throw new Error("RESULT_WRITE: "+resultError.code);
   for(const metric of extract.metrics){
    if((prior||[]).some(p=>p.metric_key===metric.key))continue;
    const {error}=await db.from("issuer_earnings_metrics").insert({
     result_id:resultId,metric_key:metric.key,accounting_basis:"SEC_US_GAAP",
     period_basis:"fiscal_quarter",value_numeric:metric.value,
     unit:metric.unit,source_url:extract.filingUrl,
     source_excerpt:"XBRL us-gaap:"+metric.tag+"; accession "+metric.accession+
      "; filed "+metric.filed+"; quarter "+metric.start+" to "+metric.end,
     verification_status:"verified",captured_at:asOf,
    });
    if(error)throw new Error("METRIC_WRITE: "+error.code);
   }
   await setState(attempts>=4?"review_required":"partial",
    attempts>=4?"Income-statement facts published; cash flow / guidance require separate verified source":
     "SEC income-statement facts verified; awaiting separate CFO, capex and guidance reconciliation",
    attempts>=4?null:24);
   out.partial++;out.details.push(item.ticker+":SEC_FINANCIAL_FACTS_"+extract.metrics.length);
  }catch(error){
   const detail=error instanceof Error?error.message:"unknown";
   // A failed external request may be retried, but a database integrity error
   // must remain visible and must never manufacture a completed result.
   if(!detail.startsWith("SEC_HTTP_")&&!detail.includes("fetch")){
    out.details.push(item.ticker+":DATABASE_OR_SOURCE_ERROR:"+detail);
   }else out.details.push(item.ticker+":"+detail);
   if(attempts>=8){
    await setState("review_required","SEC retrieval failed after bounded retries: "+detail,null);
    out.reviewRequired++;
   }else{
    await setState("retry","SEC or persistence unavailable: "+detail,12);
    out.unavailable++;
   }
  }
 }
 return out;
}
