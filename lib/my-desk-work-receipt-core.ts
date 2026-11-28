import {lane,fresh,latest,myt,type HealthLane} from "./my-desk-health-core.ts";
import type {CreatorDigest} from "./bluebelly-creator-signals.ts";
type Obj=Record<string,unknown>;
const obj=(v:unknown):Obj=>v&&typeof v==="object"&&!Array.isArray(v)?v as Obj:{};
const txt=(v:unknown)=>Array.isArray(v)?v.map(t=>{const a=obj(t);return typeof a.plain_text==="string"?a.plain_text:typeof obj(a.text).content==="string"?obj(a.text).content:""}).join(""):"";
const prop=(r:unknown,k:string)=>obj(obj(obj(r).properties)[k]);
const val=(r:unknown,k:string)=>{const p=prop(r,k);return typeof obj(p.select).name==="string"?String(obj(p.select).name):txt(p.title??p.rich_text)};
const time=(v:unknown,now:Date)=>typeof v==="string"&&Number.isFinite(Date.parse(v))&&Date.parse(v)<=+now?v:null;
const at=(r:unknown,k:string,now:Date)=>time(obj(prop(r,k).date).start,now);
const created=(r:unknown,now:Date)=>time(obj(r).created_time,now);
const today=(now:Date)=>new Date(+now+8*3600000).toISOString().slice(0,10);
const bounded=(r:unknown)=>Array.isArray(obj(r).results)?(obj(r).results as unknown[]).slice(0,24):[];
const completeResult=(r:unknown)=>Array.isArray(obj(r).results);
const oneOf=(s:string,allowed:string[])=>allowed.includes(s)?s:"Unknown";
const unknown=(label:string,gaps:string)=>lane(label,{gaps});
export function projectMacroLog(raw:unknown,now:Date):HealthLane{
 if(!completeResult(raw))return unknown("MacroPulse","Existing private Log receipt unavailable");
 const slotAt=(r:unknown)=>{
  const date=val(r,"Date Key"),slot=val(r,"MYT Slot"),id=val(r,"Pulse ID");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(slot))return null;
  const key=date.replace(/-/g,"")+"-"+slot.replace(":","");
  return (id===key||id==="MP-"+key)?time(date+"T"+slot+":00+08:00",now):null;
 };
 const rows=bounded(raw).filter(r=>slotAt(r)!==null).sort((a,b)=>Date.parse(slotAt(b)!)-Date.parse(slotAt(a)!));
 const r=rows[0];if(!r)return unknown("MacroPulse","No scheduled Log in bounded receipt window; manual records do not prove scheduled delivery");
 const status=oneOf(val(r,"Status"),["PUBLISHED","QUALIFIED","UNPUBLISHED","SKIPPED"]);
 const success=latest(rows.filter(x=>["PUBLISHED","QUALIFIED"].includes(val(x,"Status"))&&typeof prop(x,"Post URL").url==="string"&&String(prop(x,"Post URL").url).startsWith("https://")).map(x=>at(x,"Published At",now)));
 const date=val(r,"Date Key"),isCurrent=date===today(now);
 const count=prop(r,"Source Count").number;
 const post=typeof prop(r,"Post URL").url==="string"&&String(prop(r,"Post URL").url).startsWith("https://");
 return lane("MacroPulse",{success,execution:"Latest stored scheduled Log: "+status+" · "+(isCurrent?"current MYT day":"earlier MYT day"),
 coverage:(typeof count==="number"&&Number.isFinite(count)&&count>=0?count+" sources recorded":"Source count unknown")+"; "+(post?"Post URL recorded (not independently read back)":"Post link absent"),
 coverageComplete:null,fresh:fresh(success,now,24),partial:status==="UNPUBLISHED"||status==="SKIPPED"||!post,
 gaps:"Last stored Log created "+myt(created(r,now))+"; latest task attempt, fallback and any unsaved slots remain unverified"});
}
export function projectGapRun(raw:unknown,kind:"Material Events"|"Research Investigation",now:Date):HealthLane{
 if(!completeResult(raw))return unknown(kind,"Existing private Run receipt unavailable");
 const rows=bounded(raw).filter(r=>{const name=val(r,"Run");return kind==="Material Events"?/^ME-\d{8}-(?:MANUAL-)?\d{4}$/.test(name):!!name&&!name.startsWith("ME-")&&["AM","PM","MANUAL"].includes(val(r,"Session"))});
 const r=rows[0];if(!r)return unknown(kind,"No matching saved Run in bounded receipt window");
 const status=oneOf(val(r,"Status"),["COMPLETE","PARTIAL","FAILED"]),coverage=oneOf(val(r,"Coverage"),["GOOD","PARTIAL","MATERIAL GAP"]),input=oneOf(val(r,"Input Health"),["GOOD","PARTIAL","FAILED"]),quality=oneOf(val(r,"Research Quality"),["GOOD","DEGRADED","INSUFFICIENT"]),session=oneOf(val(r,"Session"),["AM","PM","MANUAL"]);
 const attempt=at(r,"Run At",now),saved=created(r,now);
 const success=latest(rows.filter(x=>["COMPLETE","PARTIAL"].includes(val(x,"Status"))).map(x=>created(x,now)));
 return lane(kind,{attempt,success,execution:"Saved "+session+" Run: "+status,
 coverage:"Coverage "+coverage+" · inputs "+input+" · research quality "+quality,
 coverageComplete:coverage==="PARTIAL"||coverage==="MATERIAL GAP"?false:null,
 fresh:fresh(attempt,now,24),failed:status==="FAILED",partial:status==="PARTIAL"||input==="PARTIAL"||input==="FAILED"||quality==="DEGRADED"||quality==="INSUFFICIENT",
 gaps:"Saved "+myt(saved)+"; "+(session==="MANUAL"?"manual recovery, scheduled execution not established; ":"")+"latest unsaved task attempts, exact provider fallback and consumer readback not established"});
}
export function projectAiMatrix(raw:unknown,now:Date):HealthLane{
 const [heading,body]=bounded(raw);const h=obj(heading),b=obj(body);
 if(h.type!=="heading_2"||b.type!=="paragraph")return unknown("AI16","Newest bounded parent blocks do not match a dated matrix receipt");
 const match=txt(obj(h.heading_2).rich_text).match(/^AI16(?: |_)DAILY(?: |_)MATRIX(?: |_)(\d{4}-\d{2}-\d{2})(?: | |_)(\d{2})(\d{2})(?: |_)MYT(?: |_)V\d+$/);
 const p=txt(obj(b.paragraph).rich_text).slice(0,4000);
 if(!match)return unknown("AI16","No exact dated matrix marker in first parent block; no broad historical scan");
 const stamp=time(match[1]+"T"+match[2]+":"+match[3]+":00+08:00",now);
 if(!stamp)return unknown("AI16","Invalid or future matrix date");
 const count=p.match(/\brow_count\s*=\s*(\d{1,2})\b/i),checks=p.match(/\bORIGINAL_SOURCE_CHECKS_COMPLETED\s*=\s*(\d{1,2})\/16\b/i);
 const n=count?Number(count[1]):null,k=checks?Number(checks[1]):null;
 const valid=n!==null&&n>=0&&n<=16,checked=k!==null&&k>=0&&k<=16;
 return lane("AI16",{success:stamp,execution:"Dated parent matrix marker read; task execution unverified",
 coverage:(valid?n+"/16 rows reported saved":"Row count unknown")+"; "+(checked?k+"/16 original checks reported":"Fresh issuer checks unknown"),
 coverageComplete:checked&&k!<16?false:null,partial:(valid&&n!<16)||(checked&&k!<16),fresh:fresh(stamp,now,24),
 gaps:"Matrix marker is not independent per-issuer verification; current source clocks, fallback and consumer readback not established"});
}
export function augmentCreatorLane(base:HealthLane,digest:CreatorDigest|null,now:Date):HealthLane{
 if(!digest||!time(digest.generatedAt,now))return base;
 const reviewed=digest.creators.filter(x=>x.sourceStatus==="reviewed").length,privateOnly=digest.creators.filter(x=>x.sourceStatus==="handoff_reviewed").length;
 const partial=/\bPARTIAL\b|\bDEGRADED\b/i.test(digest.coverage)||privateOnly>0;
 const reportedRecovery=digest.creators.filter(x=>x.sourceStatus==="handoff_reviewed"&&typeof x.changed==="string"&&/^RECOVERED\s*[—:-]/.test(x.changed)).length;
 const credit=digest.coverage.match(/ScrapeCreators last verified balance (\d{1,6})\b/i);
 return lane(base.label,{...base,execution:base.execution+"; saved digest "+myt(digest.generatedAt),
 coverage:base.coverage+"; digest "+reviewed+" reviewed / "+privateOnly+" private handoff reviews (not full roster coverage)",
 partial:base.partial||partial,fresh:base.fresh,coverageComplete:partial?false:base.coverageComplete,
 budget:credit?"ScrapeCreators last reported free balance: "+credit[1]:base.budget,
 gaps:base.gaps+(privateOnly?"; "+privateOnly+" private reviews require separate canonical intake readback":"")+"; digest timestamp is not new discovery or transcript timestamp",
 backup:reportedRecovery?reportedRecovery+" private recovery reported in saved digest; equivalent provider fallback chain not verified":base.backup});
}


