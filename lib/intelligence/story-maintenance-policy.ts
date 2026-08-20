import type { EvidencePackItem } from "./schemas.ts";

export type MaintenanceDisposition = "unchanged" | "reinforced" | "weakened" | "reframed" | "invalidated";

function creatorOnly(item: EvidencePackItem) {
  return item.evidenceClass === "transcript" || item.evidenceClass === "research_analysis";
}

function credibleNonCreator(item: EvidencePackItem) {
  return !creatorOnly(item) && item.sourceTier <= 4;
}

function independentGroup(item: EvidencePackItem) {
  return item.ancestryGroupId || `source:${item.sourceName.trim().toLowerCase()}`;
}

/**
 * Creator commentary may generate a test or countercase, but cannot mutate the
 * canonical thesis on its own. Invalidation is intentionally stricter because
 * archiving a Story is the highest-impact state transition in maintenance.
 */
export function materialMutationAuthorised(input: {
  disposition: MaintenanceDisposition;
  evidenceIds: string[];
  evidenceById: Map<string, EvidencePackItem>;
}) {
  const credible = input.evidenceIds
    .map((id) => input.evidenceById.get(id))
    .filter((item): item is EvidencePackItem => Boolean(item && credibleNonCreator(item)));
  if (!credible.length) return false;
  if (input.disposition !== "invalidated") return true;
  if (credible.some((item) => item.sourceTier <= 2)) return true;
  return new Set(credible.map(independentGroup)).size >= 2;
}

export function effectiveMaintenanceDisposition(input: {
  disposition: MaintenanceDisposition;
  requestedMaterialChange: boolean;
  authorised: boolean;
}): MaintenanceDisposition {
  return input.requestedMaterialChange && input.authorised ? input.disposition : "unchanged";
}

export function materialDecisiveEvidenceIds(input: {
  supporting: string[];
  contradicting: string[];
}) {
  return [...new Set([...input.supporting, ...input.contradicting])];
}
