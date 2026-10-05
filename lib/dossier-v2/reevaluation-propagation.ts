import type { SupabaseClient } from "@supabase/supabase-js";

import type { DossierV2InputPacket } from "./input-packet.ts";
import type {
  MotionSynthesisDecision,
  ResearchBrainOutputV1,
} from "./research-brain-contracts.ts";
import { isValidUuid } from "./validation.ts";

export const DOSSIER_REEVALUATION_PROPAGATION_CONTRACT_VERSION =
  "dossier-reevaluation-propagation/1" as const;
export const MAX_DOSSIER_REEVALUATION_PROPAGATION_TARGETS = 4;

export type DossierReevaluationPropagationRouteKind =
  | "dossier_persistent_story"
  | "explicit_story"
  | "motion_primary_story"
  | "regime_core"
  | "regime_bridge";

export type DossierPersistentStoryEvidenceClassification =
  | "CONFIRMING"
  | "CONTRADICTING"
  | "ACCELERATING";

export type DossierReevaluationPropagationItem = {
  /** Present for A2 Motion-originated A3 items; null for direct Dossier Story evidence items. */
  motion_id: string | null;
  decision: Extract<MotionSynthesisDecision, "ACCEPT" | "REFINE"> | null;
  source_kind?: "dossier_story_evidence";
  source_ref?: string;
  evidence_classification?: DossierPersistentStoryEvidenceClassification;
  /** Exact evidence reference emitted by A2 and present in the Dossier packet. */
  canonical_evidence_ref: string;
  /** Internal intelligence_evidence.id UUID used by the durable Story queue FK. */
  canonical_evidence_id: string;
  target_story_id: string;
  target_story_slug: string;
  target_regime_slug: string | null;
  route_kind: DossierReevaluationPropagationRouteKind;
  priority: number;
  route_reason: string;
};

export type DossierReevaluationPropagationPlan = {
  contract_version: typeof DOSSIER_REEVALUATION_PROPAGATION_CONTRACT_VERSION;
  items: DossierReevaluationPropagationItem[];
  omitted_count: number;
  warnings: string[];
};

export type DossierPropagationStoryRow = {
  id: string;
  slug: string;
  status: string;
  confidence: number | null;
};

export type DossierPropagationRegimeLinkRow = {
  regime_slug: string;
  story_id: string;
  role: "core" | "bridge" | "supporting" | "countercase" | string;
  confidence: number;
};

type PlannerInput = {
  packet: DossierV2InputPacket;
  analyticalOutput: ResearchBrainOutputV1;
  stories: DossierPropagationStoryRow[];
  regimeLinks: DossierPropagationRegimeLinkRow[];
  queueableEvidenceIds: ReadonlySet<string>;
  queueEvidenceIdByCanonicalRef?: ReadonlyMap<string, string>;
  evidenceIdentityWarnings?: string[];
};

type RankedItem = DossierReevaluationPropagationItem & {
  route_rank: number;
  decision_rank: number;
  link_confidence: number;
  story_confidence: number;
  sequence: number;
};

function emptyPlan(warnings: string[] = []): DossierReevaluationPropagationPlan {
  return {
    contract_version: DOSSIER_REEVALUATION_PROPAGATION_CONTRACT_VERSION,
    items: [],
    omitted_count: 0,
    warnings,
  };
}

function decisionPriority(
  route: DossierReevaluationPropagationRouteKind,
  decision: Extract<MotionSynthesisDecision, "ACCEPT" | "REFINE">,
) {
  const accepted = decision === "ACCEPT";
  if (route === "explicit_story") return accepted ? 95 : 90;
  if (route === "motion_primary_story") return accepted ? 92 : 87;
  if (route === "regime_core") return accepted ? 90 : 85;
  return accepted ? 85 : 80;
}

function routeRank(route: DossierReevaluationPropagationRouteKind, sourceRole?: string) {
  if (route === "dossier_persistent_story" || route === "explicit_story") return 0;
  if (route === "motion_primary_story") return 1;
  if (route === "regime_core") return 2;
  return sourceRole === "supporting" ? 4 : 3;
}

function persistentStoryEvidencePriority(
  classification: DossierPersistentStoryEvidenceClassification,
) {
  if (classification === "ACCELERATING") return 93;
  if (classification === "CONTRADICTING") return 90;
  return 85;
}

