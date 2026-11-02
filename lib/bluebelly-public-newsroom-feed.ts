import {blueDeskPublicHref} from "./blue-desk-host";
import type {NewsBriefV1} from "./market-brief-news";
import type {ArchiveNewsItem} from "./bluebelly-publication-archive";
import type {NewsroomEditorialItem} from "./bluebelly-newsroom-editorial";
import {projectNewsroomEditorial} from "./bluebelly-newsroom-editorial";
import {recentBankDecisions} from "./bluebelly-bank-decision-snapshots";
import {recentReportedEditorial} from "./bluebelly-reported-editorial";
import {selectPostEventRecaps} from "./bluebelly-post-event-recap";
import {weekAheadNewsroomEditorial} from "./bluebelly-week-ahead-newsroom";
import {currentReviewedPublicFocus} from "./bluebelly-reviewed-public-focus";
import {OCT30_SELL_OFF,oct30SelloffIsLead} from "./bluebelly-oct30-tech-selloff";

/** The *same* read-only Newsroom editorial admission on Today and Newsroom.
 * Source attribution and review status are not upgraded here.
 * No new publisher, task, model, source verification or private data access.
 */
export function publicNewsroomEditorials(
 news:readonly NewsBriefV1[],now:Date,host:string|null,
):NewsroomEditorialItem[]{
 const reader=blueDeskPublicHref("/blue-desk/key-stories",host);
 const result=projectNewsroomEditorial(
  recentBankDecisions(now,168),recentReportedEditorial(now,168),
  selectPostEventRecaps(news,now,8),reader,now,
 );
 result.push(...weekAheadNewsroomEditorial(now,blueDeskPublicHref("/blue-desk/newsroom/week-ahead",host)));
 for(const focus of currentReviewedPublicFocus(now))result.push({
  id:focus.id,headline:focus.headline,summary:focus.fact,
  occurredAt:focus.eventDay,sourceName:focus.sourceName,
  sourceUrl:focus.sourceUrl,readerHref:reader+focus.href,
  topics:[...focus.topics],verificationLabel:"REVIEWED EDITORIAL · PROPOSAL NOT AGREEMENT",
  why:focus.mechanism,nextTest:focus.test,kind:"reported",
 });
 if(oct30SelloffIsLead(now))result.unshift({
  id:OCT30_SELL_OFF.id,headline:OCT30_SELL_OFF.headline,
  summary:OCT30_SELL_OFF.fact+" "+OCT30_SELL_OFF.why,
  occurredAt:OCT30_SELL_OFF.occurredAt,
  sourceName:OCT30_SELL_OFF.sourceName,sourceUrl:OCT30_SELL_OFF.sourceUrl,
  readerHref:reader+OCT30_SELL_OFF.href,topics:["ai","earnings"],
  verificationLabel:"DATED EDITORIAL · REPORTED INTRADAY",
  why:OCT30_SELL_OFF.mechanism,nextTest:OCT30_SELL_OFF.test,kind:"reported",
 });
 return result;
}

export type TodayNewsroomItem={
 id:string;headline:string;summary:string;readerHref:string;
 sourceName:string;sourceUrl:string;sourceAt:string;label:string;
};

function validSource(url:string):boolean{
 try{const u=new URL(url);return u.protocol==="https:"&&!u.username&&!u.password;}catch{return false;}
}
function validInternal(href:string):boolean{
 return href.startsWith("/")&&!href.startsWith("//")&&!href.includes("\\");
}
/** Latest *published/publicly readable* Newsroom items, never research drafts.
 * Newsroom and Today share the editorial projector; archived and original
 * reports are the same public projections shown in the Newsroom reader.
 * A source date is never misrepresented as a precise publication clock.
 */
export function selectTodayNewsroomItems(
 news:readonly NewsBriefV1[],archive:readonly ArchiveNewsItem[],
 editorials:readonly NewsroomEditorialItem[],now:Date,host:string|null,limit=5,
):TodayNewsroomItem[]{
 const time=+now,day=86400000;
 if(!Number.isFinite(time)||!Number.isInteger(limit)||limit<1||limit>6)return [];
 const editorialSources=new Set(editorials.map(x=>x.sourceUrl));
 const archiveSources=new Set(archive.map(x=>x.sourceUrl));
 const entries:TodayNewsroomItem[]=[];
 for(const item of editorials){
  if(!validInternal(item.readerHref)||!validSource(item.sourceUrl))continue;
  entries.push({id:"editorial:"+item.id,headline:item.headline,summary:item.summary,
   readerHref:item.readerHref,sourceName:item.sourceName,sourceUrl:item.sourceUrl,
   sourceAt:item.occurredAt,label:item.verificationLabel});
 }
 for(const item of archive){
  if(editorialSources.has(item.sourceUrl)||!validSource(item.sourceUrl))continue;
  entries.push({id:"archive:"+item.id,headline:item.headline,summary:"",
   readerHref:blueDeskPublicHref(item.readerHref,host),
   sourceName:item.sourceName,sourceUrl:item.sourceUrl,
   sourceAt:item.eventAt||item.eventDay||"",label:item.verificationLabel});
 }
 for(const item of news){
  if(item.verification!=="SOURCE_VERIFIED"||!validSource(item.sourceUrl)||
   editorialSources.has(item.sourceUrl)||archiveSources.has(item.sourceUrl))continue;
  entries.push({id:"news:"+item.id,headline:item.headline,summary:item.summary,
   readerHref:blueDeskPublicHref("/blue-desk/key-stories",host)+"?news="+encodeURIComponent(item.id),
   sourceName:item.sourceName,sourceUrl:item.sourceUrl,
   sourceAt:item.occurredAt,label:"SOURCE-VERIFIED NEWS"});
 }
 const seen=new Set<string>();
 return entries.map((entry,index)=>({...entry,index,at:Date.parse(entry.sourceAt)}))
  .filter(e=>Number.isFinite(e.at)&&e.at<=time&&time-e.at<=7*day)
  .sort((a,b)=>b.at-a.at||a.index-b.index)
  .filter(e=>{
   if(seen.has(e.readerHref))return false;
   seen.add(e.readerHref);return true;
  }).slice(0,limit).map(({index,at,...entry})=>entry);
}
