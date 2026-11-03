import "server-only";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {projectCompletedOfficialMacroNews,projectCompletedReviewedBankNews,type CompletedMacroRow} from "./blue-desk-canonical-macro-news";
import {getRecentOfficialMacroResults} from "./blue-desk-official-macro-results";
import type {NewsBriefV1} from "./market-brief-news";

/** Read-only completed actual bridge. Uses only existing original-source
 * macro release receipts; it does not query drafts, Work editions or owner
 * research, create verified records, or grant publication approval.
 */
export async function getCompletedOfficialMacroNews(
 now=new Date(),limit=12,lookbackDays=7,
):Promise<NewsBriefV1[]>{
 if(!Number.isFinite(+now)||!Number.isInteger(lookbackDays)||
  lookbackDays<1||lookbackDays>7||limit<1||limit>18)return [];
 const db=createSupabaseAdminClient();
 const cutoff=new Date(+now-lookbackDays*86400000).toISOString();
 const {data,error}=await db.from("macro_releases")
  .select("id,release_name,agency,release_date,reference_period,status,source_url,source_classification,actual,actual_retrieved_at,ingestion_attempt_status,released_at")
  .eq("status","completed").eq("ingestion_attempt_status","completed")
  .eq("source_classification","official_government")
  .not("actual","is",null).not("actual_retrieved_at","is",null)
  .gte("release_date",cutoff).lte("release_date",now.toISOString())
  .order("release_date",{ascending:false}).limit(30);
 if(error)throw new Error("Original official macro release receipt read failed");
 const reviewed=new Set(getRecentOfficialMacroResults(now).map(x=>x.sourceUrl));
 const rows=(data||[]) as CompletedMacroRow[];
 // Keep the US original-source gate unchanged; additionally reuse an already
 // reviewed RBA policy snapshot only when the completed DB receipt is identical.
 return [...projectCompletedOfficialMacroNews(rows,now,limit,lookbackDays),
   ...projectCompletedReviewedBankNews(rows,now,limit,lookbackDays)]
  .filter(item=>!reviewed.has(item.sourceUrl))
  .sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt)).slice(0,limit);
}