function persistentStoryEvidenceRank(
  classification: DossierPersistentStoryEvidenceClassification,
) {
  if (classification === "ACCELERATING") return 0;
  if (classification === "CONTRADICTING") return 1;
  return 2;
}

function rankedItemCompare(left: RankedItem, right: RankedItem) {
  return left.route_rank - right.route_rank
    || left.decision_rank - right.decision_rank
    || right.link_confidence - left.link_confidence
    || right.priority - left.priority
    || right.story_confidence - left.story_confidence
    || left.target_story_id.localeCompare(right.target_story_id)
    || left.canonical_evidence_id.localeCompare(right.canonical_evidence_id)
    || left.sequence - right.sequence;
}

function canonicalPacketEvidenceIds(packet: DossierV2InputPacket) {
  return new Set([
    ...packet.observed_evidence.map((item) => item.evidence_id),
    ...(packet.rate_context?.evidence ?? []).map((item) => item.evidence_id),
  ]);
}

function firstQueueableEvidenceIdentity(
  refs: string[],
  packetEvidenceIds: ReadonlySet<string>,
  queueableEvidenceIds: ReadonlySet<string>,
  queueEvidenceIdByCanonicalRef?: ReadonlyMap<string, string>,
) {
  for (const ref of refs) {
    if (!packetEvidenceIds.has(ref)) continue;
    const mapped = queueEvidenceIdByCanonicalRef?.get(ref);
    if (mapped && isValidUuid(mapped) && queueableEvidenceIds.has(mapped)) {
      return { ref, id: mapped };
    }
    if (isValidUuid(ref) && queueableEvidenceIds.has(ref)) {
      return { ref, id: ref };
    }
  }
  return null;
}

function validStory(
  storyById: ReadonlyMap<string, DossierPropagationStoryRow>,
  storyId: string | null | undefined,
) {
  if (!storyId) return null;
  const story = storyById.get(storyId);
  if (!story || story.status === "discarded") return null;
  return story;
}

function regimeLinkCompare(
  storyById: ReadonlyMap<string, DossierPropagationStoryRow>,
  left: DossierPropagationRegimeLinkRow,
  right: DossierPropagationRegimeLinkRow,
) {
  const role = (value: string) => value === "core" ? 0 : value === "bridge" ? 1 : value === "supporting" ? 2 : 3;
  const leftStory = storyById.get(left.story_id);
  const rightStory = storyById.get(right.story_id);
  return role(left.role) - role(right.role)
    || right.confidence - left.confidence
    || Number(rightStory?.confidence ?? 0) - Number(leftStory?.confidence ?? 0)
    || left.story_id.localeCompare(right.story_id);
}

function addCandidate(
  candidates: RankedItem[],
  input: {
    motionId: string;
    decision: Extract<MotionSynthesisDecision, "ACCEPT" | "REFINE">;
    evidenceRef: string;
    evidenceId: string;
    story: DossierPropagationStoryRow;
    regimeSlug: string | null;
    routeKind: DossierReevaluationPropagationRouteKind;
    routeReason: string;
    linkConfidence?: number;
    sourceRole?: string;
    sequence: number;
  },
) {
  candidates.push({
    motion_id: input.motionId,
    decision: input.decision,
    canonical_evidence_ref: input.evidenceRef,
    canonical_evidence_id: input.evidenceId,
    target_story_id: input.story.id,
    target_story_slug: input.story.slug,
    target_regime_slug: input.regimeSlug,
    route_kind: input.routeKind,
    priority: decisionPriority(input.routeKind, input.decision),
    route_reason: input.routeReason,
    route_rank: routeRank(input.routeKind, input.sourceRole),
    decision_rank: input.decision === "ACCEPT" ? 0 : 1,
    link_confidence: input.linkConfidence ?? 0,
    story_confidence: Number(input.story.confidence ?? 0),
    sequence: input.sequence,
  });
}

