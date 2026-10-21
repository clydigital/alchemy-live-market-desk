import type { EditorialCandidate, EditorialFact } from "./market-editorial-v1.ts";

/**
 * Second-generation long-form article admission; not the existing four-role
 * market-editorial/v1 brief. Both are derived from the same frozen candidate.
 * This module is pure: no model calls, database reads or Story mutations.
 */
export const ARTICLE_SECTIONS_V2 = "article-sections/2" as const;
export type ArticleSectionsV2 = {
  contractVersion: typeof ARTICLE_SECTIONS_V2;
  fingerprint: string;
  storyId: string;
  storyThesisVersionId: string;
  storySnapshotId: string;
  asOf: string;
  materialChangeAt: string | null;
  lineage: "EXACT_EDITION_MANIFEST" | "FROZEN_DOSSIER_CONTEXT";
  context: "MATERIAL_STORY_CHANGE" | "CONTINUING_STORY";
  readiness: "FULL_ARTICLE" | "BRIEF_ONLY";
  reporting: Array<{
    text: string;
    evidenceIds: string[];
    sourceUrls: string[];
    sourceName: string;
    sourceAvailableAt: string;
    basis: "SOURCE_VERIFIED";
  }>;
  interpretation: Array<{
    text: string;
    evidenceIds: string[];
    sourceUrls: string[];
    basis: "CANONICAL_INTERPRETATION" | "HISTORICAL_CONTEXT" | "CONDITIONAL";
    support: "mechanism" | "asset" | "countercase" | "nextTest";
    asset: string | null;
  }>;
  sourceLinks: Array<{ url: string; sourceName: string }>;
  gaps: string[];
};
export type ModelArticleSectionsV2 = {
  fingerprint: string;
  reportingFactIds: string[];
  interpretation: Array<{
    text: string;
    support: "mechanism" | "asset" | "countercase" | "nextTest";
    asset: string | null;
  }>;
};
export const MODEL_ARTICLE_SECTIONS_V2_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["fingerprint", "reportingFactIds", "interpretation"],
  properties: {
    fingerprint: { type: "string" },
    reportingFactIds: { type: "array", items: { type: "string" } },
    interpretation: { type: "array", items: {
      type: "object", additionalProperties: false, required: ["text", "support", "asset"],
      properties: {
        text: { type: "string" },
        support: { type: "string", enum: ["mechanism", "asset", "countercase", "nextTest"] },
        asset: { type: ["string","null"] },
      },
    } },
  },
} as const;

const UUID=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const PROCESS=/^(?:observed by research gap|detected:|detected\b|story:\s*detected|verification pending|awaiting provider|source retrieval failed|research gap)/i;
const OPERATIONAL=/\b(?:(?:research|data|publication|intelligence) pipeline|system 2|canonical evidence|dossier status|thesis version|source coverage|provider authentication|ingestion)\b/i;
const REACTION=/\b(?:rallied|surged|sold off|slumped|tumbled|rebounded|rose|fell|jumped|plunged|gained|lost|declined|retreated|closed higher|closed lower|traded higher|traded lower)\b/i;
const CONDITIONAL=/\b(?:may|might|could|would|if|unless|provided|conditional|potential)\b/i;
const UNSUPPORTED_RECENCY=/\b(?:today|this morning|just announced|overnight|breaking news|right now)\b/i;
function record(value:unknown):Record<string,unknown>|null {
  return value!==null && typeof value==="object" && !Array.isArray(value)
    ? value as Record<string,unknown> : null;
}
function str(value:unknown):string { return typeof value==="string"?value.trim():""; }
function directSourceUrl(value:string) {
  try {
    const url=new URL(value);
    return value.length<=2048 && url.protocol==="https:" && !url.username && !url.password
      && url.hostname.length>3 && (url.pathname!=="/" || Boolean(url.search)) ? url.href : null;
  } catch { return null; }
}
function numericTokens(value:string):string[] {
  return (value.match(/\b\d+(?:[.,]\d+)*(?:%|bp|bps|bn|tn)?\b/gi)||[]).map(x=>x.toLowerCase());
}
function factsForArticle(candidate:EditorialCandidate):EditorialFact[] {
  return candidate.facts.filter(f=>
    UUID.test(f.factId) && f.text.trim().length>=45 && f.text.length<=720
    && !PROCESS.test(f.text) && !OPERATIONAL.test(f.text)
    && Boolean(directSourceUrl(f.sourceUrl)) && Number.isFinite(Date.parse(f.availableAt))
    && Date.parse(f.availableAt)<=Date.parse(candidate.packet.asOf)
  ).slice(0,10);
}
// Full articles require developed, separately sourced reporting, not a string
// of short one-sentence financial metrics dressed up as 3-5 paragraphs.
const MIN_FULL_REPORTING_CHARS=160;
function substantiveSourceParagraph(text:string):boolean {
  const trimmed=text.trim();
  if(trimmed.length<MIN_FULL_REPORTING_CHARS) return false;
  // A source-extracted long-form paragraph must include at least two
  // declarative sentences; dates embedded inside one issuer claim do not count.
  return (trimmed.match(/(?:[.!?](?=\s+[A-Z]|$))/g)||[]).length>=2;
}
/**
 * The original atomic claim stays canonical. Extra reporting may come only
 * from an issuer-owned paragraph captured at authenticated intake, anchored
 * to the same metric, source URL and original source availability clock.
 */
