import type { NotionResearchBundle } from "./notion-market-research.ts";
import type { NewsBriefV1 } from "./market-brief-news.ts";
import type { DeliveredMacroPulseBrief } from "./blue-desk-delivered-research";
import type {PrivateCreatorReview} from "./bluebelly-private-creator-reviews.ts";

export type DailyResearchCalendarItem = {
  title:string; scheduledAt:string|null; sourceName:string; sourceUrl:string|null;
  verificationState:string; decidingQuestion:string|null;
};
export type DailyResearchPriceObservation = {
  label:string; level:number|null; asOf:string|null; sourceName:string; frequency:string;
};
export type ResearchSourceCandidate = {
  url:string; sourcePageUrl:string; kind:"MACROPULSE"|"RESEARCH_GAP";
  verification:"EXACT_NEWS_SOURCE_MATCH"|"UNVERIFIED_LINK";
  matchingNewsHeadline:string|null;
};
export type DailyResearchPacket = {
  contractVersion:"daily-report-research/1";
  researchSourceCandidates:ResearchSourceCandidate[];
  assembledAt:string;
  notionStatus:NotionResearchBundle["status"];
  warnings:string[];
  newsCount:number;
  deliveredBriefCount?:number;
  packet:string;
  sourceUrls:string[];
};
function safeUrl(value:unknown):string|null {
  if(typeof value!=="string")return null;
  try{const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password&&
    !u.hostname.endsWith(".internal")&&!u.hostname.endsWith(".local")?u.toString():null;}
  catch{return null;}
}
function safe(v:unknown,max=500):string {
  return typeof v==="string"?v.replace(/[\u0000-\u0008\u000e-\u001f]/g," ").trim().slice(0,max):"";
}
export function buildDailyResearchPacket(input:{
  now:string; notion:NotionResearchBundle; news:readonly NewsBriefV1[];
  calendar:readonly DailyResearchCalendarItem[];
  prices:readonly DailyResearchPriceObservation[];
  editorialBriefs?:readonly DeliveredMacroPulseBrief[];
  creatorReviews?:readonly PrivateCreatorReview[];
  creatorCoverageStatus?:"AVAILABLE"|"UNAVAILABLE";
  marketDiagnostics?: readonly {status:"ready"|"insufficient";headline:string;interpretation:string;
    nextTest:string;asOf:string|null;sourceUrls:readonly string[]}[];
}):DailyResearchPacket{
  const links=new Set<string>();
  const include=(url:unknown)=>{const safeLink=safeUrl(url);if(safeLink&&links.size<40)links.add(safeLink);};
  const normalise=(raw:string)=>{
    try{
      const u=new URL(raw);
      if(u.protocol!=="https:")return null;
      u.hash="";
      for(const key of [...u.searchParams.keys()])
        if(/^(?:utm_.+|fbclid|gclid)$/i.test(key))u.searchParams.delete(key);
      const path=u.pathname.endsWith("/")?u.pathname.slice(0,-1):u.pathname;
      return u.origin+path+u.search;
    }catch{return null;}
  };
  // An exact source URL match confirms only that an independent News receipt
  // exists for that document. It does not verify a claim written in Notion.
  const proven=new Map(input.news
    .filter(n=>n.verification==="SOURCE_VERIFIED")
    .flatMap(n=>{const k=normalise(n.sourceUrl);return k?[[k,n.headline] as const]:[];}));
  const candidates:ResearchSourceCandidate[]=[];
  const candidateKeys=new Set<string>();
  for(const page of input.notion.sources.slice(0,3)){
    for(const raw of page.originalLinks.slice(0,32)){
      const url=safeUrl(raw),key=url&&normalise(url);
      if(!url||!key||candidateKeys.has(key))continue;
      candidateKeys.add(key);
      candidates.push({url,sourcePageUrl:page.url,kind:page.kind,
        verification:proven.has(key)?"EXACT_NEWS_SOURCE_MATCH":"UNVERIFIED_LINK",
        matchingNewsHeadline:proven.get(key)||null});
      if(candidates.length>=32)break;
    }
    if(candidates.length>=32)break;
  }
  const delivered=(input.editorialBriefs||[]).slice(0,6);
  for(const brief of delivered){
    for(const link of Array.isArray(brief.source_links)?brief.source_links.slice(0,8):[]){
      const url=safeUrl(link.url),key=url&&normalise(url);
      if(!url||!key||candidateKeys.has(key)||candidates.length>=32)continue;
      candidateKeys.add(key);
      candidates.push({url,sourcePageUrl:brief.source_page_url,kind:"MACROPULSE",
        verification:proven.has(key)?"EXACT_NEWS_SOURCE_MATCH":"UNVERIFIED_LINK",
        matchingNewsHeadline:proven.get(key)||null});
    }
  }
  const lines=[
    "RESEARCH PACKET v1 / PRIVATE UNVERIFIED ANALYST INPUT",
    "Assembled: "+input.now,
    "IMPORTANT: Notion posts and Research Gap Gate are research notes, not original-source proof.",
    "Only independently verified source news below is considered source-verified factual reporting.",
    "Distinguish event time, quote time, publication time, retrieval time and stale data.",
    "Do not treat attributed X posts or creator hypotheses as underlying fact.",
    "Do not invent market causality, a session return, issuer guidance or future releases.",
    "When dates or price series differ, do not synthesize a matched event reaction.",
    "NOTION COVERAGE: "+input.notion.status,
    ...input.notion.warnings.map(w=>"COVERAGE WARNING: "+safe(w,550)),
    "",
  ];
  const reviews=(input.creatorReviews||[]).slice(0,7);
  if(reviews.length){
    lines.push("","## PRIVATE CREATOR TRANSCRIPT ARGUMENTS — ATTRIBUTED / NOT ORIGINAL FACTS",
      "These reviews were derived from actually stored YouTube transcripts with review receipts. They are hypotheses, not independent evidence or exhaustive new videos. Video publication dates are NOT current prices or verified transactions. Numbers in creator speech require the explicit verification targets below.");
    for(const review of reviews){
      include(review.url);
      lines.push("### "+safe(review.publisher,75)+" | "+safe(review.title,145),
        "Original video: "+review.url+" | ID "+safe(review.videoId,20)+
        " | published "+safe(review.publishedAt,45),
        "Attributed creator logic: "+safe(review.logic,580),
        "Review synopsis (not independently verified): "+safe(review.summary,240));
      for(const c of review.claimChecks.slice(0,2))
        lines.push("Check ("+safe(c.kind,30)+"): "+safe(c.claim,200)+
          " | Independent source target: "+safe(c.verificationTarget||"UNVERIFIED",170));
    }
    lines.push("");
  }else lines.push("","CREATOR TRANSCRIPT COVERAGE: "+(input.creatorCoverageStatus==="UNAVAILABLE"?"RETRIEVAL UNAVAILABLE. This does not establish that there were no reviewed videos.":"No reviewed videos in the bounded recent window.")+" Do not invent video viewpoints.");
  if(delivered.length){
    lines.push("## PRIVATELY DELIVERED MACROPULSE EDITORIAL BRIEFS — RESEARCH ONLY",
      "These are attributed drafts supplied to the separate owner review queue, NOT independently verified News, accepted Motion, Dossier evidence, or proof of a live Notion API read.",
      "The original MacroPulse and Research Gap coverage status above remains unchanged. Research Gate completeness must be assessed separately.");
    for(const brief of delivered){
      include(brief.source_page_url);
      lines.push("### "+safe(brief.headline,140),
        "Source Pulse: "+safe(brief.source_pulse_id,180),
        "Original research: "+safe(brief.source_page_url,500),
        "Source published: "+safe(brief.source_published_at,50)+
        "; retrieved: "+safe(brief.source_retrieved_at,50),
        "Owner status: "+(brief.status==="published"?"OWNER-REVIEWED RESEARCH":"UNAPPROVED REVIEW DRAFT")+
        "; verification: RESEARCH_DERIVED_UNADJUDICATED",
        "Standfirst: "+safe(brief.standfirst,550),
        "Claim as described by research: "+safe(brief.what_changed,1500),
        "Potential market mechanism, NOT an observed reaction: "+safe(brief.why_it_matters,1500),
        "Countercase and attribution limits: "+safe(brief.countercase,1000),
        "Next original-source checks: "+safe(brief.watch_next,950));
      for(const source of Array.isArray(brief.source_links)?brief.source_links.slice(0,8):[]){
        const url=safeUrl(source.url);if(!url)continue;include(url);
        lines.push("Candidate source (must check): "+safe(source.kind,35)+
          " | "+safe(source.label,130)+" | "+url);
      }
    }
    lines.push("");
  }
  lines.push("## SOURCE-VERIFIED NEWS (factual only, no automatic price/causal claim)");
  for(const n of input.news.slice(0,10)){
    include(n.sourceUrl);
    lines.push("- "+safe(n.occurredAt,50)+" | "+safe(n.headline,200),
      "  What happened: "+safe(n.summary,550),
      "  Original: "+safe(n.sourceName,90)+" "+n.sourceUrl);
  }
  if(!input.news.length)lines.push("No source-verified recent news found; DO NOT state there was no market news.");
  lines.push("","## CURRENT SOURCE-DATED PRICE OBSERVATIONS (not event-timed proof)");
  for(const p of input.prices.slice(0,12))lines.push(
    "- "+safe(p.label,100)+": "+(p.level===null?"UNKNOWN":String(p.level))+
    " (source: "+safe(p.sourceName,80)+", observed: "+safe(p.asOf||"UNKNOWN",35)+
    ", frequency: "+safe(p.frequency,35)+")",
  );
  if(!input.prices.length)lines.push("Price/context source unavailable. Price action UNKNOWN.");
  // Market internals guide the next investigation; never bypass source admission.
  lines.push("","## MARKET PARTICIPATION — SOURCE-DATED, NONCANONICAL RESEARCH CHECK");
  for(const d of (input.marketDiagnostics||[]).slice(0,3)){
    lines.push("Status: "+safe(d.status,25)+" | source session: "+safe(d.asOf||"UNKNOWN",35),
      "Observation/diagnostic: "+safe(d.headline,150),
      "Interpretation — NOT market causality or an accepted Regime/Dossier finding: "+safe(d.interpretation,850),
      "Next independent test: "+safe(d.nextTest,450));
    for(const url of d.sourceUrls.slice(0,4)){include(url);lines.push("Dated original vendor page: "+safeUrl(url));}
  }
  if(!input.marketDiagnostics?.length)lines.push("No eligible breadth research diagnostic. Do not infer index-wide participation from a proxy.");

  lines.push("","## ECONOMIC RELEASES & ISSUER EARNINGS (upcoming, not outcomes)");
  for(const e of input.calendar.slice(0,14)){
    include(e.sourceUrl);
    lines.push("- "+safe(e.title,150)+" | "+safe(e.scheduledAt||"date only / time unknown",65)+
      " | "+safe(e.verificationState,70)+" | "+safe(e.sourceName,90)+
      " | "+safe(e.decidingQuestion||"Deciding question not supplied",220)+
      (e.sourceUrl?" | "+e.sourceUrl:""));
  }
  if(!input.calendar.length)lines.push("No upcoming events in available provider window; coverage may be incomplete.");
  lines.push("","## MACROPULSE AND RESEARCH GAP (research leads only; ALL claims require original-source checks)");
  for(const s of input.notion.sources.slice(0,3)){
    include(s.url);
    lines.push("### "+s.kind+" / "+safe(s.title,200),
      "Notion page: "+s.url,"Retrieved: "+s.retrievedAt,
      "Status: RESEARCH INPUT, NOT INDEPENDENT SOURCE VERIFICATION",
      "Embedded original-source link candidates: ");
    for(const url of s.originalLinks.slice(0,14)){include(url);lines.push(" - "+url);}
    lines.push(s.text.slice(0,s.kind==="RESEARCH_GAP"?8000:4300));
  }
  if(!input.notion.sources.length)lines.push("No current Notion material accessible. Do not simulate its findings.");
  lines.push("","## REPORT WRITING CONTRACT",
    "Explain facts, then each causal step, then the affected markets, then a countercase.",
    "Use conditional, evidence-scoped hypotheses and identify missing pricing and source data.",
    "Reference the actual upcoming economic and earnings questions.",
    "If the report has inadequate verified material, produce an explicitly PARTIAL report.");
  return {contractVersion:"daily-report-research/1",assembledAt:input.now,
    notionStatus:input.notion.status,warnings:input.notion.warnings,
    newsCount:input.news.length,deliveredBriefCount:delivered.length,researchSourceCandidates:candidates,
    packet:lines.join("\n").slice(0,23800),sourceUrls:[...links]};
}