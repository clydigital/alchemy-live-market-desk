import type { EvidencePackItem } from "./schemas.ts";

export const RESEARCH_DELTA_DIGEST_VERSION = "research-delta-v1" as const;

const MAX_MARKET_CONTEXT = 12;
const MAX_RATES_CONTEXT = 24;

type HypothesisLike = {
  evidence_for_ids?: string[];
  evidence_against_ids?: string[];
  affected_assets?: string[];
  causal_chain?: unknown;
};

type ScenarioLike = {
  explanatory_evidence_ids?: string[];
};

export type ResearchDeltaDigest = {
  version: typeof RESEARCH_DELTA_DIGEST_VERSION;
  evidence: EvidencePackItem[];
  evidenceIds: string[];
  sourceEvidenceCount: number;
  referencedEvidenceCount: number;
  selectedEvidenceCount: number;
};

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : [];
}

function causalEvidenceIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((edge) => {
    if (!edge || typeof edge !== "object" || Array.isArray(edge)) return [];
    return stringArray((edge as { evidenceIds?: unknown }).evidenceIds);
  });
}

function ratesTriggerKeys(item: EvidencePackItem): string[] {
  const ratesContext = item.structuredPayload?.ratesContext;
  if (!ratesContext || typeof ratesContext !== "object" || Array.isArray(ratesContext)) return [];
  return stringArray((ratesContext as { triggerItemKeys?: unknown }).triggerItemKeys);
}

/**
 * Deterministically reconstruct the downstream reasoning evidence packet from
 * persisted Hypothesis/Scenario evidence references plus bounded market/rates
 * context. Exact cited evidence is never dropped and an empty reference set
 * never falls back to the full evidence universe.
 */
export function buildResearchDeltaDigest(input: {
  evidence: EvidencePackItem[];
  hypotheses: HypothesisLike[];
  scenarios?: ScenarioLike[];
}): ResearchDeltaDigest {
  const referencedIds = new Set<string>();
  const affectedAssets = new Set<string>();

  for (const hypothesis of input.hypotheses) {
    for (const id of hypothesis.evidence_for_ids ?? []) referencedIds.add(id);
    for (const id of hypothesis.evidence_against_ids ?? []) referencedIds.add(id);
    for (const id of causalEvidenceIds(hypothesis.causal_chain)) referencedIds.add(id);
    for (const asset of hypothesis.affected_assets ?? []) if (asset) affectedAssets.add(asset);
  }
  for (const scenario of input.scenarios ?? []) {
    for (const id of scenario.explanatory_evidence_ids ?? []) referencedIds.add(id);
  }

  if (!referencedIds.size) {
    return {
      version: RESEARCH_DELTA_DIGEST_VERSION,
      evidence: [],
      evidenceIds: [],
      sourceEvidenceCount: input.evidence.length,
      referencedEvidenceCount: 0,
      selectedEvidenceCount: 0,
    };
  }

  const direct = input.evidence.filter((item) => referencedIds.has(item.id));
  const triggerItemKeys = new Set(direct.flatMap((item) => {
    const key = item.structuredPayload?.itemKey;
    return typeof key === "string" && key ? [key] : [];
  }));

  const marketContext = input.evidence
    .filter((item) => !referencedIds.has(item.id)
      && item.evidenceClass === "market_observation"
      && item.affectedAssets.some((asset) => affectedAssets.has(asset)))
    .slice(0, MAX_MARKET_CONTEXT);

  const ratesContext = input.evidence
    .filter((item) => !referencedIds.has(item.id)
      && ratesTriggerKeys(item).some((key) => triggerItemKeys.has(key)))
    .slice(0, MAX_RATES_CONTEXT);

  const selectedIds = new Set([
    ...direct.map((item) => item.id),
    ...marketContext.map((item) => item.id),
    ...ratesContext.map((item) => item.id),
  ]);
  const evidence = input.evidence.filter((item) => selectedIds.has(item.id));

  return {
    version: RESEARCH_DELTA_DIGEST_VERSION,
    evidence,
    evidenceIds: evidence.map((item) => item.id),
    sourceEvidenceCount: input.evidence.length,
    referencedEvidenceCount: referencedIds.size,
    selectedEvidenceCount: evidence.length,
  };
}