function reportingSource(f:EditorialFact,asOf:string):{text:string;availableAt:string} {
  const passage=f.sourcePassages?.find(p=>
    p && p.sourceUrl===f.sourceUrl && directSourceUrl(p.sourceUrl)!==null
    && Number.isFinite(Date.parse(p.capturedAt))
    && Date.parse(p.capturedAt)>=Date.parse(f.availableAt)
    && Date.parse(p.capturedAt)<=Date.parse(asOf)
    && typeof p.matchedMetric==="string" && p.matchedMetric.length>0
    && f.text.includes(p.matchedMetric) && p.text.includes(p.matchedMetric)
    && substantiveSourceParagraph(p.text)
    && !PROCESS.test(p.text) && !OPERATIONAL.test(p.text)
  );
  return passage?{text:passage.text,availableAt:passage.capturedAt}
    :{text:f.text,availableAt:f.availableAt};
}
function distinctSubstantiveReports(facts:EditorialFact[],asOf:string) {
  return new Set(facts.flatMap(f=>{
    const text=reportingSource(f,asOf).text.trim();
    return substantiveSourceParagraph(text)?[text]:[];
  })).size;
}
function validText(text:string,numbers:Set<string>,sourceContext:boolean) {
  return text.length>=45 && text.length<=720 && !PROCESS.test(text)
    && !OPERATIONAL.test(text) && !REACTION.test(text)
    && !numericTokens(text).some(n=>!numbers.has(n))
    && (!sourceContext || !UNSUPPORTED_RECENCY.test(text))
    && text.split(/[.!?]+/).filter(x=>x.trim().length>3).length<=3;
}
function safeAssetName(text:string,asset:string) {
  return asset.length>1 && text.toUpperCase().includes(asset.toUpperCase());
}

/**
 * Pure preflight: adding long-form output to the single Dossier stage is
 * pointless unless at least three distinct, dated source facts and real
 * canonical market interpretation inputs are already frozen.
 */
export function eligibleForArticleSectionsV2(candidate:EditorialCandidate):boolean {
  const packet=candidate.packet;
  return packet.kind==="STORY" && Boolean(packet.identity.storyId)
    && Boolean(packet.identity.storyThesisVersionId) && Boolean(packet.identity.storySnapshotId)
    && distinctSubstantiveReports(factsForArticle(candidate),packet.asOf)>=3
    && Boolean(packet.mechanism.text && packet.mechanism.evidenceState!=="UNAVAILABLE")
    && packet.assetReadThroughs.some(a=>a.asset.length>1 && a.interpretation.trim().length>20);
}

/**
 * "reportingFactIds" selects VERBATIM, previously admitted source facts. The
 * model cannot write unsupported reporting prose: all reporting text comes
 * from the original-source facts recorded as of the frozen edition.
 * Model-written interpretation remains conditional and tied to one exact
 * frozen mechanism, asset read-through, countercase or next test.
 */
