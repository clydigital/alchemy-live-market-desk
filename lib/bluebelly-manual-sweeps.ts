import ledger from "../data/bluebelly-manual-sweeps.json" with {type:"json"};
import type {InfluenceTopic} from "./bluebelly-topic-influence.ts";
import {isReviewedValuationComparison,type ValuationComparison} from "./bluebelly-signal-tags.ts";

export type ManualSweepFinding={
 reason:string;
 sourceName:string;
 sourceUrl:string;
 sourcePublishedAt:string;
 status:"RESEARCH_LEAD"|"SOURCE_CORROBORATED"|"CONTRADICTED";
 nextCheck:string;
 /** Explicit, dual-source valuation comparison; rejected if incomplete. */
 reviewedValuation?:ValuationComparison;
};
export type ManualSweep={
 id:string;topic:InfluenceTopic;date:string;researchAt:string;title:string;
 findings:ManualSweepFinding[];
};
const TOPICS=new Set(["hormuz","fed","bonds","ai","china","energy","yen","breadth","gold","housing"]);
const text=(value:unknown,max=260)=>typeof value==="string"?value.replace(/\s+/g," ").trim().slice(0,max):"";
const properDate=(value:unknown):value is string=>typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+"T00:00:00Z"))&&new Date(value+"T00:00:00Z").toISOString().slice(0,10)===value;
function httpsSource(value:unknown):string|null{
 if(typeof value!=="string")return null;
 try{
  const url=new URL(value);
  if(url.protocol!=="https:"||url.username||url.password||url.port||!url.hostname.includes("."))return null;
  return url.toString();
 }catch{return null;}
}
function asSourceFinding(value:unknown,now:Date):ManualSweepFinding|null{
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const row=value as Record<string,unknown>;
 const reason=text(row.reason,380),sourceName=text(row.sourceName,100),sourceUrl=httpsSource(row.sourceUrl);
 const sourcePublishedAt=text(row.sourcePublishedAt,40),sourceMs=Date.parse(sourcePublishedAt);
 const status=row.status;
 if(!reason||!sourceName||!sourceUrl||!Number.isFinite(sourceMs)||sourceMs>now.getTime()+300000||
    !["RESEARCH_LEAD","SOURCE_CORROBORATED","CONTRADICTED"].includes(String(status)))return null;
 const candidate=row.reviewedValuation as ValuationComparison|undefined;
 const reviewedValuation=status==="SOURCE_CORROBORATED"&&isReviewedValuationComparison(candidate)&&
  candidate!.priceObservedOn<=new Date(now.getTime()+8*3600000).toISOString().slice(0,10)?candidate:undefined;
 return {reason,sourceName,sourceUrl,sourcePublishedAt,status:status as ManualSweepFinding["status"],
  nextCheck:text(row.nextCheck,300),...(reviewedValuation?{reviewedValuation}:{})};
}
/** Only editor-committed, exact-source and date-vetted manual notes are public.
 * Git commits are the audit trail; the application never turns chat into a public write.
 */
export function selectManualSweeps(value:unknown,topic:InfluenceTopic,now=new Date(),limit=2):ManualSweep[]{
 if(!value||typeof value!=="object"||Array.isArray(value))return [];
 const data=value as Record<string,unknown>;
 if(data.version!==1||!Array.isArray(data.sweeps)||!TOPICS.has(topic))return [];
 const seen=new Set<string>(),result:ManualSweep[]=[];
 for(const raw of data.sweeps){
  if(!raw||typeof raw!=="object"||Array.isArray(raw))continue;
  const row=raw as Record<string,unknown>;
  const id=text(row.id,90),date=row.date,title=text(row.title,180),researchAt=text(row.researchAt,50);
  const researchMs=Date.parse(researchAt);
  const mytToday=new Date(now.getTime()+8*3600000).toISOString().slice(0,10);
  if(!/^[a-z0-9][a-z0-9-]{5,89}$/.test(id)||seen.has(id)||row.topic!==topic||
    !properDate(date)||date>mytToday||!title||!Number.isFinite(researchMs)||researchMs>now.getTime()+300000||
    !Array.isArray(row.findings))continue;
  const findings=row.findings.slice(0,6).map(v=>asSourceFinding(v,now)).filter((v):v is ManualSweepFinding=>!!v);
  if(!findings.length)continue;
  seen.add(id);result.push({id,topic,date,researchAt,title,findings});
 }
 return result.sort((a,b)=>b.researchAt.localeCompare(a.researchAt)).slice(0,limit);
}
export function getManualSweeps(topic:InfluenceTopic,now=new Date(),limit=2){
 return selectManualSweeps(ledger as unknown,topic,now,limit);
}
