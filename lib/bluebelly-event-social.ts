/**
 * Read-only public social CONTEXT, never an original source for a bank decision.
 * Input rows are already-acquired social discovery leads; no automatic
 * verification, canonical promotion, authorisation or market causality.
 */
export type CapturedSocialLead={
 publisher:unknown;title:unknown;url:unknown;published_at:unknown;
 status:unknown;item_type:unknown;source_quality:unknown;
};
export type EmbeddedSocialContext={
 id:string;handle:string;url:string;postedAt:string;caption:string;phase:"BEFORE DECISION"|"AFTER DECISION";
};
const TRUSTED_CONTEXT_HANDLES=new Set([
 "KobeissiLetter","Bluekurtic","FirstSquawk","HFI_Research",
 "ReserveBankofNZ","federalreserve","bankofcanada","ecb"
]);
const TOPIC:Readonly<Record<string,RegExp>>={
 "fed-2026-10-28":/\b(?:FOMC|Fed|federal reserve|Warsh|Hammack|Cook|interest rates?)\b/i,
 "boc-2026-10-28":/\b(?:Bank of Canada|BoC|Canadian (?:rate|central bank)|Macklem)\b/i,
 "rbnz-2026-10-28":/\b(?:RBNZ|Reserve Bank of New Zealand|OCR|NZ rate decision|New Zealand central bank)\b/i,
};
function canonicalSocialLink(input:string):{id:string;handle:string;url:string}|null{
 try{
  const u=new URL(input);
  if(u.protocol!=="https:"||!["x.com","www.x.com","twitter.com","www.twitter.com"].includes(u.hostname)
    ||u.search||u.hash||u.port)return null;
  const m=/^\/([A-Za-z0-9_]{1,15})\/status\/(\d{12,22})\/?$/.exec(u.pathname);
  if(!m||!TRUSTED_CONTEXT_HANDLES.has(m[1]))return null;
  return {handle:m[1],id:m[2],url:"https://x.com/"+m[1]+"/status/"+m[2]};
 }catch{return null;}
}
export function selectEventSocialContext(
 rows:readonly CapturedSocialLead[],eventId:string,eventAt:string,now:Date,limit=2
):EmbeddedSocialContext[]{
 const topic=TOPIC[eventId],release=Date.parse(eventAt),t=now.getTime();
 if(!topic||!Number.isFinite(release)||!Number.isFinite(t)||t<release||
  !Number.isInteger(limit)||limit<1||limit>4)return [];
 const output:EmbeddedSocialContext[]=[];const seen=new Set<string>();
 for(const r of rows){
  if(r.status!=="accepted"||r.item_type!=="news"||r.source_quality!==35||
    typeof r.title!=="string"||typeof r.publisher!=="string"||typeof r.url!=="string"||
    typeof r.published_at!=="string")continue;
  const published=Date.parse(r.published_at);
  if(!Number.isFinite(published)||published>t||published<release-36*3600000||
    published>release+12*3600000)continue;
  if(r.title.length<10||r.title.length>1200||!topic.test(r.title))continue;
  const link=canonicalSocialLink(r.url);
  if(!link||r.publisher!=="X/@"+link.handle||seen.has(link.id))continue;
  seen.add(link.id);
  output.push({id:link.id,handle:link.handle,url:link.url,
   postedAt:new Date(published).toISOString(),
   caption:r.title.slice(0,210).trim(),
   phase:published<release?"BEFORE DECISION":"AFTER DECISION"});
 }
 return output.sort((a,b)=>Date.parse(b.postedAt)-Date.parse(a.postedAt)).slice(0,limit);
}
