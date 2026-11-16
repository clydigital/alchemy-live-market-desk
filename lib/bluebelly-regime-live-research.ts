import {REGIME_LENS_WORKBOOKS} from "./bluebelly-regime-lens-workbook.ts";
import type {EditorialRegimeId} from "./bluebelly-editorial-architecture.ts";
import type {NewsBriefV1} from "./market-brief-news.ts";
import type {PublicSourceObservation} from "./blue-desk-source-observations-projector.ts";
import type {PublicMacroPulseBrief} from "./blue-desk-macropulse-brief.ts";
import type {TopicInfluenceRead} from "./bluebelly-topic-influence.ts";
import type {PublicMarketObservation} from "./blue-desk-public-markets.ts";
import type {RegimeMeterReading} from "./bluebelly-regime-market-meter.ts";
import type {RegimeDirectionId} from "./bluebelly-regime-direction-reads.ts";
import {lensCardSignal,type LensCardSignal} from "./bluebelly-regime-lens-card-signal.ts";

const DAY=86400000;
type Receipt={id:string;title:string;detail:string;at:string;source:string;url:string};
export type LiveLensResearch={facts:Receipt[];briefs:Receipt[];leads:Receipt[];partial:boolean};
function recent(at:string,now:Date,days:number){const age=now.getTime()-Date.parse(at);return Number.isFinite(age)&&age>=0&&age<=days*DAY;}
function safeUrl(url:string|null):url is string{try{const u=new URL(url||"");return u.protocol==="https:"&&!u.username&&!u.password;}catch{return false;}}
function unique(items:Receipt[],limit=3){
 const seen=new Set<string>();
 return items.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).filter(i=>{
  const key=i.url+"|"+i.title.toLowerCase();if(seen.has(key))return false;seen.add(key);return true;
 }).slice(0,limit);
}
/** Read-time topical fanout of existing public-qualified records, NOT a new harvest or a verdict mutation. */
export function projectLiveLensResearch(id:EditorialRegimeId,news:readonly NewsBriefV1[],observations:readonly PublicSourceObservation[]|null,
 briefs:readonly PublicMacroPulseBrief[],influence:TopicInfluenceRead|null,now:Date,partial=false):LiveLensResearch{
 const pattern=REGIME_LENS_WORKBOOKS[id].sourcePattern;
 const facts:Receipt[]=[];
 for(const n of news){
  if(n.verification!=="SOURCE_VERIFIED"||!recent(n.occurredAt,now,7)||!recent(n.observedAt,now,7)||Date.parse(n.observedAt)<Date.parse(n.occurredAt)||!safeUrl(n.sourceUrl)||!pattern.test(n.headline+" "+n.summary))continue;
  facts.push({id:n.id,title:n.headline,detail:n.summary,at:n.occurredAt,source:n.sourceName,url:n.sourceUrl});
 }
 for(const o of observations??[]){
  if(!recent(o.eventAt,now,2)||!safeUrl(o.sourceUrl)||!pattern.test(o.description))continue;
  facts.push({id:o.id,title:o.description,detail:"",at:o.eventAt,source:o.sourceName,url:o.sourceUrl});
 }
 const context:Receipt[]=[];
 for(const b of briefs){
  if(b.verification_label!=="RESEARCH_DERIVED_UNADJUDICATED"||!recent(b.source_published_at,now,7)||!recent(b.published_at,now,7)||!pattern.test(b.headline+" "+b.what_changed))continue;
  const link=b.source_links?.find(l=>l.kind!=="SOCIAL_LEAD"&&safeUrl(l.url));if(!link)continue;
  context.push({id:b.id,title:b.headline,detail:b.what_changed,at:b.source_published_at,source:link.label,url:link.url});
 }
 const leads=(influence?[...influence.x,...influence.creators]:[]).filter(l=>l.verification==="UNVERIFIED_LEAD"&&recent(l.publishedAt,now,l.source==="X"?2:14)&&safeUrl(l.url))
  .map(l=>({id:l.id,title:l.title,detail:l.reason,at:l.publishedAt,source:l.sourceName,url:l.url}));
 return {facts:unique(facts),briefs:unique(context),leads:unique(leads),partial:partial||observations===null||!influence||influence.xState==="UNAVAILABLE"||influence.creatorState==="UNAVAILABLE"};
}

const EXTRA:Partial<Record<EditorialRegimeId,{ids:string[];scope:string;name:string;directional:"price"|"rate"|"neutral"}>>={
 china:{ids:["csi300"],scope:"China A-share ETF price only · not compute competitiveness",name:"China equity proxy",directional:"price"},
 yen:{ids:["usdjpy"],scope:"USDJPY only · not proof of carry liquidation",name:"USDJPY",directional:"neutral"},
 gold:{ids:["gold","gold-proxy"],scope:"Gold price only · not reserve purchases",name:"Gold price proxy",directional:"price"},
 housing:{ids:["us10y-fred"],scope:"10Y Treasury financing proxy · not mortgage rates or home sales",name:"Housing financing proxy",directional:"rate"},
};
export function liveLensSignal(id:EditorialRegimeId,readings:Record<RegimeDirectionId,RegimeMeterReading>,rows:readonly PublicMarketObservation[],now:Date):LensCardSignal{
 const extra=EXTRA[id];if(!extra)return lensCardSignal(id,readings);
 const row=extra.ids.map(key=>rows.find(r=>r.id===key)).find(r=>r&&r.frequency==="daily"&&r.dataStatus!=="UNAVAILABLE_OR_STALE"&&r.asOf&&recent(r.asOf,now,6)&&safeUrl(r.sourceUrl)&&r.last!==null&&Number.isFinite(r.last)&&r.change!==null&&Number.isFinite(r.change));
 if(!row||row.change===null)return {tone:"unknown",label:"No dated market direction",scope:extra.scope,readout:"INSUFFICIENT / STALE",sourceDate:null,dateNote:"Review evidence inside"};
 const n=row.change,word=n>0?"rising":n<0?"falling":"flat";
 const tone=n===0||extra.directional==="neutral"?"mixed":(extra.directional==="rate"?n<0:n>0)?"improving":"pressure";
 return {tone,label:extra.name+" "+word,scope:extra.scope,readout:"1D · "+(n>0?"+":"")+n.toFixed(row.changeUnit==="bp"?1:2)+(row.changeUnit==="bp"?" bp":"%"),sourceDate:row.asOf,dateNote:"SOURCE SESSION"};
}
