import type {PublicTrendCard} from "./blue-desk-whats-new-trends.ts";

/** A RELATED observed series, never a measured response to this event.
 * Only use existing qualified, source-dated market monitor data. */
export type EvidenceTopic={title:string;fact:string;assets:readonly string[]};
export function topicTrendKey(topic:EvidenceTopic):string|null{
 const subject=(topic.title+" "+topic.assets.join(" ")).toLowerCase();
 if(/\b(?:hormuz|brent|wti|crude|oil|tanker|shipping|opec|lng)\b/.test(subject))return "energy";
 if(/\b(?:nvidia|nvda|micron|mu|tsmc|tsm|hynix|semiconductor|chips?|hbm|sandisk|sndk|amd)\b/.test(subject))return "semiconductors";
 if(/\b(?:jpy|yen|dxy|usd.?jpy|boj|bank of japan)\b/.test(subject))return "fx";
 if(/\b(?:treasur(?:y|ies)|10.year|30.year|bond|credit|spread|long.yield)\b/.test(subject))return "rates-long";
 if(/\b(?:fomc|federal reserve|\bfed\b|warsh|us2y|short.yield)\b/.test(subject))return "rates-short";
 if(/\b(?:spx|s&p|nasdaq|equities|stocks?|earnings|amazon|amzn|alphabet|googl|microsoft|msft|meta|apple|aapl)\b/.test(subject))return "equities";
 return null;
}
export function selectTopicTrend(topic:EvidenceTopic,cards:readonly PublicTrendCard[]):PublicTrendCard|null{
 const key=topicTrendKey(topic);
 const found=key?cards.find(c=>c.key===key):null;
 // A stale/proxy-only or unavailable observation must never masquerade
 // as a current event chart; the normal illustration remains the fallback.
 return found?.status==="ready"&&found.points.length>=6&&Boolean(found.sourceUrl)
   ?found:null;
}
