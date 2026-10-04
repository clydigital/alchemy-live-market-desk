import type { DossierMotionStoryRefreshRequest } from "./motion-story-refresh-request.ts";
import { MAX_DOSSIER_MOTION_STORY_REFRESH_REQUESTS } from "./motion-story-refresh-request.ts";
import { isValidUuid } from "./validation.ts";

export const DOSSIER_MOTION_STORY_WAKE_TARGET_VERSION =
  "dossier-motion-story-wake-target/1" as const;

export type DossierMotionStoryWakeStory = {
  id: string;
  status: string;
};

export type DossierMotionStoryWakeEvidence = {
  id: string;
  external_evidence_id?: string | null;
};

export type ResolvedDossierMotionStoryWakeTarget = {
  contract_version: typeof DOSSIER_MOTION_STORY_WAKE_TARGET_VERSION;
  dossier_id: string;
  motion_id: string;
  story_id: string;
  decision: "ACCEPT" | "REFINE";
  canonical_reassessment_scope: "STORY" | "STORY_AND_REGIME";
  packet_evidence_reference: string;
  canonical_evidence_id: string;
  story_implication: string;
  reason: string;
  regime_implication: string | null;
  investigation_next: string | null;
  refined_motion: DossierMotionStoryRefreshRequest["refined_motion"];
  priority_signals: DossierMotionStoryRefreshRequest["priority_signals"];
};

function clean(value: string | null | undefined) {
  return (value ?? "").trim();
}

// Deliberately boolean rather than a type predicate. The shared isValidUuid()
// narrows a failed string check to never, which is undesirable when we still
// need to inspect alternate reference forms such as ev:<uuid>.
function uuidText(value: string): boolean {
  return isValidUuid(value);
}

function canonicalEvidenceIdForReference(
  reference: string,
  evidenceRows: DossierMotionStoryWakeEvidence[],
): string | null {
  const packetReference = clean(reference);
  if (!packetReference) return null;

  let canonicalIdReference: string | null = null;
  if (uuidText(packetReference)) {
    canonicalIdReference = packetReference;
  } else if (packetReference.startsWith("ev:")) {
    const candidate = packetReference.slice(3);
    if (uuidText(candidate)) canonicalIdReference = candidate;
  }

  if (canonicalIdReference) {
    const canonicalIds = new Set(
      evidenceRows
        .filter((row) => row.id === canonicalIdReference && uuidText(row.id))
        .map((row) => row.id),
    );
    return canonicalIds.size === 1 ? [...canonicalIds][0] ?? null : null;
  }

  const canonicalIds = new Set(
    evidenceRows
      .filter((row) => clean(row.external_evidence_id) === packetReference)
      .map((row) => row.id)
      .filter((id) => uuidText(id)),
  );

  return canonicalIds.size === 1 ? [...canonicalIds][0] ?? null : null;
}

/**
 * Resolve a validated System-2 Story reassessment request to one exact Story
 * and one exact canonical evidence UUID.
 *
 * This function is intentionally pure and read-only. It does not enqueue
 * work, mutate Story/Regime state, create thesis versions, or publish.
 */
export function resolveDossierMotionStoryWakeTarget(input: {
  request: DossierMotionStoryRefreshRequest;
  stories: DossierMotionStoryWakeStory[];
  evidenceRows: DossierMotionStoryWakeEvidence[];
}): ResolvedDossierMotionStoryWakeTarget | null {
  const { request } = input;

  if (request.decision !== "ACCEPT" && request.decision !== "REFINE") return null;
  if (
    request.canonical_reassessment_scope !== "STORY"
    && request.canonical_reassessment_scope !== "STORY_AND_REGIME"
  ) {
    return null;
  }

  const dossierId = clean(request.dossier_id);
  const motionId = clean(request.motion_id);
  const storyId = clean(request.story_id);
  const packetEvidenceReference = clean(request.packet_evidence_id);
  const storyImplication = clean(request.story_implication);

  if (!dossierId || !motionId || !storyId || !packetEvidenceReference || !storyImplication) {
    return null;
  }
  if (!request.evidence_references.includes(request.packet_evidence_id)) return null;

  if (request.decision === "REFINE") {
    if (
      !request.refined_motion
      || !clean(request.refined_motion.headline)
      || !clean(request.refined_motion.why_interesting)
      || !clean(request.refined_motion.big_picture_bridge)
    ) {
      return null;
    }
  }

  const storyMatches = input.stories.filter((story) => story.id === storyId);
  if (storyMatches.length !== 1) return null;
  if (storyMatches[0]?.status === "discarded") return null;

  const canonicalEvidenceId = canonicalEvidenceIdForReference(
    packetEvidenceReference,
    input.evidenceRows,
  );
  if (!canonicalEvidenceId) return null;

  return {
    contract_version: DOSSIER_MOTION_STORY_WAKE_TARGET_VERSION,
    dossier_id: dossierId,
    motion_id: motionId,
    story_id: storyId,
    decision: request.decision,
    canonical_reassessment_scope: request.canonical_reassessment_scope,
    packet_evidence_reference: packetEvidenceReference,
    canonical_evidence_id: canonicalEvidenceId,
    story_implication: storyImplication,
    reason: clean(request.reason),
    regime_implication: clean(request.regime_implication) || null,
    investigation_next: clean(request.investigation_next) || null,
    refined_motion: request.refined_motion,
    priority_signals: { ...request.priority_signals },
  };
}

export function resolveDossierMotionStoryWakeTargets(input: {
  requests: DossierMotionStoryRefreshRequest[];
  stories: DossierMotionStoryWakeStory[];
  evidenceRows: DossierMotionStoryWakeEvidence[];
}): ResolvedDossierMotionStoryWakeTarget[] {
  const orderedRequests = [...input.requests].sort((left, right) =>
    right.priority_signals.materiality - left.priority_signals.materiality
    || right.priority_signals.relevance - left.priority_signals.relevance
    || right.priority_signals.novelty - left.priority_signals.novelty
    || left.motion_id.localeCompare(right.motion_id)
  );

  return orderedRequests
    .flatMap((request): ResolvedDossierMotionStoryWakeTarget[] => {
      const target = resolveDossierMotionStoryWakeTarget({
        request,
        stories: input.stories,
        evidenceRows: input.evidenceRows,
      });
      return target ? [target] : [];
    })
    .slice(0, MAX_DOSSIER_MOTION_STORY_REFRESH_REQUESTS);
}
