import type {NewsBriefV1} from "./market-brief-news.ts";
import type {PresenterCalendar} from "./presenter-calendar.ts";
import {selectBlueDeskUpcoming} from "./blue-desk-calendar.ts";
import {decisionTopics} from "./bluebelly-decision-brief.ts";
import {getRecentVerifiedEarningsScorecards} from "./blue-desk-earnings-results.ts";
import {formatDualDeskTime} from "./blue-desk-time.ts";

/** One read-only on-air handrail, sourced exclusively from the existing public projections. */
export function buildPresenterOneMinute(news:readonly NewsBriefV1[], calendar:PresenterCalendar, now:Date){
 const topics=decisionTopics(news,calendar,now);
 const official=selectBlueDeskUpcoming(calendar,now,7).filter(e=>e.verificationState==='official');
 const lead=topics[0]||null;
 const imminent=official.find(e=>e.kind==='economic' && e.scheduledAt)
   ||official.find(e=>e.scheduledAt) || official[0] || null;
 const released=getRecentVerifiedEarningsScorecards(now,7)[0]||null;
 const newsLead=topics.find(t=>t.status==='NEW' && t.id!==released?.id);
 const when=imminent?.scheduledAt?formatDualDeskTime(imminent.scheduledAt)?.et||"time unconfirmed":
   imminent?.localDate?imminent.localDate+" · date only":"time unavailable";
 const opening=imminent?
   "The next scheduled catalyst is "+imminent.title+" ("+when+"). Its outcome has not been verified in the current calendar.":
   lead?"The desk has verified the following development: "+lead.title+".":"No current source-qualified lead is available.";
 const evidence=released?
   "Separately, "+released.company+" reported "+released.fiscalPeriod+": "+
    released.metrics.filter(m=>m.state==='measured').slice(0,2).map(m=>m.name+" "+m.value).join("; ")+
    ". These are issuer figures, not a verified analyst-consensus beat.":
   newsLead?"A separately qualified update: "+newsLead.title+". The announcement alone does not prove a market reaction.":
   "There is no independently matched released result available in this briefing.";
 const watch=imminent?.affectedAssets.filter(Boolean).slice(0,4)||
   lead?.assets.filter(Boolean).slice(0,4)||[];
 const next=imminent?.decidingQuestion||lead?.test||"Find an original release and source-dated prices.";
 const stop="Do not call the outcome, consensus surprise or asset reaction confirmed without the relevant source receipts and matched price timestamps.";
 return {
   opening,evidence,next,stop,
   script:[opening,evidence,"My next test: "+next,stop].join(" "),
   eventTitle:imminent?.title||null,
   eventUrl:imminent?.sourceUrl||null,
   time:when,
   watch,
   releasedName:released?.company||null,
   releasedUrl:released?.sourceUrl||null,
   state:imminent?"PRE-EVENT / OUTCOME PENDING":lead?"REPORTED / PRICE IMPACT UNVERIFIED":"SOURCE COVERAGE GAP",
   readAt:now.toISOString(),
 };
}
