import type {NewsBriefV1} from "./market-brief-news.ts";
import type {PublicSourceObservation} from "./blue-desk-source-observations-projector.ts";

export type AutomaticReportSlot="morning"|"evening";
export type ReportSource={
 id:string;type:"NEWS"|"OBSERVATION"|"CALENDAR";title:string;
 detail:string;sourceName:string;url:string;eventAt:string;
};
export type ReportStory={
 headline:string;setup:string;reveal:string;humanStake:string;
 mechanism:string;countercase:string;nextTest:string;sourceIds:string[];
};
export type ReportWatch={
 event:string;when:string;question:string;positiveCase:string;negativeCase:string;sourceIds:string[];
};
export type AutomatedReportNarrative={
 title:string;deck:string;executiveSummary:string;bigPicture:string;
 stories:ReportStory[];crossMarket:string[];watchlist:ReportWatch[];
 concludingAssessment:string;limitations:string;
};
export type AutomaticReportEvidence={
 asOf:string;slot:AutomaticReportSlot;sources:ReportSource[];
 coverageNote:string;
};
const text=(x:unknown,min:number,max:number):x is string=>
 typeof x==="string"&&x.trim()===x&&x.length>=min&&x.length<=max
 && !/[\u0000-\u0008\u000b\u000e-\u001f]/.test(x);
/** Existing Dossier retry time is the report's finalisation opportunity (UTC). */
export function isAutomaticReportFinalisationWindow(now:Date,slot:AutomaticReportSlot):boolean{
 if(!Number.isFinite(now.getTime()))return false;
 const minutes=now.getUTCHours()*60+now.getUTCMinutes();
 const target=slot==="morning"?2*60+40:15*60+20;
 return minutes>=target&&minutes<target+16;
}

/** Existing Research Gap handoff cron (03:30/03:45 and 15:30/15:45 UTC)
 * retries the PDF only after an already-finalised canonical Dossier.
 * It does not change the Dossier, Story, research or cron schedules. */
export function isAutomaticReportFallbackWindow(now:Date,slot:AutomaticReportSlot):boolean{
 if(!Number.isFinite(now.getTime()))return false;
 const minutes=now.getUTCHours()*60+now.getUTCMinutes();
 const target=slot==="morning"?3*60+30:15*60+30;
 return minutes>=target&&minutes<target+26;
}

/** A late PDF retry is authorised by the *canonical* persisted Dossier outcome,
 * not a merely successful Research Gap handoff or a Motion lead. */
export function isCompletedDossierForAutomaticReport(
 run:{id:string;schedule_slot:string;scheduled_for:string;completed_at:string|null;status:string}|null,
 slotRun:{research_run_id:string;slot_key:string;status:string;health_state:string|null;
  live_publication_status:string|null;hybrid_handoff_status:string|null;
  stage_summary:Record<string,unknown>|null}|null,
 slot:AutomaticReportSlot,now:Date,
):boolean{
 if(!run||!slotRun||run.id!==slotRun.research_run_id||run.schedule_slot!==slot||slotRun.slot_key!==slot)return false;
 if(run.status!=="completed"||slotRun.status!=="completed"||slotRun.health_state!=="healthy"
  ||slotRun.live_publication_status!=="complete"||slotRun.hybrid_handoff_status!=="complete")return false;
 const scheduled=Date.parse(run.scheduled_for),completed=Date.parse(run.completed_at||"");
 if(!Number.isFinite(scheduled)||!Number.isFinite(completed)||completed>now.getTime()
  ||scheduled>now.getTime()||now.getTime()-scheduled>5*3600_000)return false;
 const summary=slotRun.stage_summary;
 if(!summary||summary.evidence_gate_passed!==true||summary.required_sources_complete!==true
   ||summary.accuracy_gate==="blocked")return false;
 const checkpoint=summary.postResearchDossier;
 return !!checkpoint&&typeof checkpoint==="object"&&!Array.isArray(checkpoint)
  &&(checkpoint as Record<string,unknown>).contractVersion==="post-research-dossier/1"
  &&(checkpoint as Record<string,unknown>).state==="DONE";
}
const MAX_AGE=48*3600_000;
const dateValid=(s:string,now:number)=>Number.isFinite(Date.parse(s))
 && Date.parse(s)<=now+120000;
function qualified(url:string){
 try{const u=new URL(url);return u.protocol==="https:"&&!u.username&&!u.password
  &&!!u.hostname&&u.href.length<=1800&&(u.pathname!=="/"||!!u.search);}
 catch{return false;}
}
/** Only source-verified News, tier-1/2 observations and source-listed future events.
 * No X, creator summaries, Notion hypotheses, or current Dossier estimates. */
