/** Calendar-only read model. Merges immutable, source-reviewed editorial
 * scorecards with independently SEC-verified persisted financial facts.
 * A partial SEC result is NOT a guidance review or an analyst-consensus beat.
 */
import "server-only";
import {createSupabaseAdminClient} from "../supabase/admin.ts";
import {
 getRecentVerifiedEarningsScorecards,type VerifiedEarningsScorecard,
 type EarningsScorecardMetric,
} from "../blue-desk-earnings-results.ts";
import {parseFiscalQuarter} from "./sec-quarter-facts.ts";
type Row={
 id:string;ticker:string;company_name:string;fiscal_period:string;
 filing_day:string|null;published_at:string|null;source_url:string;
 verification_status:string;
};
type Fact={
 result_id:string;metric_key:string;value_numeric:number|string;unit:string;
 accounting_basis:string;period_basis:string;source_url:string;source_excerpt:string|null;
};
function label(value:number,unit:string){
 if(unit==="USD/shares")return "$"+value.toFixed(2)+" per diluted share";
 const magnitude=Math.abs(value);
 if(magnitude>=1e12)return "$"+(value/1e12).toFixed(3)+"tn";
 if(magnitude>=1e9)return "$"+(value/1e9).toFixed(3)+"bn";
 if(magnitude>=1e6)return "$"+(value/1e6).toFixed(2)+"m";
 return "$"+value.toLocaleString("en-US",{maximumFractionDigits:2});
}
function metric(
 facts:Fact[],key:string,name:EarningsScorecardMetric["name"],
):EarningsScorecardMetric{
 const found=facts.find(f=>f.metric_key===key
  &&(f.accounting_basis==="SEC_US_GAAP"||f.accounting_basis==="SEC_US_GAAP_DERIVED")
  &&f.period_basis==="fiscal_quarter");
 if(!found)return {name,value:null,comparison:null,state:"not_verified",
  note:"A matched SEC-filed quarter-specific amount has not been established."};
 const value=Number(found.value_numeric);
 if(!Number.isFinite(value))return {name,value:null,comparison:null,state:"not_verified"};
 return {name,value:label(value,found.unit),comparison:null,state:"measured",
  note:"SEC US-GAAP XBRL filing"+(found.accounting_basis==="SEC_US_GAAP_DERIVED"?" · derived using separately verified YTD cash-flow periods":"")+"; not an analyst estimate. "+(found.source_excerpt||"")};
}
function fiscalId(ticker:string,period:string){
 const parsed=parseFiscalQuarter(period);
 return parsed?ticker+":"+parsed.year+":"+parsed.quarter:ticker+":"+period;
}
export async function getCalendarEarningsScorecards(
 now=new Date(),
):Promise<VerifiedEarningsScorecard[]>{
 const fallback=getRecentVerifiedEarningsScorecards(now,30);
 try{
  const db=createSupabaseAdminClient();
  const since=new Date(now.getTime()-30*86400000).toISOString();
  const {data:resultRows,error:resultError}=await db.from("issuer_earnings_results")
   .select("id,ticker,company_name,fiscal_period,filing_day,published_at,source_url,verification_status")
   .in("verification_status",["partial","verified"])
   .gte("published_at",since).lte("published_at",now.toISOString())
   .order("published_at",{ascending:false}).limit(30);
  if(resultError)throw new Error("ISSUER_RESULT_READ_"+resultError.code);
  const results=(resultRows||[]) as Row[];
  if(!results.length)return fallback;
  const {data:factRows,error:factError}=await db.from("issuer_earnings_metrics")
   .select("result_id,metric_key,value_numeric,unit,accounting_basis,period_basis,source_url,source_excerpt")
   .eq("verification_status","verified").in("result_id",results.map(r=>r.id));
  if(factError)throw new Error("ISSUER_FACT_READ_"+factError.code);
  const facts=(factRows||[]) as Fact[];
  const dynamic=results.flatMap((row):VerifiedEarningsScorecard[]=>{
   const selected=facts.filter(f=>f.result_id===row.id);
   const revenue=metric(selected,"revenue","Revenue");
   const income=metric(selected,"operating_income","Operating profit / margin");
   const fcf=metric(selected,"free_cash_flow","Free cash flow");
   const capex=metric(selected,"capital_expenditure","Capital expenditure");
   const eps=selected.find(f=>f.metric_key==="diluted_eps"&&f.accounting_basis==="SEC_US_GAAP");
   const epsValue=eps?Number(eps.value_numeric):null;
   if(!row.filing_day||!selected.length||!/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\//.test(selected[0].source_url))return [];
   const basis="SEC US-GAAP company filing dated "+row.filing_day+
     ". Figures are quarter-specific and filing-matched. No post-release consensus substitution.";
   return [{
    id:"sec:"+row.id,ticker:row.ticker,company:row.company_name,
    fiscalPeriod:row.fiscal_period,releaseDay:row.filing_day,
    sourceName:"SEC EDGAR · issuer filing",sourceUrl:selected[0].source_url,basis,
    headline:"SEC filing confirms "+row.ticker+" "+row.fiscal_period+" financial facts"+
     (epsValue!==null&&Number.isFinite(epsValue)?" (diluted EPS "+label(epsValue,"USD/shares")+")":"."),
    beatMiss:"Analyst beat/miss not established: no matching, frozen pre-release consensus snapshot.",
    beatSource:"unavailable",
    metrics:[revenue,income,fcf,capex],
    outlook:"Management guidance changes have not been independently reconciled with the original issuer release.",
    conclusion:"Quarter-specific financial statements were verified in a filing. No automatic growth, cash-return, guidance quality or share-price interpretation is asserted.",
    nextTest:"Reconcile issuer-reported guidance, cash flow and capital expenditure from original period-matched statements, then capture contemporaneous market reaction separately.",
    preliminary:true,
   }];
  });
  const keys=new Set(dynamic.map(row=>fiscalId(row.ticker,row.fiscalPeriod)));
  return [...dynamic,...fallback.filter(row=>!keys.has(fiscalId(row.ticker,row.fiscalPeriod)))]
   .sort((a,b)=>b.releaseDay.localeCompare(a.releaseDay)).slice(0,30);
 }catch(error){
  console.error("calendar_issuer_results_unavailable",error instanceof Error?error.message:"unknown");
  return fallback;
 }
}
