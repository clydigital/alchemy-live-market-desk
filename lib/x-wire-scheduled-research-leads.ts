import {createHash} from "node:crypto";
import type {ResearchRunInput,IntakeItemInput} from "./research-update.ts";
import type {XWireDurable} from "./x-wire-durable.ts";
const CORPORATE=/\b(?:merger|merging|special committee|ipo|initial public offering|s-1|prospectus|takeover|buyout|capital raise|debt financing|stock offering|profit warning|guidance)\b/i;
const MAX=5;
/** One-way candidate-only mirror. A quoted X post confirms nothing beyond
 * what that author wrote; never manufacture 'original_verified' evidence. */
export function attachXWireResearchLeads(input:ResearchRunInput,
 wire:Pick<XWireDurable,"posts"|"accounts"|"storageHealthy">,now=new Date()):ResearchRunInput{
 const valid=(p:(typeof wire.posts)[number])=>{
  const time=Date.parse(p.publishedAt);
  if(!Number.isFinite(time)||time>now.getTime()+5*60_000||
   now.getTime()-time>48*3_600_000||p.intakeStatus!=="discovery")return false;
  if(!CORPORATE.test(p.text)||!/^https:\/\/(?:www\.)?x\.com\/[A-Za-z0-9_]{1,15}\/status\/\d+$/.test(p.url))return false;
  return p.text.length>=35;
 };
 const candidates=wire.posts.filter(valid).sort((a,b)=>
  Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,MAX);
 const existing=new Set(input.items.map(x=>x.url));
 const additions:IntakeItemInput[]=[];
 for(const post of candidates){
  if(existing.has(post.url))continue;
  // Deliberately BELOW official verification threshold. Tweet is evidence
  // only of an attributable social-media claim, not the alleged merger/filing.
  additions.push({
   itemKey:"x-wire-lead:"+createHash("sha256").update(post.url).digest("hex").slice(0,24),
   itemType:"news",publisher:"X/@"+post.handle,
   title:post.text.slice(0,200),url:post.url,publishedAt:post.publishedAt,
   summary:"THIRD-PARTY X COMMENTARY — unverified claim, corroboration required. "+post.text.slice(0,1300),
   sourceQuality:35,relevance:76,novelty:78,materiality:80,
   recommendedAction:"collect_evidence",evidence:[],
   newsSignal:"A social-media author raised a potential corporate action. The event's truth and price reaction are UNKNOWN.",
   reviewReason:"X Wire discovery only (unverified). Verify corporate action from issuer, SEC filing or independent credible reporting; never treat this as canonical evidence."
  });
  existing.add(post.url);
 }
 const unhealthy=wire.accounts.filter(a=>a.status==="unavailable"||
   a.status==="blocked"||a.status==="partial"||a.status==="unconfigured").length;
 const summary=" X Wire "+(wire.storageHealthy?"STORAGE_AVAILABLE":"STORAGE_UNAVAILABLE")+
   ": "+additions.length+" X research leads; "+unhealthy+"/"+
   wire.accounts.length+" accounts incomplete/unavailable. Social posts are non-evidentiary.";
 return {...input,items:[...input.items,...additions],
  summary:(input.summary||"").slice(0,3900)+summary};
}
