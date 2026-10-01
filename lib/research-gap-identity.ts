import { createHash } from "node:crypto";

import type { ResearchGapWorkSource } from "./research-gap-worker.ts";

type PersistentGapIdentityInput = {
  sourceKind: ResearchGapWorkSource;
  sourceRef: string;
  nativeId?: string | null;
  question?: string | null;
  action: string;
  reason?: string | null;
  evidenceNeeded: string[];
  linkedInvestigationIds: string[];
  linkedStoryIds: string[];
  blockingRefs: string[];
};

function clean(value: string | null | undefined) {
  return (value ?? "").trim();
}

function normaliseText(value: string | null | undefined) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9:._/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stableHash(parts: string[]) {
  return createHash("sha256")
    .update(parts.map(normaliseText).filter(Boolean).join("\n"))
    .digest("hex")
    .slice(0, 24);
}

function canonicalId(value: string | null | undefined) {
  return normaliseText(value).slice(0, 160);
}

function sorted(values: string[]) {
  return [...new Set(values.map(normaliseText).filter(Boolean))].sort();
}

/**
 * Stable cross-Dossier identity for operational Research Gap work.
 *
 * Canonical investigation / gap IDs win whenever available. Research Now work
 * linked to the same investigation keeps distinct evidence branches so two
 * genuinely different tests are not collapsed. Text hashing is deliberately a
 * conservative fallback: lifecycle persistence must not invent fuzzy semantic
 * equivalence that canonical Live has not established.
 */
export function persistentResearchGapKey(input: PersistentGapIdentityInput) {
  const investigationId = canonicalId(input.linkedInvestigationIds[0]);
  const nativeId = canonicalId(input.nativeId);

  if (input.sourceKind === "investigation" && investigationId) {
    return `gap:investigation:${investigationId}`;
  }

  if (input.sourceKind === "research_now" && investigationId) {
    const branchHash = stableHash([
      input.action,
      ...sorted(input.evidenceNeeded),
    ]);
    return `gap:investigation:${investigationId}:branch:${branchHash}`;
  }

  if (input.sourceKind === "research_gap" && nativeId) {
    return `gap:native:${nativeId}`;
  }

  if (input.sourceKind === "market_motion" && nativeId) {
    const branchHash = stableHash([
      input.question ?? "",
      input.action,
      ...sorted(input.evidenceNeeded),
    ]);
    return `gap:motion:${nativeId}:branch:${branchHash}`;
  }

  const storyIds = sorted(input.linkedStoryIds);
  const fingerprint = stableHash([
    input.sourceKind,
    input.question ?? "",
    input.action,
    input.reason ?? "",
    ...storyIds,
    ...sorted(input.blockingRefs),
    ...sorted(input.evidenceNeeded),
    input.sourceRef,
  ]);

  return storyIds.length > 0
    ? `gap:story:${stableHash(storyIds)}:${fingerprint}`
    : `gap:fingerprint:${fingerprint}`;
}
