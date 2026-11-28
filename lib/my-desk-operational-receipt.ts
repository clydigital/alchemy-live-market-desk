import {lane,myt,fresh,type HealthLane} from "./my-desk-health-core.ts";
export const WORK_KEYS=["investigation","creator","ai16","macropulse","material"] as const;
type Key=typeof WORK_KEYS[number];
const execution=["completed","no_update","reported_finished","failed","in_progress","unknown"] as const;
const coverage=["complete","partial","none","unknown"] as const;
const delivery=["saved","reported_verified","failed","not_attempted","unknown"] as const;
const causes=["none","source_gap","service_unavailable","auth","quota","budget_disabled","timeout","capability_mismatch","handoff_failure","unknown"] as const;
const fallbacks=["not_attempted","attempted_failed","partial_recovery","equivalent_recovery","unknown"] as const;
const budgets=["free_available","disabled","exhausted","unknown"] as const;
export type WorkOperationalReceipt={lane:Key;attemptAt:string;completedAt:string|null;scheduledAt:string|null;nextScheduledAt:string|null;execution:typeof execution[number];coverage:typeof coverage[number];delivery:typeof delivery[number];cause:typeof causes[number];fallback:typeof fallbacks[number];budget:typeof budgets[number];origin:"scheduler_readback"|"task_reported"};
const record=(x:unknown):Record<string,unknown>=>x&&typeof x==="object"&&!Array.isArray(x)?x as Record<string,unknown>:{};
const member=<T extends readonly string[]>(v:unknown,choices:T):v is T[number]=>typeof v==="string"&&(choices as readonly string[]).includes(v);
const iso=(x:unknown):x is string=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(x)&&Number.isFinite(Date.parse(x));
const past=(x:unknown,now:Date):x is string=>iso(x)&&Date.parse(x)<=+now;
export function parseOperationalReceipt(raw:unknown,now:Date):WorkOperationalReceipt|null{
 const r=record(raw);
 if(r.version!=="md4-work-health/1"||!member(r.lane,WORK_KEYS)||!past(r.attemptAt,now)||
 !(r.completedAt===null||past(r.completedAt,now)&&Date.parse(r.completedAt)>=Date.parse(r.attemptAt))||
 !(r.scheduledAt===null||past(r.scheduledAt,now))||
 !(r.nextScheduledAt===null||iso(r.nextScheduledAt)&&Date.parse(r.nextScheduledAt)>Date.parse(r.attemptAt))||
 !member(r.execution,execution)||!member(r.coverage,coverage)||!member(r.delivery,delivery)||
 !member(r.cause,causes)||!member(r.fallback,fallbacks)||!member(r.budget,budgets)||
 !member(r.origin,["scheduler_readback","task_reported"] as const))return null;
 if(r.origin==="task_reported"&&["completed","no_update"].includes(r.execution))return null;
 if(["completed","no_update","reported_finished","failed"].includes(r.execution)&&!r.completedAt)return null;
 return {lane:r.lane,attemptAt:r.attemptAt,completedAt:r.completedAt,scheduledAt:r.scheduledAt,nextScheduledAt:r.nextScheduledAt,execution:r.execution,coverage:r.coverage,delivery:r.delivery,cause:r.cause,fallback:r.fallback,budget:r.budget,origin:r.origin};
}
export function parseOperationalBlocks(raw:unknown,now:Date):Partial<Record<Key,WorkOperationalReceipt>>{
 const blocks=record(raw).results;const out:Partial<Record<Key,WorkOperationalReceipt>>={},duplicates=new Set<Key>();
 if(!Array.isArray(blocks))return out;
 for(const b of blocks.slice(0,8)){
  const a=record(b),c=record(a.code);if(a.type!=="code"||c.language!=="json"||!Array.isArray(c.rich_text))continue;
  const text=c.rich_text.map(t=>record(t).plain_text).filter(t=>typeof t==="string").join("");
  if(!text||text.length>4000)continue;
  try{const r=parseOperationalReceipt(JSON.parse(text),now);if(!r)continue;if(out[r.lane])duplicates.add(r.lane);else out[r.lane]=r}catch{/* no raw data surfaced */}
 }
 for(const k of duplicates)delete out[k];return out;
}
const causeLabels:Record<WorkOperationalReceipt["cause"],string>={none:"No failure reported",source_gap:"Source coverage gap",service_unavailable:"Service unavailable",auth:"Access/configuration",quota:"Rate limit/quota",budget_disabled:"Budget disabled",timeout:"Timeout",capability_mismatch:"Capability mismatch",handoff_failure:"Handoff failed",unknown:"Not recorded"};
const backupLabels:Record<WorkOperationalReceipt["fallback"],string>={not_attempted:"Not attempted",attempted_failed:"Attempted; failed",partial_recovery:"Partial recovery reported",equivalent_recovery:"Equivalent recovery reported",unknown:"Not recorded"};
const budgetLabels:Record<WorkOperationalReceipt["budget"],string>={free_available:"Free allowance reported available",disabled:"Budget disabled",exhausted:"Allowance exhausted",unknown:"Unknown"};
export function applyOperationalReceipt(base:HealthLane,r:WorkOperationalReceipt|undefined,now:Date):HealthLane{
 if(!r)return base;
 const current=fresh(r.attemptAt,now,24)===true;
 const overdue=!!r.nextScheduledAt&&Date.parse(r.nextScheduledAt)<=+now-3600000;
 const failed=current&&!overdue&&(r.execution==="failed"||r.delivery==="failed"||r.coverage==="none");
 const partial=base.partial||!current||overdue||r.coverage==="partial"||r.coverage==="none"||r.delivery==="failed"||r.delivery==="not_attempted";
 const next=r.nextScheduledAt&&Date.parse(r.nextScheduledAt)>+now?"Next scheduled check (not guaranteed retry): "+myt(r.nextScheduledAt):overdue?"Expected next scheduled check passed; newer receipt absent":"Next scheduled check unknown";
 return lane(base.label,{...base,attempt:r.attemptAt,
 execution:(r.origin==="scheduler_readback"?"Scheduler readback: ":"Task-reported execution: ")+r.execution+" · delivery "+r.delivery+"; "+base.execution,
 coverage:base.coverage+"; task coverage "+r.coverage,
 coverageComplete:partial||failed?false:base.coverageComplete,
 fresh:current&&!overdue?base.fresh:false,failed:base.failed||failed,partial,
 failure:r.cause==="unknown"?base.failure:causeLabels[r.cause],
 backup:r.fallback==="unknown"?base.backup:backupLabels[r.fallback],
 budget:r.budget==="unknown"?base.budget:budgetLabels[r.budget]+"; "+base.budget,
 backupRecovered:base.backupRecovered&&r.fallback!=="attempted_failed",
 gaps:base.gaps+"; "+(base.attempt?"Underlying source/Run attempt: "+myt(base.attempt)+"; ":"")+next+"; task receipt is not independent source or consumer verification"});
}
