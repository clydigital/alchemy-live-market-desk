/**
 * The last completed US equity session is not a freshness watermark.
 * A Friday session date may remain correct on Monday, but a report produced
 * Friday is not evidence that Monday's policy, earnings and economic catalysts
 * were checked. This pure gate is shared by the cron and its tests.
 */
export type PrivateReportReceipt={
 id:string;created_at:string;delivery_type?:"CHATGPT_WORK"|"SCHEDULED_RESEARCH";
};
export type PrivateArchiveSelection={
 action:"reuse_complete"|"reuse_fallback"|"generate"|"stale_fallback";
 id?:string;reason:string;
};
export const MORNING_FRESHNESS_MAX_HOURS=8;
export function isFreshPrivateMorningReceipt(
 createdAt:string,now:Date,maxHours=MORNING_FRESHNESS_MAX_HOURS,
):boolean{
 const written=Date.parse(createdAt),at=now.getTime();
 return Number.isFinite(written)&&Number.isFinite(at)
  &&Number.isFinite(maxHours)&&maxHours>0&&maxHours<=24
  &&written<=at+120_000&&at-written<=maxHours*3_600_000;
}
export function selectPrivateDailyArchive(
 work:readonly PrivateReportReceipt[],
 owner:readonly PrivateReportReceipt[],
 now:Date,
):PrivateArchiveSelection{
 const latest=(rows:readonly PrivateReportReceipt[])=>[...rows]
  .sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
 const freshComplete=latest(work).find(r=>r.delivery_type==="CHATGPT_WORK"
  &&isFreshPrivateMorningReceipt(r.created_at,now));
 if(freshComplete)return {action:"reuse_complete",id:freshComplete.id,
  reason:"fresh_work_edition"};
 const freshOwner=latest(owner).find(r=>isFreshPrivateMorningReceipt(r.created_at,now));
 if(freshOwner)return {action:"reuse_complete",id:freshOwner.id,
  reason:"fresh_owner_revision"};
 const fallback=latest(work).find(r=>r.delivery_type==="SCHEDULED_RESEARCH");
 if(fallback){
  return isFreshPrivateMorningReceipt(fallback.created_at,now)
   ?{action:"reuse_fallback",id:fallback.id,reason:"fresh_source_led_fallback_only"}
   :{action:"stale_fallback",id:fallback.id,reason:"scheduled_fallback_outdated_full_work_update_needed"};
 }
 return {action:"generate",reason:work.length||owner.length
  ?"older_same_session_editions_do_not_satisfy_morning_freshness"
  :"no_private_edition_for_session"};
}
