import {expectedCompletedUsWeekdaySessionDay} from "./bluebelly-daily-report-session.ts";
import type {PrivateDailyIntelligenceEdition} from "./bluebelly-private-edition-dedupe.ts";

export type SessionCheckedDailyIntelligence={
 eligible:PrivateDailyIntelligenceEdition[];
 sessionConflicts:PrivateDailyIntelligenceEdition[];
 expectedDay:string|null;
};

/** A dated title explicitly claiming a US/ET *session* must agree with
 * report_day. Source-update dates and ordinary event headlines are not session
 * assertions, so they are deliberately not parsed here. */
export function explicitTitleSessionDay(title:string,reportDay:string):string|null{
 const iso=title.match(/\b(20\d{2}-\d{2}-\d{2})\s+(?:ET|US)\s+(?:cash\s+)?session\b/i);
 if(iso)return iso[1];
 const named=title.match(/\b(\d{1,2})\s+(Jan\w*|Feb\w*|Mar\w*|Apr\w*|May\w*|Jun\w*|Jul\w*|Aug\w*|Sep\w*|Oct\w*|Nov\w*|Dec\w*)\s+(?:(20\d{2})\s+)?(?:ET|US)\s+(?:cash\s+)?session\b/i);
 if(!named)return null;
 const monthIndex=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(named[2].slice(0,3).toLowerCase());
 const year=Number(named[3]||reportDay.slice(0,4));
 const day=Number(named[1]);
 if(monthIndex<0||!Number.isInteger(year)||day<1||day>31)return "INVALID_SESSION_TITLE";
 const parsed=new Date(Date.UTC(year,monthIndex,day));
 if(parsed.getUTCFullYear()!==year||parsed.getUTCMonth()!==monthIndex||parsed.getUTCDate()!==day)return "INVALID_SESSION_TITLE";
 return parsed.toISOString().slice(0,10);
}

/**
 * Only reports actually filed for an already-completed regular US equity
 * session can lead My Desk or generate report-led ideas. Both the session at
 * archive creation and the session at reading must be checked.
 *
 * A Work report can add newer research to a historical Friday edition, but
 * this never makes it a Tuesday-close edition on Tuesday morning. Keep the
 * immutable incorrect receipt in a distinct review shelf; never delete or
 * silently rewrite it. This display gate is not an exchange-holiday calendar
 * or an original-source verification/approval gate.
 */
export function classifyPrivateDailyIntelligenceSessions(
 editions:readonly PrivateDailyIntelligenceEdition[],now:Date,
):SessionCheckedDailyIntelligence{
 const expectedDay=expectedCompletedUsWeekdaySessionDay(now);
 const eligible:PrivateDailyIntelligenceEdition[]=[];
 const sessionConflicts:PrivateDailyIntelligenceEdition[]=[];
 const nowMs=now.getTime();
 for(const e of editions){
  const savedMs=Date.parse(e.createdAt);
  const expectedWhenSaved=expectedCompletedUsWeekdaySessionDay(new Date(savedMs));
  const validDay=/^\d{4}-\d{2}-\d{2}$/.test(e.reportDay)&&
   Number.isFinite(Date.parse(e.reportDay+"T00:00:00.000Z"))&&
   new Date(e.reportDay+"T00:00:00.000Z").toISOString().slice(0,10)===e.reportDay;
  const namedSessionDay=explicitTitleSessionDay(e.title,e.reportDay);
  const titleDayAgrees=namedSessionDay===null||namedSessionDay===e.reportDay;
  const canLead=titleDayAgrees&&validDay&&expectedDay!==null&&expectedWhenSaved!==null&&
   Number.isFinite(nowMs)&&Number.isFinite(savedMs)&&
   savedMs<=nowMs+60_000&&
   e.reportDay<=expectedWhenSaved&&e.reportDay<=expectedDay;
  (canLead?eligible:sessionConflicts).push(e);
 }
 return {eligible,sessionConflicts,expectedDay};
}
