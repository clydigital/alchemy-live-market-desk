/**
 * The last completed US equity session is not a freshness watermark.
 * A Friday session date may remain correct on Monday, but a report produced
 * Friday is not evidence that Monday's policy, earnings and economic catalysts
 * were checked. This pure gate is shared by the cron and its tests.
 */
import {expectedCompletedUsWeekdaySessionDay} from "./bluebelly-daily-report-session.ts";

export type PrivateReportReceipt={
 id:string;created_at:string;delivery_type?:string;report_day?:string;
};
function savedSessionWasComplete(receipt:PrivateReportReceipt,now:Date):boolean{
 // A query may have matched report_day even though Work falsely assigned a
 // future US trading session before that session closed. Never reuse it as
 // a completed daily report. Legacy narrow test fixtures omit report_day.
 if(receipt.report_day===undefined)return true;
 const atSave=expectedCompletedUsWeekdaySessionDay(new Date(receipt.created_at));
 const atRead=expectedCompletedUsWeekdaySessionDay(now);
 return atSave!==null&&atRead!==null&&
  /^\d{4}-\d{2}-\d{2}$/.test(receipt.report_day)&&
  receipt.report_day<=atSave&&receipt.report_day<=atRead;
}
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
  &&savedSessionWasComplete(r,now)&&isFreshPrivateMorningReceipt(r.created_at,now));
 if(freshComplete)return {action:"reuse_complete",id:freshComplete.id,
  reason:"fresh_work_edition"};
 const freshOwner=latest(owner).find(r=>savedSessionWasComplete(r,now)&&isFreshPrivateMorningReceipt(r.created_at,now));
 if(freshOwner)return {action:"reuse_complete",id:freshOwner.id,
  reason:"fresh_owner_revision"};
 const fallback=latest(work).find(r=>r.delivery_type==="SCHEDULED_RESEARCH"&&savedSessionWasComplete(r,now));
 if(fallback){
  return isFreshPrivateMorningReceipt(fallback.created_at,now)
   ?{action:"reuse_fallback",id:fallback.id,reason:"fresh_source_led_fallback_only"}
   :{action:"stale_fallback",id:fallback.id,reason:"scheduled_fallback_outdated_full_work_update_needed"};
 }
 return {action:"generate",reason:work.length||owner.length
  ?"older_same_session_editions_do_not_satisfy_morning_freshness"
  :"no_private_edition_for_session"};
}