export function assembleAutomaticReportEvidence(input:{
 now:Date;slot:AutomaticReportSlot;news:readonly NewsBriefV1[];
 observations:readonly PublicSourceObservation[];
 calendar:readonly {title:string;when:string|null;sourceName:string;sourceUrl:string|null;question:string}[];
 market?:readonly {label:string;level:number|null;previousClose:number|null;asOf:string|null;sourceName:string;sourceUrl:string;frequency:string}[];
}):AutomaticReportEvidence{
 const t=input.now.getTime();const sources:ReportSource[]=[];
 const seen=new Set<string>();
 function add(item:ReportSource){
  if(!qualified(item.url)||!dateValid(item.eventAt,t))return;
  if(seen.has(item.url))return;seen.add(item.url);sources.push(item);
 }
 for(const row of input.news.slice(0,12)){
  const published=Date.parse(row.occurredAt);
  if(row.verification!=="SOURCE_VERIFIED"||!Number.isFinite(published)||published>t||t-published>MAX_AGE)continue;
  add({id:"N"+(sources.length+1),type:"NEWS",title:row.headline,
   detail:row.summary,sourceName:row.sourceName,url:row.sourceUrl,eventAt:row.occurredAt});
 }
 for(const row of input.observations.slice(0,12)){
  const at=Date.parse(row.eventAt);
  if(!Number.isFinite(at)||at>t||t-at>MAX_AGE||row.sourceTier>2)continue;
  add({id:"O"+(sources.length+1),type:"OBSERVATION",title:row.description.slice(0,170),
   detail:row.description,sourceName:row.sourceName,url:row.sourceUrl,eventAt:row.eventAt});
 }
 // Dated daily provider prices are observable facts, not causal evidence.
 // Accept only explicit source URLs and recent daily as-of timestamps; monthly
 // levels cannot be repackaged as today's price reaction.
 for(const row of (input.market||[]).slice(0,10)){
  const at=Date.parse(row.asOf||"");
  if(row.frequency!=="daily"||row.level===null||!Number.isFinite(row.level)||
   !Number.isFinite(at)||at>t||t-at>MAX_AGE)continue;
  const prior=typeof row.previousClose==="number"&&Number.isFinite(row.previousClose)
   ?` Previous close: ${row.previousClose} (comparison only, not event attribution).`:"";
  add({id:"M"+(sources.length+1),type:"OBSERVATION",
   title:row.label+" - dated market level "+row.level,
   detail:`Provider-reported latest level: ${row.level} at ${row.asOf}.${prior} No event cause is established.`,
   sourceName:row.sourceName,url:row.sourceUrl,eventAt:row.asOf!});
 }
 // Calendar does not count towards the minimum independent factual event coverage.
 for(const row of input.calendar.slice(0,12)){
  if(!row.sourceUrl||!row.when||!qualified(row.sourceUrl))continue;
  const scheduled=Date.parse(row.when);
  if(!Number.isFinite(scheduled)||scheduled<t-12*3600_000||scheduled>t+14*86400_000)continue;
  // Dates for future events can exceed report asOf but must be clearly labelled.
  if(seen.has(row.sourceUrl))continue;
  seen.add(row.sourceUrl);
  sources.push({id:"C"+(sources.length+1),type:"CALENDAR",title:row.title,
   detail:row.question,sourceName:row.sourceName,url:row.sourceUrl,eventAt:row.when});
 }
 const actual=sources.filter(s=>s.type!=="CALENDAR").length;
 const qualifiedNews=sources.some(s=>s.type==="NEWS");
 const coverageNote=actual<2
  ?"Insufficient independent dated factual sources for a comprehensive automatic report. Edition withheld."
  :qualifiedNews
   ?"Automated briefing: original news and market observations are source-attributed. Market causality, interpretation and scenarios are AI-assisted, not human reviewed."
   :"DATA-LED EDITION / NEWS COVERAGE GAP: No fresh source-verified news qualified. Dated provider market measurements and source-listed future decisions are presented as conditional interpretation, not a verified explanation of price moves. AI-assisted, not human reviewed.";
 return {asOf:input.now.toISOString(),slot:input.slot,sources,coverageNote};
}
export function reportEvidenceReady(evidence:AutomaticReportEvidence):boolean{
 const factual=evidence.sources.filter(s=>s.type!=="CALENDAR");
 const news=factual.some(x=>x.type==="NEWS");
 const dataLed=factual.filter(x=>x.type==="OBSERVATION").length>=4
   &&evidence.sources.some(x=>x.type==="CALENDAR");
 return factual.length>=2&&new Set(factual.map(x=>x.url)).size>=2
  &&(news||dataLed);
}
function extractNumbers(s:string):Set<string>{
 return new Set((s.match(/\b\d+(?:[.,]\d+)*%?\b/g)||[])
  .map(v=>v.replaceAll(",","")));
}
/** Deliberately conservative rejection-only gate, not a claim-level fact checker.
 * Unsupported numeric magnitudes must never enter an automatically public PDF. */
