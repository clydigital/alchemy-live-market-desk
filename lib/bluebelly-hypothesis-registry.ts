/** Bounded projection of existing private Research Gap rows. No inference or writes. */
export type EvidenceRole="CONFIRMS"|"WEAKENS"|"CONDITIONAL"|"AMPLIFIES"|"INVALIDATES"|"TRANSMITS"|"HORIZON_SHIFT";
export type DossierReference={status:"ANALYTICAL_REFERENCE"|"GOVERNANCE_ONLY"|"NOT_REFERENCED"|"BEFORE_RECEIPT"|"UNAVAILABLE";dossierId:string|null;asOf:string|null};
export type CanonicalReceipt={status:"MATCHED"|"MISSING"|"PROVENANCE_MISMATCH"|"UNAVAILABLE";receivedAt:string|null;dossierReference?:DossierReference};
export type Gem={id:string;label:string;role:EvidenceRole;observation:string;sourceUrl:string;sourceDate:string|null;state:"RETAINED_SOURCE_RECEIPT"|"ATTRIBUTED"|"PENDING";premise:string;canonicalReceipt?:CanonicalReceipt};
export type HypothesisChartUnit="bp"|"%"|"USD bn"|"AUD mn"|"wafers/month";
export type HypothesisChartState="RETAINED"|"ATTRIBUTED"|"FORECAST"|"DERIVED";
export type HypothesisChart={id:string;title:string;unit:HypothesisChartUnit;state:HypothesisChartState;basis:string;points:{label:string;value:number;gemId:string}[]};
export type HypothesisSnapshot={version:"evidence-gems/1";hypothesisId:string;reviewedOn:string;currentRead:string;conditional:string;nextTest:string;gems:Gem[];charts?:HypothesisChart[];chartWarnings?:string[]};
export type RegistryRow={id:string;pageId:string;title:string;state:"ACTIVE"|"STALE";theme:string;confidence?:"LOW"|"MEDIUM"|"HIGH";decisionImpact?:string;currentRead:string;nextTrigger:string;lastChecked:string|null;lastEdited:string|null;snapshot:HypothesisSnapshot|null};
export type RegistryRead={status:"AVAILABLE"|"PARTIAL"|"UNAVAILABLE"|"NOT_CONFIGURED"|"UNAUTHORISED";rows:RegistryRow[];truncated:boolean;retrievedAt:string|null};
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:{};
const list=(v:unknown):unknown[]=>Array.isArray(v)?v:[];
const str=(v:unknown,n=1000)=>typeof v==="string"&&v.trim().length<=n?v.trim():"";
const rich=(v:unknown,n=1600)=>str(list(v).map(x=>str(obj(x).plain_text,4000)||str(obj(obj(x).text).content,4000)).join(""),n);
const date=(v:unknown,now:Date)=>{const s=str(v,40);return s&&/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(s)&&Number.isFinite(Date.parse(s))&&Date.parse(s)<=now.getTime()?s:null;};
const safeId=(v:unknown)=>{const s=str(v,50).replace(/-/g,"").toLowerCase();return /^[0-9a-f]{32}$/.test(s)?s:"";};
const roles=new Set<string>(["CONFIRMS","WEAKENS","CONDITIONAL","AMPLIFIES","INVALIDATES","TRANSMITS","HORIZON_SHIFT"]);
const states=new Set<string>(["RETAINED_SOURCE_RECEIPT","ATTRIBUTED","PENDING"]);
function sourceUrl(v:unknown){try{const u=new URL(str(v,1800));return u.protocol==="https:"&&!u.username&&!u.password&&!/^(localhost|127\.|0\.|\[)/i.test(u.hostname)&&!u.hostname.endsWith(".local")&&!u.hostname.endsWith(".internal")?u.href:"";}catch{return "";}}
export function projectRegistryRows(raw:unknown,now:Date):RegistryRow[]{
 const seen=new Set<string>();return list(obj(raw).results).slice(0,12).flatMap(v=>{
 const r=obj(v),p=obj(r.properties),field=(key:string,kind="rich_text")=>rich(obj(p[key])[kind]),id=field("Investigation ID"),pageId=safeId(r.id),title=field("Gap","title"),state=str(obj(obj(p.Status).select).name,20);
 if(r.archived||r.in_trash||!pageId||!/^[-A-Za-z0-9_]{3,100}$/.test(id)||!title||!["ACTIVE","STALE"].includes(state)||seen.has(id))return [];
 seen.add(id);return [{id,pageId,title,state:state as RegistryRow["state"],theme:field("Story / Theme"),confidence:(["LOW","MEDIUM","HIGH"].includes(str(obj(obj(p.Confidence).select).name,20))?str(obj(obj(p.Confidence).select).name,20) as RegistryRow["confidence"]:undefined),decisionImpact:field("Dossier Impact"),currentRead:field("Current Read"),nextTrigger:field("Next Trigger"),lastChecked:date(obj(obj(p["Last Checked"]).date).start,now),lastEdited:date(r.last_edited_time,now),snapshot:null}];
 });
}
/** Optional numeric research observations, not extracted from narrative. Each
 * point must reference a dated, nonpending gem in the same snapshot. Reject a
 * bad chart independently so its failure cannot hide valid hypothesis gems. */
function parseCharts(raw:unknown,gems:Gem[]):{charts:HypothesisChart[];chartWarnings:string[]}{
 const charts:HypothesisChart[]=[],chartWarnings:string[]=[],seen=new Set<string>();
 if(raw===undefined)return {charts,chartWarnings};
 if(!Array.isArray(raw)){return {charts,chartWarnings:["Chart payload is not an array"]};}
 if(raw.length>6)chartWarnings.push("Chart coverage bounded to six entries");
 const byId=new Map(gems.map(g=>[g.id,g]));
 const units=new Set(["bp","%","USD bn","AUD mn","wafers/month"]);
 const kinds=new Set(["RETAINED","ATTRIBUTED","FORECAST","DERIVED"]);
 for(const [i,v] of raw.slice(0,6).entries()){
  const x=obj(v),id=str(x.id,64),title=str(x.title,90),unit=str(x.unit,20),state=str(x.state,20),basis=str(x.basis,140);
  const points:HypothesisChart["points"]=[],labels=new Set<string>();
  let valid=/^[a-z0-9][a-z0-9-]{1,63}$/.test(id)&&!seen.has(id)&&!!title&&units.has(unit)&&kinds.has(state)&&!!basis&&Array.isArray(x.points)&&x.points.length>=2&&x.points.length<=12;
  if(valid)for(const rawPoint of list(x.points)){
   const p=obj(rawPoint),label=str(p.label,36),gemId=str(p.gemId,140),g=byId.get(gemId),value=p.value;
   if(!label||labels.has(label)||!g||!g.sourceDate||g.state==="PENDING"||
      (g.state==="ATTRIBUTED"&&state!=="ATTRIBUTED")||typeof value!=="number"||!Number.isFinite(value)||value<0||value>1e12||
      (unit==="%"&&value>100)){valid=false;break;}
   labels.add(label);points.push({label,value,gemId});
  }
  if(!valid){chartWarnings.push("Rejected chart entry "+(i+1));continue;}
  seen.add(id);charts.push({id,title,unit:unit as HypothesisChartUnit,state:state as HypothesisChartState,basis,points});
 }
 return {charts,chartWarnings};
}
export function parseHypothesisSnapshot(raw:unknown,row:RegistryRow,now:Date):HypothesisSnapshot|null{
 const x=obj(raw),reviewedOn=date(x.reviewedOn,now),currentRead=str(x.currentRead,1600),conditional=str(x.conditional,1600),nextTest=str(x.nextTest,1000);
 if(x.version!=="evidence-gems/1"||x.hypothesisId!==row.id||!reviewedOn||!currentRead||currentRead!==row.currentRead||!conditional||!nextTest||!Array.isArray(x.gems)||x.gems.length<1||x.gems.length>8)return null;
 const gems:Gem[]=[],ids=new Set<string>();
 for(const rawGem of x.gems){const g=obj(rawGem),id=str(g.id,140),label=str(g.label,180),role=str(g.role,30),state=str(g.state,40),observation=str(g.observation,750),premise=str(g.premise,600),url=sourceUrl(g.sourceUrl),d=g.sourceDate===null?null:date(g.sourceDate,now);
 if(!id||ids.has(id)||!label||!roles.has(role)||!states.has(state)||!observation||!premise||!url||(g.sourceDate!==null&&!d))return null;
 ids.add(id);gems.push({id,label,role:role as EvidenceRole,state:state as Gem["state"],observation,premise,sourceUrl:url,sourceDate:d});
 }
 return {version:"evidence-gems/1",hypothesisId:row.id,reviewedOn,currentRead,conditional,nextTest,gems,...(x.charts===undefined?{}:parseCharts(x.charts,gems))};
}
export function readFirstSnapshot(blockResponse:unknown,row:RegistryRow,now:Date):HypothesisSnapshot|null{
 const block=obj(list(obj(blockResponse).results)[0]),code=obj(block.code);
 if(block.type!=="code"||code.language!=="json")return null;
 const raw=rich(code.rich_text,28000);if(!raw)return null;
 try{return parseHypothesisSnapshot(JSON.parse(raw),row,now);}catch{return null;}
}

/** Exact canonical evidence IDs only. Receipt presence is not hypothesis admission. */
const canonicalId=(id:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)?id.toLowerCase():"";
export function canonicalGemIds(rows:RegistryRow[]):string[]{
 return [...new Set(rows.slice(0,4).flatMap(row=>(row.snapshot?.gems??[]).slice(0,8).map(g=>canonicalId(g.id)).filter(Boolean)))];
}
// Only exact IDs in declared reference fields count, never a prose substring.
const analyticalRefKeys=new Set(["evidence_references","evidence_ids","observed_evidence","supporting_evidence_ids","counter_evidence_ids","current_evidence_refs","observed_reaction_evidence_refs","evidence_for_ids","evidence_against_ids","confirming","contradicting","accelerating","unresolved","blocking_evidence"]);
function dossierReferenceIndex(raw:unknown,now:Date){
 const d=obj(raw),id=canonicalId(str(d.id,36)),asOf=date(d.as_of,now),payload=obj(d.payload),analytical=obj(payload.analytical_output),governance=obj(payload.evidence_governance);
 if(!id||!asOf||!Object.keys(analytical).length||!Array.isArray(governance.items))return null;
 const references=new Set<string>(),governed=new Set<string>();
 const visit=(value:unknown,depth=0)=>{
 if(depth>16)return;
 if(Array.isArray(value)){for(const v of value)visit(v,depth+1);return;}
 for(const [key,v] of Object.entries(obj(value))){
 if(analyticalRefKeys.has(key)&&Array.isArray(v))for(const x of v){const s=str(x,300);if(s)references.add(s);}
 if(v&&typeof v==="object")visit(v,depth+1);
 }
 };
 visit(analytical);
 for(const item of governance.items){const s=str(obj(item).evidenceId,300);if(s)governed.add(s);}
 return {id,asOf,references,governed};
}
export function projectCanonicalGemReceipts(rows:RegistryRow[],receipts:unknown[]|null,now:Date,dossier?:unknown):RegistryRow[]{
 const index=dossierReferenceIndex(dossier,now);
 const allowed=new Set(canonicalGemIds(rows)),byId=new Map((receipts??[]).map(v=>[canonicalId(str(obj(v).id,36)),obj(v)]));
 return rows.map(row=>!row.snapshot?row:{...row,snapshot:{...row.snapshot,gems:row.snapshot.gems.map(g=>{
 const id=canonicalId(g.id);if(!allowed.has(id))return g;
 const r=byId.get(id),receivedAt=r?date(r.received_at,now):null;
 const sameUrl=r&&list(r.provenance_urls).some(u=>sourceUrl(u)===g.sourceUrl);
 const sameDate=r&&g.sourceDate&&[r.event_at,r.published_at].some(v=>date(v,now)?.slice(0,10)===g.sourceDate?.slice(0,10));
 const status:CanonicalReceipt["status"]=receipts===null?"UNAVAILABLE":!r?"MISSING":sameUrl&&sameDate&&receivedAt?"MATCHED":"PROVENANCE_MISMATCH";
 let dossierReference:DossierReference|undefined;
 if(status==="MATCHED"&&receivedAt&&r&&dossier!==undefined){
 const aliases=[id,`ev:${id}`,`lead:${id}`,str(r.external_evidence_id,300)].filter(Boolean);
 const referenceStatus:DossierReference["status"]=!index?"UNAVAILABLE":Date.parse(index.asOf)<Date.parse(receivedAt)?"BEFORE_RECEIPT":aliases.some(a=>index.references.has(a))?"ANALYTICAL_REFERENCE":aliases.some(a=>index.governed.has(a))?"GOVERNANCE_ONLY":"NOT_REFERENCED";
 dossierReference={status:referenceStatus,dossierId:index?.id??null,asOf:index?.asOf??null};
 }
 return {...g,canonicalReceipt:{status,receivedAt:status==="MATCHED"?receivedAt:null,...(dossierReference?{dossierReference}:{})}};
 })}});
}
