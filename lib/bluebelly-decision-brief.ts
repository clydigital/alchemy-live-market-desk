import {getRecentVerifiedEarningsScorecards} from "./blue-desk-earnings-results.ts";
import {getRecentOfficialMacroResults} from "./blue-desk-official-macro-results.ts";
import type { NewsBriefV1 } from './market-brief-news.ts';
import type { PresenterCalendar, PresenterCalendarEvent } from './presenter-calendar.ts';
import { projectLivingMarketTopics } from './blue-desk-living-topics.ts';
import { selectBlueDeskUpcoming, selectBlueDeskReleasedWeek } from './blue-desk-calendar.ts';

/** Public presentation only: no new evidence admission or canonical reasoning. */
export function decisionTopics(news: readonly NewsBriefV1[], calendar: PresenterCalendar, now: Date) {
  const current = news.filter(n => Date.parse(n.occurredAt) <= +now && +now-Date.parse(n.occurredAt) <= 48*3600000);
  const topics = projectLivingMarketTopics(current).map(t => ({
    id:t.id,title:t.updates[0].headline, fact:t.updates[0].summary,
    why:t.humanStake,test:t.guidingQuestion,at:t.latestObservedAt,
    sourceUrl:t.updates[0].sourceUrl,sourceName:t.updates[0].sourceName,
    href:'?news='+encodeURIComponent(t.updates[0].id),status:'NEW' as 'NEW'|'UPCOMING'|'FEATURE',
    mechanism:t.marketMechanism, assets:[] as string[], priority:2,
  }));
  // Source-reviewed BEA outcome: only after official release, expires after
  // seven days, and never masquerades as a canonical source-admitted NewsBrief.
  // If original-source news intake has published it, avoid duplicate cards.
  for(const result of getRecentOfficialMacroResults(now)){
    if(current.some(n=>/\\b(?:PCE|personal consumption expenditures)\\b/i.test(n.headline) &&
      /(?:September|Sep\\.?|2026)/i.test(n.headline+" "+n.summary)))continue;
    topics.push({
      id:result.id,title:result.title,fact:result.fact,why:result.why,
      test:result.test,at:result.releaseAt,sourceUrl:result.sourceUrl,
      sourceName:result.sourceName,href:'?brief='+encodeURIComponent(result.id),
      status:'FEATURE',mechanism:result.mechanism,assets:result.affectedAssets,
      priority:7,
    });
  }
  // The separately editor-published RBNZ feature is an approved, dated article,
  // not a new research-engine admission or an inferred market price reaction.
  // Surface it for 48 hours only, and suppress it if a current news brief
  // already contains the same original policy decision.
  const rbnzAt="2026-10-28T01:00:00.000Z";
  const age=+now-Date.parse(rbnzAt);
  if(age>=0 && age<=48*3600000 && !current.some(n=>/rbnz|reserve bank of new zealand|ocr held at 2\.75/i.test(n.headline))){
    topics.push({
      id:"rbnz-october-2026-editorial",title:"RBNZ surprised markets with a narrow 4–3 rate hold",
      fact:"The RBNZ held the OCR at 2.75% by a 4–3 vote. September-quarter inflation was 3.7% and the bank forecast 4.4% for December, largely reflecting fuel costs.",
      why:"A hold is not automatically dovish: compare what markets expected with what the bank said it may do next.",
      test:"Next RBNZ decision on 9 December 2026; check New Zealand short yields and NZD/USD on matched timestamps.",
      at:rbnzAt,
      sourceUrl:"https://www.rbnz.govt.nz/news-and-events/news/2026/10/ocr-held-at-2-75-percent",
      sourceName:"Reserve Bank of New Zealand · decision and meeting record",
      href:"?feature=rbnz-october-2026",status:"FEATURE",
      mechanism:"A surprise pause can shift the relative interest-rate outlook for the New Zealand dollar, but the effect must be measured against pre-announcement pricing and other FX drivers.",
      assets:["NZDUSD"],priority:3,
    });
  }
  for(const result of getRecentVerifiedEarningsScorecards(now,7)) {
    topics.push({id:result.id,title:result.headline,fact:result.company+" · "+result.fiscalPeriod+": "+result.metrics.filter(m=>m.state==='measured').map(m=>m.name+" "+m.value).join("; "),why:result.conclusion,test:result.nextTest,at:result.releaseDay,sourceUrl:result.sourceUrl,sourceName:result.sourceName,href:'?brief='+encodeURIComponent(result.id),status:'NEW',mechanism:result.outlook,assets:[result.ticker],priority:3});
  }
  const upcoming = selectBlueDeskUpcoming(calendar,now,7);
  // One policy decision and one earnings theme; never pad the slate with tickers.
  for(const kind of ['economic','earnings'] as const){
    const event=upcoming.find(e=>e.kind===kind && e.verificationState==='official');
    if(!event) continue;
    // A scheduled issuer report is a distinct decision even if current AI news
    // shares the broad sector. Do not hide the earnings receipt in another topic.
    const related=kind==='economic'?topics.find(t=>t.id==='rates-bonds-credit'):null;
    if(related){related.test=event.title+' · '+(event.scheduledAt||event.localDate)+' · '+event.decidingQuestion;continue;}
    topics.push({id:event.id,title:event.title,fact:'Scheduled decision; no verified outcome yet.',
      why:event.decidingQuestion,test:event.decidingQuestion,at:event.scheduledAt||event.localDate,
      sourceUrl:event.sourceUrl,sourceName:event.sourceName,href:'?brief='+encodeURIComponent(event.id),status:'UPCOMING',
      mechanism:kind==='earnings'?'Revenue growth must become cash after operating costs and investment. Compare guidance and cash conversion before drawing a valuation conclusion.':'The decision matters relative to expectations. Compare the policy message with independently measured yields and currency moves before assigning a cause.',
      assets:event.affectedAssets,priority:(kind==='economic'?(/\b(?:fomc|rate decision|interest rate|central bank|monetary policy)\b/i.test(event.title)?6:4):3)
        + (event.scheduledAt && Date.parse(event.scheduledAt)-+now<=24*3600000?1:0)});
  }
  return topics.sort((a,b)=>b.priority-a.priority ||
    (a.status==='UPCOMING' && b.status==='UPCOMING'
       ? (Date.parse(a.at)||Infinity)-(Date.parse(b.at)||Infinity)
       : b.status==='NEW'&&a.status==='NEW'
         ? (Date.parse(b.at)||0)-(Date.parse(a.at)||0) : 0) || a.id.localeCompare(b.id)).slice(0,5);
}