export function parseAutomatedReportNarrative(
 raw:unknown,evidence:AutomaticReportEvidence,
):AutomatedReportNarrative|null{
 if(!reportEvidenceReady(evidence)||!raw||typeof raw!=="object"||Array.isArray(raw))return null;
 const r=raw as Record<string,unknown>;
 if(!text(r.title,12,110)||!text(r.deck,30,450)
  ||!text(r.executiveSummary,120,1400)||!text(r.bigPicture,180,2400)
  ||!text(r.concludingAssessment,100,1600)||!text(r.limitations,45,1100))return null;
 if(!Array.isArray(r.stories)||r.stories.length<2||r.stories.length>4
  ||!Array.isArray(r.crossMarket)||r.crossMarket.length<3||r.crossMarket.length>7
  ||!Array.isArray(r.watchlist)||r.watchlist.length<2||r.watchlist.length>7)return null;
 const map=new Map(evidence.sources.map(s=>[s.id,s]));
 function refs(value:unknown,requireFact:boolean):value is string[]{
  if(!Array.isArray(value)||value.length<1||value.length>4||new Set(value).size!==value.length)return false;
  if(!value.every(v=>typeof v==="string"&&map.has(v)))return false;
  return !requireFact||value.some(v=>map.get(v)?.type!=="CALENDAR");
 }
 for(const item of r.stories){
  if(!item||typeof item!=="object"||Array.isArray(item))return null;
  const s=item as Record<string,unknown>;
  if(!text(s.headline,12,130)||!text(s.setup,90,1300)||!text(s.reveal,70,1250)
   ||!text(s.humanStake,65,1200)||!text(s.mechanism,100,1650)
   ||!text(s.countercase,65,1100)||!text(s.nextTest,55,1050)
   ||!refs(s.sourceIds,true))return null;
 }
 for(const item of r.watchlist){
  if(!item||typeof item!=="object"||Array.isArray(item))return null;
  const w=item as Record<string,unknown>;
  if(!text(w.event,8,120)||!text(w.when,5,100)||!text(w.question,35,480)
   ||!text(w.positiveCase,35,450)||!text(w.negativeCase,35,450)
   ||!refs(w.sourceIds,false))return null;
 }
 if(!r.crossMarket.every(v=>text(v,55,600)))return null;
 // The report may explain supplied figures, but must not create new values.
 // Reject numeric tokens not in the immutable source packet (apart from the as-of clock).
 const known=extractNumbers(evidence.sources.map(s=>[s.title,s.detail,s.eventAt].join(" ")).join(" ")+evidence.asOf);
 const candidate=JSON.stringify({...r,stories:r.stories.map((v:ReportStory)=>({...v,sourceIds:[]})),
  watchlist:r.watchlist.map((v:ReportWatch)=>({...v,sourceIds:[]}))});
 for(const n of extractNumbers(candidate)){if(!known.has(n))return null;}
 return r as AutomatedReportNarrative;
}
export function buildAutomaticReportModelPrompt(e:AutomaticReportEvidence){
 return JSON.stringify({
  instruction:"Return STRICT JSON only. You are Bluebelly's automated client market report writer. Produce a substantial chronological Shark Tank-like briefing (not TV dialogue). Explain catalysts, meaningful source-supported numerical comparisons, real human financial consequences, causal mechanics, strongest alternative, source-dated next test. British English, short readable paragraphs. Cite by sourceIds from the packet ONLY. No new prices, numerical claims, quotes, headlines, dates or URLs. No unsupported claim that a market move was caused by a catalyst. If reaction unknown say unknown. Calendar entries are upcoming questions, never reported outcomes. Write clear scenarios, not directional promises. Prefer depth on 2-4 genuine linked stories. Label gaps. For source limitations state the model interpretation is automated and not independently human reviewed. Minimum lengths are substantive, avoid padding. Return fields title,deck,executiveSummary,bigPicture,stories[{headline,setup,reveal,humanStake,mechanism,countercase,nextTest,sourceIds}],crossMarket[string],watchlist[{event,when,question,positiveCase,negativeCase,sourceIds}],concludingAssessment,limitations. Follow sources; do not infer current prices.",
  asOf:e.asOf,edition:e.slot,
  newsCoverage:e.sources.some(s=>s.type==="NEWS")?"SOURCE_QUALIFIED":"GAP_NO_RECENT_VERIFIED_NEWS",
  sources:e.sources,
 });
}
