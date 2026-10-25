import type {NotionResearchBundle} from "./notion-market-research.ts";
import type {DailyResearchPacket} from "./daily-report-research-packet.ts";
import type {NewsBriefV1} from "./market-brief-news.ts";

export type DailyResearchHealth={
  contractVersion:"daily-report-health/1";
  assessedAt:string;
  status:"NOTION_NOT_CONFIGURED"|"NOTION_UNAVAILABLE"|"COVERAGE_PARTIAL"|"READY_FOR_ANALYST_REVIEW";
  message:string;
  sources:{macroPulsePosts:number;researchGapRuns:number;exactOriginalMatches:number;unverifiedCandidateLinks:number};
  news:{qualifiedCount:number;latestEventAt:string|null;within48h:number};
  checks:{notionAvailable:boolean;gateIncluded:boolean;fullPulseIncluded:boolean;independentNewsPresent:boolean};
  nextActions:string[];
};
/**
 * Private operational status, not publication approval or market judgement.
 * A READY_FOR_ANALYST_REVIEW packet still contains unverified research leads.
 */
export function assessDailyResearchHealth(input:{
  now:Date;notion:NotionResearchBundle;packet:DailyResearchPacket;news:readonly NewsBriefV1[];
}):DailyResearchHealth {
  const now=input.now.getTime();
  const sources=input.notion.sources;
  const macro=sources.filter(s=>s.kind==="MACROPULSE").length;
  const gap=sources.filter(s=>s.kind==="RESEARCH_GAP").length;
  const candidates=input.packet.researchSourceCandidates||[];
  const exact=candidates.filter(c=>c.verification==="EXACT_NEWS_SOURCE_MATCH").length;
  const news=input.news.filter(n=>n.verification==="SOURCE_VERIFIED" &&
    Number.isFinite(Date.parse(n.occurredAt)) && Date.parse(n.occurredAt)<=now);
  const fresh=news.filter(n=>now-Date.parse(n.occurredAt)<=48*3600_000);
  const latest=news.length?news.map(n=>n.occurredAt).sort().at(-1)!:null;
  const notionAvailable=input.notion.status!=="NOT_CONFIGURED"&&input.notion.status!=="UNAVAILABLE";
  const partial=input.notion.status==="PARTIAL"||macro<2||gap<1||input.notion.warnings.length>0;
  const status:DailyResearchHealth["status"]=input.notion.status==="NOT_CONFIGURED"
    ?"NOTION_NOT_CONFIGURED":input.notion.status==="UNAVAILABLE"
    ?"NOTION_UNAVAILABLE":partial?"COVERAGE_PARTIAL":"READY_FOR_ANALYST_REVIEW";
  const message={
    NOTION_NOT_CONFIGURED:"Notion server token is absent. Only other source-qualified inputs are available.",
    NOTION_UNAVAILABLE:"Notion could not be read. Confirm integration sharing, permissions and availability.",
    COVERAGE_PARTIAL:"Some MacroPulse/Gate material was read, but completeness has not been established.",
    READY_FOR_ANALYST_REVIEW:"Full expected Notion inputs were read; individual claims still require verification.",
  }[status];
  const nextActions:string[]=[];
  if(status==="NOTION_NOT_CONFIGURED")nextActions.push(
    "Set server-only NOTION_API_TOKEN in Vercel and share the MacroPulse root and Research Gap data source with the read-only Notion integration.");
  else if(status==="NOTION_UNAVAILABLE")nextActions.push(
    "Check the authorised Notion integration, source-page sharing and full-post retrieval; do not reuse cached material as current.");
  else if(partial)nextActions.push(
    "Inspect the source-page list and partial-coverage warnings; recover full qualifying posts before calling the sweep complete.");
  if(!fresh.length)nextActions.push(
    "No recent independently source-verified News is in this packet. Verify original documents before making fresh factual claims.");
  if(!exact&&candidates.length)nextActions.push(
    "Notion source links have no exact independently verified News receipt in this packet. Treat all as investigation candidates.");
  nextActions.push("Draft only as unapproved analyst copy; original-source review, rights and fixed PDF require separate owner approval.");
  return {
    contractVersion:"daily-report-health/1",assessedAt:input.now.toISOString(),
    status,message,
    sources:{macroPulsePosts:macro,researchGapRuns:gap,exactOriginalMatches:exact,
      unverifiedCandidateLinks:candidates.length-exact},
    news:{qualifiedCount:news.length,latestEventAt:latest,within48h:fresh.length},
    checks:{notionAvailable,gateIncluded:gap>0,fullPulseIncluded:macro>=2,
      independentNewsPresent:fresh.length>0},nextActions,
  };
}
