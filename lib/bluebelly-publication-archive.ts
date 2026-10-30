/** Pure public projection of an existing reviewed-reader archival receipt.
 * Not a source verification, editorial approval or canonical evidence writer.
 * Backend retains the record after it ages out of the visible seven-day feed.
 */
import type {ContentTopic,EventType} from "./bluebelly-content-contract.ts";

export type PublicArchiveRow={
 record_key:string;event_type:string;headline:string;
 event_at:string|null;event_day:string|null;
 source_url:string;source_name:string;reader_href:string;
 source_module:string;topics:unknown;entity_keys:unknown;
 publication_basis:string;approved_publication_id:string|null;
};
export type ArchiveNewsItem={
 id:string;headline:string;eventType:EventType;
 eventAt:string|null;eventDay:string|null;
 sourceName:string;sourceUrl:string;readerHref:string;
 topics:ContentTopic[];entityKeys:string[];
 verificationLabel:"REVIEWED PUBLIC READER SNAPSHOT"|"APPROVED PUBLICATION";
};
const SOURCE_MODULES=new Set([
 "lib/bluebelly-bank-decision-snapshots.ts",
 "lib/blue-desk-earnings-results.ts",
 "lib/blue-desk-official-macro-results.ts",
]);
const EVENT_TYPES=new Set(["EARNINGS","ECONOMIC_RELEASE","POLICY_DECISION"]);
const TOPICS=new Set<string>([
 "AI_TECHNOLOGY","RATES_BONDS","CREDIT_FINANCING","ENERGY",
 "GEOPOLITICS","EQUITIES","ECONOMY","FX","METALS","OTHER",
]);
function safeOriginalSource(raw:string):boolean{
 try{
  if(raw.length>2048)return false;
  const u=new URL(raw);
  return u.protocol==="https:"&&!u.username&&!u.password&&!u.hash&&
   u.pathname!=="/"&&!u.hostname.endsWith(".local")&&!u.hostname.endsWith(".internal");
 }catch{return false;}
}
function utc(v:string):boolean{
 return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(v) &&
  Number.isFinite(Date.parse(v));
}
function validDay(d:string):boolean{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return false;
 const value=new Date(d+"T00:00:00.000Z");
 return Number.isFinite(+value)&&value.toISOString().slice(0,10)===d;
}
function asTags(v:unknown,allowed:Set<string>):string[]|null{
 if(!Array.isArray(v)||v.length>12||!v.every(x=>typeof x==="string"&&allowed.has(x)))return null;
 return [...new Set(v)];
}
export function projectPublicArchive(
 rows:readonly PublicArchiveRow[],now:Date,days=7,
):ArchiveNewsItem[]{
 if(!Number.isFinite(+now)||!Number.isInteger(days)||days<1||days>7)return [];
 const cutoffIso=new Date(+now-days*86400000).toISOString();
 const cutoffDay=cutoffIso.slice(0,10);
 const today=now.toISOString().slice(0,10);
 const seen=new Set<string>();
 return rows.flatMap(row=>{
  if(!row||!SOURCE_MODULES.has(row.source_module)||!EVENT_TYPES.has(row.event_type)||
     !/^[a-z0-9][a-z0-9._-]{2,119}$/.test(row.record_key)||
     row.headline.trim().length<8||row.headline.length>300||
     !safeOriginalSource(row.source_url)||!row.source_name.trim()||
     (row.reader_href!=="/key-stories?postEvent="+row.record_key&&
      row.reader_href!=="/key-stories?brief="+row.record_key))
   return [];
  // A reviewed, public snapshot is a historical discovery receipt, not an
  // owner-approved editorial publication. Never upgrade this label implicitly.
  if(!["OBSERVED_PUBLIC_READER","APPROVED_WITH_RECEIPT"].includes(row.publication_basis)||
    (row.publication_basis==="APPROVED_WITH_RECEIPT"&&!row.approved_publication_id))return [];
  const eventAt=row.event_at,eventDay=row.event_day;
  if((eventAt===null)===(eventDay===null))return [];
  if(eventAt!==null&&(!utc(eventAt)||Date.parse(eventAt)>+now||eventAt<cutoffIso))return [];
  if(eventDay!==null&&(!validDay(eventDay)||eventDay>today||eventDay<cutoffDay))return [];
  const tags=asTags(row.topics,TOPICS);
  if(!tags||tags.length===0||!Array.isArray(row.entity_keys)||
    row.entity_keys.length>20||!row.entity_keys.every(k=>typeof k==="string"&&
      /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/.test(k)))return [];
  if(seen.has(row.record_key))return [];
  seen.add(row.record_key);
  return [{
   id:row.record_key,headline:row.headline,eventType:row.event_type as EventType,
   eventAt,eventDay,sourceName:row.source_name,sourceUrl:row.source_url,
   readerHref:row.reader_href,topics:tags as ContentTopic[],entityKeys:row.entity_keys as string[],
   verificationLabel:row.publication_basis==="APPROVED_WITH_RECEIPT"?
    "APPROVED PUBLICATION" as const:"REVIEWED PUBLIC READER SNAPSHOT" as const,
  }];
 }).sort((a,b)=>
   (b.eventAt||b.eventDay||"").localeCompare(a.eventAt||a.eventDay||"")||
   a.id.localeCompare(b.id));
}

/** Search aliases improve discovery without changing historical source data,
 * claiming a new entity relationship, or relabelling source verification.
 */
const ARCHIVE_ENTITY_ALIASES:Readonly<Record<string,string>>={
 FED:"FOMC Federal Open Market Committee Federal Reserve",
 BOC:"BoC Bank of Canada",
 RBNZ:"OCR Reserve Bank of New Zealand",
 "US-PCE":"PCE Personal Consumption Expenditures inflation BEA",
};
export function publicArchiveSearchIndex(item:ArchiveNewsItem):string{
 return [item.headline,item.sourceName,item.eventType,...item.entityKeys,
  ...item.topics,...item.entityKeys.map(k=>ARCHIVE_ENTITY_ALIASES[k]||"")]
  .join(" ").toLowerCase();
}
