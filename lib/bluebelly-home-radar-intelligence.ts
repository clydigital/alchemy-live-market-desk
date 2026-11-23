import type {NewsBriefV1} from "./market-brief-news.ts";
import type {PublicMarketObservation} from "./blue-desk-public-markets.ts";
import type {MarketDivergenceRead} from "./bluebelly-market-divergence-watch.ts";
import type {CreatorDigest} from "./bluebelly-creator-signals.ts";
import {selectMeasuredMarketSignals} from "./bluebelly-measured-market-signals.ts";

/** Prioritisation for the HOMEPAGE research radar. This is a reader projection,
 * NOT a verified causal link, statistical outlier detector or Regime scorer.
 * Private creator material may be supplied ONLY after its existing owner gate. */
export type HomeRadarKind="NEWS"|"BIG_MOVE"|"DIVERGENCE"|"CREATOR";
export type HomeRadarPulse=Readonly<{
 id:string;kind:HomeRadarKind;title:string;summary:string;why:string;
 observedAt:string;clockLabel:string;statusLabel:string;
 href:string;sourceUrl:string|null;sourceLabel:string|null;rank:number;
}>;
export type HomeRadarRead=Readonly<{
 generatedAt:string;windowStart:string;windowEnd:string;
 items:HomeRadarPulse[];
 newsCount:number;moveCount:number;divergenceCount:number;creatorCount:number;
 creatorAccess:"OWNER_REVIEWED"|"PRIVATE_LOCKED"|"NO_RECENT_REVIEWED";
}>;