function addPersistentStoryCandidate(
  candidates: RankedItem[],
  input: {
    analyticalStoryId: string;
    classification: DossierPersistentStoryEvidenceClassification;
    evidenceRef: string;
    evidenceId: string;
    story: DossierPropagationStoryRow;
    sequence: number;
  },
) {
  candidates.push({
    motion_id: null,
    decision: null,
    source_kind: "dossier_story_evidence",
    source_ref: input.analyticalStoryId,
    evidence_classification: input.classification,
    canonical_evidence_ref: input.evidenceRef,
    canonical_evidence_id: input.evidenceId,
    target_story_id: input.story.id,
    target_story_slug: input.story.slug,
    target_regime_slug: null,
    route_kind: "dossier_persistent_story",
    priority: persistentStoryEvidencePriority(input.classification),
    route_reason:
      `dossier_story:${input.analyticalStoryId}|classification:${input.classification}`,
    route_rank: routeRank("dossier_persistent_story"),
    decision_rank: persistentStoryEvidenceRank(input.classification),
    link_confidence: 0,
    story_confidence: Number(input.story.confidence ?? 0),
    sequence: input.sequence,
  });
}

export function buildDossierReevaluationPropagationPlan(
  input: PlannerInput,
): DossierReevaluationPropagationPlan {
  const motionItems = input.packet.motion_context?.items ?? [];
  const motionById = new Map(motionItems.map((item) => [item.motion_id, item]));
  const storyById = new Map(input.stories.map((story) => [story.id, story]));
  const packetEvidenceIds = canonicalPacketEvidenceIds(input.packet);
  const warnings: string[] = [...(input.evidenceIdentityWarnings ?? [])];
  const candidates: RankedItem[] = [];
  const decisions = input.analyticalOutput.motion_acceptance?.decisions ?? [];

  for (let decisionIndex = 0; decisionIndex < decisions.length; decisionIndex++) {
    const acceptance = decisions[decisionIndex];
    if (acceptance.decision !== "ACCEPT" && acceptance.decision !== "REFINE") continue;

    const motion = motionById.get(acceptance.motion_id);
    if (!motion) {
      warnings.push(
        `Motion ${acceptance.motion_id} was accepted/refined but is absent from the bounded Motion context; propagation skipped.`,
      );
      continue;
    }

    const evidenceIdentity = firstQueueableEvidenceIdentity(
      acceptance.canonical_evidence_refs,
      packetEvidenceIds,
      input.queueableEvidenceIds,
      input.queueEvidenceIdByCanonicalRef,
    );
    if (!evidenceIdentity) {
      warnings.push(
        `Motion ${acceptance.motion_id} ${acceptance.decision} has no queueable canonical evidence UUID in intelligence_evidence; propagation skipped.`,
      );
      continue;
    }

    const decision = acceptance.decision;
    const explicitStoryRefs = acceptance.destination_refs
      .filter((ref) => ref.startsWith("STORY:"))
      .map((ref) => ref.slice("STORY:".length))
      .filter(Boolean);

    if (explicitStoryRefs.length) {
      for (const storyId of [...new Set(explicitStoryRefs)]) {
        const story = validStory(storyById, storyId);
        if (!story) {
          warnings.push(
            `Motion ${acceptance.motion_id} explicit Story ${storyId} is unavailable or discarded; explicit route skipped.`,
          );
          continue;
        }
        addCandidate(candidates, {
          motionId: acceptance.motion_id,
          decision,
          evidenceRef: evidenceIdentity.ref,
          evidenceId: evidenceIdentity.id,
          story,
          regimeSlug: null,
          routeKind: "explicit_story",
          routeReason: "explicit_story",
          sequence: decisionIndex,
        });
      }
    } else if (motion.primary_story_id) {
      const story = validStory(storyById, motion.primary_story_id);
      if (!story) {
        warnings.push(
          `Motion ${acceptance.motion_id} primary Story ${motion.primary_story_id} is unavailable or discarded; no substitute Story was inferred.`,
        );
      } else {
        addCandidate(candidates, {
          motionId: acceptance.motion_id,
          decision,
          evidenceRef: evidenceIdentity.ref,
          evidenceId: evidenceIdentity.id,
          story,
          regimeSlug: null,
          routeKind: "motion_primary_story",
          routeReason: "motion_primary_story",
          sequence: decisionIndex,
        });
      }
    }

    if (acceptance.destination_refs.includes("REGIME:CURRENT")) {
      const regimeSlug = motion.primary_regime_slug;
      if (!regimeSlug) {
        warnings.push(
          `Motion ${acceptance.motion_id} requested REGIME:CURRENT without a primary Regime slug; Regime routing skipped.`,
        );
        continue;
      }

      const links = input.regimeLinks
        .filter((link) => link.regime_slug === regimeSlug)
        .filter((link) => validStory(storyById, link.story_id))
        .sort((left, right) => regimeLinkCompare(storyById, left, right));

      const core = links.find((link) => link.role === "core") ?? null;
      const secondary = links
        .filter((link) => link.role === "bridge" || link.role === "supporting")
        .slice(0, 2);
      const selected = [...(core ? [core] : []), ...secondary];

      if (!selected.length) {
        warnings.push(
          `Motion ${acceptance.motion_id} Regime ${regimeSlug} has no active linked Story eligible for propagation.`,
        );
      }

      for (const link of selected) {
        const story = validStory(storyById, link.story_id);
        if (!story) continue;
        const coreRoute = link.role === "core";
        addCandidate(candidates, {
          motionId: acceptance.motion_id,
          decision,
          evidenceRef: evidenceIdentity.ref,
          evidenceId: evidenceIdentity.id,
          story,
          regimeSlug,
          routeKind: coreRoute ? "regime_core" : "regime_bridge",
          routeReason: `regime:${regimeSlug}|role:${link.role}`,
          linkConfidence: Number(link.confidence || 0),
          sourceRole: link.role,
          sequence: decisionIndex,
        });
      }
    }
  }

  const bindingByAnalyticalStoryId = new Map(
    (input.packet.persistent_story_bindings ?? []).map((binding) => [
      binding.analytical_story_id,
      binding.persistent_story_id,
    ]),
  );

  for (
    let storyIndex = 0;
    storyIndex < input.analyticalOutput.major_stories.length;
    storyIndex++
  ) {
    const majorStory = input.analyticalOutput.major_stories[storyIndex];
    const persistentStoryId = majorStory.persistent_story_id ?? null;
    if (!persistentStoryId) continue;

    const exactBinding = bindingByAnalyticalStoryId.get(majorStory.story_id) ?? null;
    if (exactBinding !== persistentStoryId) {
      warnings.push(
        `Dossier analytical Story ${majorStory.story_id} persistent Story target ${persistentStoryId} is not backed by the exact packet binding; A3 propagation skipped.`,
      );
      continue;
    }

    const story = validStory(storyById, persistentStoryId);
    if (!story) {
      warnings.push(
        `Dossier analytical Story ${majorStory.story_id} exact persistent Story ${persistentStoryId} is unavailable or discarded; A3 propagation skipped.`,
      );
      continue;
    }

    const evidenceBuckets: Array<[
      DossierPersistentStoryEvidenceClassification,
      string[],
    ]> = [
      ["ACCELERATING", majorStory.market_evidence.accelerating ?? []],
      ["CONTRADICTING", majorStory.market_evidence.contradicting ?? []],
      ["CONFIRMING", majorStory.market_evidence.confirming ?? []],
    ];
    const classificationsByRef = new Map<
      string,
      Set<DossierPersistentStoryEvidenceClassification>
    >();
    for (const [classification, refs] of evidenceBuckets) {
      for (const ref of refs) {
        const classes = classificationsByRef.get(ref) ?? new Set();
        classes.add(classification);
        classificationsByRef.set(ref, classes);
      }
    }

    for (const [ref, classifications] of classificationsByRef) {
      if (classifications.size !== 1) {
        warnings.push(
          `Dossier analytical Story ${majorStory.story_id} classifies canonical evidence "${ref}" into multiple Story evidence buckets; A3 propagation for this ref was suppressed.`,
        );
        continue;
      }
      const classification = [...classifications][0];
      const evidenceIdentity = firstQueueableEvidenceIdentity(
        [ref],
        packetEvidenceIds,
        input.queueableEvidenceIds,
        input.queueEvidenceIdByCanonicalRef,
      );
      if (!evidenceIdentity) {
        warnings.push(
          `Dossier analytical Story ${majorStory.story_id} ${classification} evidence "${ref}" has no queueable canonical evidence UUID in intelligence_evidence; A3 propagation skipped.`,
        );
        continue;
      }
      addPersistentStoryCandidate(candidates, {
        analyticalStoryId: majorStory.story_id,
        classification,
        evidenceRef: evidenceIdentity.ref,
        evidenceId: evidenceIdentity.id,
        story,
        sequence: decisions.length + storyIndex,
      });
    }
  }

  if (!candidates.length) return emptyPlan(warnings);

  const bestByPair = new Map<string, RankedItem>();
  for (const candidate of candidates.sort(rankedItemCompare)) {
    const key = `${candidate.target_story_id}:${candidate.canonical_evidence_id}`;
    const current = bestByPair.get(key);
    if (!current || rankedItemCompare(candidate, current) < 0) {
      bestByPair.set(key, candidate);
    }
  }

  const ordered = [...bestByPair.values()].sort(rankedItemCompare);
  const selectedStories = new Set<string>();
  const omittedStories = new Set<string>();
  const selectedItems: RankedItem[] = [];

  for (const item of ordered) {
    if (
      selectedStories.has(item.target_story_id)
      || selectedStories.size < MAX_DOSSIER_REEVALUATION_PROPAGATION_TARGETS
    ) {
      selectedStories.add(item.target_story_id);
      selectedItems.push(item);
    } else {
      omittedStories.add(item.target_story_id);
    }
  }

  return {
    contract_version: DOSSIER_REEVALUATION_PROPAGATION_CONTRACT_VERSION,
    items: selectedItems.map(({
      route_rank: _routeRank,
      decision_rank: _decisionRank,
      link_confidence: _linkConfidence,
      story_confidence: _storyConfidence,
      sequence: _sequence,
      ...item
    }) => item),
    omitted_count: omittedStories.size,
    warnings,
  };
}


