import "server-only";
import {createSupabaseAdminClient} from "./supabase/admin.ts";
import {BLUEBELLY_STOCK_UNIVERSE} from "./bluebelly-equity-universe.ts";
import {projectFundamentalComparison,type IssuerResultRow,type IssuerMetricRow} from "./bluebelly-fundamental-comparison.ts";
import type {PublicEquityCoverageRow} from "./bluebelly-equity-coverage.ts";
export async function readPublicFundamentalComparison(quotes:readonly PublicEquityCoverageRow[],now=new Date()){
 try{
  const db=createSupabaseAdminClient();
  const {data:results,error}=await db.from("issuer_earnings_results").select("id,ticker,fiscal_period,filing_day,verification_status").in("ticker",BLUEBELLY_STOCK_UNIVERSE.map(x=>x.ticker)).in("verification_status",["partial","verified"]).order("filing_day",{ascending:false}).limit(240);
  if(error)throw Error("issuer results unavailable");
  const rows=(results??[]) as IssuerResultRow[];
  const ids=rows.map(r=>r.id);
  const read=ids.length?await db.from("issuer_earnings_metrics").select("result_id,metric_key,value_numeric,unit,accounting_basis,period_basis,source_url,verification_status").in("result_id",ids).eq("verification_status","verified").limit(3000):{data:[],error:null};
  if(read.error)throw Error("issuer metrics unavailable");
  return {status:"OK" as const,rows:projectFundamentalComparison(rows,(read.data??[]) as IssuerMetricRow[],quotes,now)};
 }catch{
  return {status:"UNAVAILABLE" as const,rows:projectFundamentalComparison([],[],quotes,now)};
 }
}
