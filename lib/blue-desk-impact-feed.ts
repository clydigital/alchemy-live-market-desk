/**
 * Ranked public Bluebelly reading queue. Uses admitted, source-verified NewsBrief
 * facts only; Motion commentary is shown as a *question*, never factual evidence.
 * Never changes canonical Stories, Regimes, thesis versions or source state.
 */
import { selectVerifiedNewsBriefs, type NewsBriefV1 } from "./market-brief-news.ts";
import { marketMotionAttention, type MarketMotionRecord } from "./market-motion.ts";

export type BlueDeskImpactItem = {
  fact: NewsBriefV1;
  score: number;
  attention: "MAJOR" | "WATCH" | "ROUTINE";
  category: MarketMotionRecord["category"];
  assets: string[];
  /** Research angle is not source-certified market impact or price reaction. */
  researchAngle: string | null;
  nextCheck: string;
  isSourceOnly: true;
};

const NON_EDITORIAL = /(?:evidence gap|source audit|provider authentication|ingestion pipeline|database|task status|canonical lineage|pipeline validation|Dossier status)/i;
const GENERIC = /^(?:check|monitor|assess|evaluate|verify|review|investigate|look for|confirm)(?: the| whether| if)? (?:market reaction|price action|broader markets|impact|development|next steps)[.!]?$/i;

function contextQuestion(category:MarketMotionRecord["category"]):string {
  if(category==="ENERGY"||category==="GEOPOLITICS")return "Does this change physical supply, shipping costs or the oil-inflation path? Compare source-dated energy and rates.";
  if(category==="POLICY"||category==="MACRO")return "Did rate expectations change after this release? Compare matched observation times for the dollar, Treasury yields and equities.";
  if(category==="COMPANY"||category==="EARNINGS"||category==="SECTOR")return "Does the new company information change earnings or capital spending assumptions? Check dated sector, credit and price data.";
  if(category==="MARKET_STRUCTURE")return "Is this a lasting market-structure change or a short-lived flow? Compare independent source observations.";
  if(category==="COMMODITY")return "Does this affect physical supply, inventories or inflation? Check independent prices and source dates.";
  return "Which dated market observations would support or challenge this development?";
}

function compact(value:unknown,max:number):string|null{
  if(typeof value!=="string")return null;
  const s=value.replace(/\s+/g," ").trim();
  return s.length>=24&&!NON_EDITORIAL.test(s)?s.slice(0,max).trim():null;
}

export function rankBlueDeskImpactFeed(
  input: readonly MarketMotionRecord[],now=new Date(),limit=6,
):BlueDeskImpactItem[]{
  const admitted=selectVerifiedNewsBriefs(input,now,18);
  const byId=new Map(input.map(item=>[item.id,item]));
  const timestamp=now.getTime();
  return admitted.flatMap(fact=>{
    const source=byId.get(fact.id);
    if(!source)return [];
    // Reuse the existing model-independent materiality/relevance/novelty gate.
    const attention=marketMotionAttention(source);
    const ageHours=Math.max(0,(timestamp-Date.parse(fact.occurredAt))/3_600_000);
    const importance=Math.round(Math.max(0,Math.min(100,attention.score-Math.min(10,ageHours*.24))));
    const assets=(source.tickers||[])
      .filter(t=>/^[A-Z0-9.^-]{1,12}$/.test(t)).slice(0,5);
    const researchAngle=compact(source.why_interesting,190);
    const test=compact(source.next_test,225);
    return [{
      fact,score:importance,
      attention:(importance>=78?"MAJOR":importance>=62?"WATCH":"ROUTINE") as BlueDeskImpactItem["attention"],
      category:source.category,assets,researchAngle,
      nextCheck:test&&!GENERIC.test(test)?test:contextQuestion(source.category),
      isSourceOnly:true as const,
    }];
  }).sort((a,b)=>b.score-a.score||Date.parse(b.fact.occurredAt)-Date.parse(a.fact.occurredAt))
    .slice(0,Math.max(0,Math.min(8,limit)));
}
