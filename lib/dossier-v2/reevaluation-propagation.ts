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
  | "explicit_story"
  | "motion_primary_story"
  | "regime_core"
  | "regime_bridge";

export type DossierReevaluationPropagationItem = {
  motion_id: string;
  decision: Extract<MotionSynthesisDecision, "ACCEPT" | "REFINE">;
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
  if (route === "explicit_story") return 0;
  if (route === "motion_primary_story") return 1;
  if (route === "regime_core") return 2;
  return sourceRole === "supporting" ? 4 : 3;
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

function firstQueueableEvidenceRef(
  refs: string[],
  packetEvidenceIds: ReadonlySet<string>,
  queueableEvidenceIds: ReadonlySet<string>,
) {
  return refs.find((ref) =>
    isValidUuid(ref)
    && packetEvidenceIds.has(ref)
    && queueableEvidenceIds.has(ref)) ?? null;
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

export function buildDossierReevaluationPropagationPlan(
  input: PlannerInput,
): DossierReevaluationPropagationPlan {
  const motionItems = input.packet.motion_context?.items ?? [];
  const motionById = new Map(motionItems.map((item) => [item.motion_id, item]));
  const storyById = new Map(input.stories.map((story) => [story.id, story]));
  const packetEvidenceIds = canonicalPacketEvidenceIds(input.packet);
  const warnings: string[] = [];
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

    const evidenceId = firstQueueableEvidenceRef(
      acceptance.canonical_evidence_refs,
      packetEvidenceIds,
      input.queueableEvidenceIds,
    );
    if (!evidenceId) {
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
          evidenceId,
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
          evidenceId,
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
          evidenceId,
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
