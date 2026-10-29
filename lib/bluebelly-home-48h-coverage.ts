import type {NewsBriefV1} from "./market-brief-news";
import type {PublicSourceObservation} from "./blue-desk-source-observations-projector";

/** The whole rolling two-day window, never a midnight-only 'today' gate. */
export const HOMEPAGE_SOURCE_WINDOW_MS=48*60*60*1000;
export type HomeSourceItem=
 |{kind:"NEWS";id:string;at:string;sourceUrl:string;news:NewsBriefV1}
 |{kind:"OBSERVATION";id:string;at:string;sourceUrl:string;observation:PublicSourceObservation};
export type HomeSourceCoverage={
 lead:HomeSourceItem[];feed:HomeSourceItem[];
 newsCount:number;observationCount:number;
};
/** 
 * Prioritise individually source-verified announcements; fill remaining
 * story slots with separately-labelled dated measurements, never false news.
 * Dedupe exact original document URLs across both streams while retaining
 * separate measurements from separate original documents.
 */
export function curateHomeSourceCoverage(
 news:readonly NewsBriefV1[],
 observations:readonly PublicSourceObservation[],
 now=new Date(),
 leadCount=5,
):HomeSourceCoverage{
 const cutoff=now.getTime()-HOMEPAGE_SOURCE_WINDOW_MS;
 const eligible=(value:string)=>{
  const t=Date.parse(value);
  return Number.isFinite(t)&&Number.isFinite(now.getTime())&&t>=cutoff&&t<=now.getTime();
 };
 const urls=new Set<string>();
 const distinct=(url:string)=>{
  try {
   const u=new URL(url);
   if(u.protocol!=="https:"||u.username||u.password|| (u.pathname==="/"&&!u.search))return false;
   const key=u.origin+u.pathname.replace(/\/$/,"")+u.search;
   if(urls.has(key))return false;
   urls.add(key);
   return true;
  }catch{return false;}
 };
 const sortedNews=news.filter(n=>n.verification==="SOURCE_VERIFIED"&&eligible(n.occurredAt))
  .sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt))
  .filter(n=>distinct(n.sourceUrl)).map(n=>({
   kind:"NEWS" as const,id:n.id,at:n.occurredAt,sourceUrl:n.sourceUrl,news:n,
  }));
 const sortedObservations=observations.filter(o=>eligible(o.eventAt))
  .sort((a,b)=>Date.parse(b.eventAt)-Date.parse(a.eventAt))
  .filter(o=>distinct(o.sourceUrl)).map(o=>({
   kind:"OBSERVATION" as const,id:o.id,at:o.eventAt,sourceUrl:o.sourceUrl,observation:o,
  }));
 const items:HomeSourceItem[]=[...sortedNews,...sortedObservations];
 const max=Math.min(Math.max(0,leadCount),5);
 // Show editorial source-verified news first, but fill every available slot with
 // a visibly different ORIGINAL RELEASE / DATED MARKET DATA tile.
 return {lead:items.slice(0,max),feed:items.slice(max),
  newsCount:sortedNews.length,observationCount:sortedObservations.length};
}