const DAY=86_400_000;
const SHORT=48*3_600_000;
const HTTPS=(raw:string|null|undefined):raw is string=>{
 if(!raw)return false;
 try{const u=new URL(raw);return u.protocol==="https:"&&!u.username&&!u.password&&u.hostname.includes(".");}catch{return false;}
};
function ago(raw:string,now:number,max:number):number|null {
 const n=Date.parse(raw);
 return Number.isFinite(n)&&n<=now&&n>=now-max?now-n:null;
}
function clean(text:string,max:number){
 const s=text.replace(/\s+/g," ").trim();
 return s.length<=max?s:s.slice(0,max-1).replace(/\s+\S*$/,"")+"…";
}
function newsImportance(headline:string,summary:string,sourceKind:string):number{
 const text=(headline+" "+summary).toLowerCase();
 // Deterministic presentation ordering, NOT market-impact modelling.
 let value=sourceKind==="official"||sourceKind==="filing"?18:sourceKind==="primary"?12:5;
 if(/\b(?:pce|cpi|fed|fomc|treasury|inflation|employment|jobs|rates)\b/.test(text))value+=12;
 if(/\b(?:earnings|guidance|profit|cash flow|nvidia|ai|credit|liquidity)\b/.test(text))value+=10;
 if(/\b(?:oil|gas|hormuz|tariff|bank|cyber|shipping|sanction)\b/.test(text))value+=7;
 return value;
}
const marketClass=(row:PublicMarketObservation)=>{
 const type=row.type;
 if(type==="Rates")return {threshold:10,label:"10 bp",group:"rates"};
 if(type==="FX")return {threshold:1,label:"1%",group:"fx"};
 if(type==="Energy")return {threshold:2.5,label:"2.5%",group:"energy"};
 if(type==="Metal")return {threshold:1.7,label:"1.7%",group:"metals"};
 if(type==="AI / Semis"||type==="MAG7"||type==="US Stock"||type==="Europe Stock")return {threshold:4,label:"4%",group:"ai"};
 return {threshold:2,label:"2%",group:"equities"};
};
function sourceSessionAge(raw:string|null,nowMs:number):number|null{
 if(!raw)return null;
 // The daily close may be represented as YYYY-MM-DD only. In that case,
 // measure from midnight UTC of the recorded session and DISPLAY that day.
 const day=/^\d{4}-\d{2}-\d{2}$/.test(raw)?raw+"T00:00:00Z":raw;
 return ago(day,nowMs,4*DAY);
}
function newsPulses(news:readonly NewsBriefV1[],nowMs:number,hostPrefix:string):HomeRadarPulse[]{
 const seen=new Set<string>();
 return news.flatMap((row)=>{
  if(row.verification!=="SOURCE_VERIFIED"||!HTTPS(row.sourceUrl))return [];
  const age=ago(row.occurredAt,nowMs,DAY);
  if(age===null||!row.headline||seen.has(row.sourceUrl))return [];
  seen.add(row.sourceUrl);
  return [{
   id:"news:"+row.id,kind:"NEWS" as const,title:clean(row.headline,106),
   summary:clean(row.summary,210),
   why:"Source-verified development in the last 24 hours. Its market impact still requires independent price evidence.",
   observedAt:row.occurredAt,clockLabel:"EVENT · LAST 24H",
   statusLabel:"SOURCE VERIFIED",href:hostPrefix+"/key-stories?news="+encodeURIComponent(row.id),
   sourceUrl:row.sourceUrl,sourceLabel:row.sourceName,
   rank:105+newsImportance(row.headline,row.summary,row.sourceKind)-age/DAY*12,
  }];
 }).sort((a,b)=>b.rank-a.rank||b.observedAt.localeCompare(a.observedAt)).slice(0,3);
}
function movePulses(market:readonly PublicMarketObservation[],nowMs:number,hostPrefix:string):HomeRadarPulse[]{
 const seen=new Set<string>();
 const items:HomeRadarPulse[]=[];
 for(const row of market){
  if(row.frequency!=="daily"||row.dataStatus==="UNAVAILABLE_OR_STALE"||row.change===null||
    !Number.isFinite(row.change)||!HTTPS(row.sourceUrl)||sourceSessionAge(row.asOf,nowMs)===null)continue;
  const definition=marketClass(row);
  if(row.changeUnit!==(row.type==="Rates"?"bp":"%"))continue;
  if(Math.abs(row.change)<definition.threshold||seen.has(row.symbol))continue;
  seen.add(row.symbol);
  const value=(row.change>0?"+":"")+row.change.toFixed(2)+(row.changeUnit==="bp"?" bp":"%");
  const age=sourceSessionAge(row.asOf,nowMs)!;
  items.push({
   id:"move:"+row.id,kind:"BIG_MOVE",title:row.symbol+" "+value+" · "+clean(row.label,72),
   summary:"Observed "+(row.change>0?"increase":row.change<0?"decline":"unchanged")+" over the last available daily trading session.",
   why:"Large daily price change by a presentation threshold ("+definition.label+"); NOT proof of a statistically unusual move or the news that caused it.",
   observedAt:row.asOf!,clockLabel:"LAST RECORDED SESSION",statusLabel:"MEASURED PRICE MOVE",
   href:hostPrefix+"/markets?group="+definition.group,
   sourceUrl:row.sourceUrl,sourceLabel:row.sourceName,
   rank:90+Math.min(30,Math.abs(row.change)/definition.threshold*9)-age/(4*DAY)*10,
  });
 }
 return items.sort((a,b)=>b.rank-a.rank||a.id.localeCompare(b.id)).slice(0,3);
}
function divergencePulses(
 readings:readonly MarketDivergenceRead[],now:Date,hostPrefix:string,
):HomeRadarPulse[]{
 const selected=selectMeasuredMarketSignals(readings,"1D",now,3);
 return selected.map(row=>({
  id:"divergence:"+row.id,kind:"DIVERGENCE",title:clean(row.title,90),
  summary:row.left+" "+(row.leftChange>0?"+":"")+row.leftChange.toFixed(2)+"% vs "+
   row.right+" "+(row.rightChange>0?"+":"")+row.rightChange.toFixed(2)+
   "% · gap "+(row.gapPp>0?"+":"")+row.gapPp.toFixed(2)+" pp.",
  why:row.question+" "+row.nextTest+" Matched returns are not proof of causal decoupling.",
  observedAt:row.sourceSession,clockLabel:"MATCHED 1D SESSION",
  statusLabel:row.status==="OPPOSITE_MOVE"?"OPPOSITE MOVES":"RELATIVE GAP",
  href:hostPrefix+"/markets?mode=compare&window=1D#divergence-watch",
  sourceUrl:row.leftSourceUrl,sourceLabel:row.left+" / "+row.right+" original observations",
  rank:(row.status==="OPPOSITE_MOVE"?121:106)+Math.min(15,Math.abs(row.gapPp)*2),
 })).slice(0,2);
}
function creatorPulses(
 digest:CreatorDigest|null|undefined,nowMs:number,hostPrefix:string,
):HomeRadarPulse[]{
 if(!digest||ago(digest.generatedAt,nowMs,72*3_600_000)===null)return [];
 const candidates:HomeRadarPulse[]=[];
 for(const creator of digest.creators){
  const age=creator.publishedAt?ago(creator.publishedAt,nowMs,72*3_600_000):null;
  if(age===null||!["reviewed","handoff_reviewed"].includes(creator.sourceStatus)||
    !creator.videoId||!/^[\w-]{11}$/.test(creator.videoId))continue;
  const view=creator.views.find(v=>v.signals.length>0);
  if(!view)continue;
  const video="https://www.youtube.com/watch?v="+creator.videoId;
  candidates.push({
   id:"creator:"+creator.videoId,kind:"CREATOR",
   title:clean(creator.publisher+" · "+view.asset+" "+view.bias.toLowerCase()+" thesis",102),
   summary:clean(view.signals[0],200),
   why:"Analyst-reviewed transcript interpretation, not an independently verified market fact. Horizon: "+view.horizon+". Compare against dated price, rates and original releases.",
   observedAt:creator.publishedAt!,clockLabel:"ORIGINAL VIDEO DATE",
   statusLabel:"ATTRIBUTED · REVIEWED",
   href:video,sourceUrl:hostPrefix+"/my-reports",sourceLabel:"Private reviewed digest",
   rank:100-age/(72*3_600_000)*8,
  });
 }
 return candidates.sort((a,b)=>b.rank-a.rank||a.id.localeCompare(b.id)).slice(0,2);
}

