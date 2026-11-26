export type HealthState="healthy"|"recovered"|"degraded"|"failed"|"unknown";
export type HealthEvidence={attempt:string|null;success:string|null;execution:string;coverage:string;coverageComplete:boolean|null;failure:string;backup:string;backupRecovered:boolean;budget:string;gaps:string;retry:string|null;fresh:boolean|null;failed:boolean;partial:boolean};
export type HealthLane=HealthEvidence&{label:string;state:HealthState};
export function healthState(e:HealthEvidence):HealthState {
 if(e.failed)return "failed";
 if(e.partial||e.coverageComplete===false||e.fresh===false)return "degraded";
 if(e.fresh===true&&e.coverageComplete===true&&e.success)return e.backupRecovered?"recovered":"healthy";
 return "unknown";
}
export function lane(label:string,patch:Partial<HealthEvidence>={}):HealthLane {
 const e:HealthEvidence={attempt:null,success:null,execution:"Unknown",coverage:"Unverified",coverageComplete:null,failure:"Not recorded",backup:"Not recorded",backupRecovered:false,budget:"Unknown",gaps:"No complete receipt contract available",retry:null,fresh:null,failed:false,partial:false,...patch};
 return {label,...e,state:healthState(e)};
}
export function latest(values:readonly (string|null|undefined)[]):string|null {
 return values.filter((x):x is string=>!!x&&Number.isFinite(Date.parse(x))).sort((a,b)=>Date.parse(b)-Date.parse(a))[0]??null;
}
export function earliest(values:readonly (string|null|undefined)[]):string|null {
 return values.filter((x):x is string=>!!x&&Number.isFinite(Date.parse(x))).sort((a,b)=>Date.parse(a)-Date.parse(b))[0]??null;
}
export function fresh(at:string|null,now:Date,hours:number):boolean|null {
 if(!at)return null;const age=now.getTime()-Date.parse(at);return Number.isFinite(age)&&age>=0?age<hours*3600000:null;
}
export function myt(at:string|null):string {
 if(!at||!Number.isFinite(Date.parse(at)))return "Unknown";
 return new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kuala_Lumpur",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(at))+" MYT";
}
// Never render raw provider errors (they may contain URLs, credentials or payloads).
export function failureCategory(raw:string|null|undefined):string|null {
 if(!raw)return null;
 if(/budget.disabled|budget.exhausted|budget.limit|credit.exhausted|insufficient.credit/i.test(raw))return "Budget/credits limited";
 if(/429|rate.limit|quota/i.test(raw))return "Rate limit/quota";
 if(/historical coverage gap/i.test(raw))return "Historical coverage gap";
 if(/401|403|unauthori[sz]ed|forbidden|unconfigured/i.test(raw))return "Access/configuration";
 if(/timeout|timed.out/i.test(raw))return "Timeout";
 if(/video.private|video.deleted|video.not.found|invalid.video.url/i.test(raw))return "Video unavailable";
 return "Provider error (details in source ledger)";
}
