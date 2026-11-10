import type {InfluenceLead,InfluenceTopic,TopicInfluenceRead} from "./bluebelly-topic-influence.ts";
import {getManualSweeps,type ManualSweep, type ManualSweepFinding} from "./bluebelly-manual-sweeps.ts";

/** A relevance map, not security/portfolio authority or a recommendation model.
 * Do not infer issuer-level findings from a shared macro theme. */
export type PowerStackTracked={
 ticker:string;name:string;scope:"archived_holding"|"archived_watchlist"|"bond_watch";
};
export type PowerStackResearchGroup={
 topic:InfluenceTopic;title:string;channel:"THEME CONTEXT"|"PORTFOLIO-WIDE";
 transmission:string;assets:PowerStackTracked[];manual:ManualSweep|null;
 findings:ManualSweepFinding[];leads:InfluenceLead[];
 xState:TopicInfluenceRead["xState"];creatorState:TopicInfluenceRead["creatorState"];
};
const TOPICS=["bonds","ai","hormuz","gold","china","fed","breadth"] as const satisfies readonly InfluenceTopic[];
type PowerStackResearchTopic=(typeof TOPICS)[number];
const LABELS:Record<PowerStackResearchTopic,{title:string;transmission:string}>={
 bonds:{title:"Bonds & duration",transmission:"Interest rates, inflation and duration risk. A yield move does not establish a buy level for any ETF."},
 ai:{title:"AI funding & hardware",transmission:"Industry-level funding, capex and demand context. Nvidia governance news must not be treated as evidence against another issuer's orders."},
 hormuz:{title:"Oil, refining & shipping",transmission:"Diplomacy, physical flows and transport costs can affect these instruments differently. Direction and individual earnings effects remain unverified."},
 gold:{title:"Gold & real yields",transmission:"Gold, the dollar and real yields can diverge; this is a macro exposure check, not a commodity-price forecast."},
 china:{title:"China trade & technology",transmission:"Trade controls and policy can affect these businesses differently. Do not substitute China-wide news for issuer evidence."},
 fed:{title:"Fed & inflation backdrop",transmission:"Portfolio-wide policy backdrop. These are market-wide research questions, not ticker-specific causal findings."},
 breadth:{title:"Market breadth & risk appetite",transmission:"Portfolio-wide participation and volatility checks, not a direct trade signal for individual positions."},
};
/** Strict ticker allowlists avoid naive free-text/word matches and fake issuer attribution.
 * An unlisted ticker is left unmapped rather than guessed from a company name. */
const ASSETS:Partial<Record<PowerStackResearchTopic,readonly string[]>>={
 bonds:["TLT","IEF","SGOV","SHY","EDV","ZROZ","TIP","LQD","HYG","AGG","GOVT","USFR","TLH","BND","BNDX","VGIT","VGLT","SCHR","SCHZ"],
 ai:["NVDA","AMD","AVGO","MU","SMH","SOXX","DELL","CRDO","AMZN","MSFT","GOOGL","GOOG","META","ORCL","CRWV","CRM","TSM","SKHYNIX","000660.KS","QQQ"],
 hormuz:["XOM","CVX","HAL","BKR","SLB","MPC","PSX","VLO","LNG","MISC","STNG","OXY","COP","EOG","SHEL","BP","XLE","XOP"],
 gold:["GLD","GLDM","IAU","GDX","GDXJ","WPM","NEM","GOLD","XAUUSD"],
 china:["BABA","9988.HK","JD","9618.HK","PDD","BIDU","BILI","KWEB","FXI","MCHI"],
};
const lookup=new Map<string,Set<InfluenceTopic>>();
for(const [topic,names] of Object.entries(ASSETS) as [InfluenceTopic,readonly string[]][]){
 for(const ticker of names){
  const key=ticker.toUpperCase();const match=lookup.get(key)||new Set<InfluenceTopic>();
  match.add(topic);lookup.set(key,match);
 }
}
function norm(ticker:string){return ticker.trim().toUpperCase().replace(/\.US$/,"");}
const scopeRank:Record<PowerStackTracked["scope"],number>={
 archived_holding:0,archived_watchlist:1,bond_watch:2,
};
export function powerStackResearchTopics(assets:readonly PowerStackTracked[]):PowerStackResearchTopic[]{
 if(!assets.length)return [];
 const selected=new Set<InfluenceTopic>(["fed","breadth"]);
 for(const asset of assets){
  for(const topic of lookup.get(norm(asset.ticker))||[])selected.add(topic);
 }
 return TOPICS.filter(topic=>selected.has(topic));
}
/** Only server-side authenticated Power Stack callers should pass private asset lists.
 * Output is for that private page only; it must never become a public API or cached artifact. */
export function projectPowerStackResearch(
 assets:readonly PowerStackTracked[],reads:readonly TopicInfluenceRead[],now=new Date(),
):PowerStackResearchGroup[]{
 if(!assets.length)return [];
 const unique=new Map<string,PowerStackTracked>();
 for(const raw of assets){
  const ticker=norm(raw.ticker);
  if(!/^[A-Z0-9][A-Z0-9.\-]{0,18}$/.test(ticker))continue;
  const asset={ticker,name:raw.name.slice(0,90),scope:raw.scope};
  const before=unique.get(ticker);
  if(!before||scopeRank[asset.scope]<scopeRank[before.scope])unique.set(ticker,asset);
 }
 const tracked=[...unique.values()];
 const byTopic=new Map(reads.map(row=>[row.topic,row]));
 return powerStackResearchTopics(tracked).flatMap(topic=>{
  const scoped=topic==="fed"||topic==="breadth"?[]:tracked
   .filter(asset=>lookup.get(asset.ticker)?.has(topic))
   .sort((a,b)=>scopeRank[a.scope]-scopeRank[b.scope]||a.ticker.localeCompare(b.ticker));
  if(topic!=="fed"&&topic!=="breadth"&&!scoped.length)return [];
  const read=byTopic.get(topic);
  const current=getManualSweeps(topic,now,1)[0]||null;
  const leads=read?[...read.x.slice(0,1),...read.creators.slice(0,1)]
   .sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)):[];
  if(!current&&!leads.length&&read?.xState!=="UNAVAILABLE"&&read?.creatorState!=="UNAVAILABLE")return [];
  return [{
   topic,title:LABELS[topic].title,
   channel:topic==="fed"||topic==="breadth"?"PORTFOLIO-WIDE" as const:"THEME CONTEXT" as const,
   transmission:LABELS[topic].transmission,assets:scoped,
   manual:current,findings:current?.findings.slice(0,2)||[],leads,
   xState:read?.xState||"UNAVAILABLE",creatorState:read?.creatorState||"UNAVAILABLE",
  }];
 });
}
export function powerStackResearchHref(topic:InfluenceTopic):string{
 return topic==="hormuz"?"/hormuz#influence-hormuz":"/regime-watch/"+topic+"#influence-"+topic;
}