export function validateArticleSectionsV2(
  raw:unknown, candidate:EditorialCandidate,
):ArticleSectionsV2|null {
  if (!eligibleForArticleSectionsV2(candidate)) return null;
  const packet=candidate.packet;
  const obj=record(raw);
  if (!obj || obj.fingerprint!==candidate.fingerprint || !Array.isArray(obj.reportingFactIds)
    || !Array.isArray(obj.interpretation)) return null;
  const proof=new Map(factsForArticle(candidate).map(f=>[f.factId.toLowerCase(),f]));
  const usedFacts=new Set<string>();
  const reporting:ArticleSectionsV2["reporting"]=[];
  for(const value of obj.reportingFactIds.slice(0,5)){
    const id=str(value).toLowerCase();
    const f=proof.get(id);
    if (!f || usedFacts.has(id)) continue;
    usedFacts.add(id);
    const source=reportingSource(f,packet.asOf);
    reporting.push({text:source.text.trim(),evidenceIds:[id],
      sourceUrls:[directSourceUrl(f.sourceUrl)!],sourceName:f.sourceName,
      sourceAvailableAt:new Date(source.availableAt).toISOString(),basis:"SOURCE_VERIFIED"});
  }
  const availableNumbers=new Set(numericTokens([...candidate.facts.map(f=>f.text),
    packet.mechanism.text||"",...packet.assetReadThroughs.map(a=>a.interpretation),
    packet.countercase||"",packet.nextTest||""].join(" ")));
  const interpretation:ArticleSectionsV2["interpretation"]=[];
  const usedSupports=new Set<string>();
  for(const value of obj.interpretation.slice(0,5)){
    const p=record(value);
    const text=str(p?.text);
    const support=p?.support;
    const asset=str(p?.asset);
    if (!validText(text,availableNumbers,true) || !CONDITIONAL.test(text)) continue;
    if (!["mechanism","asset","countercase","nextTest"].includes(String(support))) continue;
    const key=support==="asset" ? "asset:"+asset.toUpperCase():support as string;
    if (usedSupports.has(key)) continue;
    let supportIds:string[]=[];
    let basis:ArticleSectionsV2["interpretation"][number]["basis"];
    let sourceAsset:string|null=null;
    if(support==="mechanism"){
      if(!packet.mechanism.text||packet.mechanism.evidenceState==="UNAVAILABLE")continue;
      basis=packet.mechanism.evidenceState==="CONTEXT_ONLY"?"HISTORICAL_CONTEXT":"CANONICAL_INTERPRETATION";
      supportIds=packet.mechanism.evidenceIds;
    } else if(support==="asset"){
      const linked=packet.assetReadThroughs.find(a=>a.asset.toUpperCase()===asset.toUpperCase()
        && safeAssetName(text,a.asset));
      if(!linked)continue;
      sourceAsset=linked.asset;
      supportIds=linked.evidenceIds;
      basis=linked.kind==="LESSON_CONTEXT"||linked.kind==="MOTION_CONTEXT"
        ?"HISTORICAL_CONTEXT":"CONDITIONAL";
    } else if(support==="countercase") {
      if(!packet.countercase)continue;
      basis="CONDITIONAL";
    } else {
      if(!packet.nextTest)continue;
      basis="CONDITIONAL";
    }
    const evidenceIds=[...new Set(supportIds.map(x=>x.toLowerCase()))].filter(x=>proof.has(x));
    const sourceUrls=[...new Set(evidenceIds.map(x=>directSourceUrl(proof.get(x)!.sourceUrl)!))];
    interpretation.push({text,evidenceIds,sourceUrls,basis,
      support:support as ArticleSectionsV2["interpretation"][number]["support"],asset:sourceAsset});
    usedSupports.add(key);
  }
  const hasMechanism=interpretation.some(x=>x.support==="mechanism");
  const hasAsset=interpretation.some(x=>x.support==="asset");
  // The same upstream source paragraph copied across different metric IDs
  // is one reporting passage, not a 3-paragraph proof.
  const substantiveCount=new Set(reporting
    .filter(p=>substantiveSourceParagraph(p.text)).map(p=>p.text)).size;
  const full=reporting.length>=3 && reporting.length<=5 && substantiveCount>=3 && interpretation.length>=2
    && interpretation.length<=5 && hasMechanism && hasAsset;
  const sourceLinks=[...new Map(reporting.map(x=>[x.sourceUrls[0],x.sourceName])).entries()]
    .map(([url,sourceName])=>({url,sourceName}));
  return {
    contractVersion:ARTICLE_SECTIONS_V2,
    fingerprint:candidate.fingerprint,
    storyId:packet.identity.storyId!,
    storyThesisVersionId:packet.identity.storyThesisVersionId!,
    storySnapshotId:packet.identity.storySnapshotId!,
    asOf:packet.asOf,
    materialChangeAt:packet.materialChangeAt,
    lineage:packet.identity.lineage as ArticleSectionsV2["lineage"],
    context:packet.materialChangeAt?"MATERIAL_STORY_CHANGE":"CONTINUING_STORY",
    readiness:full?"FULL_ARTICLE":"BRIEF_ONLY",
    reporting,interpretation,sourceLinks,
    gaps:[
      ...(reporting.length<3?["Fewer than three distinct dated source facts"]:[]),
      ...(substantiveCount<3?["Fewer than three substantive source-reporting paragraphs"]:[]),
      ...(interpretation.length<2?["Fewer than two supported market-interpretation paragraphs"]:[]),
      ...(!hasMechanism?["No admitted canonical or dated-context mechanism"]:[]),
      ...(!hasAsset?["No matched conditional asset transmission"]:[]),
    ],
  };
}