/** Mandatory input source gates: news source-verified, market direct dated
 * public projection, independently admitted divergence, and owner-gated digest.
 * News is scoped to rolling 24h. Session comparisons may be older (e.g. weekend)
 * but ALWAYS show their separate observation clock. */
export function projectHomeRadar(input:{
 now:Date;news:readonly NewsBriefV1[];market:readonly PublicMarketObservation[];
 divergences:readonly MarketDivergenceRead[];creatorDigest?:CreatorDigest|null;
 creatorIsAuthorised?:boolean;hostPrefix?:string;
}):HomeRadarRead{
 const {now,news,market,divergences,creatorDigest=null,creatorIsAuthorised=false,hostPrefix=""}=input;
 const t=now.getTime();
 if(!Number.isFinite(t))throw new Error("Radar requires a valid source clock.");
 const newsItems=newsPulses(news,t,hostPrefix);
 const moveItems=movePulses(market,t,hostPrefix);
 const divergenceItems=divergencePulses(divergences,now,hostPrefix);
 const creatorItems=creatorIsAuthorised?creatorPulses(creatorDigest,t,hostPrefix):[];
 const items=[...newsItems,...moveItems.slice(0,2),...divergenceItems,...creatorItems]
   .sort((a,b)=>b.rank-a.rank||a.id.localeCompare(b.id)).slice(0,9);
 return {generatedAt:now.toISOString(),windowStart:new Date(t-DAY).toISOString(),
  windowEnd:now.toISOString(),items,newsCount:newsItems.length,moveCount:moveItems.length,
  divergenceCount:divergenceItems.length,creatorCount:creatorItems.length,
  creatorAccess:!creatorIsAuthorised?"PRIVATE_LOCKED":creatorItems.length?"OWNER_REVIEWED":"NO_RECENT_REVIEWED"};
}
