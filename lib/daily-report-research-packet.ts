import type { NotionResearchBundle } from "./notion-market-research.ts";
import type { NewsBriefV1 } from "./market-brief-news.ts";

export type DailyResearchCalendarItem = {
  title:string; scheduledAt:string|null; sourceName:string; sourceUrl:string|null;
  verificationState:string; decidingQuestion:string|null;
};
export type DailyResearchPriceObservation = {
  label:string; level:number|null; asOf:string|null; sourceName:string; frequency:string;
};
export type DailyResearchPacket = {
  contractVersion:"daily-report-research/1";
  assembledAt:string;
  notionStatus:NotionResearchBundle["status"];
  warnings:string[];
  newsCount:number;
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
}):DailyResearchPacket{
  const links=new Set<string>();
  const include=(url:unknown)=>{const safeLink=safeUrl(url);if(safeLink&&links.size<40)links.add(safeLink);};
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
    "## SOURCE-VERIFIED NEWS (factual only, no automatic price/causal claim)",
  ];
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
    newsCount:input.news.length,
    packet:lines.join("\n").slice(0,23800),sourceUrls:[...links]};
}