/** Preserve the actual bounded reader failure instead of hiding it behind old receipts. */
export function workReceiptReadIssue(status:number|null):string|null {
 if(status===200)return null;
 if(status===401||status===403||status===404)return "Notion receipt access/configuration (HTTP "+status+")";
 if(status===429)return "Notion receipt rate limit (HTTP 429)";
 if(status===null)return "Notion receipt request unavailable";
 return "Notion receipt request failed (HTTP "+status+")";
}
export function annotateWorkReceiptRead(base:HealthLane,primaryIssue:string|null,operationalIssue:string|null):HealthLane {
 const issues=[...new Set([primaryIssue,operationalIssue].filter((x):x is string=>!!x))];
 if(!issues.length)return base;
 return lane(base.label,{...base,failure:issues.join("; "),partial:true,
 coverageComplete:false,gaps:base.gaps+"; "+issues.join("; ")+"; no replacement source clock inferred"});
}
export function preserveMacroReceiptGap(work:HealthLane,brief:HealthLane):HealthLane {
 if(work.execution!=="Unknown")return work;
 return lane(brief.label,{...brief,failure:work.failure,partial:work.partial||brief.partial,
 coverageComplete:work.partial?false:brief.coverageComplete,gaps:brief.gaps+"; "+work.gaps});
}


/** Only already configured server-side identities; no token creation or scope escalation. */
export function receiptReadTokens(primary:string|undefined,secondary:string|undefined):string[] {
 return [...new Set([primary?.trim(),secondary?.trim()].filter((v):v is string=>!!v))];
}
export type ReceiptReadResult={raw:unknown;issue:string|null;status:number|null};
export async function readReceiptWithScopedFallback(tokens:readonly string[],read:(token:string)=>Promise<ReceiptReadResult>):Promise<ReceiptReadResult>{
 if(!tokens.length)return {raw:null,issue:"Existing Notion receipt reader not configured",status:null};
 const first=await read(tokens[0]);
 // A 404 may mean the first integration cannot see this particular source.
 // One alternate preconfigured identity only. Do not retry quota or timeout.
 if(![401,403,404].includes(first.status??0)||!tokens[1])return first;
 const second=await read(tokens[1]);
 if(second.status===200)return second;
 return {...second,issue:second.issue+"; alternate configured integration also unsuccessful"};
}
