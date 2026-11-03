import {expectedCompletedUsWeekdaySessionDay} from "./bluebelly-daily-report-session.ts";
import type {PrivateDailyIntelligenceEdition} from "./bluebelly-private-edition-dedupe.ts";

export type SessionCheckedDailyIntelligence={
 eligible:PrivateDailyIntelligenceEdition[];
 sessionConflicts:PrivateDailyIntelligenceEdition[];
 expectedDay:string|null;
};

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
  const canLead=validDay&&expectedDay!==null&&expectedWhenSaved!==null&&
   Number.isFinite(nowMs)&&Number.isFinite(savedMs)&&
   savedMs<=nowMs+60_000&&
   e.reportDay<=expectedWhenSaved&&e.reportDay<=expectedDay;
  (canLead?eligible:sessionConflicts).push(e);
 }
 return {eligible,sessionConflicts,expectedDay};
}
