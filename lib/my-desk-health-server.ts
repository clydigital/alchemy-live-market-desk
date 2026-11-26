import "server-only";
import {createSupabaseAdminClient} from "./supabase/admin.ts";
import {X_CORE_ROSTER} from "./x-sweep-core.ts";
import {xWireFreshCheckComplete,xWireLiveFreshnessHours} from "./x-wire-pagination.ts";
import {CREATOR_ROSTER,isRatesOutlookTitle} from "./video-intake-policy.ts";
import {lane,latest,earliest,fresh,failureCategory,myt,type HealthLane} from "./my-desk-health-core.ts";
import {getOwnerWorkReceiptLanes} from "./my-desk-work-receipt-server";
import {getOwnerCreatorSignalDigest} from "./bluebelly-creator-signals-server";
import {augmentCreatorLane} from "./my-desk-work-receipt-core";
import {applyOperationalReceipt} from "./my-desk-operational-receipt";

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
 db.from("research_runs").select("started_at,completed_at,status,required_sources_complete,evidence_gate_passed,freshness_gate_passed,videos_found,transcripts_ready,updates_published,evidence_added").in("schedule_slot",["morning","evening"]).order("started_at",{ascending:false,nullsFirst:false}).limit(1),
 db.from("research_runs").select("completed_at").in("schedule_slot",["morning","evening"]).eq("status","completed").not("completed_at","is",null).order("completed_at",{ascending:false}).limit(1)]);
 if(last.error||success.error)throw Error("run read failed");
 const r=last.data?.[0],at=success.data?.[0]?.completed_at??null;
 const gate=(value:boolean|null|undefined)=>value===true?"passed":value===false?"not passed":"unverified";
 const failedGates=r?[r.required_sources_complete===false?"required sources":null,r.evidence_gate_passed===false?"evidence":null,r.freshness_gate_passed===false?"freshness":null].filter(Boolean):[];
 return lane("Scheduled source acquisition",{attempt:r?.started_at??null,success:at,execution:r?.status??"Unknown",
 coverage:r?String(r.videos_found??0)+" video discoveries; "+String(r.transcripts_ready??0)+" transcripts; "+String(r.evidence_added??0)+" reported evidence additions in latest acquisition receipt":"Unverified",
 coverageComplete:null,fresh:r?.freshness_gate_passed===false?false:fresh(at,now,24),failed:r?.status==="failed"||r?.status==="blocked",partial:failedGates.length>0,
 failure:failedGates.length?"Gate not passed: "+failedGates.join(", "):"Not established",
 gaps:"Required sources "+gate(r?.required_sources_complete)+" · evidence "+gate(r?.evidence_gate_passed)+" · freshness "+gate(r?.freshness_gate_passed)+". Source-only completion is not digestion, publication or full creator coverage"});
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
 const [latestCase,lastHandoff,handedCount]=await Promise.all([
  db.from("research_gap_cases").select("status,updated_at,research_started_at").order("updated_at",{ascending:false}).limit(1),
  db.from("research_gap_cases").select("handed_off_at,handoff_canonical_status").not("handed_off_at","is",null).order("handed_off_at",{ascending:false}).limit(1),
  db.from("research_gap_cases").select("id",{head:true,count:"exact"}).eq("status","HANDED_OFF")]);
 const r=latestCase.data?.[0],h=lastHandoff.data?.[0];
 const caseAt=latestCase.error?"Read unavailable":myt(r?.updated_at??null);
 const handoffAt=lastHandoff.error?"Read unavailable":myt(h?.handed_off_at??null);
 const count=handedCount.error?"Unknown":String(handedCount.count??0);
 const status=h?.handoff_canonical_status;
 const canonical=typeof status==="number"?"HTTP "+status:"Unverified";
 return lane("Research digestion / handoff",{attempt:r?.research_started_at??null,success:!lastHandoff.error&&typeof status==="number"&&status>=200&&status<300?h?.handed_off_at??null:null,
 execution:latestCase.error?"Case read unavailable":r?"Latest modified case: "+r.status:"No gap-case receipt",
 coverage:count+" cases currently marked HANDED_OFF; last recorded handoff "+handoffAt+" ("+canonical+")",
 gaps:"Latest case modification: "+caseAt+". Modification is not a new handoff. Gap cases represent only one research route; agent-led reviews and consumer readback require separate receipts.",
 failed:false,coverageComplete:null,fresh:null});
}
async function publication(db:DB){
 const readLatest=async(table:"intelligence_evidence"|"story_updates"|"story_thesis_versions",column:"created_at")=>{
  const {data,error}=await db.from(table).select(column).order(column,{ascending:false}).limit(1);
  if(error)throw error;
  return data?.[0]?.created_at??null;
 };
 const [evidence,story,thesis,scheduled]=await Promise.allSettled([
  readLatest("intelligence_evidence","created_at"),readLatest("story_updates","created_at"),
  readLatest("story_thesis_versions","created_at"),
  (async()=>{const {data,error}=await db.from("research_runs").select("completed_at,updates_published").in("schedule_slot",["morning","evening"]).gt("updates_published",0).not("completed_at","is",null).order("completed_at",{ascending:false}).limit(1);
  if(error)throw error;return data?.[0]?.completed_at??null;})()]);
 const get=(r:PromiseSettledResult<string|null>)=>r.status==="fulfilled"?r.value:null;
 const label=(r:PromiseSettledResult<string|null>)=>r.status==="fulfilled"?(r.value?myt(r.value):"No record"):"Read unavailable";
 const e=get(evidence),s=get(story),t=get(thesis);
 const lag=!!e&&[s,t].some(at=>!!at&&Date.parse(e)-Date.parse(at)>7*86400000);
 return lane("Publication / consumer readback",{success:latest([s,t]),
 execution:"Actual canonical table timestamps; Work receipts are separate",
 coverage:"Evidence: "+label(evidence)+" · Story update: "+label(story)+" · Thesis revision: "+label(thesis),
 partial:lag,failure:lag?"Canonical evidence is newer than a downstream revision by over 7 days; review disposition unverified":"Not established",
 gaps:"Last scheduled publishing run: "+label(scheduled)+". Stale canonical revisions do not prove failed agent-led research or a material change. Consumer readback and no-change disposition need their own receipts.",
 fresh:null,coverageComplete:null});
}
export async function getMyDeskHealth(now=new Date()):Promise<HealthLane[]>{
 let db:DB;try{db=createSupabaseAdminClient()}catch{return ["X Wire","Creator discovery / transcripts","Scheduled source acquisition","MacroPulse","AI16","Material Events","Research Investigation","Market data / EMA","Research digestion / handoff","Publication / consumer readback"].map(label=>unknown(label,"Database unavailable"))}
 const work=getOwnerWorkReceiptLanes(now);
 const creator=safe("Creator discovery / transcripts",async()=>{const [base,digest,receipts]=await Promise.all([creators(db,now),getOwnerCreatorSignalDigest(now),work]);return applyOperationalReceipt(augmentCreatorLane(base,digest.digest,now),receipts.creatorReceipt,now)});
 return Promise.all([
 safe("X Wire",()=>xwire(db,now)),creator,safe("Scheduled source acquisition",()=>sourceRun(db,now)),safe("MacroPulse",async()=>{const r=(await work).MacroPulse;return r.execution!=="Unknown"?r:macro(db)}),
 safe("AI16",async()=>(await work).AI16),
 safe("Material Events",async()=>(await work)["Material Events"]),
 safe("Research Investigation",async()=>(await work)["Research Investigation"]),
 safe("Market data / EMA",()=>market(db)),safe("Research digestion / handoff",()=>gaps(db)),safe("Publication / consumer readback",()=>publication(db))]);
}
