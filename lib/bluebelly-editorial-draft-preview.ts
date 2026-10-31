import {createHash} from "node:crypto";
import type {NewsBriefV1} from "./market-brief-news.ts";
import type {ReaderEdition,ReaderSection,ReaderSource} from "./bluebelly-editorial-reader.ts";

/** Draft formatting only: NEVER claim that an author's text was fact-checked
 * just because independent News receipts were available in the same packet.
 * No research, model calls, storage, or auto-publication.
 */
export function buildPrivateDailyReaderDraft(input:{
 title:string;body:string;asOf:string;news:readonly NewsBriefV1[];
}):ReaderEdition{
 const title=input.title.trim(),body=input.body.trim();
 const at=Date.parse(input.asOf);
 if(!Number.isFinite(at)||!input.asOf.endsWith("Z")||
   title.length<8||title.length>110||body.length<250||body.length>75000)
   throw new Error("INVALID_PRIVATE_READER_DRAFT");
 const factual=input.news.filter(n=>
   n.verification==="SOURCE_VERIFIED"&&
   Number.isFinite(Date.parse(n.occurredAt))&&Date.parse(n.occurredAt)<=at&&
   at-Date.parse(n.occurredAt)<=48*3600_000&&
   (n.sourceKind==="official"||n.sourceKind==="primary"||
    n.sourceKind==="filing"||n.sourceKind==="reporting"||n.sourceKind==="market_data")
 ).slice(0,12);
 const seen=new Set<string>();
 const sources:ReaderSource[]=[];
 for(const n of factual){
  if(seen.has(n.sourceUrl))continue;
  seen.add(n.sourceUrl);
  sources.push({
   id:"verified-news-"+(sources.length+1),
   title:n.headline,
   publisher:n.sourceName,
   url:n.sourceUrl,
   publishedAt:n.occurredAt,
   status:["official","primary","filing"].includes(n.sourceKind)?"ORIGINAL_VERIFIED":"CORROBORATED",
   period:"Source-dated event, not independently matched market reaction",
  });
 }
 if(!sources.length)throw new Error("NO_RECENT_INDEPENDENT_SOURCE_RECEIPTS");
 // Preserve every paragraph. Do not synthesize an opinion or reorder scenes.
 // Explicit headings are used only as layout cues. One original lead is lifted
 // to the executive opening rather than being duplicated in the main narrative.
 const chunks=body.split(/\n\s*\n+/).map(v=>v.trim()).filter(Boolean);
 if(!chunks.length)throw new Error("EMPTY_NARRATIVE");
 const first=chunks[0].replace(/^#{1,3}\s+/,"");
 const opening=chunks.length>1?first.slice(0,1400):"Private editorial preview; the full original text is reproduced below without a source-verification claim.";
 const sections:ReaderSection[]=[];
 let current:ReaderSection|null=null;
 const start=(title:string)=>{
  current={id:"chapter-"+(sections.length+1),title,opening:"",blocks:[]};
  sections.push(current);
 };
 start("The market story");
 for(const chunk of (chunks.length>1?chunks.slice(1):chunks)){
  const heading=chunk.match(/^#{1,3}\s+([^\n]{8,100})$/);
  if(heading){start(heading[1].trim());continue;}
  if(!current)start("Continuing analysis");
  // The first real paragraph becomes the section's opening, once only.
  // Long sections break for navigation without rewriting or inventing content.
  if(current!.blocks.length>=7)start("Continuation "+(sections.length+1));
  if(!current!.opening){current!.opening=chunk;continue;}
  current!.blocks.push({kind:"paragraph",text:chunk,sourceIds:[]});
 }
 if(!sections.some(s=>s.opening))throw new Error("EMPTY_NARRATIVE");
 // A dangling heading with no copy must not emit an artificial summary.
const active=sections.filter(s=>Boolean(s.opening));
 const snapshotSha256=createHash("sha256").update(JSON.stringify({
   title,body,asOf:input.asOf,
   sources:sources.map(s=>[s.id,s.url,s.publishedAt,s.status]),
 })).digest("hex");
 const reportDay=new Date(at+8*3600_000).toISOString().slice(0,10);
 return {
  editionId:"preview-"+snapshotSha256.slice(0,16),reportDay,asOf:input.asOf,
  snapshotSha256,title,
  deck:"Private formatting preview · Independent source receipts are listed, but this draft's claims are not adjudicated.",
  executiveSummary:opening,
  sections:active,sources,status:"PRIVATE_DRAFT",
 };
}
