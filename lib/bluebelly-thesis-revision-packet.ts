/** Private append-only Work handoff. A packet is an analyst interpretation,
 * never canonical evidence or automatic public publication. */
export const THESIS_PACKET_TITLE="Bluebelly — Thesis revision packet v1";
export const THESIS_PACKET_VERSION="bluebelly/thesis-revision/1";
export const PACKET_LANES=["macropulse","material","ai16","creator","investigation","manual"] as const;
export const PACKET_LENSES=["fed","bonds","ai","china","energy","yen","breadth","gold","housing","recession"] as const;
type Lane=typeof PACKET_LANES[number];
type Lens=typeof PACKET_LENSES[number];
type Reference={kind:"BB_RECORD"|"WORK_EDITION"|"ORIGINAL_LINK";id:string|null;lane:string|null;url:string|null;sourceAt:string;role:"SUPPORT"|"CHALLENGE"|"CONTEXT";claim:string;qualification:"ATTRIBUTED"|"RETAINED_REVIEW"|"DATED_MEASUREMENT"|"CONTEXT_ONLY"};
export type ThesisRevisionPacket={version:typeof THESIS_PACKET_VERSION;producer:Lane;hypothesisId:string;eventKey:string;reviewedAt:string;sourceThrough:string;marketSession:string|null;priorThesis:string;currentCondition:string;mechanism:string;countercase:string;nextTest:string;horizon:string;assessment:"STRENGTHENED"|"CHALLENGED"|"MIXED"|"UNCHANGED"|"INSUFFICIENT";coverage:"PARTIAL"|"COMPLETE";materiality:"HIGH"|"MEDIUM"|"LOW";lenses:Lens[];references:Reference[];visibility:"PRIVATE_ONLY"};
type Obj=Record<string,unknown>;
const obj=(v:unknown):Obj=>v&&typeof v==="object"&&!Array.isArray(v)?v as Obj:{};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const key=/^[A-Za-z0-9][A-Za-z0-9:._-]{2,150}$/;
const date=(v:unknown,now:Date):v is string=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}(?:T.*(?:Z|[+-]\d{2}:\d{2}))?$/.test(v)&&Number.isFinite(Date.parse(v))&&Date.parse(v)<=+now;
const str=(v:unknown,max=1600):v is string=>typeof v==="string"&&v.trim().length>=8&&v.length<=max;
const validUrl=(v:unknown):v is string=>{if(typeof v!=="string"||v.length>2048)return false;try{const u=new URL(v);return u.protocol==="https:"&&!u.username&&!u.password}catch{return false}};
const oneOf=<T extends string>(v:unknown,options:readonly T[]):v is T=>typeof v==="string"&&options.includes(v as T);
export function parseThesisRevisionPacket(raw:unknown,now:Date):ThesisRevisionPacket|null{
 const x=obj(raw);
 if(x.version!==THESIS_PACKET_VERSION||x.visibility!=="PRIVATE_ONLY"||!oneOf(x.producer,PACKET_LANES)||typeof x.hypothesisId!=="string"||!key.test(x.hypothesisId)||typeof x.eventKey!=="string"||!key.test(x.eventKey)||
 !date(x.reviewedAt,now)||!date(x.sourceThrough,now)||Date.parse(x.sourceThrough)>Date.parse(x.reviewedAt)||
 !(x.marketSession===null||typeof x.marketSession==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x.marketSession)&&date(x.marketSession,now)&&Date.parse(x.marketSession)<=Date.parse(x.reviewedAt))||
 !oneOf(x.assessment,["STRENGTHENED","CHALLENGED","MIXED","UNCHANGED","INSUFFICIENT"] as const)||
 !oneOf(x.coverage,["PARTIAL","COMPLETE"] as const)||!oneOf(x.materiality,["HIGH","MEDIUM","LOW"] as const)||
 !str(x.priorThesis)||!str(x.currentCondition)||!str(x.mechanism)||!str(x.countercase)||!str(x.nextTest)||!str(x.horizon,250)||
 !Array.isArray(x.lenses)||!x.lenses.length||x.lenses.length>10||!x.lenses.every(v=>oneOf(v,PACKET_LENSES))||new Set(x.lenses).size!==x.lenses.length||
 !Array.isArray(x.references)||!x.references.length||x.references.length>12)return null;
 const references:Reference[]=[];
 const seen=new Set<string>();
 for(const rawRef of x.references){
  const r=obj(rawRef);
  if(!oneOf(r.kind,["BB_RECORD","WORK_EDITION","ORIGINAL_LINK"] as const)||!date(r.sourceAt,now)||Date.parse(r.sourceAt)>Date.parse(x.sourceThrough)||
   !oneOf(r.role,["SUPPORT","CHALLENGE","CONTEXT"] as const)||!oneOf(r.qualification,["ATTRIBUTED","RETAINED_REVIEW","DATED_MEASUREMENT","CONTEXT_ONLY"] as const)||!str(r.claim,700))return null;
  if(r.kind==="BB_RECORD"&&(!(typeof r.id==="string"&&uuid.test(r.id))||!oneOf(r.lane,["evidence","intake","creator","motion","thesis","x_wire"] as const)||!validUrl(r.url)))return null;
  if(r.kind==="WORK_EDITION"&&(!(typeof r.id==="string"&&uuid.test(r.id))||r.lane!==null||r.url!==null||r.qualification!=="RETAINED_REVIEW"))return null;
  if(r.kind==="ORIGINAL_LINK"&&(r.id!==null||r.lane!==null||!validUrl(r.url)))return null;
  const k=r.kind+"|"+(r.id??r.url)+"|"+(r.lane??"");if(seen.has(k))return null;seen.add(k);
  references.push({kind:r.kind,id:r.id as string|null,lane:r.lane as string|null,url:r.url as string|null,sourceAt:r.sourceAt,role:r.role,claim:r.claim,qualification:r.qualification});
 }
 if(!references.some(r=>Date.parse(r.sourceAt)===Date.parse(x.sourceThrough as string)))return null;
 if(x.assessment!=="INSUFFICIENT"&&(!references.some(r=>r.role==="SUPPORT")||!references.some(r=>r.role==="CHALLENGE")))return null;
 return {version:THESIS_PACKET_VERSION,visibility:"PRIVATE_ONLY",producer:x.producer,hypothesisId:x.hypothesisId,eventKey:x.eventKey,reviewedAt:x.reviewedAt,sourceThrough:x.sourceThrough,marketSession:x.marketSession as string|null,priorThesis:x.priorThesis,currentCondition:x.currentCondition,mechanism:x.mechanism,countercase:x.countercase,nextTest:x.nextTest,horizon:x.horizon,assessment:x.assessment,coverage:x.coverage,materiality:x.materiality,lenses:x.lenses as Lens[],references};
}
export function parseThesisPacketHtml(html:string,now:Date){
 const matches=[...html.matchAll(/<pre id="bb-thesis-revision-v1">([\s\S]*?)<\/pre>/g)];
 if(matches.length!==1||matches[0][1].length>40000)return null;
 try{return parseThesisRevisionPacket(JSON.parse(matches[0][1].replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,"&")),now)}catch{return null}
}
export type PacketReceipt={editionId:string;storedAt:string;packet:ThesisRevisionPacket;referenceStates:{reference:Reference;state:"IDENTITY_MATCHED"|"LINK_ONLY"|"UNRESOLVED"}[]};
/** Keep history; a duplicate or rival packet is not an independent vote. */
export function groupThesisPacketReceipts(receipts:readonly PacketReceipt[]){
 const groups=new Map<string,PacketReceipt[]>();
 for(const r of receipts){const k=r.packet.hypothesisId+"|"+r.packet.eventKey;const g=groups.get(k)??[];g.push(r);groups.set(k,g)}
 return [...groups.values()].map(g=>{
  const revisions=[...g].sort((a,b)=>Date.parse(b.packet.reviewedAt)-Date.parse(a.packet.reviewedAt)||a.editionId.localeCompare(b.editionId));
  const latest=revisions[0];
  const conflicting=new Set(revisions.map(r=>r.packet.assessment)).size>1;
  return {hypothesisId:latest.packet.hypothesisId,eventKey:latest.packet.eventKey,latest,revisions:revisions.map(r=>({editionId:r.editionId,reviewedAt:r.packet.reviewedAt,assessment:r.packet.assessment})),conflicting,admission:"PRIVATE_REVIEW_ONLY" as const,publicReadback:"NOT_ADMITTED" as const};
 }).sort((a,b)=>({HIGH:0,MEDIUM:1,LOW:2}[a.latest.packet.materiality]-{HIGH:0,MEDIUM:1,LOW:2}[b.latest.packet.materiality])||Date.parse(b.latest.packet.reviewedAt)-Date.parse(a.latest.packet.reviewedAt));
}
