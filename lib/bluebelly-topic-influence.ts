import {X_CORE_ROSTER,normaliseXPostUrl} from "./x-sweep-core.ts";
import {rankXWireMarketCandidates} from "./x-wire-market-candidates.ts";
import type {XWireDurable} from "./x-wire-durable.ts";

/** Display-only discovery, not independent verification or a canonical Regime mutation. */
export type InfluenceTopic="hormuz"|"ai";
export type InfluenceLead={
 id:string;
 source:"X"|"CREATOR";
 sourceName:string;
 url:string;
 title:string;
 excerpt:string;
 publishedAt:string;
 reviewedAt:string|null;
 nextCheck:string;
 verification:"UNVERIFIED_LEAD";
};
export type InfluenceSourceState="AVAILABLE"|"EMPTY"|"UNAVAILABLE";
export type TopicInfluenceRead={
 topic:InfluenceTopic;
 checkedAt:string;
 xState:InfluenceSourceState;
 creatorState:InfluenceSourceState;
 x:InfluenceLead[];
 creators:InfluenceLead[];
};
export type XInfluenceRow={
 post_id:string;handle:string;original_url:string;published_at:string;
 retrieved_at:string|null;body:string;intake_status:string;
};
export type CreatorInfluenceRow={
 external_id:string|null;publisher:string;title:string;url:string;
 published_at:string;transcript_interpreted_at:string|null;
 transcript_status:string|null;video_review_status:string|null;
 recontextualized_summary:string|null;summary:string|null;
 claim_checks:unknown;
};
const DAY=86400000;
const THEMES:Record<InfluenceTopic,RegExp>={
 hormuz:/\b(?:hormuz|strait of hormuz|iran|iranian|tehran|persian gulf|gulf of oman|ceasefire|doha talks|qatar mediation|shipping blockade)\b/i,
 ai:/\b(?:artificial intelligence|ai|nvidia|nvda|semiconductor|hyperscaler|gpu|hbm|coreweave|crwv|data cent(?:re|er)|aws|azure|google cloud|ai capex|compute financing)\b/i,
};
const CHECKS:Record<InfluenceTopic,string>={
 hormuz:"Check original diplomatic or maritime notices, then dated vessel crossings, security and fuel-market readings.",
 ai:"Check dated issuer filings, demand, capex, operating cash flow, debt and the relevant market tape.",
};
const APPROVED_CREATORS=new Set(["stockedup","wall street truthbombs","fx evolution","tradernick"]);
const ALLOWED_X=new Set(X_CORE_ROSTER.map(row=>row.handle.toLowerCase()));
const clean=(v:unknown,max=240)=>typeof v==="string"?v.replace(/\s+/g," ").trim().slice(0,max):"";
function validDate(value:string|null|undefined,now:Date,maxAgeMs:number):boolean{
 if(!value)return false;
 const date=Date.parse(value),current=now.getTime();
 return Number.isFinite(date)&&date<=current+300000&&date>=current-maxAgeMs;
}
function videoSource(url:string,id:string):boolean{
 if(!/^[A-Za-z0-9_-]{11}$/.test(id))return false;
 try{
  const u=new URL(url);
  if(u.protocol!=="https:"||u.username||u.password||u.port)return false;
  if(["www.youtube.com","youtube.com","m.youtube.com"].includes(u.hostname))
   return u.pathname==="/watch"&&u.searchParams.get("v")===id;
  return u.hostname==="youtu.be"&&u.pathname==="/"+id;
 }catch{return false;}
}
function selectedClaim(value:unknown,pattern:RegExp):{claim:string;target:string}|null{
 if(!Array.isArray(value))return null;
 for(const raw of value.slice(0,10)){
  if(!raw||typeof raw!=="object"||Array.isArray(raw))continue;
  const row=raw as Record<string,unknown>;
  const claim=clean(row.claim,260),target=clean(row.verificationTarget,250);
  if(pattern.test(claim+" "+target)&&claim)return {claim,target};
 }
 return null;
}
/** Repeatable, bounded source projection. A video being discovered is NOT a completed transcript. */
export function projectTopicInfluence(
 topic:InfluenceTopic,xRows:readonly XInfluenceRow[],videoRows:readonly CreatorInfluenceRow[],
 now=new Date(),xState:InfluenceSourceState="AVAILABLE",creatorState:InfluenceSourceState="AVAILABLE",
):TopicInfluenceRead{
 const theme=THEMES[topic],checkedAt=now.toISOString();
 const eligiblePosts=xRows.filter(p=>p.intake_status==="discovery"&&ALLOWED_X.has(p.handle.toLowerCase())&&
  validDate(p.published_at,now,48*3600000)&&theme.test(p.body));
 const posts:XWireDurable["posts"]=eligiblePosts.map(p=>({
  id:p.post_id,handle:p.handle,url:p.original_url,publishedAt:p.published_at,text:p.body,
  images:[],quoteUrl:null,attribution:"THIRD_PARTY_ONLY" as const,intakeStatus:"discovery" as const,
 }));
 const x=rankXWireMarketCandidates(posts,now,12).slice(0,3).map(({post}):InfluenceLead=>{
  const original=eligiblePosts.find(row=>row.post_id===post.id);
  // The existing X ranking validates the exact canonical post URL and monitored identity.
  const normal=normaliseXPostUrl(post.url);
  return {
   id:"x:"+normal.postId,source:"X",sourceName:"@"+post.handle,url:normal.url,
   title:"X Wire report to verify",excerpt:clean(post.text,240),publishedAt:post.publishedAt,
   reviewedAt:original?.retrieved_at||null,nextCheck:CHECKS[topic],
   verification:"UNVERIFIED_LEAD",
  };
 });
 const creators:InfluenceLead[]=[];
 const used=new Set<string>(),seen=new Set<string>();
 for(const video of [...videoRows].sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at))){
  const creator=clean(video.publisher,60);
  if(!APPROVED_CREATORS.has(creator.toLowerCase())||used.has(creator.toLowerCase())||
   video.transcript_status!=="ready"||video.video_review_status!=="reviewed"||
   !validDate(video.published_at,now,14*DAY)||
   !validDate(video.transcript_interpreted_at,now,14*DAY)||
   !video.external_id||!videoSource(video.url,video.external_id)||
   seen.has(video.external_id))continue;
  const claim=selectedClaim(video.claim_checks,theme);
  const summary=clean(video.recontextualized_summary||video.summary,420);
  if(!theme.test(video.title+" "+summary)&&!claim)continue;
  if(!claim&&!summary)continue;
  creators.push({
   id:"video:"+video.external_id,source:"CREATOR",sourceName:creator,
   url:video.url,title:clean(video.title,160),
   // Never publish the private transcript-derived claim or review summary.
   // Only public video metadata and a generic topic check leave this projector.
   excerpt:topic==="ai"?"Video identified for AI demand, financing or cash-conversion research. Its underlying claims remain unverified.":
    "Video identified for Iran, Hormuz or maritime-risk research. Its underlying claims remain unverified.",
   publishedAt:video.published_at,reviewedAt:video.transcript_interpreted_at,
   nextCheck:CHECKS[topic],verification:"UNVERIFIED_LEAD",
  });
  used.add(creator.toLowerCase());seen.add(video.external_id);
  if(creators.length===2)break;
 }
 return {topic,checkedAt,xState:xState==="UNAVAILABLE"?"UNAVAILABLE":x.length?"AVAILABLE":"EMPTY",
  creatorState:creatorState==="UNAVAILABLE"?"UNAVAILABLE":creators.length?"AVAILABLE":"EMPTY",x,creators};
}
