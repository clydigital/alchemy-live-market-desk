import "server-only";
import {createSupabaseAdminClient} from "./supabase/admin.ts";
import {getRecentVerifiedEarningsScorecards} from "./blue-desk-earnings-results.ts";
import {buildIndustryComparison,type IssuerResultRow,type IssuerFactRow} from "./bluebelly-industry-comparison.ts";

/** Read existing earnings stores only. No polling, write, or private holdings data.
 * Bounded 90-day report window; query success is not universe coverage.
 */
export async function readIndustryComparison(tickers:readonly string[],now=new Date()){
 const selected=[...new Set(tickers)].slice(0,8);
 const fallback=getRecentVerifiedEarningsScorecards(now,90);
 let results:IssuerResultRow[]=[],facts:IssuerFactRow[]=[],status:"READABLE"|"UNAVAILABLE"="READABLE";
 try{
  if(selected.length){
   const db=createSupabaseAdminClient();
   const since=new Date(now.getTime()-90*86400000).toISOString().slice(0,10);
   const {data,error}=await db.from("issuer_earnings_results")
    .select("id,ticker,company_name,fiscal_period,filing_day,published_at,source_retrieved_at,source_url,verification_status")
    .in("ticker",selected).in("verification_status",["partial","verified"])
    .gte("filing_day",since).lte("filing_day",now.toISOString().slice(0,10))
    .or("published_at.lte."+now.toISOString()+",and(published_at.is.null,source_retrieved_at.lte."+now.toISOString()+")")
    .order("filing_day",{ascending:false}).order("published_at",{ascending:false,nullsFirst:false}).limit(80);
   if(error)throw new Error("issuer_result_read_failed");
   results=(data??[]) as IssuerResultRow[];
   if(results.length){
    const {data:rows,error:factError}=await db.from("issuer_earnings_metrics")
     .select("result_id,metric_key,value_numeric,unit,accounting_basis,period_basis,source_url,verification_status,captured_at")
     .eq("verification_status","verified").in("result_id",results.map(r=>r.id)).limit(1000);
    if(factError)throw new Error("issuer_fact_read_failed");
    facts=(rows??[]) as IssuerFactRow[];
   }
  }
 }catch{status="UNAVAILABLE";results=[];facts=[];}
 return {status,asOf:now.toISOString(),columns:buildIndustryComparison(selected,results,facts,fallback,now)};
}
