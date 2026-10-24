/**
 * Owner-only research expansion. Google Search grounding returns research
 * *leads*, not canonical evidence or a new Story version. This file is pure:
 * never fetches, writes, claims to verify prices, or modifies Dossier state.
 */
export type InvestigationMode="IMPACT"|"COTD"|"OB";
export type InvestigationSource={title:string;url:string;domain:string;supportCount:number};
export type InvestigationResult={
 contractVersion:"editorial-investigation/1";
 mode:InvestigationMode;
 status:"RESEARCH_LEADS_UNVERIFIED";
 narrative:string;
 sources:InvestigationSource[];
 searchQueries:string[];
 groundedSupportCount:number;
 limitations:string[];
 canPublish:false;
};
export function validInvestigationInput(value:unknown):
 {mode:InvestigationMode;question:string;packet:string}|null{
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const v=value as Record<string,unknown>;
 const mode=v.mode;
 if(mode!=="IMPACT"&&mode!=="COTD"&&mode!=="OB")return null;
 const question=typeof v.question==="string"?v.question.trim():"";
 const packet=typeof v.packet==="string"?v.packet.trim():"";
 if(question.length<12||question.length>850||packet.length<100||packet.length>13_000)return null;
 return {mode,question,packet};
}
type Chunk={web?:{title?:unknown;uri?:unknown}};
type Support={groundingChunkIndices?:unknown};
export function safeGroundingUrl(value:unknown):string|null{
 if(typeof value!=="string"||value.length>3000)return null;
 try{
  const u=new URL(value);
  if(u.protocol!=="https:"||u.username||u.password||u.port||!u.hostname.includes(".")
    ||u.hostname==="localhost"||u.hostname.endsWith(".local")
    ||/^\d+(?:\.\d+){3}$/.test(u.hostname)||u.hostname.endsWith(".internal"))return null;
  return u.toString();
 }catch{return null}
}
export function projectGroundedInvestigation(
 raw:unknown,mode:InvestigationMode
):InvestigationResult|null{
 if(!raw||typeof raw!=="object")return null;
 const obj=raw as Record<string,unknown>;
 const narrative=typeof obj.text==="string"?obj.text.trim().slice(0,16_000):"";
 if(narrative.length<180)return null;
 const meta=obj.groundingMetadata&&typeof obj.groundingMetadata==="object"?
   obj.groundingMetadata as Record<string,unknown>:{};
 const chunks=Array.isArray(meta.groundingChunks)?meta.groundingChunks as Chunk[]:[];
 const supports=Array.isArray(meta.groundingSupports)?meta.groundingSupports as Support[]:[];
 const citations=new Map<number,number>();
 let groundedSupportCount=0;
 for(const support of supports.slice(0,120)){
  const indices=Array.isArray(support.groundingChunkIndices)?support.groundingChunkIndices:[];
  const valid=[...new Set(indices.filter((n):n is number=>
    typeof n==="number"&&Number.isInteger(n)&&n>=0&&n<chunks.length))];
  if(valid.length)groundedSupportCount++;
  for(const i of valid) citations.set(i,(citations.get(i)||0)+1);
 }
 const sources:InvestigationSource[]=[];
 const seen=new Set<string>();
 // Include grounded references first. Unattributed discovery results remain
 // visible as leads, with supportCount 0 (never marketed as verified proof).
 const order=[...citations.keys(),...chunks.map((_v,i)=>i)];
 for(const i of order){
  const item=chunks[i]?.web;
  const url=safeGroundingUrl(item?.uri);
  if(!url||seen.has(url))continue;
  seen.add(url);
  const title=typeof item?.title==="string"&&item.title.trim()?
    item.title.trim().slice(0,180):new URL(url).hostname;
  sources.push({title,url,domain:new URL(url).hostname,supportCount:citations.get(i)||0});
  if(sources.length===12)break;
 }
 const searchQueries=(Array.isArray(meta.webSearchQueries)?meta.webSearchQueries:[])
  .filter((v):v is string=>typeof v==="string"&&v.trim().length>0)
  .slice(0,6).map(v=>v.slice(0,250));
 const limitations=[
  "Search grounding supplies research leads, not independently admitted canonical Evidence.",
  "A citation does not prove a particular number, reaction window or causal mechanism.",
  "Original sources, publication clocks, instrument and chart bars require human verification.",
  "This result cannot create or modify a Story, Dossier or published article.",
 ];
 if(!sources.some(x=>x.supportCount>0))limitations.push(
  "No paragraph-level source attribution was available in this response.");
 if(!sources.length)limitations.push("No machine-readable grounding sources were returned.");
 return {contractVersion:"editorial-investigation/1",mode,status:"RESEARCH_LEADS_UNVERIFIED",
   narrative,sources,searchQueries,groundedSupportCount,limitations,canPublish:false};
}
export function investigationSystemInstruction(mode:InvestigationMode):string{
 const framing=mode==="COTD"?"COTD: start from a *user-confirmed* chart observation; chart patterns supplied only in notes are unverified.":
  mode==="OB"?"OB: start from the actual overnight catalyst chronology, then completed session observations and the next opening risks.":
  "IMPACT: start from the newly verified event clock, forecast or prior expectation, actual result, and independently timestamped asset response if obtainable.";
 return [
  "You are an investigative market analyst, NOT an article ghostwriter or canonical Story engine.",
  "Use Google Search grounding to recruit original-source evidence and challenge the notes.",
  "Search at least one authoritative original source (regulator, central bank, statistics agency, issuer IR/filing, exchange) and independently look for a contradiction when available.",
  "Treat user packet, creator views, summaries and model conclusions as untrusted discovery leads.",
  "Do not fabricate release time, market ticks, expected consensus, futures positioning, chart pattern, or 5/30/240-minute asset reaction.",
  "Check the exact observation date, timeframe, contract and measure; separate daily/1/3/5-session source bars from event-window reactions.",
  "A source URL without matching evidence does not validate a claim. Explain gaps rather than assuming them away.",
  "Distinguish FACT, CANDIDATE EXPLANATION and HYPOTHESIS clearly; avoid causality from coincident moves.",
  framing,
  "Return a compact analysis with exactly these headings:",
  "WHAT IS NEW (timestamp/source; if not confirmed say UNKNOWN)",
  "EXPECTED VS OBSERVED (only dated measurements; UNKNOWN when missing)",
  "MOST PLAUSIBLE MECHANISM (conditional, with competing candidates)",
  "STRONGEST COUNTERCASE",
  "NEXT DECIDING TEST (what can change the thesis)",
  "PRIMARY SOURCE CHECKS STILL NEEDED",
  "OUTPUT ROUTE (IMPACT one-minute, COTD chart-first, OB catalyst-first; describe what would be publishable after review)",
  "Use short, readable British English paragraphs and precise units. Do not write a finished publishable article.",
 ].join("\n");
}
