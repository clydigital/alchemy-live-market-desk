/**
 * Bluebelly Content Contract v1 — a portable, pure TypeScript read-model
 * boundary for Newsroom, Regime Watch and Markets.
 *
 * NOT an intake writer, publication approval, source-verification service,
 * regime mutation, or migration. No database, server-only, network or auth
 * imports. Do not infer states from headlines or free-form summaries.
 */

export const CONTENT_CONTRACT_VERSION="bluebelly-content/1" as const;
export const EVENT_TYPES=[
 "EARNINGS","ECONOMIC_RELEASE","POLICY_DECISION","COMPANY_DISCLOSURE",
 "CORPORATE_ACTION","REGULATORY_CHANGE","SUPPLY_DISRUPTION",
 "GEOPOLITICAL_DEVELOPMENT","MARKET_OBSERVATION","OTHER",
] as const;
export const CONTENT_TOPICS=[
 "AI_TECHNOLOGY","RATES_BONDS","CREDIT_FINANCING","ENERGY",
 "GEOPOLITICS","EQUITIES","ECONOMY","FX","METALS","OTHER",
] as const;
export const SOURCE_KINDS=[
 "OFFICIAL","ISSUER","REGULATORY_FILING","MARKET_DATA",
 "ATTRIBUTED_REPORTING","CREATOR","SOCIAL",
] as const;
export const VERIFICATION_STATES=[
 "UNVERIFIED","ATTRIBUTED_UNCONFIRMED","CORROBORATED_REPORT",
 "ORIGINAL_VERIFIED","DISPUTED","SUPERSEDED",
] as const;
export const PUBLICATION_STATES=[
 "UNREGISTERED","DRAFT","IN_REVIEW","APPROVED","PUBLISHED",
 "CORRECTED","RETRACTED","ARCHIVED",
] as const;
export const CONSENSUS_STATES=[
 "NOT_APPLICABLE","UNAVAILABLE","PENDING","SOURCE_VERIFIED",
] as const;
export const REACTION_STATES=[
 "NOT_MEASURED","DATED_OBSERVATION_ONLY","EVENT_WINDOW_MEASURED",
] as const;
export const REGIME_LINK_STATES=[
 "NAVIGATION_ONLY","EVIDENCE_CANDIDATE","EVIDENCE_ACCEPTED","THESIS_UPDATED",
] as const;
export const TIME_PRECISIONS=["INSTANT","DATE_ONLY"] as const;

export type EventType=typeof EVENT_TYPES[number];
export type ContentTopic=typeof CONTENT_TOPICS[number];
export type SourceKind=typeof SOURCE_KINDS[number];
export type VerificationState=typeof VERIFICATION_STATES[number];
export type PublicationState=typeof PUBLICATION_STATES[number];
export type ConsensusState=typeof CONSENSUS_STATES[number];
export type ReactionState=typeof REACTION_STATES[number];
export type RegimeLinkState=typeof REGIME_LINK_STATES[number];
export type EventTime=
 | {precision:"INSTANT";occurredAt:string;eventDate?:never}
 | {precision:"DATE_ONLY";eventDate:string;occurredAt?:never};

export type ContentSource={
 sourceId:string;sourceUrl:string;sourceKind:SourceKind;
 publisher:string;verifiedAt:string|null;
};
export type PublicationReceipt={
 status:PublicationState;
 articleId:string|null;revisionId:string|null;
 permalink:string|null;publishedAt:string|null;
 reviewReceiptId:string|null;supersedesRevisionId:string|null;
};
export type RegimeRelationship={
 regimeId:string;regimeKind:"CANONICAL"|"EDITORIAL_LENS";
 relationship:RegimeLinkState;
 evidenceId:string|null;reviewReceiptId:string|null;thesisVersionId:string|null;
};
export type BluebellyContentRecord={
 contractVersion:typeof CONTENT_CONTRACT_VERSION;
 eventId:string;headline:string;eventType:EventType;
 topics:ContentTopic[];entityKeys:string[];
 eventTime:EventTime;
 verification:VerificationState;
 sources:ContentSource[];
 publication:PublicationReceipt;
 consensus:ConsensusState;consensusSourceId:string|null;
 reaction:ReactionState;marketObservationIds:string[];
 regimeLinks:RegimeRelationship[];
};

