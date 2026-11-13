import type {TopicInfluenceRead,InfluenceTopic,InfluenceLead} from "./bluebelly-topic-influence.ts";
import {getManualSweeps} from "./bluebelly-manual-sweeps.ts";
import {suggestSignalTags,type SignalTag} from "./bluebelly-signal-tags.ts";
import {selectMeasuredMarketSignals,type MeasuredMarketSignal} from "./bluebelly-measured-market-signals.ts";
import type {MarketDivergenceRead} from "./bluebelly-market-divergence-watch.ts";
import type {MarketChangeWindow} from "./blue-desk-market-filters.ts";

export type SignalRadarEntry=Readonly<{
 id:string;topic:InfluenceTopic;title:string;reason:string;nextTest:string;
 tags:SignalTag[];sourceAt:string;sourceName:string;sourceUrl:string;
 verification:"AUTOMATED LEAD"|"RESEARCH LEAD"|"SOURCE-CORROBORATED EVENT"|"MEASURED MARKET GAP";
  secondarySource?:{name:string;url:string};
  measured?:MeasuredMarketSignal;
 href:string;
}>;
const hrefFor=(topic:InfluenceTopic)=>topic==="hormuz"?"/hormuz#influence-hormuz":
 "/regime-watch/"+topic+"#influence-"+topic;
function leadEntry(topic:InfluenceTopic,lead:InfluenceLead):SignalRadarEntry|null{
 const tags=suggestSignalTags({title:lead.title,detail:lead.source==="X"?lead.excerpt:lead.reason,
  nextCheck:lead.nextCheck,evidence:"AUTOMATED_LEAD"});
 if(!tags.length)return null;
 return {id:lead.id,topic,title:lead.title,reason:lead.reason,nextTest:lead.nextCheck,tags,
  sourceAt:lead.publishedAt,sourceName:lead.sourceName,sourceUrl:lead.url,verification:"AUTOMATED LEAD",href:hrefFor(topic)};
}
/** A bounded radar from the existing research ledgers. It adds no source query, cron,
 * new writer or automatic "mispricing" inference. Tags are investigation prompts.
 */
export function buildSignalRadar(feeds:readonly TopicInfluenceRead[],now=new Date(),limit=12,
 marketReadings:readonly MarketDivergenceRead[]=[],marketWindow:MarketChangeWindow="1D"):SignalRadarEntry[]{
 const entries:SignalRadarEntry[]=[];
 const topics=[...new Set(feeds.map(feed=>feed.topic))];
 for(const topic of topics){
  let count=0;
  for(const sweep of getManualSweeps(topic,now,4)){
   const finding=sweep.findings.find(x=>x.status==="SOURCE_CORROBORATED")||sweep.findings[0];
   const tags=suggestSignalTags({title:sweep.title,detail:finding.reason,
    nextCheck:finding.nextCheck,evidence:finding.status,reviewedValuation:finding.reviewedValuation});
   if(!tags.length)continue;
   entries.push({id:sweep.id,topic,title:sweep.title,reason:finding.reason.slice(0,240),nextTest:finding.nextCheck,
    tags,sourceAt:finding.sourcePublishedAt,sourceName:finding.sourceName,sourceUrl:finding.sourceUrl,
    verification:finding.status==="SOURCE_CORROBORATED"?"SOURCE-CORROBORATED EVENT":"RESEARCH LEAD",href:hrefFor(topic)});
   if(++count>=2)break;
  }
  const feed=feeds.find(x=>x.topic===topic);
  const mostRecent=[...(feed?.x||[]),...(feed?.creators||[])].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt))[0];
  if(mostRecent){const item=leadEntry(topic,mostRecent);if(item)entries.push(item);}
 }
 const priority=(e:SignalRadarEntry)=>e.verification==="SOURCE-CORROBORATED EVENT"?1:0;
 const sources=entries.sort((a,b)=>b.sourceAt.localeCompare(a.sourceAt)||priority(b)-priority(a)||a.topic.localeCompare(b.topic));
 // Reserve at most three slots for fresh, quantified pair gaps. Source leads
 // still dominate the bounded public radar, and missing quotes add no cards.
 const pairs=selectMeasuredMarketSignals(marketReadings,marketWindow,now,Math.min(3,Math.max(1,Math.ceil(limit/4))));
 const measured:SignalRadarEntry[]=pairs.map(pair=>({
  id:"market:"+pair.id,topic:pair.id==="energy-vs-consumer"?"energy":
   pair.id==="equal-vs-cap"||pair.id==="financials-vs-tech"?"breadth":"ai",
  title:pair.title,reason:pair.question+" "+
   pair.left+" "+(pair.leftChange>0?"+":"")+pair.leftChange.toFixed(2)+"% vs "+
   pair.right+" "+(pair.rightChange>0?"+":"")+pair.rightChange.toFixed(2)+
   "%; spread "+(pair.gapPp>0?"+":"")+pair.gapPp.toFixed(2)+" pp ("+pair.window+", "+pair.sourceSession+" matched session).",
  nextTest:pair.nextTest,tags:[pair.tag],sourceAt:pair.sourceSession,
  sourceName:pair.left+" original market data",sourceUrl:pair.leftSourceUrl,
  secondarySource:{name:pair.right+" original market data",url:pair.rightSourceUrl},
  measured:pair,verification:"MEASURED MARKET GAP",
  href:"/markets?mode=watch&window="+marketWindow+"#divergence-watch"
 }));
 return [...measured,...sources.slice(0,Math.max(0,limit-measured.length))].slice(0,limit);
}
