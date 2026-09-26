import type {
  EvidencePackItem,
  StoryReviewTargetPackItem,
} from "./schemas.ts";
import { attachRatesContext } from "./rates-context.ts";

const MAX_CLAIM_CHARS = 1_800;
const MAX_SUMMARY_CHARS = 700;
const MAX_SIGNAL_CHARS = 500;
const MAX_TITLE_CHARS = 320;
const MAX_ARRAY_ITEMS = 12;
const MAX_PROVENANCE_URLS = 2;

const STRUCTURED_PAYLOAD_KEYS = [
  "title",
  "itemKey",
  "novelty",
  "relevance",
  "newsSignal",
  "materiality",
  "statsSignal",
  "reviewReason",
  "candidateScore",
  "divergenceKind",
  "evidenceNature",
  "recommendedAction",
] as const;

type BeliefEvidenceReference = {
  evidence_ids: string[];
  recruitment_cluster_ids: string[];
};

type RecruitmentClusterEvidenceReference = {
  id: string;
  evidence_ids: string[];
};

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function compactText(value: unknown, maximum: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = decodeEntities(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  if (cleaned.length <= maximum) return cleaned;

  const marker = " …[truncated for model input]… ";
  const available = Math.max(0, maximum - marker.length);
  const head = Math.floor(available * 0.72);
  const tail = available - head;
  return cleaned.slice(0, head) + marker + cleaned.slice(-tail);
}

function compactPrimitive(value: unknown): unknown {
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) return value;
  if (typeof value === "string") return compactText(value, MAX_SIGNAL_CHARS);
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => compactPrimitive(item))
      .filter((item) => item !== undefined);
  }
  return undefined;
}

function compactRatesContext(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const triggerItemKeys = Array.isArray(record.triggerItemKeys)
    ? record.triggerItemKeys.filter((item): item is string => typeof item === "string").slice(0, 8)
    : [];
  return {
    ...(triggerItemKeys.length ? { triggerItemKeys } : {}),
    ...(typeof record.retrievedAt === "string" ? { retrievedAt: record.retrievedAt } : {}),
  };
}

function compactStructuredPayload(payload: Record<string, unknown>) {
  const compact: Record<string, unknown> = {};
  for (const key of STRUCTURED_PAYLOAD_KEYS) {
    const value = compactPrimitive(payload[key]);
    if (value !== undefined && value !== null && value !== "") compact[key] = value;
  }
  const ratesContext = compactRatesContext(payload.ratesContext);
  if (ratesContext && Object.keys(ratesContext).length) compact.ratesContext = ratesContext;
  return compact;
}

export function compactEvidenceForModel(item: EvidencePackItem) {
  return {
    id: item.id,
    claim: compactText(item.claim, MAX_CLAIM_CHARS) ?? "",
    summary: compactText(item.summary, MAX_SUMMARY_CHARS),
    evidenceClass: item.evidenceClass,
    sourceName: item.sourceName,
    sourceTier: item.sourceTier,
    reliabilityScore: item.reliabilityScore,
    ancestryGroupId: item.ancestryGroupId,
    supportDirection: item.supportDirection,
    eventAt: item.eventAt,
    publishedAt: item.publishedAt,
    availableAt: item.availableAt,
    freshnessStatus: item.freshnessStatus,
    affectedAssets: item.affectedAssets.slice(0, MAX_ARRAY_ITEMS),
    affectedTopics: item.affectedTopics.slice(0, MAX_ARRAY_ITEMS),
    provenanceUrls: item.provenanceUrls.slice(0, MAX_PROVENANCE_URLS),
    providerKey: item.providerKey ?? null,
    sourceVerificationRole: item.sourceVerificationRole ?? "canonical",
    structuredPayload: compactStructuredPayload(item.structuredPayload),
  };
}

export function compactStoryReviewTargetsForModel(
  targets: StoryReviewTargetPackItem[],
) {
  return targets.map((target) => ({
    ...target,
    relevantEvidence: target.relevantEvidence.map(compactEvidenceForModel),
  }));
}

export function buildDivergenceEvidencePack({
  beliefs,
  recruitmentClusters,
  reasoningEvidence,
  asOf,
}: {
  beliefs: BeliefEvidenceReference[];
  recruitmentClusters: RecruitmentClusterEvidenceReference[];
  reasoningEvidence: EvidencePackItem[];
  asOf: string;
}) {
  const clusterById = new Map(recruitmentClusters.map((cluster) => [cluster.id, cluster]));
  const selectedIds = new Set<string>();

  for (const belief of beliefs) {
    for (const evidenceId of belief.evidence_ids ?? []) selectedIds.add(evidenceId);
    for (const clusterId of belief.recruitment_cluster_ids ?? []) {
      for (const evidenceId of clusterById.get(clusterId)?.evidence_ids ?? []) {
        selectedIds.add(evidenceId);
      }
    }
  }

  if (!selectedIds.size) return reasoningEvidence;

  const selected = reasoningEvidence.filter((item) => selectedIds.has(item.id));
  if (!selected.length) return reasoningEvidence;
  return attachRatesContext(selected, reasoningEvidence, asOf);
}

export function stageInputSize(value: unknown) {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}
