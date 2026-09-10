import type { EvidencePackItem } from "./schemas.ts";

export const DIVERGENCE_DIGEST_SHADOW_VERSION = "divergence-digest-shadow-v1" as const;

const MAX_ASSET_CONTEXT = 48;
const MAX_TOPIC_CONTEXT = 32;
const MAX_RATES_CONTEXT = 24;

type BeliefLike = {
  evidence_ids?: string[];
  affected_assets?: string[];
};

export type DivergenceDigestShadow = {
  version: typeof DIVERGENCE_DIGEST_SHADOW_VERSION;
  evidence: EvidencePackItem[];
  evidenceIds: string[];
  sourceEvidenceCount: number;
  anchorEvidenceCount: number;
  assetContextCount: number;
  topicContextCount: number;
  ratesContextCount: number;
  candidateEvidenceCount: number;
};

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : [];
}

function ratesTriggerKeys(item: EvidencePackItem): string[] {
  const ratesContext = item.structuredPayload?.ratesContext;
  if (!ratesContext || typeof ratesContext !== "object" || Array.isArray(ratesContext)) return [];
  return stringArray((ratesContext as { triggerItemKeys?: unknown }).triggerItemKeys);
}

/**
 * Measurement-only candidate for a future Divergence evidence digest.
 *
 * The live Divergence model still receives the complete evidence packet. This
 * helper only estimates a deterministic compact packet built around exact
 * Market Belief citations plus bounded asset/topic/rates context. It fails
 * closed when the supplied beliefs cite no evidence rather than pretending the
 * entire universe is a safe compact fallback.
 */
export function buildDivergenceDigestShadow(input: {
  beliefs: BeliefLike[];
  evidence: EvidencePackItem[];
}): DivergenceDigestShadow {
  const anchorIds = new Set<string>();
  const affectedAssets = new Set<string>();

  for (const belief of input.beliefs) {
    for (const id of belief.evidence_ids ?? []) if (id) anchorIds.add(id);
    for (const asset of belief.affected_assets ?? []) if (asset) affectedAssets.add(asset);
  }

  if (!anchorIds.size) {
    return {
      version: DIVERGENCE_DIGEST_SHADOW_VERSION,
      evidence: [],
      evidenceIds: [],
      sourceEvidenceCount: input.evidence.length,
      anchorEvidenceCount: 0,
      assetContextCount: 0,
      topicContextCount: 0,
      ratesContextCount: 0,
      candidateEvidenceCount: 0,
    };
  }

  const anchors = input.evidence.filter((item) => anchorIds.has(item.id));
  const anchorTopics = new Set(anchors.flatMap((item) => item.affectedTopics));
  const anchorItemKeys = new Set(anchors.flatMap((item) => {
    const key = item.structuredPayload?.itemKey;
    return typeof key === "string" && key ? [key] : [];
  }));

  const selected = new Set(anchors.map((item) => item.id));

  const assetContext = input.evidence
    .filter((item) => !selected.has(item.id)
      && item.affectedAssets.some((asset) => affectedAssets.has(asset)))
    .slice(0, MAX_ASSET_CONTEXT);
  assetContext.forEach((item) => selected.add(item.id));

  const topicContext = input.evidence
    .filter((item) => !selected.has(item.id)
      && item.affectedTopics.some((topic) => anchorTopics.has(topic)))
    .slice(0, MAX_TOPIC_CONTEXT);
  topicContext.forEach((item) => selected.add(item.id));

  const ratesContext = input.evidence
    .filter((item) => !selected.has(item.id)
      && ratesTriggerKeys(item).some((key) => anchorItemKeys.has(key)))
    .slice(0, MAX_RATES_CONTEXT);
  ratesContext.forEach((item) => selected.add(item.id));

  const evidence = input.evidence.filter((item) => selected.has(item.id));

  return {
    version: DIVERGENCE_DIGEST_SHADOW_VERSION,
    evidence,
    evidenceIds: evidence.map((item) => item.id),
    sourceEvidenceCount: input.evidence.length,
    anchorEvidenceCount: anchors.length,
    assetContextCount: assetContext.length,
    topicContextCount: topicContext.length,
    ratesContextCount: ratesContext.length,
    candidateEvidenceCount: evidence.length,
  };
}
