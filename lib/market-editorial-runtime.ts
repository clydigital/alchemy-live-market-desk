import "server-only";
import { runStructuredStage } from "@/lib/intelligence/openai";
import { buildMarketImpactPacketsV1, type MarketImpactPacketV1 } from "@/lib/market-impact-packet";
import {
  MARKET_EDITORIAL_V1, selectMarketEditorialCandidates, validateMarketEditorialOutput,
  type EditorialEvidence, type EditorialCandidate, type MarketEditorialArticleV1, type ModelEditorialOutput,
} from "@/lib/market-editorial-v1";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadArchivedIssuerPassages } from "@/lib/market-editorial-source-archive";

export const EDITORIAL_SCHEMA = {
  type:"object", additionalProperties:false, required:["articles"],
  properties:{ articles:{ type:"array", items:{
    type:"object",additionalProperties:false,required:["fingerprint","paragraphs"],
    properties:{
      fingerprint:{type:"string"},
      paragraphs:{type:"array",items:{
        type:"object",additionalProperties:false,
        required:["role","text","factIds","evidenceState"],
        properties:{
          role:{type:"string",enum:["development","mechanism","markets","outlook"]},
          text:{type:"string"}, factIds:{type:"array",items:{type:"string"}},
          evidenceState:{type:"string",enum:["SOURCE_VERIFIED","CANONICAL_INTERPRETATION","CONDITIONAL","CONTEXT_ONLY"]},
        },
      }},
    },
  }}},
};
export const EDITORIAL_INSTRUCTIONS = [
  "You are a Bluebelly client-facing editorial formatter, not a second reasoning engine.",
  "Write in the LY voice: British English, plain words, concise causal explanations, no hype or artificial suspense.",
  "Use only the supplied frozen editorial packets and first-tier sourced facts. No internet, price estimates, invented events, source IDs or assumed observed market moves.",
  "For each supplied article produce at most four short paragraphs, one each in order:",
  "development: the specific original-source event/measurement and dated comparison, quoting only supplied verified facts;",
  "mechanism: why the reported facts might matter under the accepted explanation;",
  "markets: name the applicable actual linked tickers/indices/FX/metals, with explicitly conditional exposure, not invented realised moves;",
  "outlook: strongest supplied countercase and confirmation/invalidation or next test.",
  "Each paragraph 1-3 sentences, no more than 720 characters. Only 3-4 paragraphs if facts support them; omit unsupported roles.",
  "Use only exact factIds supplied. development MUST cite at least one factId and have SOURCE_VERIFIED evidenceState.",
  "CANONICAL_INTERPRETATION means the mechanism remains a canonical interpretation, NOT an observed price move.",
  "CONDITIONAL means may/could/if/then; CONTEXT_ONLY means frozen prior commentary; do not falsely present it as breaking news.",
  "Markets paragraph MUST be CONDITIONAL and mention at least one exact linked asset; supplied reactionCandidate is UNSOURCED, DO NOT USE.",
  "Never claim markets rose, fell, rallied, sold off or confirmed any move without separately proven dated market tape. None is provided.",
  "Omit unsupported statistics and do not add new numbers, dates, sources, causes or instruments.",
  "Quote no provenance UUID in visible text; put only exact factIds into the factIds field. Do not mention any internal stage or Dossier workflow.",
  "Keep a quiet historical Story clearly described as continuing context; its asOf is edition publication, not last material change.",
  "Use exact fingerprint for each article. Do not manufacture additional articles or mix facts between articles.",
].join("\n");

type SourceRow = {
  id:string; claim_text:string|null; evidence_class:string|null; source_tier?:number|null;
  support_direction?:string|null; created_at:string|null; available_at:string|null;
  structured_payload:Record<string,unknown>|null;
  provenance_urls:string[]|null; source: Array<{source_name:string|null;source_url:string|null;source_tier:number|null}>
    | {source_name:string|null;source_url:string|null;source_tier:number|null} | null;
};
function asSource(row: SourceRow) { return Array.isArray(row.source) ? row.source[0] ?? null : row.source; }

/**
 * Editorial is an optional, bounded sibling of Dossier storyline composition.
 * It cannot modify canonical Story/Regime rows and never runs at page render.
 * Failure leaves the existing frozen base edition intact.
 */