const allowedTransitions:Readonly<Record<PublicationState,readonly PublicationState[]>>={
 UNREGISTERED:["DRAFT"],
 DRAFT:["IN_REVIEW"],
 IN_REVIEW:["APPROVED","DRAFT"],
 APPROVED:["PUBLISHED","IN_REVIEW"],
 PUBLISHED:["CORRECTED","RETRACTED","ARCHIVED"],
 CORRECTED:["CORRECTED","RETRACTED","ARCHIVED"],
 RETRACTED:[],
 ARCHIVED:["CORRECTED","RETRACTED"],
};
export function publicationTransitionAllowed(from:PublicationState,to:PublicationState):boolean{
 return from===to || allowedTransitions[from].includes(to);
}
export function canAppearInPublicIndex(record:BluebellyContentRecord):boolean{
 return (record.publication.status==="PUBLISHED" ||
    record.publication.status==="CORRECTED" ||
    record.publication.status==="ARCHIVED") &&
  validateContentRecord(record).length===0;
}
const inEnum=(value:unknown,values:readonly string[]):boolean=>
 typeof value==="string"&&values.includes(value);
const identifier=(value:unknown):boolean=>
 typeof value==="string"&&/^[a-zA-Z0-9][a-zA-Z0-9:_-]{2,149}$/.test(value);
