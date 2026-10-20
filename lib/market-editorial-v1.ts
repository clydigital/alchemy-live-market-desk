import { createHash } from "node:crypto";
import type { MarketImpactPacketV1 } from "./market-impact-packet.ts";

export const MARKET_EDITORIAL_V1 = "market-editorial/v1" as const;
export type MarketEditorialRole = "development" | "mechanism" | "markets" | "outlook";
export type EditorialEvidence = {
  id: string; claimText: string | null; evidenceClass: string | null;
  sourceTier: number | null; sourceName: string | null; sourceUrl: string | null;
  provenanceUrls: string[]; createdAt: string | null; availableAt: string | null;
};
export type EditorialFact = {
  factId: string; text: string; sourceUrl: string; sourceName: string; availableAt: string;
};
export type EditorialCandidate = { packet: MarketImpactPacketV1; facts: EditorialFact[]; fingerprint: string };
export type EditorialParagraph = {
  role: MarketEditorialRole; text: string; evidenceIds: string[]; sourceUrls: string[];
  evidenceState: "SOURCE_VERIFIED" | "CANONICAL_INTERPRETATION" | "CONDITIONAL" | "CONTEXT_ONLY";
};
export type MarketEditorialArticleV1 = {
  contractVersion: typeof MARKET_EDITORIAL_V1; fingerprint: string;
  kind: "STORY" | "MOTION"; storyId: string | null; motionId: string | null;
  storyThesisVersionId: string | null; storySnapshotId: string | null;
  lineage: MarketImpactPacketV1["identity"]["lineage"]; asOf: string; materialChangeAt: string | null;
  headline: string; paragraphs: EditorialParagraph[]; sourceLinks: Array<{url: string; sourceName: string}>;
  readiness: "READY" | "DEVELOPING"; gaps: string[];
};
export type ModelEditorialOutput = {
  articles: Array<{ fingerprint: string; paragraphs: Array<{
    role: MarketEditorialRole; text: string; factIds: string[];
    evidenceState: EditorialParagraph["evidenceState"];
  }> }>;
};
const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const FIRST_TIER = new Set([
  "official_release", "company_primary", "official_statistic", "official_measurement",
  "verified_macro", "official_document", "filing", "regulatory_filing",
]);
const PROCESS = /^(?:observed by research gap|detected:|detected\b|story:\s*detected|verification pending|awaiting provider|source retrieval failed|research gap)/i;
const OPERATIONAL = /\b(?:pipeline|system 2|canonical evidence|dossier status|thesis version|source coverage|provider authentication|ingestion)\b/i;
const PAST_REACTION = /\b(?:rallied|surged|sold off|slumped|tumbled|rebounded|rose|fell|jumped|plunged|gained|lost|declined|retreated|traded higher|traded lower|closed higher|closed lower|finished higher|finished lower)\b/i;
const CONDITIONAL_LANGUAGE = /\b(?:may|might|could|would|if|unless|provided|potential|conditional)\b/i;
const ROLES: MarketEditorialRole[] = ["development", "mechanism", "markets", "outlook"];
function validUrl(value: string | null | undefined) {
  if (!value || value.length > 2048) return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password
      && u.hostname.length > 3 && (u.pathname !== "/" || Boolean(u.search)) ? u.href : null;
  } catch { return null; }
}
function iso(value: string | null | undefined, asOf: string) {
  return value && Number.isFinite(Date.parse(value)) && Date.parse(value) <= Date.parse(asOf)
    ? new Date(value).toISOString() : null;
}
function unique<T>(x: T[]) { return [...new Set(x)]; }
function factSet(packet: MarketImpactPacketV1, rows: readonly EditorialEvidence[]) {
  const ids = new Set(unique([
    ...packet.evidenceCandidateIds, ...packet.development.evidenceIds, ...packet.mechanism.evidenceIds,
    ...packet.assetReadThroughs.flatMap(a => a.evidenceIds),
  ].map(x=>x.toLowerCase())).filter(x=>UUID.test(x)).slice(0,60));
  const facts: EditorialFact[] = [];
  for (const row of rows) {
    if (!ids.has(row.id.toLowerCase()) || !FIRST_TIER.has((row.evidenceClass || "").toLowerCase())
      || row.sourceTier === null || row.sourceTier > 2 || !row.claimText || PROCESS.test(row.claimText)) continue;
    const availableAt = iso(row.availableAt, packet.asOf);
    if (!availableAt || !iso(row.createdAt, packet.asOf)) continue;
    const original = (row.provenanceUrls.length ? row.provenanceUrls : [row.sourceUrl || ""])
      .map(validUrl).find(Boolean);
    if (!original) continue;
    facts.push({factId: row.id.toLowerCase(), text: row.claimText.slice(0,420),
      sourceUrl: original, sourceName: (row.sourceName || new URL(original).hostname).slice(0,90), availableAt});
    if (facts.length >= 10) break;
  }
  if (packet.kind === "MOTION" && packet.identity.motionId
    && packet.development.sourceUrl && packet.development.text
    && validUrl(packet.development.sourceUrl) && packet.development.basis === "SOURCE_VERIFIED_MOTION") {
    facts.unshift({factId: "motion:" + packet.identity.motionId.toLowerCase(),
      text: packet.development.text.slice(0,420), sourceUrl: packet.development.sourceUrl,
      sourceName: new URL(packet.development.sourceUrl).hostname,
      availableAt: packet.attentionAssessedAt || packet.asOf});
  }
  return facts.slice(0,10);
}
export function selectMarketEditorialCandidates(input: {
  packets: readonly MarketImpactPacketV1[]; evidence: readonly EditorialEvidence[]; maxArticles?: number;
}): EditorialCandidate[] {
  const max = Math.min(3,Math.max(0,input.maxArticles ?? 3));
  const result: EditorialCandidate[] = [];
  for (const packet of input.packets) {
    if (packet.contractVersion !== "market-impact-packet/1"
      || (packet.kind === "STORY" && !packet.identity.storyThesisVersionId)) continue;
    const facts = factSet(packet,input.evidence);
    if (!facts.length) continue;
    const fingerprint = createHash("sha256").update(JSON.stringify({
      version: MARKET_EDITORIAL_V1, kind: packet.kind, identity: packet.identity,
      headline: packet.headline, background: packet.background,
      materialChangeAt: packet.materialChangeAt,
      mechanism: packet.mechanism, assets: packet.assetReadThroughs,
      countercase: packet.countercase, nextTest: packet.nextTest,
      facts: facts.map(f=>[f.factId,f.text,f.sourceUrl,f.availableAt]),
    })).digest("hex").slice(0,32);
    result.push({packet,facts,fingerprint});
    if (result.length >= max) break;
  }
  return result;
}
function numericTokens(s: string) {
  return (s.match(/\b\d+(?:[.,]\d+)*(?:%|bp|bps|bn|tn)?\b/gi)||[]).map(x=>x.toLowerCase());
}
function safeParagraphs(value: unknown, candidate: EditorialCandidate): EditorialParagraph[] {
  if (!Array.isArray(value)) return [];
  const map = new Map(candidate.facts.map(f=>[f.factId,f]));
  const availableNumbers = new Set(numericTokens([
    candidate.packet.headline,...candidate.facts.map(f=>f.text),
    ...candidate.packet.background,candidate.packet.mechanism.text || "",
    ...candidate.packet.assetReadThroughs.map(a=>a.interpretation),
    candidate.packet.nextTest || "",candidate.packet.countercase || "",
  ].join(" ")));
  const result: EditorialParagraph[] = [];
  const used = new Set<MarketEditorialRole>();
  for (const raw of value.slice(0,4)) {
    if (!raw || typeof raw!=="object" || Array.isArray(raw)) continue;
    const p = raw as Record<string,unknown>;
    const role = p.role as MarketEditorialRole;
    const text = typeof p.text==="string" ? p.text.trim() : "";
    if (!ROLES.includes(role)||used.has(role)||text.length<30||text.length>720||PROCESS.test(text)||OPERATIONAL.test(text)) continue;
    if (numericTokens(text).some(n=>!availableNumbers.has(n))) continue;
    if (role==="markets" && (PAST_REACTION.test(text) || !CONDITIONAL_LANGUAGE.test(text))) continue;
    if (text.split(/[.!?]+/).filter(x=>x.trim().length>3).length>3) continue;
    const ids = Array.isArray(p.factIds)
      ? unique(p.factIds.filter((x): x is string=>typeof x==="string").map(x=>x.toLowerCase())):[];
    if (ids.some(x=>!map.has(x))) continue;
    const evidenceState=p.evidenceState;
    if (!["SOURCE_VERIFIED","CANONICAL_INTERPRETATION","CONDITIONAL","CONTEXT_ONLY"].includes(String(evidenceState))) continue;
    if (role==="development" && (!ids.length || evidenceState!=="SOURCE_VERIFIED")) continue;
    if (evidenceState==="SOURCE_VERIFIED" && !ids.length) continue;
    if (evidenceState==="CONTEXT_ONLY" && ids.length) continue;
    if (role==="markets") {
      if (evidenceState!=="CONDITIONAL" || !candidate.packet.assetReadThroughs.some(a=>
        a.asset.length>1 && text.toUpperCase().includes(a.asset.toUpperCase()))) continue;
    }
    result.push({role,text,evidenceIds:ids.filter(x=>UUID.test(x)),
      sourceUrls:unique(ids.flatMap(x=>map.get(x)?.sourceUrl ? [map.get(x)!.sourceUrl]:[])),
      evidenceState:evidenceState as EditorialParagraph["evidenceState"]});
    used.add(role);
  }
  return ROLES.flatMap(role=>result.filter(p=>p.role===role));
}
export function validateMarketEditorialOutput(raw: unknown, candidates: readonly EditorialCandidate[]): MarketEditorialArticleV1[] {
  if (!raw || typeof raw!=="object" || Array.isArray(raw)) return [];
  const entries=(raw as Record<string,unknown>).articles;
  if (!Array.isArray(entries)) return [];
  const lookup=new Map(candidates.map(x=>[x.fingerprint,x]));
  const seen=new Set<string>();
  return entries.slice(0,3).flatMap(row=>{
    if (!row || typeof row!=="object" || Array.isArray(row)) return [];
    const r=row as Record<string,unknown>;
    const fingerprint=typeof r.fingerprint==="string" ? r.fingerprint:"";
    const candidate=lookup.get(fingerprint);
    if (!candidate||seen.has(fingerprint)) return [];
    seen.add(fingerprint);
    const paragraphs=safeParagraphs(r.paragraphs,candidate);
    if (!paragraphs.length) return [];
    const first=paragraphs.some(p=>p.role==="development");
    const market=paragraphs.some(p=>p.role==="markets");
    const readiness=first&&market&&paragraphs.length>=3?"READY" as const:"DEVELOPING" as const;
    const links=new Map(candidate.facts.map(f=>[f.sourceUrl,f.sourceName]));
    return [{
      contractVersion:MARKET_EDITORIAL_V1,fingerprint,
      kind:candidate.packet.kind,storyId:candidate.packet.identity.storyId,
      motionId:candidate.packet.identity.motionId,
      storyThesisVersionId:candidate.packet.identity.storyThesisVersionId,
      storySnapshotId:candidate.packet.identity.storySnapshotId,
      lineage:candidate.packet.identity.lineage,asOf:candidate.packet.asOf,
      materialChangeAt:candidate.packet.materialChangeAt,headline:candidate.packet.headline,
      paragraphs,sourceLinks:[...links].map(([url,sourceName])=>({url,sourceName})),
      readiness,gaps:unique([
        ...candidate.packet.missing,
        ...(!first?["No verified factual opening"]:[]),
        ...(!market?["No conditional asset-specific explanation"]:[]),
        ...(paragraphs.length<3?["Insufficient supported prose"]:[]),
      ]),
    }];
  });
}
