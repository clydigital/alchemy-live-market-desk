import { createHash } from "node:crypto";
import type { MarketMonitorRow } from "./market-monitor.ts";
import { expectedMarketMeasurementDays } from "./scheduled-market-measurement-quality.ts";

/**
 * All 16 AI capital-cycle companies remain in scope. A Nasdaq US-listed
 * share/ADS close is NOT a Korean local-share price or a private valuation.
 */
export const AI_COMPANY_CLOSE_METHOD = "ai-issuer-nasdaq-close/1" as const;
export const AI_COMPANY_WATCH = [
  {name:"Alphabet",ticker:"GOOGL",monitorId:"googl",priceFeed:"NASDAQ_US"},
  {name:"Amazon",ticker:"AMZN",monitorId:"amzn",priceFeed:"NASDAQ_US"},
  {name:"Microsoft",ticker:"MSFT",monitorId:"msft",priceFeed:"NASDAQ_US"},
  {name:"Meta Platforms",ticker:"META",monitorId:"meta",priceFeed:"NASDAQ_US"},
  {name:"Oracle",ticker:"ORCL",monitorId:"orcl",priceFeed:"NASDAQ_US"},
  {name:"CoreWeave",ticker:"CRWV",monitorId:"crwv",priceFeed:"NASDAQ_US"},
  {name:"Nvidia",ticker:"NVDA",monitorId:"nvda",priceFeed:"NASDAQ_US"},
  {name:"AMD",ticker:"AMD",monitorId:"amd",priceFeed:"NASDAQ_US"},
  {name:"Micron",ticker:"MU",monitorId:"mu",priceFeed:"NASDAQ_US"},
  {name:"Broadcom",ticker:"AVGO",monitorId:"avgo",priceFeed:"NASDAQ_US"},
  {name:"TSMC US ADS",ticker:"TSM",monitorId:"tsm",priceFeed:"NASDAQ_US"},
  {name:"Samsung Electronics",ticker:"005930.KS",monitorId:null,priceFeed:"KOREAN_LOCAL_NOT_CONNECTED"},
  {name:"SK Hynix",ticker:"000660.KS",monitorId:null,priceFeed:"KOREAN_LOCAL_NOT_CONNECTED"},
  {name:"SpaceX AI",ticker:null,monitorId:null,priceFeed:"NO_SUPPORTED_LISTED_PRICE"},
  {name:"OpenAI",ticker:null,monitorId:null,priceFeed:"NO_SUPPORTED_LISTED_PRICE"},
  {name:"Anthropic",ticker:null,monitorId:null,priceFeed:"NO_SUPPORTED_LISTED_PRICE"},
] as const;

export type AiClose = {
  symbol:string;
  monitorId:string;
  observationDay:string;
  observedAt:string;
  closeUsd:number;
  sourceUrl:string;
  sourceName:string;
  externalEvidenceId:string;
  contentHash:string;
  priorCloseUsd:number|null;
  priceChangePercent:number|null;
};
export type AiCloseCandidates={
  items:AiClose[];
  gaps:string[];
  expectedSession:string;
  uncovered:Array<{name:string;ticker:string|null;reason:string}>;
};

function day(time:number):string|null{
  if(!Number.isFinite(time)||time<0)return null;
  return new Date(time*1000).toISOString().slice(0,10);
}
function exactSource(symbol:string) {
  return "https://www.nasdaq.com/market-activity/stocks/"+symbol.toLowerCase()+"/historical";
}
export function buildAiCompanyCloseCandidates(
  rows: readonly MarketMonitorRow[],
  now: Date,
):AiCloseCandidates{
  const expectedSession=expectedMarketMeasurementDays(now).usClose;
  const items:AiClose[]=[], gaps:string[]=[];
  const uncovered=AI_COMPANY_WATCH.filter(c=>c.monitorId===null).map(c=>({
    name:c.name,ticker:c.ticker as string|null,reason:c.priceFeed,
  }));
  for(const company of AI_COMPANY_WATCH){
    if(!company.monitorId || !company.ticker)continue;
    const symbol=company.ticker, id=company.monitorId;
    const matches=rows.filter(x=>x.id===id);
    if(matches.length!==1){
      gaps.push(symbol+":MISSING_OR_DUPLICATE_MONITOR_SERIES");continue;
    }
    const x=matches[0];
    if(x.symbol!==symbol||x.frequency!=="daily"
      ||x.sourceName!=="Nasdaq official stocks history"
      ||x.sourceUrl!==exactSource(symbol)){
      gaps.push(symbol+":SOURCE_IDENTITY_OR_FREQUENCY_MISMATCH");continue;
    }
    const observations=x.points.filter(p=>day(p.time)!==null
      &&day(p.time)!<=expectedSession
      &&Number.isFinite(p.close)&&p.close>0
      &&new Date(p.time*1000).getUTCHours()===0
      &&new Date(p.time*1000).getUTCMinutes()===0
    ).sort((a,b)=>a.time-b.time);
    const last=observations.at(-1);
    const latest=last?day(last.time):null;
    if(!last||!latest){
      gaps.push(symbol+":NO_FINISHED_SESSION_PRICE");continue;
    }
    const age=(Date.parse(expectedSession+"T00:00:00Z")-Date.parse(latest+"T00:00:00Z"))/86_400_000;
    if(age>7||age<0){
      gaps.push(symbol+":STALE_OR_FUTURE_QUOTE_"+latest);continue;
    }
    const forDay=observations.filter(x=>day(x.time)===latest);
    if(forDay.length!==1){
      gaps.push(symbol+":DUPLICATE_SAME_SESSION_PRICE");continue;
    }
    const prior=observations.filter(p=>p.time<last.time).at(-1)??null;
    const change=prior&&prior.close>0?Number(((last.close/prior.close-1)*100).toFixed(4)):null;
    const externalEvidenceId="ai-close:"+symbol+":"+latest;
    const contentHash=createHash("sha256").update(JSON.stringify({
      method:AI_COMPANY_CLOSE_METHOD,externalEvidenceId,sourceUrl:x.sourceUrl,
      close:last.close,priorDate:prior?day(prior.time):null,priorClose:prior?.close??null,
    })).digest("hex");
    items.push({
      symbol,monitorId:id,observationDay:latest,
      observedAt:latest+"T23:59:59.999Z",closeUsd:last.close,
      sourceUrl:x.sourceUrl,sourceName:x.sourceName,
      externalEvidenceId,contentHash,
      priorCloseUsd:prior?.close??null,priceChangePercent:change,
    });
  }
  return{items,gaps,expectedSession,uncovered};
}
