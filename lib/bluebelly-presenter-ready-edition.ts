/**
 * Bluebelly owner Presenter — finished, read-aloud edition.
 * This composes ONLY data already passed by the existing NewsBrief / current
 * Dossier / completed-session source projection. No model, source acquisition,
 * Dossier mutation or inferred chart measurements.
 */
import type { TodayTalk, TalkPrice } from "./bluebelly-todays-talk.ts";
import type { DossierPresentationSelection } from "./dossier-v2/presentation-reader.ts";
import type { PresenterCheckItem } from "./presenter-technical-checks.ts";

export const READY_PRESENTER_EDITION_VERSION="bluebelly-presenter-ready/1" as const;
export type ChartDirection="bullish"|"bearish"|"inconclusive";
export type ReadyChart={
 id:string;symbol:string;timeframe:"4H"|"1D"|"1W";chartLabel:string;
 timeframeMeaning:string;sourceLine:string;
 bullish:string;bearish:string;inconclusive:string;
 higherTimeframe:string;observedCheckKey:string|null;
};
export type ReadySection={
 id:string;title:string;paragraphs:string[];
 sources:Array<{label:string;url:string;eventTime:string}>;
 evidenceIds:string[];
};
export type ReadyPresenterEdition={
 contractVersion:typeof READY_PRESENTER_EDITION_VERSION;
 asOf:string;title:string;status:"RESEARCH_BACKED"|"PARTIAL_RESEARCH"|"SOURCE_GAP";
 opening:string;sections:ReadySection[];charts:ReadyChart[];
 closing:string;sourceCount:number;creatorContext:"NOT_ADMITTED";
};

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const take=(v:unknown,n=900)=>typeof v==="string"?v.trim().slice(0,n):"";
const last=(v:string)=>v.replace(/[.!?]\s*$/,"");
function safeNews(talk:TodayTalk){
 return talk.news.filter(n=>n.label==="SOURCE_VERIFIED_NOT_CANONICAL" &&
  n.sourceUrl.startsWith("https://") &&
  Number.isFinite(Date.parse(n.occurredAt))).slice(0,3);
}
function sourceLine(card:TalkPrice|undefined):string {
 if(!card||card.status!=="OBSERVED"||!card.asOf)
  return "No sufficiently recent matching completed daily source observation; no numeric level or breakout is claimed.";
 const comparison=card.windows.find(w=>w.sessions===1);
 return card.label+" ("+card.symbol+"): "+card.level+" as of "+card.asOf+
  ". Previous completed session: "+(comparison?.text||"UNKNOWN")+
  ". Source: "+card.sourceName+(card.sourceUrl?" "+card.sourceUrl:"")+
  ". These are daily observations, not chart-indicator readings.";
}
type ChartIdentity="dxy"|"brent"|"spx";
const INSTRUMENTS:Record<ChartIdentity,{
 label:string;symbol:string;key:string;labelIntro:string;bullish4h:string;bearish4h:string;
 bullishDaily:string;bearishDaily:string;bullishWeekly:string;bearishWeekly:string;
 sideways:string;transmission:string;
}> = {
 dxy:{
  label:"Dollar index",symbol:"DXY",key:"dxy",
  labelIntro:"Dollar strength can change global funding conditions and the pressure on dollar-priced assets.",
  bullish4h:"If the four-hour DXY chart has reclaimed and held the EMA20 upper band on a completed candle, short-term dollar buyers have regained some control. That is a near-term move, not a weekly regime reversal.",
  bearish4h:"If the four-hour DXY chart has broken and remained below its EMA20 lower band on a completed candle, the short-term recovery is failing. I would not automatically extrapolate that into a multi-week dollar downtrend.",
  bullishDaily:"If the daily DXY candle closes above its EMA20 upper band and holds on the retest, this dollar rebound has become more than an intraday move. The next question is whether the bond market supports a persistent yield advantage.",
  bearishDaily:"If the daily DXY candle closes below its EMA20 lower band, the weakness carries across sessions. That would make a four-hour bounce less persuasive until buyers retake the daily band.",
  bullishWeekly:"If the weekly DXY trend structure also turns up, short- and long-horizon dollar strength may be aligning. I would still check the yield differential and JXY before treating it as a lasting regime shift.",
  bearishWeekly:"If the weekly DXY structure remains weak, a bullish four-hour or daily pattern can be a countertrend recovery rather than the start of a lasting dollar advance.",
  sideways:"If DXY is trapped inside the band or the candle has not closed, the chart is indecisive. I would explain the current macro drivers without calling a breakout.",
  transmission:"Dollar direction matters because it can ease or tighten the burden for borrowers outside the US and affect gold, yen crosses and risk appetite. The size and timing of those effects still need dated market observations.",
 },
 brent:{
  label:"Brent crude",symbol:"Brent",key:"brent",
  labelIntro:"Energy can transmit a supply shock into transport, refinery and household costs before the effect reaches inflation data.",
  bullish4h:"If Brent holds above its four-hour EMA20 upper band after a completed candle, traders are still paying up for near-term barrels. That is short-horizon momentum, not proof of a permanent supply shortage.",
  bearish4h:"If Brent breaks below its four-hour EMA20 lower band and fails to reclaim it, the immediate risk premium may be cooling. It does not prove that shipping or production conditions have normalised.",
  bullishDaily:"If Brent stays above its daily EMA20 band on closing prices, the supply-risk premium is persisting across sessions. That keeps fuel-sensitive companies and inflation expectations exposed.",
  bearishDaily:"If Brent closes below its daily EMA20 lower band, the market is starting to discount less immediate pressure. I would still look for independent supply and shipping confirmation before calling an end to the disruption.",
  bullishWeekly:"If the weekly Brent structure remains upward, the inflation and purchasing-power problem could outlast the short-term headlines. A four-hour pullback would then be a pause within a larger risk regime.",
  bearishWeekly:"If the weekly Brent structure weakens, a four-hour surge may be a temporary headline premium. That is materially different from a sustained multi-month energy shock.",
  sideways:"If Brent is inside the band, the chart does not settle whether supply risk is rising or fading. Physical flows and refinery data become the deciding evidence.",
  transmission:"Higher energy costs can squeeze transport and industrial margins, then feed into consumer prices. Lower crude can ease that pressure, but prices alone do not prove what happened to physical supply.",
 },
 spx:{
  label:"S&P 500",symbol:"SPX",key:"spx",
  labelIntro:"Equities discount earnings, interest rates and the willingness to bear risk, so an index move can reflect several mechanisms at once.",
  bullish4h:"If SPX recovers its four-hour trend band and keeps higher lows, buyers have regained the short-term initiative. I would still call it a rebound unless the daily chart also repairs its structure.",
  bearish4h:"If SPX rejects its four-hour band and loses the recent swing low, sellers control the immediate setup. That does not prove a lasting bear market while the weekly channel is still intact.",
  bullishDaily:"If SPX reclaims and closes above its daily trend band with broader participation, the recovery is gaining credibility. I would want more than a handful of index heavyweights to confirm it.",
  bearishDaily:"If SPX closes beneath its daily trend support and fails the retest, the downside argument extends beyond one weak session. Broadening credit or yield stress would strengthen the macro case, but must be checked separately.",
  bullishWeekly:"If the weekly log-channel and trend structure remain intact, a daily sell-off could still be a correction inside the larger advance.",
  bearishWeekly:"If the weekly log-channel fails on a completed candle and the retest is rejected, that is a much stronger structural warning than a four-hour dip.",
  sideways:"If price is oscillating inside the trend band, the technical evidence is mixed. I would frame both paths and wait for a completed close and participation data.",
  transmission:"Stocks may react to the combined effect of oil on costs, yields on valuations and actual earnings expectations. A coincident decline does not tell us which channel dominated.",
 },
};

