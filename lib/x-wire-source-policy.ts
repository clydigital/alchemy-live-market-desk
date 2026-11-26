/** Source routing is an attention/cost policy, never an evidence grade. */
export const X_ANALYST_HANDLES = new Set(["oddstats","macropaperr","hfi_research","kobeissiletter","drjstrategy"]);
export const X_ALERT_HANDLES = new Set(["firstsquawk","zerohedge","currentreport1"]);
const normalize=(handle:string)=>handle.toLowerCase();
export function xWireSourcePolicy(handle:string){
 const h=normalize(handle);
 return {analyst:X_ANALYST_HANDLES.has(h),alert:X_ALERT_HANDLES.has(h),
   recoveryHours:h==="firstsquawk"?24:72,
   activeCap:h==="firstsquawk"?12:h==="zerohedge"?18:40,
   maxAgeHours:h==="firstsquawk"?24:168,
   researchCap:h==="firstsquawk"||h==="zerohedge"||h==="currentreport1"||h==="drjstrategy"?2:3};
}
const MAJOR_ECONOMY=/\b(?:US|U\.S\.|USA|EUROZONE|EURO AREA|UK|BRITAIN|GERMAN|GERMANY|CHINA|CHINESE|JAPAN|JAPANESE|CANADA|AUSTRALIA|NEW ZEALAND)\b/i;
const MACRO_DATA=/\b(?:CPI|PPI|PCE|GDP|payrolls?|jobless claims|unemployment|retail sales|ISM|PMI|consumer confidence|business outlook|industrial production|jobs report|trade balance|inflation)\b/i;
const ACTUAL=/\b(?:EST|EXP|EXPECTED|CONSENSUS|ACTUAL|PREV|REVISED)\b/i;
const BANK=/\b(?:FED|FOMC|FEDERAL RESERVE|ECB|BOJ|BOE|PBOC|RBA|RBNZ|BOC|SNB|CENTRAL BANK|BANK OF JAPAN|BANK OF ENGLAND)\b/i;
const POLICY=/\b(?:raises?|raised|cuts?|hikes?|hiked|holds?|held|keeps?|kept|leaves?|left|lowers?|lowered|sets?|set|voted|votes?)\b[^.!?]{0,85}\b(?:rates?|bps|basis points|target range)\b/i;
const HYPOTHETICAL=/\b(?:expects?|forecast|may|might|could|would|sees?|should|outlook)\b/i;
const CONFLICT=/\b(?:iran|israel|hormuz|houthi|russia|ukraine|china|taiwan|gulf|red sea|saudi|tanker|vessel)\b/i;
const SHOCK=/\b(?:hit|hits|struck|strikes?|striking|attack(?:ed|s)?|bomb(?:ed|ing|s)?|missiles?|drones?|explosion|mines?|blockade|seiz(?:e|ed|ure)|threatens? to close|ceasefire (?:agreed|signed|violated|collapsed)|suspend(?:s|ed)?|halt(?:s|ed)?|resum(?:es|ed|ing)|approv(?:es|ed)|impos(?:es|ed)|ban(?:s|ned)?)\b/i;
const COMP=/\b(?:earnings|EPS|revenue|guidance|capex|cloud revenue|free cash flow|outlook|profit)\b/i;
const KEY_COMP=/\b(?:nvidia|amd|tsmc|samsung|intel|alphabet|google|microsoft|meta|amazon|apple|oracle|coreweave|anthropic|openai|alibaba|walmart|tesla|semiconductor|chips?)\b/i;
const SIGNIFICANT=/\b(?:cyber ?attack|hacked|market halt|trading halt|bank failure|emergency funding|defaulted|bankruptcy|export controls?|export restrictions?|tariffs? (?:imposed|raised|cut)|suspend(?:s|ed)? (?:some )?(?:chip |oil )?shipments|oil shipments|IPO (?:priced|priced at)|crude inventories|EIA crude|OPEC\+? (?:agrees|cuts|raises))\b/i;
export type XFlashKind="macro_data"|"policy_decision"|"conflict_shock"|"earnings"|"market_shock";
export function classifyXFlash(body:string):XFlashKind|null {
 if(MAJOR_ECONOMY.test(body)&&MACRO_DATA.test(body)&&/\d/.test(body)&&ACTUAL.test(body))return "macro_data";
 if(BANK.test(body)&&((POLICY.test(body)&&/\d|\b(?:unchanged|unanimous|split vote)\b/i.test(body)&&!HYPOTHETICAL.test(body))||/\b(?:rate decision|policy decision)\b.*\d/i.test(body)))return "policy_decision";
 if(CONFLICT.test(body)&&SHOCK.test(body)&&!/\b(?:discussed|reiterates?|commented|spoke|wants|hopes|meeting with|ready to continue)\b/i.test(body))return "conflict_shock";
 if(COMP.test(body)&&/\d/.test(body)&&(ACTUAL.test(body)||KEY_COMP.test(body)))return "earnings";
 if(KEY_COMP.test(body)&&/\b(?:compute supply|chip supply|data cent(?:er|re) capacity|memory shortage)\b/i.test(body)&&/\b(?:scarce|scarcity|shortage|constrained|sold out|supply gap)\b/i.test(body))return "market_shock";
 if(/\b(?:copper|lithium|rare earths?|crude|natural gas|LNG)\b/i.test(body)&&/\b(?:booked vessels|export ban|supply disruption|critical shortage)\b/i.test(body))return "market_shock";
 if(SIGNIFICANT.test(body))return "market_shock";
 return null;
}
export function permitsXResearch(handle:string,body:string){
 const h=normalize(handle), clean=body.replace(/^@[A-Za-z0-9_]+\s+/,"");
 if(h==="firstsquawk")return classifyXFlash(body)!==null;
 if(/^@\w+\s/.test(body)&&clean.length<80)return false;
 return clean.trim().length>=24;
}
/** Conservative repeat detection: do not merge changed values or different events. */
function tokens(body:string){return new Set(body.toLowerCase().replace(/https?:\/\/\S+/g,"").match(/[a-z0-9]+(?:\.[0-9]+)?/g)?.filter(x=>x.length>2)||[]);}
export function xWireNearDuplicate(a:string,b:string){
 const x=tokens(a),y=tokens(b);
 if(x.size<4||y.size<4)return a.trim().toLowerCase()===b.trim().toLowerCase();
 const nums=(s:string)=>[...new Set(s.match(/\d+(?:\.\d+)?/g)||[])].sort().join(",");
 if(nums(a)!==nums(b))return false;
 const intersection=[...x].filter(t=>y.has(t)).length;
 return intersection/Math.max(x.size,y.size)>=0.78;
}
