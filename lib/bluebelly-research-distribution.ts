import type {CreatorDigest} from "./bluebelly-creator-signals.ts";

/** Owner-only analytical routing, not a new ingestion or publication engine.
 * A target is an action for the analyst, never proof of an updated consumer. */
export const DESTINATIONS={
 creator:{path:"/creator-intelligence",action:"Reconcile exact video identities and refresh the existing structured creator digest; keep source limitations."},
 dashboard:{path:"/",action:"Check owner Creator Radar after a valid digest handoff; do not republish creator claims as news."},
 fed:{path:"/regime-watch/fed",action:"Check official macro releases, front-end yields and Fed pricing; revise the conditional view only if material."},
 bonds:{path:"/regime-watch/bonds",action:"Verify issuer financing and matched IG/HY/CCC spreads, Treasury yields and funding conditions."},
 ai:{path:"/regime-watch/ai",action:"Check issuer filings, cash conversion, capex, debt and valuation; update the existing AI tracker or reviewed thesis as appropriate."},
 china:{path:"/regime-watch/china",action:"Verify official trade measures, scope and issuer exposure before revising the thesis."},
 energy:{path:"/regime-watch/energy",action:"Check physical supply, dated inventory and refinery/product evidence; separate crude from refined fuels."},
 yen:{path:"/regime-watch/yen",action:"Check BOJ, JGB yields and FX/funding transmission; no inferred carry unwind from price alone."},
 breadth:{path:"/regime-watch/breadth",action:"Check matched equal-weight and cap-weight performance and participation; distinguish rotation from contagion."},
 gold:{path:"/regime-watch/gold",action:"Compare matched gold, dollar, real yields and risk assets; test the liquidation hypothesis."},
 housing:{path:"/regime-watch/housing",action:"Verify housing releases, rates and credit transmission; avoid speculative spillover claims."},
 compare:{path:"/markets?mode=compare",action:"Read current independently dated sector and breadth observations; do not write creator estimates into market data."},
 divergence:{path:"/markets?mode=watch",action:"Check measured relative leadership and acceleration; route only observed discrepancies to Radar."},
 crash:{path:"/crash-opportunity",action:"Reassess broad deterioration versus sector-specific deleveraging using independent credit, breadth, positioning and volatility."},
 positioning:{path:"/qqq-positioning",action:"Check exchange settlement dates and separate daily price/option proxies from actual short interest."},
 mindset:{path:"/regime-watch",action:"Use the eligible existing Dossier V2 route for source-backed material reasoning; do not manufacture a Dossier receipt."},
 earnings:{path:"/earnings",action:"Check reported issuer results, filings and guidance; keep company speculation out of verified fundamentals."},
 recession:{path:"/regime-watch/recession",action:"Test leading labour/growth and credit hypotheses against actual releases; distinguish inflation-driven high yields from resilient demand."},
 industry:{path:"/industry-intel",action:"Test customer/supplier, capacity, realised prices, utilisation, margins and funding; reference the same evidence rather than copy claims."},
 calendar:{path:"/calendar",action:"Identify a dated next resolving release/event; distinguish scheduled expectations from actuals."},
 scanner:{path:"/markets/scanner",action:"Check measured sector and asset changes; do not label creator predictions as live technical signals."},
 library:{path:"/owner/research",action:"Retain attributed hypotheses, original source receipts, contradictions and next tests using existing private research and gap records."},
 myDesk:{path:"/my-reports",action:"Use qualified evidence deltas and unresolved hypotheses in manual briefs; no automatic writing or publication."},
 powerStack:{path:"/power-stack",action:"Private manual decision only: compare revised normalized earnings, valuation, financing, downside and current independently dated BB observations; no order or trade."},
 newsroom:{path:"/newsroom",action:"Verify event against original reporting or official release; use existing editorial handoff only when warranted."},
 hormuz:{path:"/hormuz",action:"Verify shipping, security and physical flows; commentary is a research lead only."},
} as const;
export type Destination=keyof typeof DESTINATIONS;
const ROUTES:Readonly<Record<string,readonly Destination[]>>={
 "fed-hold-versus-hikes":["fed","bonds","mindset"],
 "fed-long-end-stress":["fed","bonds","gold","mindset"],
 "ai-financing-stress":["ai","bonds","crash","mindset","earnings"],
 "ai-capex-cash-conversion":["ai","earnings","mindset"],
 "private-ai-capital":["ai","bonds","earnings"],
 "ai-control-risk":["ai","earnings","newsroom"],
 "market-breadth-health":["breadth","compare","divergence","crash","positioning"],
 "gold-bitcoin-monetary-alternatives":["gold","bonds","crash"],
 "oil-physical-disruption":["energy","hormuz","fed"],
 "rates-led-same-session-repricing-overwhelms-summit-optics":["fed","bonds","compare","divergence"],
};
const RULES:ReadonlyArray<{pattern:RegExp;targets:readonly Destination[]}>= [
 {pattern:/\b(?:credit default swaps?|CDS|credit spreads?|refinancing|CCC|high.yield)\b/i,targets:["bonds","crash"]},
 {pattern:/\b(?:breadth thrust|equal.weight|sector rotation|defensive rotation|deleveraging|short covering)\b/i,targets:["breadth","compare","divergence","crash"]},
 {pattern:/\b(?:Nasdaq|QQQ)\b.{0,100}\b(?:short interest|futures positioning|deleverag|short covering)/i,targets:["positioning"]},
 {pattern:/\b(?:gold|precious metals|GLD|silver)\b/i,targets:["gold"]},
 {pattern:/\b(?:tariffs?|Section 301|trade restrictions?)\b/i,targets:["china","fed","newsroom"]},
 {pattern:/\b(?:PCE|consumer confidence|FOMC|rate hikes?|Fed pause|payrolls?)\b/i,targets:["fed","mindset","recession","calendar"]},
 {pattern:/\b(?:recession|unemployment|jobless claims|PMI|ADP|employment|earnings revisions?)\b/i,targets:["recession","calendar"]},
 {pattern:/\b(?:contract renewal|customer concentration|utili[sz]ation|GPU rental|memory pricing|capex|financing|backlog|cash conversion|free cash flow|valuation)\b/i,targets:["industry","earnings","powerStack"]},
 {pattern:/\b(?:breadth|rotation|relative strength|moving averages?|deleveraging)\b/i,targets:["scanner"]},
 {pattern:/\b(?:AI financing|AI capex|hyperscalers?|GPU|robotaxi|SpaceX|CoreWeave|Nvidia|Tesla)\b/i,targets:["ai","earnings","industry","powerStack"]},
 {pattern:/\b(?:oil inventories|crude inventories|diesel|refined products|Brent)\b/i,targets:["energy"]},
 {pattern:/\b(?:Hormuz|tanker crossings|shipping blockade)\b/i,targets:["energy","hormuz"]},
 {pattern:/\b(?:BOJ|JGB|yen carry)\b/i,targets:["yen"]},
 {pattern:/\b(?:mortgage|housing starts|home sales)\b/i,targets:["housing","industry","powerStack"]},
];
export type DistributionRow={
 id:string;publisher:string;external_id:string|null;title:string;url:string;
 published_at:string;updated_at:string;transcript_interpreted_at:string|null;
 transcript_status:string|null;video_review_status:string|null;summary:string|null;
 recontextualized_summary:string|null;affected_story_slugs:string[]|null;
 transcript_metadata:unknown;transcript_evidence_id:string|null;
};
type Metadata=Record<string,unknown>;
const meta=(value:unknown):Metadata=>value&&typeof value==="object"&&!Array.isArray(value)?value as Metadata:{};
const validId=(id:string|null)=>typeof id==="string"&&/^[\w-]{11}$/.test(id);
export function routeResearchDistribution(rows:readonly DistributionRow[],digest:CreatorDigest|null,now:Date,truncated=false){
 const items=rows.map(row=>{
  const m=meta(row.transcript_metadata);
  const supplied=m.manual_sweep_source==="user_pasted_transcript";
  const description=m.source_scope==="video_description_only";
  const full=row.transcript_status==="ready"&&row.video_review_status==="reviewed";
  const sourceState=full?"REVIEWED_TRANSCRIPT":supplied?"SUPPLIED_ARGUMENT":description?"DESCRIPTION_ONLY":"PARTIAL";
  const publicationVerified=m.publication_timestamp_verified!==false&&m.published_at_is_capture_proxy!==true&&m.published_at_date_only_proxy!==true&&m.publication_time_unknown!==true;
  const exactVideoId=validId(row.external_id)?row.external_id:null;
  const match=digest?.creators.find(c=>exactVideoId?c.videoId===exactVideoId:
   supplied&&c.sourceStatus==="supplied"&&c.videoId===null&&c.publisher===row.publisher&&c.title===row.title);
  // A mention does not prove synthesis. Do not treat source coverage as a
  // verified content handoff, even when the digest is newer.
  const reviewAt=supplied||m.manual_sweep_review_date?row.updated_at:row.transcript_interpreted_at??row.updated_at;
  const digestState=!digest?"DIGEST_UNAVAILABLE":!match?"NOT_LISTED":Date.parse(digest.generatedAt)<Date.parse(reviewAt)?"SOURCE_NEWER_THAN_DIGEST":"SOURCE_LISTED_CONTENT_UNVERIFIED";
  const targets=new Set<Destination>(["creator","dashboard","library","myDesk"]);
  const storySlugs=Array.isArray(row.affected_story_slugs)?row.affected_story_slugs:[];
  for(const slug of storySlugs)for(const target of ROUTES[slug]??[])targets.add(target);
  const content=[row.title,row.summary,row.recontextualized_summary].filter(Boolean).join(" ").slice(0,12000);
  for(const rule of RULES)if(rule.pattern.test(content))for(const target of rule.targets)targets.add(target);
  return {id:row.id,publisher:row.publisher,title:row.title,videoId:exactVideoId,url:row.url,
   publishedAt:publicationVerified?row.published_at:null,reviewAt,sourceState,digestState,
   evidenceReference:row.transcript_evidence_id??null,storySlugs,targets:[...targets],
   argument:(row.recontextualized_summary??row.summary??"").slice(0,1600)};
 });
 const targets=(Object.keys(DESTINATIONS) as Destination[]).flatMap(key=>{
  const matching=items.filter(i=>i.targets.includes(key));
  if(!matching.length)return [];
  return [{destination:key,...DESTINATIONS[key],sourceIds:matching.map(i=>i.id),
   status:key==="creator"&&matching.every(i=>i.digestState==="SOURCE_LISTED_CONTENT_UNVERIFIED")
    ?"SOURCE_LISTED_CONTENT_UNVERIFIED":"ANALYST_HANDOFF_REQUIRED"}];
 });
 return {checkedAt:now.toISOString(),coverage:truncated?"BOUNDED_PARTIAL":"BOUNDED",
  digestGeneratedAt:digest?.generatedAt??null,marketSession:digest?.marketSession??null,
  items,targets,caveat:"Owner-only routing suggestions. Stored, source-listed, admitted, and displayed are independent. No canonical evidence, prices, stories, public claims or publication states are modified."};
}