export function decisionCalendar(calendar:PresenterCalendar,now:Date){
  // Reuse the established weekly selector, widening the input clock backwards
  // only for selection; filter on actual source time for the rolling seven days.
  const released=[...selectBlueDeskReleasedWeek(calendar,now),...selectBlueDeskReleasedWeek(calendar,new Date(+now-7*86400000))];
  return {
    released:released.filter((e,i,a)=>a.findIndex(x=>x.id===e.id)===i).filter(e=>{
      const time=Date.parse(e.releasedAt||e.scheduledAt||e.localDate+'T00:00:00Z');
      return time<=+now && time>=+now-7*86400000;
    }),
    policy:selectBlueDeskUpcoming(calendar,now,7).filter(e=>e.kind==='economic'),
    earnings:selectBlueDeskUpcoming(calendar,now,7).filter(e=>e.kind==='earnings'),
  };
}

export type ComparableValue={value:number;metric:string;period:string;basis:string;unit:string;releaseId:string;sourceUrl:string;asOf:string;verified:boolean};
/** No free-text/regex inference. Missing basis or provenance fails closed. */
export function compareRelease(actual:ComparableValue|null,consensus:ComparableValue|null){
  const unknown={status:'COMPARISON UNAVAILABLE',surprise:null} as const;
  if(!actual||!consensus||!actual.verified||!consensus.verified) return unknown;
  for(const key of ['metric','period','basis','unit','releaseId'] as const)
    if(!actual[key]||actual[key]!==consensus[key]) return unknown;
  if(![actual,consensus].every(v=>Number.isFinite(v.value)&&/^https:\/\//.test(v.sourceUrl)&&Number.isFinite(Date.parse(v.asOf))))return unknown;
  if(Date.parse(consensus.asOf)>=Date.parse(actual.asOf))return unknown;
  const surprise=actual.value-consensus.value;
  return {status:surprise>0?'BEAT':surprise<0?'MISS':'INLINE',surprise};
}
export function calendarOutcome(event:PresenterCalendarEvent){
  // Calendar strings lack metric/period/basis; they cannot authorise comparison.
  return event.actual ? 'Actual reported; comparison unavailable' : 'Verified actual unavailable';
}
