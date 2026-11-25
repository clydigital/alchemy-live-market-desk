import { MATERIAL_RESEARCH_QUESTIONS, questionNews } from "./bluebelly-industry-intel.ts";
import { projectVerifiedMarketEvents,type VerifiedMarketEvent } from "./bluebelly-verified-event-read-model.ts";
import type { NewsBriefV1 } from "./market-brief-news.ts";

/** Stable research threads, NOT new canonical market events or confirmed commercial relationships.
 * Durable private lifecycle stays in the existing Research Gap Registry. The public projection
 * uses only the existing source-qualified news reader; quiet windows never resolve a thread.
 */
export type ResearchRole = "customer"|"supplier"|"possible_competitor"|"transaction_party"|"issuer"|"industry_peer";
export type ResearchRelationship = {company:string;role:ResearchRole;qualification:string};
const ROLES:Record<string,readonly ResearchRelationship[]> = {
 "google-accelerator-allocation":[
  {company:"GOOGL",role:"customer",qualification:"Procurement and total compute allocation to investigate"},
  {company:"AVGO",role:"supplier",qualification:"TPU order exposure to verify"},
  {company:"MediaTek",role:"supplier",qualification:"Reported variant allocation to verify"},
  {company:"NVDA",role:"possible_competitor",qualification:"Substitution is a hypothesis, not a confirmed order"}],
 "tesla-spacex-transaction":[
  {company:"TSLA",role:"transaction_party",qualification:"Standalone cash flows and governance; terms unconfirmed"},
  {company:"SPCX",role:"transaction_party",qualification:"Standalone cash flows and governance; terms unconfirmed"}],
};
export type IndustryEventThread = {
 id:string;title:string;question:string;next:string;companies:readonly string[];lenses:readonly string[];
 relationships:readonly ResearchRelationship[]; stage:"MONITORING_QUESTION";
 evidenceState:"RELATED_QUALIFIED_SOURCES"|"NO_MATCH_IN_BOUNDED_READER";
 latestRelatedEventAt:string|null; sources:VerifiedMarketEvent[];
};
export function projectIndustryEventThreads(items:readonly NewsBriefV1[], now=new Date()):IndustryEventThread[]{
 const since=new Date(now.getTime()-7*86400000).toISOString();
 const qualified=projectVerifiedMarketEvents(items,now,{since,limit:18}).events;
 return MATERIAL_RESEARCH_QUESTIONS.map(q=>{
  const sources=questionNews(q.id,qualified.map(e=>({...e,headline:e.title,summary:e.fact})))
    .map(({headline:_headline,summary:_summary,...e})=>e);
  const relationships=ROLES[q.id]??q.companies.map(company=>({company,role:"industry_peer" as const,qualification:"Research exposure to test; no confirmed causal impact"}));
  return {id:q.id,title:q.title,question:q.question,next:q.next,companies:q.companies,lenses:q.lenses,
   relationships,stage:"MONITORING_QUESTION",evidenceState:sources.length?"RELATED_QUALIFIED_SOURCES":"NO_MATCH_IN_BOUNDED_READER",
   latestRelatedEventAt:sources[0]?.occurredAt??null,sources};
 });
}
