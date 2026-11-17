import "server-only";
import {createSupabaseAdminClient} from "./supabase/admin.ts";

export type InvestorReviewReceipt={checkedAt:string;outcome:"PERSISTED"|"NO_CHANGE"|"ALREADY_CURRENT"};

/** Reuse completed post-research checkpoints; never expose run summaries or IDs. */
export async function getInvestorReviewReceipt(dossierId:string|null,now:Date):Promise<InvestorReviewReceipt|null>{
 if(!dossierId)return null;
 const {data,error}=await createSupabaseAdminClient().from("research_slot_runs")
  .select("checkpoint:stage_summary->postResearchDossier")
  .in("slot_key",["morning","evening"]).eq("status","completed")
  .order("scheduled_for",{ascending:false}).limit(8);
 if(error)return null;
 const receipts=(data??[]).flatMap(row=>{
  const c=row.checkpoint as {contractVersion?:string;state?:string;outcome?:string;dossierId?:string;finishedAt?:string}|null;
  if(!c||c.contractVersion!=="post-research-dossier/1"||c.state!=="DONE"||c.dossierId!==dossierId||!c.finishedAt||!Number.isFinite(Date.parse(c.finishedAt))||Date.parse(c.finishedAt)>+now)return [];
  if(c.outcome!=="PERSISTED"&&c.outcome!=="NO_CHANGE"&&c.outcome!=="ALREADY_CURRENT")return [];
  return [{checkedAt:c.finishedAt,outcome:c.outcome} satisfies InvestorReviewReceipt];
 });
 return receipts.sort((a,b)=>Date.parse(b.checkedAt)-Date.parse(a.checkedAt))[0]??null;
}
