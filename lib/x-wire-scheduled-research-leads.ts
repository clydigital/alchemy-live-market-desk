import {createHash} from "node:crypto";
import {rankXWireMarketCandidates} from "./x-wire-market-candidates.ts";
import type {ResearchRunInput,IntakeItemInput} from "./research-update.ts";
import type {XWireDurable} from "./x-wire-durable.ts";

/** X is a source of investigation prompts only. It never proves the reported
 * market event, supply change, price move or canonical Story mutation. */
export function attachXWireResearchLeads(input:ResearchRunInput,
 wire:Pick<XWireDurable,"posts"|"accounts"|"storageHealthy">,now=new Date()):ResearchRunInput{
 const ranked=wire.storageHealthy?rankXWireMarketCandidates(wire.posts,now,12):[];
 const existing=new Set(input.items.map(x=>x.url));
 const additions:IntakeItemInput[]=[];
 for(const {post,theme,priority} of ranked){
  if(existing.has(post.url))continue;
  additions.push({
   itemKey:"x-wire-lead:"+createHash("sha256").update(post.url).digest("hex").slice(0,24),
   itemType:"news",publisher:"X/@"+post.handle,
   title:post.text.slice(0,200),url:post.url,publishedAt:post.publishedAt,
   summary:"UNVERIFIED X CLAIM / "+theme+" — independent corroboration required. "+post.text.slice(0,1250),
   sourceQuality:35,relevance:priority,novelty:78,materiality:Math.min(88,priority),
   recommendedAction:"collect_evidence",evidence:[],
   newsSignal:"X Wire "+theme+" catalyst candidate, not proof of a market event or observed reaction.",
   reviewReason:"X Wire attributed third-party discovery only (unverified). Cross-check original issuer, government, exchange, regulator, shipping sensor or publisher sources. Original post existence does not prove its claim; no Story/Dossier mutation without canonical evidence."
  });
  existing.add(post.url);
 }
 const unhealthy=wire.accounts.filter(a=>a.status==="unavailable"||
   a.status==="blocked"||a.status==="partial"||a.status==="unconfigured").length;
 const summary=" X Wire "+(wire.storageHealthy?"STORAGE_AVAILABLE":"STORAGE_UNAVAILABLE")+
   ": "+additions.length+" unverified market leads; "+unhealthy+"/"+
   wire.accounts.length+" accounts incomplete/unavailable. Shared discovery only; no facts admitted.";
 return {...input,items:[...input.items,...additions],
  summary:(input.summary||"").slice(0,3700)+summary};
}