export type DossierReevaluationPropagationResult = {
  contract_version: typeof DOSSIER_REEVALUATION_PROPAGATION_CONTRACT_VERSION;
  dossier_id: string;
  planned: number;
  enqueued: number;
  skipped_existing: number;
  omitted_count: number;
  items: DossierReevaluationPropagationItem[];
  warnings: string[];
};

type RegimeIdentityRow = {
  id: string;
  slug: string;
};

type RegimeStoryLinkDbRow = {
  regime_id: string;
  story_id: string;
  role: string;
  confidence: number;
  effective_to?: string | null;
};

function candidateCanonicalEvidenceRefs(
  analyticalOutput: ResearchBrainOutputV1,
) {
  const motionRefs = (analyticalOutput.motion_acceptance?.decisions ?? [])
    .filter((item) => item.decision === "ACCEPT" || item.decision === "REFINE")
    .flatMap((item) => item.canonical_evidence_refs);
  const dossierStoryRefs = analyticalOutput.major_stories
    .filter((story) => Boolean(story.persistent_story_id))
    .flatMap((story) => [
      ...(story.market_evidence.confirming ?? []),
      ...(story.market_evidence.contradicting ?? []),
      ...(story.market_evidence.accelerating ?? []),
    ]);

  return [...new Set(
    [...motionRefs, ...dossierStoryRefs]
      .filter((ref) => typeof ref === "string" && Boolean(ref.trim()))
      .map((ref) => ref.trim()),
  )];
}

