import "server-only";
import { acquireEventHorizonEvents } from "./event-horizon-acquisition.ts";
import { parseOfficialPressFeed } from "./official-press-news-intake.ts";
import { marketEventFromRow, type MarketEventRow } from "./market-event-persistence.ts";
import { intelligenceRest } from "./intelligence/supabase.ts";
import type { MarketEventV1 } from "./market-events.ts";
import type { OfficialSignal, CatalystLane } from "./bluebelly-catalyst-calendar.ts";
import { isMaterialCatalystHeadline } from "./bluebelly-catalyst-headline-policy.ts";

type Feed = { name:string; url:string; host:string; lane:CatalystLane; ticker?:string; test:RegExp };
/** Original-publisher feeds. These are discovery leads, NOT confirmed appointments. */
export const CATALYST_OFFICIAL_FEEDS:readonly Feed[] = [
  {name:"Apple Newsroom",url:"https://www.apple.com/newsroom/rss-feed.rss",host:"www.apple.com",lane:"technology",ticker:"AAPL",test:/\b(?:unveil(?:s|ed)?|introduc(?:es|ed)|launch(?:es|ed)?|reveal(?:s|ed)?|keynote|product event|special event)\b.*\b(?:iPhone|iPad|Mac|Watch|Vision|AirPods|Siri|AI|chip|device|product|model)\b|\b(?:iPhone|iPad|Mac|Watch|Vision|AirPods|Siri|AI|chip|device|product|model)\b.*\b(?:unveil(?:s|ed)?|introduc(?:es|ed)|launch(?:es|ed)?|reveal(?:s|ed)?|keynote)\b/i},
  {name:"NVIDIA Newsroom",url:"https://nvidianews.nvidia.com/cats/press_release.xml",host:"nvidianews.nvidia.com",lane:"technology",ticker:"NVDA",test:/\b(?:GTC|keynote|unveil(?:s|ed)?|introduc(?:es|ed)|launch(?:es|ed)?|reveal(?:s|ed)?|debut(?:s|ed)?)\b.*\b(?:AI|GPU|chip|Blackwell|Rubin|inference|data.center|platform|product|infrastructure|architecture)\b|\b(?:AI|GPU|chip|Blackwell|Rubin|inference|data.center|platform|product|infrastructure|architecture)\b.*\b(?:GTC|keynote|unveil(?:s|ed)?|introduc(?:es|ed)|launch(?:es|ed)?|reveal(?:s|ed)?|debut(?:s|ed)?)\b/i},
  {name:"White House statements",url:"https://www.whitehouse.gov/briefings-statements/feed/",host:"www.whitehouse.gov",lane:"diplomacy",test:/\b(?:ceasefire|peace deal|peace talks|peace negotiations|peace agreement|truce|hostilities|humanitarian corridor|sanctions relief|de.escalat|mediat(?:ion|or|ors)|negotiat(?:ion|ions|es|ed|ing))\b/i},
  {name:"Federal Reserve speeches published",url:"https://www.federalreserve.gov/feeds/speeches.xml",host:"www.federalreserve.gov",lane:"fed",test:/./},
  {name:"UN News",url:"https://news.un.org/feed/subscribe/en/news/all/rss.xml",host:"news.un.org",lane:"diplomacy",test:/\b(?:ceasefire|peace deal|peace talks|peace negotiations|peace agreement|truce|hostilities|humanitarian corridor|sanctions relief|de.escalat|mediat(?:ion|or|ors)|negotiat(?:ion|ions|es|ed|ing))\b/i},
];
function publisherLink(url:string,host:string) {
  try {
    const value = new URL(url);
    if(value.protocol!=="https:" || value.hostname.toLowerCase()!==host || value.username || value.password) return null;
    return value.href;
  }catch{return null}
}
export function classifyOfficialSignal(
  feed:Feed, item:{title:string;url:string;publishedAt:string}, now:Date,
):OfficialSignal|null {
  const url=publisherLink(item.url,feed.host),at=Date.parse(item.publishedAt);
  if(!url || !Number.isFinite(at) || at>now.getTime()+300_000 || at<now.getTime()-7*86_400_000) return null;
  if(!feed.test.test(item.title) || !isMaterialCatalystHeadline(feed.lane==="technology"?"technology":feed.lane==="diplomacy"?"diplomacy":"fed",item.title)) return null;
  return {id:feed.name+":"+url,title:item.title,sourceUrl:url,sourceName:feed.name,
    publishedAt:item.publishedAt,lane:feed.lane,ticker:feed.ticker};
}
export type RadarSourceState={name:string;state:"checked"|"unavailable"|"not_configured"|"stale";detail:string};
async function sourceSignals(feed:Feed,now:Date,fetchImpl:typeof fetch) {
  try {
    const resp=await fetchImpl(feed.url,{next:{revalidate:1800},headers:{Accept:"application/rss+xml,application/atom+xml,text/xml"},signal:AbortSignal.timeout(5_500)});
    if(!resp.ok) throw new Error("HTTP "+resp.status);
    const body=(await resp.text()).slice(0,210_000);
    const signals=parseOfficialPressFeed(body).flatMap(item=>{
      const candidate=classifyOfficialSignal(feed,item,now);return candidate?[candidate]:[];
    }).slice(0,5);
    return {signals,state:{name:feed.name,state:"checked",detail:"Checked official feed; new signals are not scheduled appointments."} as RadarSourceState};
  }catch{
    return {signals:[] as OfficialSignal[],state:{name:feed.name,state:"unavailable",detail:"Official feed unavailable; coverage incomplete."} as RadarSourceState};
  }
}
/** Never project private/editorial market-event rows to the public calendar. */
function isOfficialPublicEvent(event:MarketEventV1){
  if(event.verificationState!=="official")return false;
  try {
    const u=new URL(event.sourceUrl),host=u.hostname.toLowerCase();
    if(u.protocol!=="https:"||u.username||u.password)return false;
    const publicDomain = /(?:^|\\.)(?:gov|gov\\.uk|gov\\.au|gc\\.ca|federalreserve\\.gov|un\\.org|opec\\.org|ecb\\.europa\\.eu|boj\\.or\\.jp|bankofengland\\.co\\.uk|bankofcanada\\.ca|rba\\.gov\\.au|rbnz\\.govt\\.nz|tesla\\.com|apple\\.com|nvidia\\.com|microsoft\\.com|google\\.com|abc\\.xyz|amazon\\.com|aboutamazon\\.com|meta\\.com|atmeta\\.com)$/.test(host);
    return publicDomain;
  }catch{return false;}
}
async function storedEvents(now:Date):Promise<MarketEventV1[]>{
  try {
    const since=new Date(now.getTime()-2*86_400_000).toISOString().slice(0,10);
    const rows=await intelligenceRest<MarketEventRow[]>(
      "market_events?select=*&status=in.(scheduled,confirmed,reported)&start_at=gte."
      +encodeURIComponent(since)+"&order=start_at.asc&limit=240");
    return rows.flatMap(row=>{const event=marketEventFromRow(row);return event&&isOfficialPublicEvent(event)?[event]:[]});
  }catch{return []}
}
export async function getBluebellyCatalystSources({
  now=new Date(),fetchImpl=fetch,withFeeds=true,
}:{now?:Date;fetchImpl?:typeof fetch;withFeeds?:boolean}={}){
  const [horizon,stored,feeds]=await Promise.all([
    acquireEventHorizonEvents({fetchImpl,now}).catch(()=>({events:[] as MarketEventV1[],coverage:[],warnings:["Fed/OPEC horizon unavailable."]})),
    storedEvents(now),
    withFeeds?Promise.all(CATALYST_OFFICIAL_FEEDS.map(feed=>sourceSignals(feed,now,fetchImpl))):Promise.resolve([]),
  ]);
  const seen=new Set<string>();
  const events=[...horizon.events,...stored].filter(event=>{
    const k=event.eventType+":"+event.occurrenceKey;
    if(seen.has(k))return false;seen.add(k);return true;
  });
  return {
    events,
    signals: feeds.flatMap(row=>row.signals),
    coverage:[
      ...horizon.coverage.map(x=>({name:x.family,state:x.state==="covered"?"checked":x.state==="unsupported"?"not_configured":x.state==="stale"?"stale":"unavailable",detail:x.detail} as RadarSourceState)),
      ...feeds.map(x=>x.state),
    ],
    warnings:horizon.warnings,
  };
}
