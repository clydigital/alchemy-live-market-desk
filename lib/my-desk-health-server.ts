import "server-only";
import {createSupabaseAdminClient} from "./supabase/admin.ts";
import {X_CORE_ROSTER} from "./x-sweep-core.ts";
import {xWireFreshCheckComplete,xWireLiveFreshnessHours} from "./x-wire-pagination.ts";
import {CREATOR_ROSTER,isRatesOutlookTitle} from "./video-intake-policy.ts";
import {lane,latest,earliest,fresh,failureCategory,myt,type HealthLane} from "./my-desk-health-core.ts";
import {getOwnerWorkReceiptLanes} from "./my-desk-work-receipt-server";
import {getOwnerCreatorSignalDigest} from "./bluebelly-creator-signals-server";
import {augmentCreatorLane} from "./my-desk-work-receipt-core";

type DB=ReturnType<typeof createSupabaseAdminClient>;
const categories=(errors:(string|null|undefined)[])=>[...new Set(errors.map(failureCategory).filter(Boolean))].join("; ")||"Not recorded";
const budget=(errors:(string|null|undefined)[])=>errors.some(x=>failureCategory(x)==="Budget/credits limited")?"Budget/credit restriction recorded":"Unknown";
const next=(values:(string|null|undefined)[],now:Date)=>earliest(values.filter(x=>!!x&&Date.parse(x)>=now.getTime()));
const unknown=(label:string,gaps:string)=>lane(label,{gaps});
async function safe(label:string,read:()=>Promise<HealthLane>):Promise<HealthLane>{
 try{return await read()}catch{return lane(label,{failure:"Receipt read unavailable",gaps:"Could not read the canonical receipt; no health inferred"})}
}
async function xwire(db:DB,now:Date){
 const {data,error}=await db.from("x_wire_accounts").select("handle,health,last_attempt_at,last_completed_at,last_error,uncovered_before,page_cursor,next_attempt_at");
 if(error)throw error;
 const roster=new Set<string>(X_CORE_ROSTER.map(x=>x.handle.toLowerCase()));
 const rows=(data??[]).filter(r=>roster.has(r.handle.toLowerCase()));
 const complete=rows.filter(r=>xWireFreshCheckComplete(r,now,xWireLiveFreshnessHours(r.handle)));
 const gaps=rows.filter(r=>!!r.uncovered_before).length;
 const errors=rows.map(r=>r.last_error);
 const all=roster.size>0&&complete.length===roster.size&&gaps===0;
 const attempt=latest(rows.map(r=>r.last_attempt_at)),success=latest(rows.map(r=>r.last_completed_at));
 return lane("X Wire",{attempt,success,execution:attempt?"Per-account checks recorded":"No recorded attempt",
 coverage:complete.length+" / "+roster.size+" accounts with complete fresh checks",coverageComplete:rows.length?all:null,
 fresh:rows.length?complete.length===roster.size:null,failure:categories(errors),budget:budget(errors),
 gaps:(roster.size-complete.length)+" incomplete current checks; "+gaps+" historical gaps",
 retry:next(rows.map(r=>r.next_attempt_at),now),failed:!!attempt&&!success&&rows.length>0&&rows.every(r=>r.health==="unavailable"),partial:!!gaps});
}
async function creators(db:DB,now:Date){
 const names=CREATOR_ROSTER.map(c=>c.name);
 const start=new Date(now.getTime()+8*3600000).toISOString().slice(0,10)+"T00:00:00+08:00";
 const [day,last,attempt]=await Promise.all([
 db.from("research_intake_items").select("publisher,external_id,title,published_at,created_at,transcript_status,transcript_error_code,transcript_provider,transcript_next_attempt_at").eq("item_type","video").in("publisher",names).gte("published_at",start).lte("published_at",now.toISOString()).order("published_at",{ascending:false}).limit(200),
 db.from("research_intake_items").select("transcript_retrieved_at").eq("item_type","video").in("publisher",names).eq("transcript_status","ready").not("transcript_retrieved_at","is",null).order("transcript_retrieved_at",{ascending:false}).limit(1),
 db.from("research_intake_items").select("transcript_attempted_at").eq("item_type","video").in("publisher",names).not("transcript_attempted_at","is",null).order("transcript_attempted_at",{ascending:false}).limit(1)]);
 if(day.error||last.error||attempt.error)throw Error("creator receipt read failed");
 const raw=day.data??[];
 const rows=raw.filter(r=>r.publisher!=="ClearValueTax"||isRatesOutlookTitle(r.title));
 const unique=[...new Map([...rows].reverse().map(r=>[r.external_id||r.publisher+":"+r.title,r])).values()];
 const ready=unique.filter(r=>r.transcript_status==="ready").length;
 const missing=unique.filter(r=>r.transcript_status!=="ready");
 const order=new Map<string,number>(names.map((n,i)=>[n,i]));
 missing.sort((a,b)=>(order.get(a.publisher)??99)-(order.get(b.publisher)??99));
 const gaps=missing.slice(0,6).map(r=>r.publisher+": "+String(r.title||"Untitled").slice(0,100)).join(" · ");
 const errors=missing.map(r=>r.transcript_error_code);
 const success=last.data?.[0]?.transcript_retrieved_at??null;
 return lane("Creator discovery / transcripts",{attempt:attempt.data?.[0]?.transcript_attempted_at??null,success,
 execution:unique.length?"Today's video receipts present; discovery completion unverified":"No eligible videos in today's receipts; discovery completion unverified",
 coverage:ready+" / "+unique.length+" discovered eligible videos transcript-ready; "+new Set(unique.map(r=>r.publisher)).size+" / "+names.length+" creators represented (not full roster scan proof)",
 coverageComplete:missing.length?false:null,fresh:fresh(success,now,24),failure:categories(errors),budget:budget(errors),
 backup:"Retrieval provider recorded; backup attempt/outcome not established",
 gaps:(raw.length===200?"Receipt list capped; ":"")+(gaps||"No missing eligible video recorded")+"; latest discovery receipt: "+myt(latest(raw.map(r=>r.created_at))),
 retry:next(missing.map(r=>r.transcript_next_attempt_at),now)});
}
async function sourceRun(db:DB,now:Date){
 const [last,success]=await Promise.all([
 db.from("research_runs").select("started_at,completed_at,status,required_sources_complete,videos_found,transcripts_ready,updates_published").in("schedule_slot",["morning","evening"]).order("started_at",{ascending:false,nullsFirst:false}).limit(1),
 db.from("research_runs").select("completed_at").in("schedule_slot",["morning","evening"]).eq("status","completed").not("completed_at","is",null).order("completed_at",{ascending:false}).limit(1)]);
 if(last.error||success.error)throw Error("run read failed");
 const r=last.data?.[0],at=success.data?.[0]?.completed_at??null;
 return lane("Scheduled source acquisition",{attempt:r?.started_at??null,success:at,execution:r?.status??"Unknown",
 coverage:r?String(r.videos_found??0)+" video discoveries; "+String(r.transcripts_ready??0)+" transcripts in latest acquisition receipt":"Unverified",
 coverageComplete:null,fresh:fresh(at,now,24),failed:r?.status==="failed"||r?.status==="blocked",partial:r?.required_sources_complete===false,
 gaps:"Source-only completion is not digestion, publication or full creator coverage"});
}
async function macro(db:DB){
 const {data,error}=await db.from("blue_desk_macropulse_briefs").select("received_at,published_at,status").order("received_at",{ascending:false}).limit(1);
 if(error)throw error;const r=data?.[0];
 return lane("MacroPulse",{execution:"Scheduled Work execution receipt not linked",coverage:r?"Latest existing brief receipt: "+r.status:"No brief receipt",gaps:"Brief delivery is not the current task receipt; actual current coverage unverified",success:r?.received_at??null});
}
async function market(db:DB){
 const {data,error}=await db.from("intelligence_evidence").select("event_at,received_at").like("external_evidence_id","market-crack:%").order("event_at",{ascending:false,nullsFirst:false}).limit(1);
 if(error)throw error;const r=data?.[0];
 return lane("Market data / EMA",{execution:"Scheduled market measurement receipt only",coverage:r?"Latest canonical measurement observation: "+myt(r.event_at??null):"No canonical measurement receipt",success:r?.received_at??null,gaps:"Canonical measurement is not full equity or EMA session coverage; provider refresh and warmup status not verified"});
}
async function gaps(db:DB){
 const {data,error}=await db.from("research_gap_cases").select("status,handed_off_at,completed_at,research_started_at").order("updated_at",{ascending:false}).limit(1);
 if(error)throw error;const r=data?.[0];
 return lane("Research digestion / handoff",{attempt:r?.research_started_at??null,success:r?.handed_off_at??null,execution:r?"Latest gap case: "+r.status:"No gap-case receipt",coverage:"Case-level only",gaps:"Handoff receipt is not proof of all current research digested or downstream publication"});
}
async function publication(db:DB){
 const {data,error}=await db.from("research_runs").select("completed_at,updates_published").in("schedule_slot",["morning","evening"]).gt("updates_published",0).not("completed_at","is",null).order("completed_at",{ascending:false}).limit(1);
 if(error)throw error;const r=data?.[0];
 return lane("Publication / consumer readback",{success:r?.completed_at??null,execution:"Historical canonical Story update receipt only",coverage:r?String(r.updates_published)+" updates in last publishing run":"No publishing run receipt",gaps:"Current consumer readback and private report delivery not linked; no automatic public publication inferred"});
}
export async function getMyDeskHealth(now=new Date()):Promise<HealthLane[]>{
 let db:DB;try{db=createSupabaseAdminClient()}catch{return ["X Wire","Creator discovery / transcripts","Scheduled source acquisition","MacroPulse","AI16","Material Events","Research Investigation","Market data / EMA","Research digestion / handoff","Publication / consumer readback"].map(label=>unknown(label,"Database unavailable"))}
 const work=getOwnerWorkReceiptLanes(now);
 const creator=safe("Creator discovery / transcripts",async()=>{const [base,digest]=await Promise.all([creators(db,now),getOwnerCreatorSignalDigest(now)]);return augmentCreatorLane(base,digest.digest,now)});
 return Promise.all([
 safe("X Wire",()=>xwire(db,now)),creator,safe("Scheduled source acquisition",()=>sourceRun(db,now)),safe("MacroPulse",async()=>{const r=(await work).MacroPulse;return r.execution!=="Unknown"?r:macro(db)}),
 safe("AI16",async()=>(await work).AI16),
 safe("Material Events",async()=>(await work)["Material Events"]),
 safe("Research Investigation",async()=>(await work)["Research Investigation"]),
 safe("Market data / EMA",()=>market(db)),safe("Research digestion / handoff",()=>gaps(db)),safe("Publication / consumer readback",()=>publication(db))]);
}
