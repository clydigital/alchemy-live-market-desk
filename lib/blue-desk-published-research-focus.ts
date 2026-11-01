import type {PublicMacroPulseBrief,MacroPulseLink} from "./blue-desk-macropulse-brief.ts";

/** Discovery of explicitly owner-published research; NOT source verification.
 * This projection NEVER feeds canonical NewsBrief, Hot Picks, Dossier or Regime.
 * It may only augment dated public research context and internal navigation.
 */
export type PublicResearchFocus={
 id:string;headline:string;standfirst:string;whatChanged:string;whyItMatters:string;
 countercase:string;nextTest:string;sourcePageUrl:string;sourcePublishedAt:string;
 reviewedAt:string;sourceLinks:MacroPulseLink[];region:string;
 navigationTags:("energy"|"hormuz"|"ai"|"rates"|"china")[];
};
const DAY=86400000;
const SAFE_ID=/^[0-9a-f-]{36}$/i;
function safeHttps(value:string):boolean{
 try{
  const url=new URL(value);
  return url.protocol==="https:"&&!url.username&&!url.password&&!url.port&&
    url.href.length<=2000&&url.pathname!=="/"&&
    !url.hostname.endsWith(".internal")&&!url.hostname.endsWith(".local")&&
    !["localhost","127.0.0.1"].includes(url.hostname);
 }catch{return false;}
}
function navigationTags(text:string):PublicResearchFocus["navigationTags"]{
 const tags:PublicResearchFocus["navigationTags"]=[];
 // Search/navigation ONLY: no assertion that these markets moved.
 if(/\b(?:hormuz|strait of hormuz|persian gulf)\b/i.test(text)){tags.push("hormuz","energy");}
 else if(/\b(?:oil|brent|opec|crude|lng|diesel|gasoil|refinery|tanker)\b/i.test(text))tags.push("energy");
 if(/\b(?:ai capex|artificial intelligence|nvidia|semiconductor|ai infrastructure|hyperscaler|gpu)\b/i.test(text))tags.push("ai");
 if(/\b(?:bond yields?|treasur(?:y|ies)|central banks?|monetary policy|fed funds|fomc|interest rates?)\b/i.test(text))tags.push("rates");
 if(/\b(?:china|chinese|pboc|beijing)\b/i.test(text))tags.push("china");
 return tags;
}
export function projectPublishedResearchFocus(
 rows:readonly PublicMacroPulseBrief[],now=new Date(),limit=6,
):PublicResearchFocus[]{
 const t=now.getTime();
 if(!Number.isFinite(t)||!Number.isInteger(limit)||limit<1||limit>8)return [];
 const seen=new Set<string>();
 return rows.flatMap(row=>{
  const source=Date.parse(row.source_published_at),retrieved=Date.parse(row.source_retrieved_at),
    published=Date.parse(row.published_at);
  if(!SAFE_ID.test(row.id)||row.verification_label!=="RESEARCH_DERIVED_UNADJUDICATED"||
   !Number.isFinite(source)||!Number.isFinite(retrieved)||!Number.isFinite(published)||
   source>retrieved||retrieved>t||source>t||published>t||published<retrieved||
   t-source>7*DAY||t-published>7*DAY||seen.has(row.source_pulse_id)||
   !row.headline?.trim()||!row.standfirst?.trim()||!row.what_changed?.trim()||
   !row.why_it_matters?.trim()||!row.countercase?.trim()||!row.watch_next?.trim()||
   !safeHttps(row.source_page_url)||!Array.isArray(row.source_links)||
   row.source_links.length<1||row.source_links.length>8||
   !row.source_links.every(link=>!!link&&typeof link==="object"&&
    typeof link.url==="string"&&safeHttps(link.url)&&
    ["PRIMARY_RELEASE","DATA_OBSERVATION","REPORTING","SOCIAL_LEAD"].includes(link.kind)&&
    typeof link.label==="string"&&link.label.length>=4))return [];
  seen.add(row.source_pulse_id);
  const content=row.headline+" "+row.standfirst+" "+row.what_changed+" "+row.why_it_matters;
  return [{
   id:row.id,headline:row.headline,standfirst:row.standfirst,
   whatChanged:row.what_changed,whyItMatters:row.why_it_matters,
   countercase:row.countercase,nextTest:row.watch_next,
   sourcePageUrl:row.source_page_url,sourcePublishedAt:row.source_published_at,
   reviewedAt:row.published_at,sourceLinks:row.source_links,region:row.primary_region,
   navigationTags:navigationTags(content),
  }];
 }).sort((a,b)=>Date.parse(b.sourcePublishedAt)-Date.parse(a.sourcePublishedAt)||
   Date.parse(b.reviewedAt)-Date.parse(a.reviewedAt)||a.id.localeCompare(b.id))
  .slice(0,limit);
}
export function researchForPublicLens(
 items:readonly PublicResearchFocus[],lens:"all"|"energy"|"hormuz"|"ai"|"rates"|"china",
):PublicResearchFocus[]{
 return lens==="all"?[...items]:items.filter(item=>item.navigationTags.includes(lens));
}
