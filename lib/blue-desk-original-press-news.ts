import { createHash } from "node:crypto";
import { OFFICIAL_PRESS_FEEDS, materiallyActionableOfficialHeadline } from "./official-press-news-intake.ts";
import type { NewsBriefV1 } from "./market-brief-news.ts";

/** The existing scheduled RSS + linked HTML verification is the source of truth.
 * This projects its persisted receipts, not arbitrary research-intake headlines. */
export type OfficialPressReceipt = {
  id:unknown; item_key:unknown; item_type:unknown; status:unknown;
  publisher:unknown; title:unknown; summary?:unknown; url:unknown; published_at:unknown;
  created_at:unknown; source_quality:unknown; relevance:unknown;
  novelty:unknown; materiality:unknown; candidate_score:unknown;
  review_reason:unknown; evidence_links:unknown;
};
const MAX_LOOKBACK_DAYS=7;
const PROOF_REASON="Original official RSS publication clock and directly linked same-host press-release HTML checked. Headline describes the announcement only, not its financial effect.";

function feedFor(urlText:string){
 try{
  const u=new URL(urlText);
  if(u.protocol!=="https:"||u.username||u.password||u.hash||u.search||urlText.length>2048)return null;
  return OFFICIAL_PRESS_FEEDS.find(feed=>u.hostname===feed.host&&feed.path.test(u.pathname))||null;
 }catch{return null;}
}
export function projectOriginalPressNews(
 rows:readonly OfficialPressReceipt[],now=new Date(),limit=8,lookbackDays=2,
):NewsBriefV1[]{
 const t=now.getTime(),seen=new Set<string>();
 if(!Number.isFinite(t)||!Number.isInteger(lookbackDays)||lookbackDays<1||lookbackDays>MAX_LOOKBACK_DAYS)return [];
 const out:NewsBriefV1[]=[];
 for(const item of [...rows].sort((a,b)=>Date.parse(String(b.published_at))-Date.parse(String(a.published_at)))){
  if(item.item_type!=="news"||item.status!=="accepted"||item.review_reason!==PROOF_REASON)continue;
  if(Number(item.source_quality)!==95||Number(item.candidate_score)<72||
     Number(item.materiality)<72||Number(item.relevance)<70||Number(item.novelty)<65)continue;
  const url=String(item.url||""),feed=feedFor(url);
  if(!feed||item.publisher!==feed.publisher)continue;
  const expected="official-press:"+createHash("sha256").update(url).digest("hex").slice(0,24);
  if(item.item_key!==expected)continue;
  const title=typeof item.title==="string"?item.title.trim():"";
  if(title.length<18||title.length>500||!materiallyActionableOfficialHeadline(feed,title))continue;
  const published=Date.parse(String(item.published_at||""));
  const checked=Date.parse(String(item.created_at||""));
  if(!Number.isFinite(published)||!Number.isFinite(checked)||published>t||
     checked>t||checked<published||t-published>lookbackDays*86400000)continue;
  const evidence=Array.isArray(item.evidence_links)?item.evidence_links:[];
  if(evidence.length===0||!evidence.some(link=>{
   if(!link||typeof link!=="object")return false;
   const x=link as Record<string,unknown>;
   return x.url===url&&x.claim===title&&x.publisher===feed.publisher&&
     Number.isFinite(Date.parse(String(x.publishedAt||"")))&&
     Date.parse(String(x.publishedAt))===published;
  }))continue;
  if(seen.has(url))continue;
  const id=String(item.id||"");
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))continue;
  // A secondary factual line is shown only if it exactly matches the
  // original publisher's evidence on the same permalink, clock and company.
  // It is not inferred from the headline or trusted from a mutable summary.
  const factLines=evidence.flatMap(link=>{
   if(!link||typeof link!=="object")return [];
   const x=link as Record<string,unknown>;
   const claim=typeof x.claim==="string"?x.claim:"";
   const text=claim.startsWith("OFFICIAL_FACT: ")?claim.slice(15):"";
   return text.length>=55&&text.length<=235&&
      x.url===url&&x.publisher===feed.publisher&&x.title===title&&
      Date.parse(String(x.publishedAt||""))===published&&
      Number.isFinite(Date.parse(String(x.publishedAt||"")))
        ?[text]:[];
  }).slice(0,2);
  const qualified=factLines.join(" ");
  const exactSummary=typeof item.summary==="string"?item.summary.trim():"";
  seen.add(url);
  out.push({
    contractVersion:"news-brief/1",
    contentType:"NEWS_BRIEF",
    id,headline:title,
    summary:qualified && exactSummary===qualified ? qualified :
      "The original publisher issued this dated announcement. Its market-price reaction and wider causal effects have not been established.",
    sourceName:feed.publisher,sourceUrl:url,
    sourceKind:feed.host==="www.federalreserve.gov"||feed.host==="www.eia.gov"||feed.host==="www.ecb.europa.eu"?"official":
      feed.host==="www.sec.gov"?"filing":"primary",
    occurredAt:new Date(published).toISOString(),
    observedAt:new Date(checked).toISOString(),
    verification:"SOURCE_VERIFIED",
  });
  if(out.length>=Math.max(0,Math.min(12,limit)))break;
 }
 return out;
}
