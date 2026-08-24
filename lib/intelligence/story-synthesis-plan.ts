import { createHash } from "node:crypto";

import type {
  CanonicalEntityRefV1,
  CanonicalNextTestV1,
  CanonicalSeriesRefV1,
  NextTestStatus,
  VisualPlanV1,
} from "./story-reasoning.ts";

export type CanonicalCatalystCandidateV1 = {
  label: string;
  catalystRef: string | null;
  dueAt?: string | null;
  expiresAt?: string | null;
  evidenceIds?: string[];
  resolutionEvidenceIds?: string[];
};

export type StorySynthesisNextTestSelectionV1 = {
  label: string;
  catalystRef: string | null;
} | null;

export type CanonicalExpectedRelationshipV1 =
  | "positive"
  | "inverse"
  | "divergent"
  | "none_asserted";

export type VisualPlanAllowListV1 = {
  edgeIds: ReadonlySet<string>;
  claimIds: ReadonlySet<string>;
  evidenceIds: ReadonlySet<string>;
  seriesById: ReadonlyMap<string, CanonicalSeriesRefV1>;
  entityById: ReadonlyMap<string, CanonicalEntityRefV1>;
  expectedRelationships?: ReadonlySet<Exclude<CanonicalExpectedRelationshipV1, "none_asserted">>;
  confirmationCount: number;
  invalidationCount: number;
  hasNextTest: boolean;
};

export type StorySynthesisPlanSelectionV1 = {
  nextTest: StorySynthesisNextTestSelectionV1;
  visualPlan: VisualPlanV1[];
};

function hash(value: string, length = 16) {
  return createHash("sha256").update(value).digest("hex").slice(0, length);
}

function normalizedRef(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

function normalizedLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function uniqueInOrder(values: string[]) {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    output.push(value);
  }
  return output;
}

