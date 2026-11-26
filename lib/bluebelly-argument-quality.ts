import type {Gem,RegistryRow} from "./bluebelly-hypothesis-registry.ts";

/** Read-only diagnostics of saved arguments. Neither receipt nor grouping proves causality,
 * independence, forecast accuracy or admission to the canonical hypothesis graph. */
const normalize=(value:string)=>value.trim().toLowerCase().replace(/\s+/g," ");
function origin(value:string){
 try{const u=new URL(value);u.hash="";for(const k of [...u.searchParams.keys()])if(/^(utm_.+|fbclid|gclid)$/i.test(k))u.searchParams.delete(k);u.searchParams.sort();return u.href;}catch{return "";}
}
const direction=(g:Gem)=>g.role==="CONFIRMS"?"support":g.role==="WEAKENS"||g.role==="INVALIDATES"?"challenge":"modifier";
const day=(v:string|null|undefined)=>v&&Number.isFinite(Date.parse(v))?Date.parse(v):null;
const backed=(g:Gem)=>g.state==="RETAINED_SOURCE_RECEIPT"&&g.canonicalReceipt?.status==="MATCHED"&&day(g.sourceDate)!==null;
export function assessArgumentQuality(row:RegistryRow,asOf:string|null){
 const gems=row.snapshot?.gems??[];
 // Connected components: repeated original URLs OR exactly repeated premises are
 // possible dependence, even with different creator/source names. No fuzzy inference.
 const parents=gems.map((_,i)=>i);
 const root=(i:number):number=>parents[i]===i?i:root(parents[i]);
 for(let i=0;i<gems.length;i++)for(let j=0;j<i;j++){
  const a=gems[i],b=gems[j],u=origin(a.sourceUrl),p=normalize(a.premise);
  if((u&&u===origin(b.sourceUrl))||(p&&p===normalize(b.premise)))parents[root(i)]=root(j);
 }
 const grouped=new Map<number,Gem[]>();
 gems.forEach((g,i)=>{const k=root(i);grouped.set(k,[...(grouped.get(k)??[]),g]);});
 const groups=[...grouped.values()].map(items=>{
  const qualified=items.filter(backed);
  const roles=new Set(qualified.map(direction));
  const status=roles.has("support")&&roles.has("challenge")?"mixed":roles.has("support")?"support":roles.has("challenge")?"challenge":roles.has("modifier")?"modifier":"unverified";
  return {ids:items.map(g=>g.id),labels:items.map(g=>g.label),status,receiptBacked:qualified.length};
 });
 const count=(s:string)=>groups.filter(g=>g.status===s).length;
 const dates=gems.map(g=>day(g.sourceDate)).filter((v):v is number=>v!==null);
 const clock=day(asOf),review=day(row.snapshot?.reviewedOn);
 const age=(v:number|null)=>v!==null&&clock!==null&&v<=clock?Math.floor((clock-v)/86400000):null;
 const support=count("support"),challenge=count("challenge"),mixed=count("mixed");
 return {status:!row.snapshot?"SNAPSHOT_UNAVAILABLE":row.state==="STALE"?"STALE_REVIEW":support+challenge+mixed===0?"NO_MATCHED_DIRECTIONAL_GROUP":"DIRECTIONAL_EVIDENCE_PRESENT",
  gemCount:gems.length,groupCount:groups.length,groups,support,challenge,mixed,modifiers:count("modifier"),unverified:count("unverified"),
  receiptBacked:gems.filter(backed).length,attributed:gems.filter(g=>g.state==="ATTRIBUTED").length,pending:gems.filter(g=>g.state==="PENDING").length,
  undated:gems.length-dates.length,reviewAgeDays:age(review),oldestSourceAgeDays:age(dates.length?Math.min(...dates):null),newestSourceAgeDays:age(dates.length?Math.max(...dates):null),
  counterargumentRecorded:gems.some(g=>direction(g)==="challenge"),nextTestRecorded:Boolean(row.snapshot?.nextTest.trim()),
  conditionalRecorded:Boolean(row.snapshot?.conditional.trim())};
}
