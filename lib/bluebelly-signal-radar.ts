import type {TopicInfluenceRead,InfluenceTopic,InfluenceLead} from "./bluebelly-topic-influence.ts";
import {getManualSweeps} from "./bluebelly-manual-sweeps.ts";
import {suggestSignalTags,type SignalTag} from "./bluebelly-signal-tags.ts";

export type SignalRadarEntry=Readonly<{
 id:string;topic:InfluenceTopic;title:string;reason:string;nextTest:string;
 tags:SignalTag[];sourceAt:string;sourceName:string;sourceUrl:string;
 verification:"AUTOMATED LEAD"|"RESEARCH LEAD"|"SOURCE-CORROBORATED EVENT";
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
export function buildSignalRadar(feeds:readonly TopicInfluenceRead[],now=new Date(),limit=12):SignalRadarEntry[]{
 const entries:SignalRadarEntry[]=[];
 const topics=[...new Set(feeds.map(feed=>feed.topic))];
 for(const topic of topics){
  let count=0;
  for(const sweep of getManualSweeps(topic,now,4)){
   const finding=sweep.findings.find(x=>x.status==="SOURCE_CORROBORATED")||sweep.findings[0];
   const tags=suggestSignalTags({title:sweep.title,detail:finding.reason,
    nextCheck:finding.nextCheck,evidence:finding.status});
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
 return entries.sort((a,b)=>b.sourceAt.localeCompare(a.sourceAt)||priority(b)-priority(a)||a.topic.localeCompare(b.topic)).slice(0,limit);
}
