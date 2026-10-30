import type {NewsBriefV1} from "./market-brief-news.ts";
import type {ArchiveNewsItem} from "./bluebelly-publication-archive.ts";
import type {NewsroomEditorialItem} from "./bluebelly-newsroom-editorial.ts";

/** Newsroom-only daily editorial shortlist. No new publication, evidence,
 * market-reaction or canonical regime verdict is created.
 * Source-qualified originals and previously reviewed public readers only.
 * Date-only issuer results are held out until the next UTC day.
 */
export type HotPickKey = string;
export type NewsroomHotPicks = {etDay:string;keys:HotPickKey[]};
type Candidate={
 key:HotPickKey;eventType:string;topic:string;at:number;
 score:number;sourceUrl:string;
};
export function easternCalendarDay(now:Date):string|null {
 if(!Number.isFinite(+now))return null;
 const parts=new Intl.DateTimeFormat("en-GB",{
   timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",
 }).formatToParts(now);
 const y=parts.find(p=>p.type==="year")?.value;
 const m=parts.find(p=>p.type==="month")?.value;
 const d=parts.find(p=>p.type==="day")?.value;
 return y&&m&&d?y+"-"+m+"-"+d:null;
}
function stableDailyTie(key:string,etDay:string):number{
 // Only a small tie-break, never a reason to displace materially higher-impact news.
 let hash=2166136261;
 for(const code of key+"|"+etDay)hash=Math.imul(hash^code.charCodeAt(0),16777619);
 return ((hash>>>0)%7);
}
function mainTopic(tags:readonly string[]):string{
 if(tags.includes("ENERGY"))return "ENERGY";
 if(tags.includes("RATES_BONDS")||tags.includes("ECONOMY"))return "MACRO";
 if(tags.includes("AI_TECHNOLOGY"))return "AI";
 if(tags.includes("EQUITIES"))return "EQUITIES";
 return tags[0]||"OTHER";
}
function freshPoints(ageDays:number):number{
 return Math.max(0,Math.round(45-ageDays*7));
}
const DAY=86400000;
/** No padding with schedules, rumours, stale research or hypothetical events. */
export function selectNewsroomHotPicks(
 news:readonly NewsBriefV1[],archive:readonly ArchiveNewsItem[],now:Date,
 limit=5,editorials:readonly NewsroomEditorialItem[]=[],
):NewsroomHotPicks{
 const etDay=easternCalendarDay(now);
 if(!etDay||!Number.isInteger(limit)||limit<3||limit>5)return {etDay:etDay||"",keys:[]};
 const utcDay=now.toISOString().slice(0,10);
 const candidates:Candidate[]=[];
 const archiveUrls=new Set(archive.map(a=>a.sourceUrl));
 const editorialUrls=new Set(editorials.map(e=>e.sourceUrl));
 for(const item of editorials){
  const at=Date.parse(item.occurredAt);
  if(!Number.isFinite(at)||at>+now||+now-at>7*DAY)continue;
  const ageDays=(+now-at)/DAY;
  const topic=item.kind==="incident"?"CRYPTO":item.kind==="bank"?"MACRO":item.kind==="earnings"?"EQUITIES":"AI";
  const priority=item.kind==="incident"?102:item.kind==="bank"?90:item.kind==="earnings"?84:65;
  candidates.push({key:"editorial:"+item.id,eventType:"EDITORIAL_"+item.kind,topic,at,
   score:priority+freshPoints(ageDays)+stableDailyTie(item.id,etDay),sourceUrl:item.sourceUrl});
 }

 for(const item of archive){
  if(editorialUrls.has(item.sourceUrl))continue;
  const dateOnly=item.eventDay!==null;
  // A date-only announcement may still be ahead of its actual release.
  if(dateOnly&&item.eventDay!>=utcDay)continue;
  const at=dateOnly?Date.parse(item.eventDay!+"T00:00:00Z"):Date.parse(item.eventAt||"");
  if(!Number.isFinite(at)||at>+now)continue;
  const ageDays=(+now-at)/DAY;
  if(ageDays>8)continue; // Archive reader itself enforces <=7d.
  const basis=item.eventType==="POLICY_DECISION"?88:
   item.eventType==="ECONOMIC_RELEASE"?86:
   item.eventType==="EARNINGS"?79:68;
  const topic=mainTopic(item.topics);
  const topicBonus=topic==="ENERGY"||topic==="MACRO"||topic==="AI"?5:0;
  candidates.push({key:"archive:"+item.id,eventType:item.eventType,topic,at,
   score:basis+topicBonus+freshPoints(ageDays)+stableDailyTie(item.id,etDay),
   sourceUrl:item.sourceUrl});
 }
 for(const item of news){
  if(item.verification!=="SOURCE_VERIFIED"||archiveUrls.has(item.sourceUrl)||editorialUrls.has(item.sourceUrl))continue;
  const at=Date.parse(item.occurredAt);
  if(!Number.isFinite(at)||at>+now||+now-at>7*DAY)continue;
  const desc=(item.headline+" "+item.summary).toLowerCase();
  // Headline content is used for shortlist diversity, not to assert an event fact.
  const topic=/\b(oil|brent|diesel|hormuz|lng|crude)\b/.test(desc)?"ENERGY":
   /\b(fed|fomc|cpi|pce|yield|treasury|interest rate|central bank)\b/.test(desc)?"MACRO":
   /\b(ai|gpu|chips?|semiconductor|hyperscaler|cloud)\b/.test(desc)?"AI":"OTHER";
  candidates.push({key:"news:"+item.id,eventType:"NEWS_BRIEF",topic,at,
   score:76+(topic==="OTHER"?0:5)+freshPoints((+now-at)/DAY)+stableDailyTie(item.id,etDay),
   sourceUrl:item.sourceUrl});
 }
 candidates.sort((a,b)=>b.score-a.score||b.at-a.at||a.key.localeCompare(b.key));
 const selected:Candidate[]=[];
 const seenUrls=new Set<string>(),byType=new Map<string,number>(),byTopic=new Map<string,number>();
 // First pass prioritises distinct stories, rather than five near-identical chip headlines.
 for(const item of candidates){
  if(selected.length>=limit)break;
  if(seenUrls.has(item.sourceUrl)||
     (byType.get(item.eventType)||0)>=2||
     (byTopic.get(item.topic)||0)>=2)continue;
  selected.push(item);seenUrls.add(item.sourceUrl);
  byType.set(item.eventType,(byType.get(item.eventType)||0)+1);
  byTopic.set(item.topic,(byTopic.get(item.topic)||0)+1);
 }
 // Fill remaining places with qualified releases, never scheduled future items.
 for(const item of candidates){
  if(selected.length>=limit)break;
  if(seenUrls.has(item.sourceUrl))continue;
  selected.push(item);seenUrls.add(item.sourceUrl);
 }
 return {etDay,keys:selected.map(item=>item.key)};
}
