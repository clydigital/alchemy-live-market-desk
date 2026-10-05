import type {
  DossierV2InputPacket,
  ObservedEvidence,
  ProvenanceRef,
} from "./input-packet.ts";

export const DOSSIER_EVIDENCE_GOVERNANCE_VERSION =
  "dossier-evidence-governance/1" as const;

export type EvidenceTemporalState = "ACTIVE" | "SUPERSEDED";

export type EvidenceConflictResolution =
  | "UNRESOLVED"
  | "RESOLVED_BY_SUPERSESSION"
  | "INSUFFICIENT_MEMBERS";

export type DossierEvidenceGovernanceItem = {
  evidenceId: string;
  sourceType: string;
  availableAt: string;
  occurrenceTime: string | null;
  publishedAt: string[];
  conflictGroupId: string | null;
  supersededEvidenceIds: string[];
  supersededByEvidenceIds: string[];
  temporalState: EvidenceTemporalState;
  sourceLineageKeys: string[];
  independentLineageCount: number;
};

export type DossierEvidenceConflictGroup = {
  conflictGroupId: string;
  evidenceIds: string[];
  activeEvidenceIds: string[];
  supersededEvidenceIds: string[];
  activeIndependentLineageCount: number;
  resolution: EvidenceConflictResolution;
};

export type DossierEvidenceGovernanceSnapshot = {
  contractVersion: typeof DOSSIER_EVIDENCE_GOVERNANCE_VERSION;
  asOf: string;
  items: DossierEvidenceGovernanceItem[];
  conflictGroups: DossierEvidenceConflictGroup[];
  diagnostics: {
    duplicateEvidenceIds: string[];
    missingProvenanceEvidenceIds: string[];
    unknownSupersededEvidenceIds: string[];
    policy: string[];
  };
};

function clean(value: string | null | undefined) {
  return (value ?? "").trim();
}

function lineageKey(provenance: ProvenanceRef) {
  const sourceType = clean(provenance.source_type).toLowerCase();
  const sourceId = clean(provenance.source_id).toLowerCase();
  const url = clean(provenance.url).toLowerCase();

  // Exact provider/source identity only. Never infer semantic independence.
  if (!sourceType || !sourceId) return null;
  return [sourceType, sourceId, url].join("|");
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.map(clean).filter(Boolean))].sort();
}

function allEvidence(packet: DossierV2InputPacket) {
  return [
    ...(Array.isArray(packet.observed_evidence) ? packet.observed_evidence : []),
    ...(Array.isArray(packet.rate_context?.evidence)
      ? packet.rate_context.evidence
      : []),
  ];
}

function chooseCanonicalDuplicate(
  current: ObservedEvidence,
  candidate: ObservedEvidence,
) {
  // Packet assembly should already make evidence_id canonical. If a repeated
  // ref appears in rate_context, prefer the richer item deterministically
  // without creating a second identity.
  const currentScore =
    current.provenance.length
    + (current.conflict_group_id ? 1 : 0)
    + (current.superseded_evidence_ids?.length ?? 0)
    + (current.occurrence_time ? 1 : 0);
  const candidateScore =
    candidate.provenance.length
    + (candidate.conflict_group_id ? 1 : 0)
    + (candidate.superseded_evidence_ids?.length ?? 0)
    + (candidate.occurrence_time ? 1 : 0);

  if (candidateScore !== currentScore) {
    return candidateScore > currentScore ? candidate : current;
  }
  return candidate.available_at > current.available_at ? candidate : current;
}

