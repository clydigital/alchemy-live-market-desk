import type { EvidencePackItem } from "./schemas";

export type SourceVerificationRole = "canonical" | "discovery_only";

export function sourceVerificationRole(input: { sourceName?: string | null; provenanceUrls?: string[] | null; providerKey?: string | null }) : SourceVerificationRole {
  const value = [input.sourceName, input.providerKey, ...(input.provenanceUrls ?? [])].filter(Boolean).join(" ").toLowerCase();
  return /zerohedge|zero hedge/.test(value) ? "discovery_only" : "canonical";
}

/** Discovery sources can create leads and review debt, never prove a canonical fact or mutation. */
export function isCanonicalEligibleEvidence(item: EvidencePackItem) {
  return item.sourceVerificationRole !== "discovery_only"
    && item.evidenceClass !== "transcript"
    && item.evidenceClass !== "research_analysis"
    && item.sourceTier <= 4;
}

export function sourceVerificationWeight(item: EvidencePackItem) {
  if (!isCanonicalEligibleEvidence(item)) return 0;
  const tierWeight = [0, 1, 0.85, 0.65, 0.45, 0][item.sourceTier] ?? 0;
  return tierWeight * Math.max(0, Math.min(1, item.reliabilityScore / 100));
}