type CanonicalEvidenceIdentityRow = {
  id: string;
  external_evidence_id: string | null;
};

function fallbackEvidenceRowId(ref: string) {
  if (!ref.startsWith("ev:")) return null;
  const candidate = ref.slice(3);
  return isValidUuid(candidate) ? candidate : null;
}

function resolveCanonicalEvidenceIdentities(
  refs: string[],
  rows: CanonicalEvidenceIdentityRow[],
) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const identity = new Map<string, string>();
  const warnings: string[] = [];

  for (const ref of refs) {
    const candidateIds = new Set<string>();

    if (isValidUuid(ref) && byId.has(ref)) candidateIds.add(ref);

    const fallbackId = fallbackEvidenceRowId(ref);
    if (fallbackId && byId.has(fallbackId)) candidateIds.add(fallbackId);

    for (const row of rows) {
      if (row.external_evidence_id === ref) candidateIds.add(row.id);
    }

    if (candidateIds.size === 1) {
      identity.set(ref, [...candidateIds][0]);
    } else if (candidateIds.size > 1) {
      warnings.push(
        `A3 ambiguous canonical evidence identity for "${ref}"; matched ${candidateIds.size} intelligence_evidence rows, so propagation for this ref was suppressed.`,
      );
    }
  }

  return { identity, warnings };
}

