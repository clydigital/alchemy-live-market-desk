/** Bounded, idempotent SEC financial-facts pass for due issuer earnings.
 * Runs inside existing scheduled research, never publishes inferred consensus,
 * AI interpretations, quarter-4 annual totals, or management guidance.
 */
import {createSupabaseAdminClient} from "../supabase/admin.ts";
import {parseSecSubmissionsPayload} from "../providers/sec-edgar.ts";
import {extractSecEarningsQuarter,parseFiscalQuarter} from "./sec-quarter-facts.ts";
import {extractSecQuarterCashFlows,SEC_D1_ISSUERS,type SecCashflowIssuerTicker} from "../dossier-v2/issuer-sec-quarterly-cashflow.ts";

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
  if(!period){
   await setState("review_required","Could not identify exact fiscal quarter from issuer schedule",null);
   out.reviewRequired++;out.details.push(item.ticker+":PERIOD_REQUIRES_REVIEW");
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
   const resultId=item.ticker+"|"+item.fiscal_period;
   // Item 2.02 in a recent company-matched SEC 8-K can establish that an
   // original financial-results disclosure was filed. It does NOT establish
   // the quarter's actual EPS, guidance or analyst surprise by itself.
   const submissions=await secJson("https://data.sec.gov/submissions/CIK"+cik10+".json",agent,fetchImpl);
   const registryCompany=parseSecSubmissionsPayload(submissions,cik);
   const dueMs=Date.parse(item.event_at.slice(0,10)+"T00:00:00Z");
   const notice=registryCompany.filings.find(filing=>{
    const filedMs=Date.parse(filing.filingDate+"T00:00:00Z");
    return filing.form==="8-K" && /(?:^|[,\s])2\.02(?:$|[,\s])/.test(filing.items||"")
      && filedMs>=dueMs-3*86400000&&filedMs<=now.getTime()
      && Boolean(filing.primaryDocumentUrl);
   });
   if(notice){
    const {data:oldResult,error:oldError}=await db.from("issuer_earnings_results")
      .select("verification_status").eq("id",resultId).maybeSingle();
    if(oldError)throw new Error("8K_RESULT_READ: "+oldError.code);
    if(!oldResult){
     const {error:noticeError}=await db.from("issuer_earnings_results").insert({
      id:resultId,ticker:item.ticker,fiscal_period:item.fiscal_period,
      company_name:registryCompany.entityName||item.ticker,
      source_url:notice.primaryDocumentUrl,source_retrieved_at:asOf,
      filing_day:notice.filingDate,verification_status:"source_detected",
      verification_notes:"Matching SEC issuer Item 2.02 original filing found near scheduled event; reporting period, earnings figures and guidance await reconciliation.",
      updated_at:asOf,
     });
     if(noticeError)throw new Error("8K_RESULT_WRITE: "+noticeError.code);
     out.details.push(item.ticker+":SEC_8K_RESULTS_NOTICE_FOUND");
    }
   }
   if(period.quarter===4){
    await setState("review_required","SEC 8-K results notice "+
      (notice?"found":"not yet found")+"; Q4 requires FY-minus-9M reconciliation or issuer quarter-specific release; annual financials cannot be treated as Q4",null);
    out.reviewRequired++;out.details.push(item.ticker+":Q4_QUARTER_FINANCIALS_NEED_REVIEW");
    continue;
   }
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
   // Use the existing independently tested SEC year-to-date cash-flow
   // subtraction for four supported hyperscalers. Quarter 2/3 cash flow is
   // NEVER the year-to-date XBRL amount.
   type CandidateMetric={key:string;value:number;unit:string;accounting:string;source:string;note:string};
   const financialMetrics:CandidateMetric[]=extract.metrics.map(metric=>({
    key:metric.key,value:metric.value,unit:metric.unit,
    accounting:"SEC_US_GAAP",source:extract.filingUrl,
    note:"XBRL us-gaap:"+metric.tag+"; accession "+metric.accession+
      "; filed "+metric.filed+"; quarter "+metric.start+" to "+metric.end,
   }));
   if(item.ticker in SEC_D1_ISSUERS){
    const cash=extractSecQuarterCashFlows(facts,asOf,item.ticker as SecCashflowIssuerTicker).items
     .find(row=>row.fiscalYear===period.year&&row.fiscalQuarter===period.quarter
       &&row.periodEnd===extract.periodEnd&&row.currentAccession===extract.accession);
    if(cash){
     const note="SEC filing "+cash.currentAccession+"; quarter "+cash.periodStart+
       " to "+cash.periodEnd+"; YTD amounts reconciled against "+(cash.predecessorAccession||"Q1 opening")+
       ". FCF is operating cash flow minus cash PP&E, not company adjusted FCF or AI-only cash generation.";
     financialMetrics.push(
      {key:"operating_cash_flow",value:cash.cfoUsd,unit:"USD",accounting:"SEC_US_GAAP_DERIVED",source:cash.filingIndexUrl,note},
      {key:"capital_expenditure",value:cash.cashPpeUsd,unit:"USD",accounting:"SEC_US_GAAP_DERIVED",source:cash.filingIndexUrl,note},
      {key:"free_cash_flow",value:cash.simpleFcfUsd,unit:"USD",accounting:"SEC_US_GAAP_DERIVED",source:cash.filingIndexUrl,note},
     );
    }
   }
   const {data:existing,error:readError}=await db.from("issuer_earnings_results")
    .select("source_url,verification_status").eq("id",resultId).maybeSingle();
   if(readError)throw new Error("RESULT_READ: "+readError.code);
   if(existing?.verification_status==="review_required"||existing?.verification_status==="corrected"){
    await setState("review_required","Existing result requires adjudication; no automatic override",null);
    out.reviewRequired++;continue;
   }
   const {data:prior,error:metricError}=await db.from("issuer_earnings_metrics")
    .select("metric_key,value_numeric,unit,source_url,accounting_basis")
    .eq("result_id",resultId)
    .eq("period_basis","fiscal_quarter");
   if(metricError)throw new Error("METRIC_READ: "+metricError.code);
   const conflicts=financialMetrics.filter(metric=>{
    const before=(prior||[]).find(x=>x.metric_key===metric.key&&x.accounting_basis===metric.accounting);
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
    source_retrieved_at:asOf,filing_day:extract.filed,
    verification_status:"partial",
    verification_notes:"SEC 10-Q income-statement facts checked by CIK, fiscal year, quarter, accession and period. Guidance, consensus and cash flow remain separate.",
    published_at:asOf,updated_at:asOf,
   },{onConflict:"id"});
   if(resultError)throw new Error("RESULT_WRITE: "+resultError.code);
   for(const metric of financialMetrics){
    if((prior||[]).some(p=>p.metric_key===metric.key&&p.accounting_basis===metric.accounting))continue;
    const {error}=await db.from("issuer_earnings_metrics").insert({
     result_id:resultId,metric_key:metric.key,accounting_basis:metric.accounting,
     period_basis:"fiscal_quarter",value_numeric:metric.value,
     unit:metric.unit,source_url:metric.source,
     source_excerpt:metric.note,
     verification_status:"verified",captured_at:asOf,
    });
    if(error)throw new Error("METRIC_WRITE: "+error.code);
   }
   await setState(attempts>=4?"review_required":"partial",
    attempts>=4?"Income-statement facts published; cash flow / guidance require separate verified source":
     "SEC income-statement facts verified; awaiting separate CFO, capex and guidance reconciliation",
    attempts>=4?null:24);
   out.partial++;out.details.push(item.ticker+":SEC_FINANCIAL_FACTS_"+financialMetrics.length);
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
