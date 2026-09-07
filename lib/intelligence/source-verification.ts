import type { EvidencePackItem } from "./schemas";

export type SourceVerificationRole = "canonical" | "discovery_only";

const ZEROHEDGE_READS_PATTERNS = [
  /zero\s*hedge/i,
  /alt[- ]?market|alt-market\.us/i,
  /antiwar(?:\.com)?/i,
  /bitcoin\s*magazine|bitcoinmagazine\.com/i,
  /bombthrower|bombthrower\.com/i,
  /bullionstar|bullionstar\.(?:com|us)/i,
  /capitalist\s*exploits|capitalistexploits/i,
  /christophe\s*barraud|christophe-barraud/i,
  /dollar\s*collapse|dollarcollapse/i,
  /dr\.?\s*housing\s*bubble|doctorhousingbubble/i,
  /financial\s*revolutionist|financialrevolutionist/i,
  /forex\s*live|forexlive/i,
  /forum\s*geopolitica|forumgeopolitica/i,
  /gains\s*pains\s*(?:&|and)\s*capital|gainspainscapital/i,
  /gefira/i,
  /gmg\s*research|gmgresearch/i,
  /gold\s*core|goldcore/i,
  /implode[- ]?explode/i,
  /insider\s*paper|insiderpaper/i,
  /libertarian\s*institute|libertarianinstitute/i,
  /liberty\s*blitzkrieg|libertyblitzkrieg/i,
  /max\s*keiser|maxkeiser/i,
  /mises\s*institute|mises\.org/i,
  /mish\s*talk|mishtalk/i,
  /monetary\s*metals|monetary-metals|monetarymetals/i,
] as const;

export function sourceVerificationRole(input: { sourceName?: string | null; provenanceUrls?: string[] | null; providerKey?: string | null }): SourceVerificationRole {
  const value = [input.sourceName, input.providerKey, ...(input.provenanceUrls ?? [])].filter(Boolean).join(" ");
  return ZEROHEDGE_READS_PATTERNS.some((pattern) => pattern.test(value)) ? "discovery_only" : "canonical";
}

/** Discovery sources can create leads and review debt, never prove a canonical fact or mutation. */
export function isCanonicalEligibleEvidence(item: EvidencePackItem) {
  return item.sourceVerificationRole !== "discovery_only"
    && sourceVerificationRole({ sourceName: item.sourceName, providerKey: item.providerKey, provenanceUrls: item.provenanceUrls }) !== "discovery_only"
    && item.evidenceClass !== "transcript"
    && item.evidenceClass !== "research_analysis"
    && item.sourceTier <= 4;
}

export function sourceVerificationWeight(item: EvidencePackItem) {
  if (!isCanonicalEligibleEvidence(item)) return 0;
  const tierWeight = [0, 1, 0.85, 0.65, 0.45, 0][item.sourceTier] ?? 0;
  return tierWeight * Math.max(0, Math.min(1, item.reliabilityScore / 100));
}