export async function prepareDossierReevaluationPropagationPlan(input: {
  client: SupabaseClient;
  packet: DossierV2InputPacket;
  analyticalOutput: ResearchBrainOutputV1;
}): Promise<DossierReevaluationPropagationPlan> {
  try {
    const evidenceRefs = candidateCanonicalEvidenceRefs(input.analyticalOutput);
    const rowIdCandidates = [...new Set(evidenceRefs.flatMap((ref) => {
      const ids: string[] = [];
      if (isValidUuid(ref)) ids.push(ref);
      const fallbackId = fallbackEvidenceRowId(ref);
      if (fallbackId) ids.push(fallbackId);
      return ids;
    }))];

    const evidenceByIdPromise = rowIdCandidates.length
      ? input.client
          .from("intelligence_evidence")
          .select("id,external_evidence_id")
          .in("id", rowIdCandidates)
      : Promise.resolve({ data: [], error: null });
    const evidenceByExternalPromise = evidenceRefs.length
      ? input.client
          .from("intelligence_evidence")
          .select("id,external_evidence_id")
          .in("external_evidence_id", evidenceRefs)
      : Promise.resolve({ data: [], error: null });

    const [
      storyResult,
      evidenceByIdResult,
      evidenceByExternalResult,
      regimeResult,
      linkResult,
    ] = await Promise.all([
      input.client
        .from("stories")
        .select("id,slug,status,confidence")
        .neq("status", "discarded"),
      evidenceByIdPromise,
      evidenceByExternalPromise,
      input.client
        .from("market_regimes")
        .select("id,slug")
        .eq("status", "active"),
      input.client
        .from("market_regime_story_links")
        .select("regime_id,story_id,role,confidence,effective_to")
        .is("effective_to", null),
    ]);

    if (storyResult.error) {
      throw new Error(`Failed to load A3 Story registry: ${storyResult.error.message}`);
    }
    if (evidenceByIdResult.error || evidenceByExternalResult.error) {
      throw new Error(
        `Failed to resolve A3 canonical queue evidence: ${
          evidenceByIdResult.error?.message
          ?? evidenceByExternalResult.error?.message
          ?? "unknown evidence identity error"
        }`,
      );
    }
    if (regimeResult.error) {
      throw new Error(`Failed to load A3 Regime identities: ${regimeResult.error.message}`);
    }
    if (linkResult.error) {
      throw new Error(`Failed to load A3 Regime Story links: ${linkResult.error.message}`);
    }

    const evidenceRowsById = new Map<string, CanonicalEvidenceIdentityRow>();
    for (const row of [
      ...((evidenceByIdResult.data ?? []) as CanonicalEvidenceIdentityRow[]),
      ...((evidenceByExternalResult.data ?? []) as CanonicalEvidenceIdentityRow[]),
    ]) {
      if (row?.id && isValidUuid(row.id)) evidenceRowsById.set(row.id, row);
    }
    const evidenceResolution = resolveCanonicalEvidenceIdentities(
      evidenceRefs,
      [...evidenceRowsById.values()],
    );

    const regimes = (regimeResult.data ?? []) as RegimeIdentityRow[];
    const slugByRegimeId = new Map(regimes.map((row) => [row.id, row.slug]));
    const regimeLinks: DossierPropagationRegimeLinkRow[] = (
      (linkResult.data ?? []) as RegimeStoryLinkDbRow[]
    ).flatMap((row) => {
      const regimeSlug = slugByRegimeId.get(row.regime_id);
      if (!regimeSlug) return [];
      return [{
        regime_slug: regimeSlug,
        story_id: row.story_id,
        role: row.role,
        confidence: Number(row.confidence || 0),
      }];
    });

    return buildDossierReevaluationPropagationPlan({
      packet: input.packet,
      analyticalOutput: input.analyticalOutput,
      stories: (storyResult.data ?? []) as DossierPropagationStoryRow[],
      regimeLinks,
      queueableEvidenceIds: new Set(evidenceRowsById.keys()),
      queueEvidenceIdByCanonicalRef: evidenceResolution.identity,
      evidenceIdentityWarnings: evidenceResolution.warnings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return emptyPlan([
      `A3 reevaluation propagation plan unavailable; Dossier remains evidence-first: ${message}`,
    ]);
  }
}

type ExistingPropagationQueueRow = {
  target_id: string;
  requested_by_evidence_id: string | null;
  status?: string;
};

function propagationPair(storyId: string, evidenceId: string) {
  return `${storyId}:${evidenceId}`;
}

export function missingDossierReevaluationPropagationItems(
  items: DossierReevaluationPropagationItem[],
  existingRows: ExistingPropagationQueueRow[],
) {
  const existing = new Set(
    existingRows.flatMap((row) =>
      row.requested_by_evidence_id
        ? [propagationPair(row.target_id, row.requested_by_evidence_id)]
        : []),
  );
  return items.filter((item) =>
    !existing.has(propagationPair(item.target_story_id, item.canonical_evidence_id)));
}

function propagationQueueReason(
  dossierId: string,
  item: DossierReevaluationPropagationItem,
) {
  const prefix = item.source_kind === "dossier_story_evidence"
    ? `dossier_story_evidence:${dossierId}:${item.source_ref ?? "unknown"}:${item.evidence_classification ?? "UNRESOLVED"}`
    : `dossier_motion_acceptance:${dossierId}:${item.motion_id}:${item.decision}`;
  return item.route_reason ? `${prefix} | ${item.route_reason}` : prefix;
}

export async function enqueueDossierReevaluationPropagation(input: {
  client: SupabaseClient;
  dossierId: string;
  asOf: string;
  plan: DossierReevaluationPropagationPlan;
}): Promise<DossierReevaluationPropagationResult> {
  const base: DossierReevaluationPropagationResult = {
    contract_version: DOSSIER_REEVALUATION_PROPAGATION_CONTRACT_VERSION,
    dossier_id: input.dossierId,
    planned: input.plan.items.length,
    enqueued: 0,
    skipped_existing: 0,
    omitted_count: input.plan.omitted_count,
    items: input.plan.items.map((item) => ({ ...item })),
    warnings: [...input.plan.warnings],
  };

  if (!input.plan.items.length) return base;

  try {
    const storyIds = [...new Set(input.plan.items.map((item) => item.target_story_id))];
    const evidenceIds = [...new Set(input.plan.items.map((item) => item.canonical_evidence_id))];

    const { data: existingRows, error: existingError } = await input.client
      .from("intelligence_reevaluation_queue")
      .select("target_id,requested_by_evidence_id,status")
      .eq("target_kind", "story")
      .in("target_id", storyIds)
      .in("requested_by_evidence_id", evidenceIds)
      .in("status", ["pending", "processing", "retryable"]);

    if (existingError) {
      throw new Error(`Failed to inspect A3 Story reevaluation queue: ${existingError.message}`);
    }

    const missing = missingDossierReevaluationPropagationItems(
      input.plan.items,
      (existingRows ?? []) as ExistingPropagationQueueRow[],
    );
    const skippedExisting = input.plan.items.length - missing.length;

    if (missing.length) {
      const { error: insertError } = await input.client
        .from("intelligence_reevaluation_queue")
        .insert(missing.map((item) => ({
          target_kind: "story",
          target_id: item.target_story_id,
          requested_by_evidence_id: item.canonical_evidence_id,
          reason: propagationQueueReason(input.dossierId, item),
          priority: item.priority,
          status: "pending",
          available_at: input.asOf,
        })));

      if (insertError) {
        throw new Error(`Failed to enqueue A3 Story reevaluation: ${insertError.message}`);
      }
    }

    console.info(JSON.stringify({
      event: "dossier_reevaluation_propagation",
      dossierId: input.dossierId,
      planned: input.plan.items.length,
      enqueued: missing.length,
      skippedExisting,
      omittedCount: input.plan.omitted_count,
    }));

    return {
      ...base,
      enqueued: missing.length,
      skipped_existing: skippedExisting,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(JSON.stringify({
      event: "dossier_reevaluation_propagation_failed",
      dossierId: input.dossierId,
      error: message.slice(0, 500),
    }));
    return {
      ...base,
      enqueued: 0,
      skipped_existing: 0,
      warnings: [...base.warnings, message],
    };
  }
}