function validDateMs(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function deterministicNextTestStatus(
  candidate: CanonicalCatalystCandidateV1,
  nowMs: number,
): NextTestStatus {
  if ((candidate.resolutionEvidenceIds ?? []).length > 0) return "resolved";
  const expiresAt = validDateMs(candidate.expiresAt);
  if (expiresAt !== null && expiresAt <= nowMs) return "expired";
  const dueAt = validDateMs(candidate.dueAt);
  if (dueAt !== null && dueAt <= nowMs) return "due";
  return "upcoming";
}

function allKnown(ids: string[], known: ReadonlySet<string>) {
  return ids.every((id) => known.has(id));
}

export function buildCanonicalNextTestFromSelectionV1(input: {
  ownerKey: string;
  selection: StorySynthesisNextTestSelectionV1;
  candidates: readonly CanonicalCatalystCandidateV1[];
  knownEvidenceIds: ReadonlySet<string>;
  now?: string | Date;
}): CanonicalNextTestV1 | null {
  if (!input.selection) return null;

  const selectedLabel = normalizedLabel(input.selection.label);
  const selectedRef = normalizedRef(input.selection.catalystRef);
  if (!selectedLabel) return null;

  const candidate = input.candidates.find((item) => (
    normalizedLabel(item.label) === selectedLabel
    && normalizedRef(item.catalystRef) === selectedRef
  ));
  if (!candidate) return null;

  const evidenceIds = uniqueInOrder(candidate.evidenceIds ?? []);
  const resolutionEvidenceIds = uniqueInOrder(candidate.resolutionEvidenceIds ?? []);
  if (!allKnown(evidenceIds, input.knownEvidenceIds) || !allKnown(resolutionEvidenceIds, input.knownEvidenceIds)) {
    return null;
  }

  const nowValue = input.now instanceof Date
    ? input.now.getTime()
    : input.now
      ? Date.parse(input.now)
      : Date.now();
  const nowMs = Number.isFinite(nowValue) ? nowValue : Date.now();
  const catalystRef = normalizedRef(candidate.catalystRef);
  const identity = `${selectedLabel}|${catalystRef ?? ""}`;

  return {
    id: `candidate:${input.ownerKey}:next-test:${hash(identity, 20)}`,
    label: selectedLabel,
    status: deterministicNextTestStatus(candidate, nowMs),
    catalystRef,
    dueAt: candidate.dueAt ?? null,
    expiresAt: candidate.expiresAt ?? null,
    evidenceIds,
    resolutionEvidenceIds,
  };
}

function canonicalSeries(
  series: CanonicalSeriesRefV1[],
  allowed: VisualPlanAllowListV1,
): CanonicalSeriesRefV1[] | null {
  const ids = series.map((item) => item.seriesId);
  if (new Set(ids).size !== ids.length) return null;
  const canonical = ids.map((id) => allowed.seriesById.get(id));
  return canonical.every((item): item is CanonicalSeriesRefV1 => Boolean(item)) ? canonical : null;
}

function canonicalEntities(
  entities: CanonicalEntityRefV1[],
  allowed: VisualPlanAllowListV1,
): CanonicalEntityRefV1[] | null {
  const ids = entities.map((item) => item.entityId);
  if (new Set(ids).size !== ids.length) return null;
  const canonical = ids.map((id) => allowed.entityById.get(id));
  if (!canonical.every((item): item is CanonicalEntityRefV1 => Boolean(item))) return null;
  if (!canonical.every((item) => allKnown(item.evidenceIds, allowed.evidenceIds))) return null;
  return canonical;
}

function knownOrderedIds(ids: string[], allowed: ReadonlySet<string>) {
  if (new Set(ids).size !== ids.length) return null;
  return allKnown(ids, allowed) ? [...ids] : null;
}

function canonicalVisualId(ordinal: number, value: Omit<VisualPlanV1, "id">) {
  return `visual:${ordinal}:${hash(JSON.stringify(value), 20)}`;
}

function validateVisual(
  visual: VisualPlanV1,
  ordinal: number,
  allowed: VisualPlanAllowListV1,
): VisualPlanV1 | null {
  const title = visual.title.trim();
  if (!title) return null;

  if (visual.type === "linear_chain") {
    const edgeIds = knownOrderedIds(visual.edgeIds, allowed.edgeIds);
    if (!edgeIds?.length) return null;
    const value = { type: visual.type, title, edgeIds } as Omit<VisualPlanV1, "id">;
    return { ...value, id: canonicalVisualId(ordinal, value) } as VisualPlanV1;
  }

  if (visual.type === "feedback_loop") {
    const edgeIds = knownOrderedIds(visual.edgeIds, allowed.edgeIds);
    if (!edgeIds?.length || !allowed.edgeIds.has(visual.loopClosureEdgeId)) return null;
    const value = {
      type: visual.type,
      title,
      edgeIds,
      loopClosureEdgeId: visual.loopClosureEdgeId,
    } as Omit<VisualPlanV1, "id">;
    return { ...value, id: canonicalVisualId(ordinal, value) } as VisualPlanV1;
  }

  if (visual.type === "money_or_commodity_flow") {
    const edgeIds = knownOrderedIds(visual.edgeIds, allowed.edgeIds);
    const entities = canonicalEntities(visual.entities, allowed);
    const flowLabel = visual.flowLabel.trim();
    if (!edgeIds?.length || !entities?.length || !flowLabel) return null;
    const value = { type: visual.type, title, edgeIds, entities, flowLabel } as Omit<VisualPlanV1, "id">;
    return { ...value, id: canonicalVisualId(ordinal, value) } as VisualPlanV1;
  }

  if (visual.type === "entity_map") {
    const entities = canonicalEntities(visual.entities, allowed);
    const connectionEdgeIds = knownOrderedIds(visual.connectionEdgeIds, allowed.edgeIds);
    if (!entities?.length || connectionEdgeIds === null) return null;
    const value = { type: visual.type, title, entities, connectionEdgeIds } as Omit<VisualPlanV1, "id">;
    return { ...value, id: canonicalVisualId(ordinal, value) } as VisualPlanV1;
  }

  if (visual.type === "divergence_chart") {
    const series = canonicalSeries(visual.series, allowed);
    const evidenceIds = knownOrderedIds(visual.evidenceIds, allowed.evidenceIds);
    if (!series?.length || evidenceIds === null) return null;
    const expectedRelationship = visual.expectedRelationship === "none_asserted"
      || allowed.expectedRelationships?.has(visual.expectedRelationship)
      ? visual.expectedRelationship
      : "none_asserted";
    const value = {
      type: visual.type,
      title,
      series,
      expectedRelationship,
      evidenceIds,
      window: { ...visual.window },
    } as Omit<VisualPlanV1, "id">;
    return { ...value, id: canonicalVisualId(ordinal, value) } as VisualPlanV1;
  }

  if (visual.type === "before_after") {
    const beforeClaimIds = knownOrderedIds(visual.beforeClaimIds, allowed.claimIds);
    const afterClaimIds = knownOrderedIds(visual.afterClaimIds, allowed.claimIds);
    const changeEvidenceIds = knownOrderedIds(visual.changeEvidenceIds, allowed.evidenceIds);
    const series = canonicalSeries(visual.series, allowed);
    if (beforeClaimIds === null || afterClaimIds === null || changeEvidenceIds === null || series === null) return null;
    if (!beforeClaimIds.length && !afterClaimIds.length) return null;
    const value = {
      type: visual.type,
      title,
      beforeClaimIds,
      afterClaimIds,
      changeEvidenceIds,
      series,
    } as Omit<VisualPlanV1, "id">;
    return { ...value, id: canonicalVisualId(ordinal, value) } as VisualPlanV1;
  }

  if (visual.type === "decision_tree") {
    if (!allowed.claimIds.has(visual.rootClaimId)) return null;
    const branches = visual.branches.map((branch) => {
      const outcomeClaimIds = knownOrderedIds(branch.outcomeClaimIds, allowed.claimIds);
      if (outcomeClaimIds === null) return null;
      const ref = branch.conditionRef;
      if (ref.kind === "confirmation" && (ref.index < 0 || ref.index >= allowed.confirmationCount)) return null;
      if (ref.kind === "invalidation" && (ref.index < 0 || ref.index >= allowed.invalidationCount)) return null;
      if (ref.kind === "next_test" && !allowed.hasNextTest) return null;
      return { conditionRef: { ...ref }, outcomeClaimIds };
    });
    if (!branches.length || branches.some((branch) => branch === null)) return null;
    const value = {
      type: visual.type,
      title,
      rootClaimId: visual.rootClaimId,
      branches: branches as NonNullable<(typeof branches)[number]>[],
    } as Omit<VisualPlanV1, "id">;
    return { ...value, id: canonicalVisualId(ordinal, value) } as VisualPlanV1;
  }

  return null;
}

export function validateVisualPlanV1(
  visualPlan: readonly VisualPlanV1[],
  allowed: VisualPlanAllowListV1,
): VisualPlanV1[] {
  if (!visualPlan.length) return [];
  const accepted: VisualPlanV1[] = [];
  for (let ordinal = 0; ordinal < visualPlan.length; ordinal += 1) {
    const visual = validateVisual(visualPlan[ordinal], ordinal, allowed);
    if (visual) accepted.push(visual);
  }
  return accepted;
}

export function buildValidatedStorySynthesisPlanV1(input: {
  ownerKey: string;
  selection: StorySynthesisPlanSelectionV1;
  catalystCandidates: readonly CanonicalCatalystCandidateV1[];
  knownEvidenceIds: ReadonlySet<string>;
  visualAllowList: Omit<VisualPlanAllowListV1, "hasNextTest">;
  now?: string | Date;
}) {
  const nextTest = buildCanonicalNextTestFromSelectionV1({
    ownerKey: input.ownerKey,
    selection: input.selection.nextTest,
    candidates: input.catalystCandidates,
    knownEvidenceIds: input.knownEvidenceIds,
    now: input.now,
  });
  const visualPlan = validateVisualPlanV1(input.selection.visualPlan ?? [], {
    ...input.visualAllowList,
    hasNextTest: Boolean(nextTest),
  });
  return { nextTest, visualPlan };
}