export function buildDossierEvidenceGovernance(
  packet: DossierV2InputPacket,
): DossierEvidenceGovernanceSnapshot {
  const byId = new Map<string, ObservedEvidence>();
  const duplicateEvidenceIds = new Set<string>();

  for (const evidence of allEvidence(packet)) {
    const id = clean(evidence.evidence_id);
    if (!id) continue;
    const existing = byId.get(id);
    if (existing) {
      duplicateEvidenceIds.add(id);
      byId.set(id, chooseCanonicalDuplicate(existing, evidence));
    } else {
      byId.set(id, evidence);
    }
  }

  const supersededBy = new Map<string, Set<string>>();
  const unknownSupersededEvidenceIds = new Set<string>();
  for (const evidence of byId.values()) {
    for (const rawSupersededId of evidence.superseded_evidence_ids ?? []) {
      const supersededId = clean(rawSupersededId);
      if (!supersededId) continue;
      if (!byId.has(supersededId)) {
        unknownSupersededEvidenceIds.add(supersededId);
      }
      const replacements = supersededBy.get(supersededId) ?? new Set<string>();
      replacements.add(evidence.evidence_id);
      supersededBy.set(supersededId, replacements);
    }
  }

  const items = [...byId.values()]
    .map((evidence): DossierEvidenceGovernanceItem => {
      const sourceLineageKeys = uniqueSorted(
        evidence.provenance.flatMap((item) => {
          const key = lineageKey(item);
          return key ? [key] : [];
        }),
      );
      const replacements = uniqueSorted([
        ...(supersededBy.get(evidence.evidence_id) ?? new Set<string>()),
      ]);

      return {
        evidenceId: evidence.evidence_id,
        sourceType: evidence.source_type,
        availableAt: evidence.available_at,
        occurrenceTime: evidence.occurrence_time ?? null,
        publishedAt: uniqueSorted(
          evidence.provenance.flatMap((item) =>
            clean(item.published_at) ? [clean(item.published_at)] : []),
        ),
        conflictGroupId: clean(evidence.conflict_group_id) || null,
        supersededEvidenceIds: uniqueSorted(
          evidence.superseded_evidence_ids ?? [],
        ),
        supersededByEvidenceIds: replacements,
        temporalState: replacements.length ? "SUPERSEDED" : "ACTIVE",
        sourceLineageKeys,
        independentLineageCount: sourceLineageKeys.length,
      };
    })
    .sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));

  const itemsById = new Map(items.map((item) => [item.evidenceId, item]));
  const conflictMembers = new Map<string, string[]>();
  for (const item of items) {
    if (!item.conflictGroupId) continue;
    const members = conflictMembers.get(item.conflictGroupId) ?? [];
    members.push(item.evidenceId);
    conflictMembers.set(item.conflictGroupId, members);
  }

  const conflictGroups = [...conflictMembers.entries()]
    .map(([conflictGroupId, evidenceIds]): DossierEvidenceConflictGroup => {
      const memberItems = evidenceIds
        .map((id) => itemsById.get(id))
        .filter((item): item is DossierEvidenceGovernanceItem => Boolean(item));
      const active = memberItems.filter(
        (item) => item.temporalState === "ACTIVE",
      );
      const superseded = memberItems.filter(
        (item) => item.temporalState === "SUPERSEDED",
      );
      const activeLineages = uniqueSorted(
        active.flatMap((item) => item.sourceLineageKeys),
      );

      const resolution: EvidenceConflictResolution =
        memberItems.length < 2
          ? "INSUFFICIENT_MEMBERS"
          : active.length <= 1 && superseded.length > 0
            ? "RESOLVED_BY_SUPERSESSION"
            : "UNRESOLVED";

      return {
        conflictGroupId,
        evidenceIds: uniqueSorted(evidenceIds),
        activeEvidenceIds: uniqueSorted(
          active.map((item) => item.evidenceId),
        ),
        supersededEvidenceIds: uniqueSorted(
          superseded.map((item) => item.evidenceId),
        ),
        activeIndependentLineageCount: activeLineages.length,
        resolution,
      };
    })
    .sort((left, right) =>
      left.conflictGroupId.localeCompare(right.conflictGroupId));

  return {
    contractVersion: DOSSIER_EVIDENCE_GOVERNANCE_VERSION,
    asOf: packet.as_of,
    items,
    conflictGroups,
    diagnostics: {
      duplicateEvidenceIds: [...duplicateEvidenceIds].sort(),
      missingProvenanceEvidenceIds: items
        .filter((item) => item.sourceLineageKeys.length === 0)
        .map((item) => item.evidenceId),
      unknownSupersededEvidenceIds: [...unknownSupersededEvidenceIds].sort(),
      policy: [
        "Freshness remains claim-relative; this snapshot does not invent fixed age thresholds.",
        "Supersession is explicit and preserves historical evidence rather than deleting it.",
        "Source independence uses exact provenance lineage only; no fuzzy semantic matching is performed.",
        "Conflict groups remain unresolved unless explicit supersession leaves at most one active member.",
      ],
    },
  };
}
