import {expectedCompletedUsWeekdaySessionDay} from "./bluebelly-daily-report-session.ts";
import {inspectWritingBrainHandoff,type EditorialSlate} from "./editorial-slate-core.ts";

/** Pure, read-only source selection. Never converts research into canonical
 * evidence or implies that a persisted record proves a ChatGPT run executed. */
export type OwnerIdeaHandoffState=
 "MATCHED_UPSTREAM_SOURCE_CHECKED"|"MATCHED_PARTIAL"|"MATCHED_MANUAL_RECOVERY"|
 "NOT_DUE"|"NOT_SCHEDULED"|"MISSING"|"STALE_SLATE"|
 "PARENT_MISMATCH"|"INCOMPLETE_SLATE"|"UNAVAILABLE";

export type OwnerIdeaHandoff={
 source:"WRITING_BRAIN"|"REPORT_DERIVED";
 state:OwnerIdeaHandoffState;
 freshness:"CURRENT_US_SESSION"|"OLDER_US_SESSION"|"UNKNOWN";
 expectedSessionET:string|null;
 reportSessionET:string;
 slateDayMyt:string|null;
 reason:string;
};

export type ParentReportIdentity={
 id:string;
 reportDay:string;
 htmlSha256:string;
};

const dayMyt=(at:Date)=>new Intl.DateTimeFormat("sv-SE",{
 timeZone:"Asia/Kuala_Lumpur",year:"numeric",month:"2-digit",day:"2-digit",
}).format(at);

/** The display must never silently prefer three independent ideas over the
 * saved Writing Brain three-idea receipt. Only exact parent SHA, report ID,
 * session, source URLs and unique idea IDs qualify it as the leading slate.
 * A report-only fallback is labelled and kept private. */
export function reconcileOwnerIdeaHandoff(
 parent:ParentReportIdentity,slate:EditorialSlate|null,now:Date,
):OwnerIdeaHandoff{
 const expectedSessionET=expectedCompletedUsWeekdaySessionDay(now);
 const freshness:OwnerIdeaHandoff["freshness"]=!expectedSessionET?"UNKNOWN":
  parent.reportDay===expectedSessionET?"CURRENT_US_SESSION":"OLDER_US_SESSION";
 const base={freshness,expectedSessionET,reportSessionET:parent.reportDay,
  slateDayMyt:slate?.dayMyt||null};
 const fallback=(state:OwnerIdeaHandoffState,reason:string):OwnerIdeaHandoff=>
  ({...base,source:"REPORT_DERIVED",state,reason});
 const today=dayMyt(now);
 const receipt=inspectWritingBrainHandoff(slate,now);
 if(!slate||slate.dayMyt!==today){
  if(receipt.state==="NOT_DUE")
   return fallback("NOT_DUE","The 09:30 MYT Writing Brain slate is not yet due; showing source-attributed report directions.");
  if(receipt.state==="NOT_SCHEDULED")
   return fallback("NOT_SCHEDULED","Writing Brain is not scheduled on Sunday; showing the saved report's directions.");
  if(receipt.state==="MISSING")
   return fallback("MISSING","No current-day Writing Brain slate was persisted by the 10:00 MYT delivery check; showing report-derived directions, not a delivered scheduled slate.");
  return fallback("STALE_SLATE","No current-day Writing Brain slate is available; using clearly attributed report-derived directions.");
 }
 const produced=Date.parse(slate.producedAt);
 if(!Number.isFinite(produced)||produced>now.getTime()+120_000||
  now.getTime()-produced>=18*3600_000)
  return fallback("STALE_SLATE","The slate has an invalid, future or stale timestamp; it cannot be promoted.");
 const ids=slate.ideas.map(idea=>idea.ideaId);
 const uniqueIds=ids.length===3&&ids.every(id=>!!id)&&new Set(ids).size===3;
 const complete=slate.ideas.length===3&&uniqueIds&&slate.ideas.every(idea=>
  idea.title.length>0&&idea.hook.length>0&&idea.mechanism.length>0&&
  idea.countercase.length>0&&idea.nextTrigger.length>0&&
  idea.sourceUrls.length>0);
 if(!complete)
  return fallback("INCOMPLETE_SLATE","The saved slate lacks three distinct source-linked research ideas; the report remains the parent.");
 const matched=slate.ideas.every(idea=>
  idea.parentReportId===parent.id&&
  idea.parentReportSha256===parent.htmlSha256&&
  idea.reportSessionET===parent.reportDay);
 if(!matched)
  return fallback("PARENT_MISMATCH","The slate's exact report ID, SHA or US-session receipt differs from the current Daily Intelligence edition. It cannot silently replace that report's ideas.");
 const recovered=/RECOVERY_BACKFILL|MANUAL_BACKFILL/i.test(slate.notes);
 if(recovered)
  return {...base,source:"WRITING_BRAIN",state:"MATCHED_MANUAL_RECOVERY",
   reason:"Three source-linked ideas match this exact report, but the slate is manually recovered, not proof of a successful scheduled run."};
 if(slate.verificationStatus==="partial")
  return {...base,source:"WRITING_BRAIN",state:"MATCHED_PARTIAL",
   reason:"Three persisted ideas match this exact report; their research remains partial, and this is not proof of successful scheduled task execution."};
 return {...base,source:"WRITING_BRAIN",state:"MATCHED_UPSTREAM_SOURCE_CHECKED",
  reason:"Three persisted source-linked ideas match the report ID, SHA and US session. Source checked is upstream-reported; no independent plugin execution or publication is inferred."};
}