function scenario(id:ChartIdentity,timeframe:ReadyChart["timeframe"],price:TalkPrice|undefined):ReadyChart{
 const spec=INSTRUMENTS[id];
 const timecode=timeframe==="4H"?"four-hour":timeframe==="1D"?"daily":"weekly";
 const label=timeframe==="1W"?"trend structure / rising log channel where applicable":
  id==="spx"?"EMA20 band and log-channel retest":
  "EMA20 ±1 standard-deviation band";
 const candidate=timeframe==="4H"&&id==="dxy"?"dxy-4h":
  timeframe==="1D"&&id==="dxy"?"dxy-1d":null;
 const bull=timeframe==="4H"?spec.bullish4h:timeframe==="1D"?spec.bullishDaily:spec.bullishWeekly;
 const bear=timeframe==="4H"?spec.bearish4h:timeframe==="1D"?spec.bearishDaily:spec.bearishWeekly;
 const meaning=timeframe==="4H"
  ?"Short-horizon timing, not proof of the daily or weekly regime."
  :timeframe==="1D"
   ?"Session-to-session structure; compare with the weekly regime."
   :"Broader regime context; a 4H reversal may remain countertrend.";
 return {id:id+"-"+timeframe.toLowerCase(),symbol:spec.symbol,timeframe,
  chartLabel:"[INSERT CHART: "+spec.symbol+" · "+timeframe+" · "+label+" · exact candle timestamp required]",
  timeframeMeaning:meaning,sourceLine:sourceLine(price),
  bullish:bull,bearish:bear,inconclusive:spec.sideways,
  higherTimeframe:timeframe==="4H"?"The daily and weekly charts still control the broader interpretation. "+spec.transmission:
    timeframe==="1D"?"The weekly trend can either reinforce or contradict this daily signal. "+spec.transmission:
    spec.labelIntro+" "+spec.transmission,
  observedCheckKey:candidate};
}
/** A saved owner reading is a presenter observation, NOT a market-data proof. */
export function presenterSavedBranch(
 check:PresenterCheckItem|undefined,
 timeframe:"4H"|"1D"|"1W",nowIso:string,
):ChartDirection|null{
 if(!check||timeframe==="1W"||!check.observedOn||!check.updatedAt)return null;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(check.observedOn))return null;
 const now=Date.parse(nowIso),observed=Date.parse(check.observedOn+"T00:00:00Z");
 const saved=Date.parse(check.updatedAt);
 const limit=timeframe==="4H"?3:8;
 if(![now,observed,saved].every(Number.isFinite)||observed>now||
   saved>now||saved<observed||now-observed>limit*86400000)return null;
 const technical=check.technical;
 if(["Holding uptrend","Upper-band break","Strengthening","Rising channel intact"].includes(technical))return "bullish";
 if(["Holding downtrend","Lower-band break","Weakening","Deteriorating","Rollover confirmed"].includes(technical))return "bearish";
 if(["Rangebound","Mixed"].includes(technical))return "inconclusive";
 return null;
}
export function buildReadyPresenterEdition(input:{
 talk:TodayTalk;dossierSelection:DossierPresentationSelection|null;
}):ReadyPresenterEdition{
 const {talk,dossierSelection:selection}=input;
 const news=safeNews(talk);
 const dossier=talk.dossier;
 const exact=selection?.presentation && dossier.status==="CURRENT_HEALTHY"&&
  selection.status==="current"&&!selection.presentation.health.degraded &&
  selection.presentation.dossierId===dossier.dossierId &&
  selection.presentation.asOf===dossier.asOf ?selection.presentation:null;
 // Only actually admitted evidence UUIDs attached to this immutable read model.
 const admitted=new Set(exact?.evidenceIndex.map(x=>x.evidenceId).filter(id=>UUID.test(id))||[]);
 const stories=(exact?.whatMattersNow.stories||[]).filter(story=>
   story.evidenceRefs.some(id=>admitted.has(id))).slice(0,2);
 const lead=news[0];
 const title=take(lead?.headline||dossier.headline||"Today's market: what is confirmed and what remains open",160);
 const opening=lead
  ?lead.headline+". "+lead.summary+
   " That is the confirmed report. The key question now is whether markets have priced a temporary disruption or something that lasts."
  :exact&&dossier.headline
   ?dossier.headline+". "+dossier.answer+
    " This is the latest source-linked Dossier assessment. There is no qualifying fresh report to claim as a new catalyst."
   :"There is not enough fresh, independently qualified material for a confident market lead today. We can still examine the dated charts, but I will not invent an overnight catalyst.";
 const sections:ReadySection[]=[];
 if(news.length){
  sections.push({id:"reported",title:"Act 1 — The events and why they matter",
   paragraphs:news.map((n,i)=>(i===0?"First, ":"Also, ")+n.summary+
    " This was reported by "+n.sourceName+" on "+n.occurredAt+
    ". It establishes the reported event, not an event-window market reaction."),
   sources:news.map(n=>({label:n.sourceName+" — "+n.headline,url:n.sourceUrl,eventTime:n.occurredAt})),
   evidenceIds:[]});
 }
 if(exact){
  const paragraphs=[
   dossier.answer||"",
   ...stories.map(story=>[take(story.whatChanged,750),
    take(story.whyItMatters,750),take(story.mechanism,850),
    take(story.conclusion,600)].filter(Boolean).join(" ")),
   ...stories.map(story=>story.whatWouldChangeMind?
    "The countercase for "+story.title+" is: "+take(story.whatWouldChangeMind,500):""),
  ].filter(Boolean);
  sections.push({id:"mechanism",title:"Act 2 — The bigger picture and the transmission",
   paragraphs:paragraphs.length?paragraphs:[
    "The latest Dossier is source-linked, but its detailed Story mechanism is not available in this read model."],
   sources:[],evidenceIds:stories.length?
    [...new Set(stories.flatMap(story=>story.evidenceRefs.filter(id=>admitted.has(id))))].slice(0,14):
    dossier.evidenceRefs.filter(id=>admitted.has(id)).slice(0,14)});
 }
 const observed=talk.prices.filter(p=>p.status==="OBSERVED"&&p.asOf).slice(0,4);
 if(observed.length){
  sections.push({id:"priced",title:"Act 3 — What the completed trading sessions show",
   paragraphs:observed.map(p=>{
    const changes=p.windows.map(w=>w.sessions+"-session "+w.text).join("; ");
    return "On the source-dated daily series, "+p.label+" stood at "+p.level+
     " on "+p.asOf+". The separate comparisons are "+changes+
     ". These numbers describe trading sessions. They do not identify which event caused the move.";
   }),sources:observed.flatMap(p=>p.sourceUrl?
    [{label:p.sourceName+" — "+p.label,url:p.sourceUrl,eventTime:p.asOf||""}]:[]),evidenceIds:[]});
 }
 if(!sections.length)sections.push({id:"coverage",title:"Act 1 — What the evidence cannot settle",
  paragraphs:["There is no sufficiently fresh verified news or current source-linked Dossier narrative to support a market-led opening. Rather than fill the gap with another creator's opinion, today's edition keeps the chart possibilities conditional."],
  sources:[],evidenceIds:[]});
 const cards=new Map(talk.prices.map(p=>[p.id,p]));
 const charts=(["dxy","brent","spx"] as const).flatMap(id=>
  (["4H","1D","1W"] as const).map(tf=>scenario(id,tf,cards.get(id))));
 const closing=(dossier.status==="CURRENT_HEALTHY"&&dossier.whatWouldChangeMind
  ?"The main change-of-mind condition in the current Dossier is: "+dossier.whatWouldChangeMind+". "
  :"The larger thesis remains unconfirmed until the next original-source test. ")+
  "For the charts, start with the completed four-hour setup, judge the daily close, then check whether the weekly regime supports or contradicts it. Those are conditional scripts until an actual chart has been inspected.";
 return {
  contractVersion:READY_PRESENTER_EDITION_VERSION,asOf:talk.asOf,title,
  status:exact?(news.length?"RESEARCH_BACKED":"PARTIAL_RESEARCH")
    :news.length?"PARTIAL_RESEARCH":"SOURCE_GAP",
  opening,sections,charts,closing,sourceCount:news.length+observed.filter(p=>p.sourceUrl).length,
  creatorContext:"NOT_ADMITTED",
 };
}
export function readyPresenterCopy(edition:ReadyPresenterEdition,
 choices:Record<string,ChartDirection|null>={}):string{
 return [
  edition.title,edition.status+" · "+edition.asOf,
  "OPENING\n"+edition.opening,
  ...edition.sections.map(s=>s.title+"\n"+s.paragraphs.join("\n\n")+
   (s.sources.length?"\nSources:\n"+s.sources.map(x=>x.label+": "+x.url+" ("+x.eventTime+")").join("\n"):"")+
   (s.evidenceIds.length?"\nDossier evidence UUIDs: "+s.evidenceIds.join(", "):"")),
  "CHART INSERTIONS AND SELECTED SPOKEN VARIANTS",
  ...edition.charts.map(c=>c.chartLabel+"\n"+
   (choices[c.id]?c[choices[c.id]!]:"NO OBSERVED BRANCH SELECTED. "+
    c.inconclusive)+"\n"+c.higherTimeframe+"\n"+c.sourceLine),
  "THE CONCLUSION\n"+edition.closing,
  "Creator commentary is not integrated as verified market evidence in this edition.",
 ].join("\n\n");
}