export function editorialCandidateModelInput(c: EditorialCandidate): Record<string, unknown> {
  return {
    fingerprint:c.fingerprint,kind:c.packet.kind,
    headline:c.packet.headline,storyLineage:c.packet.identity.lineage,
    lastMaterialChangeAt:c.packet.materialChangeAt,
    development:c.packet.development.basis==="CANONICAL_CLAIM" ? c.packet.development.text : null,
    verifiedFacts:c.facts,acceptedMechanism:c.packet.mechanism,
    marketEffects:c.packet.assetReadThroughs,countercase:c.packet.countercase,
    nextTest:c.packet.nextTest,noObservedMarketTape:true,
  };
}

/** Read-only source admission. Never calls a model or changes canonical state. */
export async function prepareFrozenMarketEditorial(input: {
  editionPayload:Record<string,unknown>; asOf:string; maxArticles?:number;
}): Promise<EditorialCandidate[]> {
  const packets=Array.isArray(input.editionPayload.marketImpactPackets)
    ? input.editionPayload.marketImpactPackets as MarketImpactPacketV1[]
    : buildMarketImpactPacketsV1({payload:input.editionPayload,asOf:input.asOf});
  const limited=packets.slice(0,12);
  const ids=[...new Set(limited.flatMap(p=>[
    ...p.evidenceCandidateIds,...p.development.evidenceIds,...p.mechanism.evidenceIds,
    ...p.assetReadThroughs.flatMap(a=>a.evidenceIds),
  ]).filter(s=>/^[0-9a-f-]{36}$/i.test(s)))].slice(0,100);
  let evidence:EditorialEvidence[]=[];
  if (ids.length) {
    const db=createSupabaseAdminClient();
    const {data,error}=await db.from("intelligence_evidence")
      .select("id,claim_text,evidence_class,created_at,available_at,provenance_urls,structured_payload,source:intelligence_evidence_sources(source_name,source_url,source_tier)")
      .in("id",ids).limit(100).abortSignal(AbortSignal.timeout(4_000));
    if (error) throw new Error("Read-only editorial primary-source lookup failed.");
    // Archived excerpts from earlier completed research cycles may now be
    // attached to a NEW immutable edition; late receipts can never rewrite an
    // older base, and factSet applies its exact source/clock gates.
    const archival=await loadArchivedIssuerPassages((data||[]).map(row=>row.id))
      .catch(()=>new Map<string,EditorialEvidence["sourcePassages"]>());
    evidence=((data || []) as SourceRow[]).map(row=>{
      const source=asSource(row);
      return {id:row.id,claimText:row.claim_text,evidenceClass:row.evidence_class,
        sourceTier:source?.source_tier ?? null,sourceName:source?.source_name ?? null,
        sourceUrl:source?.source_url ?? null,
        provenanceUrls:Array.isArray(row.provenance_urls)?row.provenance_urls:[],
        createdAt:row.created_at,availableAt:row.available_at,
        sourcePassages:[
          ...(row.structured_payload?.evidenceNature==="verified_issuer_result"
            && Array.isArray(row.structured_payload?.editorialSourcePassages)
            ? row.structured_payload.editorialSourcePassages as NonNullable<EditorialEvidence["sourcePassages"]>
            : []),
          ...(archival.get(row.id.toLowerCase())||[]),
        ],
      };
    });
  }
  const candidates=selectMarketEditorialCandidates({
    packets:limited,evidence,maxArticles:input.maxArticles ?? 3,
  });
  return candidates;
}

/** Quiet editions may spend their unused one-model-stage slot on sourced copy. */
export async function composeFrozenMarketEditorial(input: {
  editionPayload:Record<string,unknown>; asOf:string; maxArticles?:number;
}): Promise<{ contractVersion:typeof MARKET_EDITORIAL_V1; articles:MarketEditorialArticleV1[]; warnings:string[] }> {
  const candidates = await prepareFrozenMarketEditorial(input);
  if (!candidates.length) return {
    contractVersion: MARKET_EDITORIAL_V1,articles:[],
    warnings:["No article qualified with a dated original-source factual claim at this edition."],
  };
  const response=await runStructuredStage<ModelEditorialOutput>({
    stageKey:"market_editorial_composer",
    instructions:EDITORIAL_INSTRUCTIONS,
    input:{asOf:input.asOf,candidates:candidates.map(editorialCandidateModelInput)},
    schema:EDITORIAL_SCHEMA,modelKind:"fast",maxOutputTokens:2500,
    requestTimeoutMs:16_000,maxAttempts:1,
  });
  const articles=validateMarketEditorialOutput(response.data,candidates);
  return {
    contractVersion:MARKET_EDITORIAL_V1,articles,
    warnings:articles.length<candidates.length
      ? ["One or more generated editorial articles did not pass source/market-reaction validation."] : [],
  };
}