const utc=(v:unknown):boolean=>{
 if(typeof v!=="string"||! /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v))return false;
 const t=Date.parse(v);
 return Number.isFinite(t)&&new Date(t).toISOString()===v.replace(/(\d{2}:\d{2}:\d{2})Z$/,"$1.000Z");
};
const dateOnly=(v:unknown):boolean=>{
 if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;
 const d=new Date(v+"T00:00:00.000Z");
 return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v;
};
const sourceUrl=(v:unknown):boolean=>{
 if(typeof v!=="string"||v.length>2048)return false;
 try{
  const url=new URL(v);
  return url.protocol==="https:"&&!url.username&&!url.password&&
    !url.hash&&(url.pathname!=="/"||Boolean(url.search));
 }catch{return false;}
};
const publicPermalink=(v:unknown):boolean=>
 typeof v==="string"&&v.length<400&&
 /^\/(?:key-stories|newsroom|regime-watch|markets)(?:[/?#]|$)/.test(v)&&
 !v.startsWith("//")&&!v.includes("..")&&!v.includes("\n");
const safeArray=(v:unknown):unknown[]=>Array.isArray(v)?v:[];
const object=(v:unknown):Record<string,unknown>|null=>
 !!v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:null;

/**
 * Runtime check: returns stable field-scoped issues, never repairs or
 * silently promotes fields. Must run before a new public index projection.
 */
export function validateContentRecord(value:unknown):string[]{
 const r=object(value);if(!r)return ["record: object required"];
 const errors:string[]=[];
 const add=(field:string,ok:boolean)=>{if(!ok)errors.push(field);};
 add("contractVersion",r.contractVersion===CONTENT_CONTRACT_VERSION);
 add("eventId",identifier(r.eventId));
 add("headline",typeof r.headline==="string"&&r.headline.trim().length>=8&&r.headline.length<=300);
 add("eventType",inEnum(r.eventType,EVENT_TYPES));
 const topics=safeArray(r.topics);
 add("topics",Array.isArray(r.topics)&&topics.length>0&&topics.length<=6&&
   topics.every(t=>inEnum(t,CONTENT_TOPICS))&&new Set(topics).size===topics.length&&
   (topics.length===1||!topics.includes("OTHER")));
 const entities=safeArray(r.entityKeys);
 add("entityKeys",Array.isArray(r.entityKeys)&&entities.length<=20&&
   entities.every(identifier)&&new Set(entities).size===entities.length);
 const t=object(r.eventTime);
 add("eventTime",!!t&&(t.precision==="INSTANT"?
   utc(t.occurredAt)&&t.eventDate===undefined:
   t.precision==="DATE_ONLY"&&dateOnly(t.eventDate)&&t.occurredAt===undefined));
 add("verification",inEnum(r.verification,VERIFICATION_STATES));
 const sources=safeArray(r.sources);
 add("sources",Array.isArray(r.sources)&&sources.length>0&&sources.length<=20&&
   sources.every(item=>{const s=object(item);return !!s&&identifier(s.sourceId)&&
    sourceUrl(s.sourceUrl)&&inEnum(s.sourceKind,SOURCE_KINDS)&&
    typeof s.publisher==="string"&&s.publisher.trim().length>0&&
    (s.verifiedAt===null||utc(s.verifiedAt));})&&
   new Set(sources.map(s=>object(s)?.sourceId)).size===sources.length);
 if(r.verification==="ORIGINAL_VERIFIED")add("verification.originalSource",
   sources.some(x=>["OFFICIAL","ISSUER","REGULATORY_FILING"].includes(String(object(x)?.sourceKind))&&utc(object(x)?.verifiedAt)));
 if(r.verification==="CORROBORATED_REPORT")add("verification.corroboration",
   new Set(sources.map(x=>object(x)?.publisher)).size>=2);
 const p=object(r.publication);
 add("publication",!!p&&inEnum(p.status,PUBLICATION_STATES)&&
    (p.articleId===null||identifier(p.articleId))&&
    (p.revisionId===null||identifier(p.revisionId))&&
    (p.permalink===null||publicPermalink(p.permalink))&&
    (p.publishedAt===null||utc(p.publishedAt))&&
    (p.reviewReceiptId===null||identifier(p.reviewReceiptId))&&
    (p.supersedesRevisionId===null||identifier(p.supersedesRevisionId)));
 const publicState=p&&["PUBLISHED","CORRECTED","ARCHIVED","RETRACTED"].includes(String(p.status));
 if(publicState)add("publication.receipt",identifier(p.articleId)&&identifier(p.revisionId)&&
   publicPermalink(p.permalink)&&utc(p.publishedAt)&&identifier(p.reviewReceiptId));
 if(p?.status==="CORRECTED")add("publication.supersedesRevisionId",
   identifier(p.supersedesRevisionId)&&p.supersedesRevisionId!==p.revisionId);
 add("consensus",inEnum(r.consensus,CONSENSUS_STATES));
 add("consensusSourceId",r.consensusSourceId===null||identifier(r.consensusSourceId));
 if(r.consensus==="SOURCE_VERIFIED")add("consensus.source",
   identifier(r.consensusSourceId)&&sources.some(s=>object(s)?.sourceId===r.consensusSourceId));
 add("reaction",inEnum(r.reaction,REACTION_STATES));
 const observations=safeArray(r.marketObservationIds);
 add("marketObservationIds",Array.isArray(r.marketObservationIds)&&observations.length<=20&&
   observations.every(identifier)&&new Set(observations).size===observations.length);
 if(r.reaction==="DATED_OBSERVATION_ONLY")add("reaction.observations",observations.length>=1);
 if(r.reaction==="EVENT_WINDOW_MEASURED")add("reaction.eventWindow",t?.precision==="INSTANT"&&observations.length>=2);
 const regimeLinks=safeArray(r.regimeLinks);
 add("regimeLinks",Array.isArray(r.regimeLinks)&&regimeLinks.length<=30&&
  regimeLinks.every(link=>{const l=object(link);if(!l)return false;
   const base=identifier(l.regimeId)&&["CANONICAL","EDITORIAL_LENS"].includes(String(l.regimeKind))&&
      inEnum(l.relationship,REGIME_LINK_STATES)&&
      (l.evidenceId===null||identifier(l.evidenceId))&&
      (l.reviewReceiptId===null||identifier(l.reviewReceiptId))&&
      (l.thesisVersionId===null||identifier(l.thesisVersionId));
   if(!base)return false;
   if(l.relationship==="EVIDENCE_ACCEPTED")return l.regimeKind==="CANONICAL"&&
      identifier(l.evidenceId)&&identifier(l.reviewReceiptId);
   if(l.relationship==="THESIS_UPDATED")return l.regimeKind==="CANONICAL"&&
      identifier(l.evidenceId)&&identifier(l.reviewReceiptId)&&identifier(l.thesisVersionId);
   return true;
  })&&new Set(regimeLinks.map(l=>String(object(l)?.regimeKind)+":"+String(object(l)?.regimeId))).size===regimeLinks.length);
 return errors;
}
/** This descriptor is derived from the same enums as runtime validation. */
export const BLUEBELLY_CONTENT_JSON_SCHEMA={
 $schema:"https://json-schema.org/draft/2020-12/schema",
 title:"BluebellyContentRecord",type:"object",
 required:["contractVersion","eventId","headline","eventType","topics","entityKeys",
   "eventTime","verification","sources","publication","consensus","consensusSourceId",
   "reaction","marketObservationIds","regimeLinks"],
 properties:{
  contractVersion:{const:CONTENT_CONTRACT_VERSION},
  eventId:{type:"string",minLength:3,maxLength:150},
  headline:{type:"string",minLength:8,maxLength:300},
  eventType:{enum:EVENT_TYPES},
  topics:{type:"array",minItems:1,maxItems:6,uniqueItems:true,items:{enum:CONTENT_TOPICS}},
  entityKeys:{type:"array",maxItems:20,uniqueItems:true,items:{type:"string"}},
  eventTime:{oneOf:[
   {type:"object",required:["precision","occurredAt"],properties:{precision:{const:"INSTANT"},occurredAt:{type:"string",format:"date-time"}},additionalProperties:false},
   {type:"object",required:["precision","eventDate"],properties:{precision:{const:"DATE_ONLY"},eventDate:{type:"string",format:"date"}},additionalProperties:false},
  ]},
  verification:{enum:VERIFICATION_STATES},
  sources:{type:"array",minItems:1,maxItems:20,items:{type:"object",
   required:["sourceId","sourceUrl","sourceKind","publisher","verifiedAt"],
   properties:{sourceId:{type:"string"},sourceUrl:{type:"string",format:"uri"},sourceKind:{enum:SOURCE_KINDS},publisher:{type:"string"},verifiedAt:{type:["string","null"]}},
   additionalProperties:false}},
  publication:{type:"object",required:["status","articleId","revisionId","permalink","publishedAt","reviewReceiptId","supersedesRevisionId"],
   properties:{status:{enum:PUBLICATION_STATES},articleId:{type:["string","null"]},revisionId:{type:["string","null"]},
    permalink:{type:["string","null"]},publishedAt:{type:["string","null"]},
    reviewReceiptId:{type:["string","null"]},supersedesRevisionId:{type:["string","null"]}},additionalProperties:false},
  consensus:{enum:CONSENSUS_STATES},consensusSourceId:{type:["string","null"]},
  reaction:{enum:REACTION_STATES},marketObservationIds:{type:"array",uniqueItems:true,items:{type:"string"}},
  regimeLinks:{type:"array",items:{type:"object",required:["regimeId","regimeKind","relationship","evidenceId","reviewReceiptId","thesisVersionId"],
   properties:{regimeId:{type:"string"},regimeKind:{enum:["CANONICAL","EDITORIAL_LENS"]},
    relationship:{enum:REGIME_LINK_STATES},evidenceId:{type:["string","null"]},
    reviewReceiptId:{type:["string","null"]},thesisVersionId:{type:["string","null"]}},additionalProperties:false}},
 },additionalProperties:false,
} as const;
