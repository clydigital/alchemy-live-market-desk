export type ScheduledContinuationRun = {
  id: string;
  status: string;
  accuracy_gate: string | null;
  source_checks: unknown;
  warnings: string[] | null;
  summary: string | null;
  updates_published: number | null;
  updated_at: string;
};

export type ScheduledContinuationState =
  | "missing"
  | "acquisition_pending"
  | "ready"
  | "intelligence_running"
  | "publication_pending"
  | "composition_pending"
  | "publication_complete"
  | "completed"
  | "terminal";

export type ScheduledPublicationCheckpoint = {
  engineStatus: string | null;
  storySnapshotCount: number;
  baseEditionId: string | null;
  composedEditionId: string | null;
};

export type ScheduledContinuationDecision = {
  state: ScheduledContinuationState;
  reason: string;
};

export const INTELLIGENCE_CONTINUATION_CLAIM_PREFIX =
  "[orchestration] intelligence continuation claimed at ";
export const INTELLIGENCE_CONTINUATION_RELEASE_PREFIX =
  "[orchestration] intelligence continuation released at ";

export const INTELLIGENCE_CONTINUATION_CLAIM_STALE_MS = 6 * 60 * 1_000;

function nonEmptySourceChecks(value: unknown) {
  return Array.isArray(value) && value.length > 0;
}

export function latestIntelligenceContinuationClaimAt(warnings: string[] | null | undefined) {
  const claims = (warnings ?? [])
    .filter((warning) => warning.startsWith(INTELLIGENCE_CONTINUATION_CLAIM_PREFIX))
    .map((warning) => Date.parse(warning.slice(INTELLIGENCE_CONTINUATION_CLAIM_PREFIX.length)))
    .filter(Number.isFinite);
  return claims.length ? Math.max(...claims) : null;
}

export function intelligenceContinuationClaimWarning(now = new Date()) {
  return `${INTELLIGENCE_CONTINUATION_CLAIM_PREFIX}${now.toISOString()}`;
}

export function intelligenceContinuationReleaseWarning(now = new Date()) {
  return `${INTELLIGENCE_CONTINUATION_RELEASE_PREFIX}${now.toISOString()}`;
}

function latestIntelligenceContinuationReleaseAt(warnings: string[] | null | undefined) {
  const releases = (warnings ?? [])
    .filter((warning) => warning.startsWith(INTELLIGENCE_CONTINUATION_RELEASE_PREFIX))
    .map((warning) => Date.parse(warning.slice(INTELLIGENCE_CONTINUATION_RELEASE_PREFIX.length)))
    .filter(Number.isFinite);
  return releases.length ? Math.max(...releases) : null;
}

export function evaluateScheduledIntelligenceContinuation(
  run: ScheduledContinuationRun | null,
  now = new Date(),
  publication: ScheduledPublicationCheckpoint | null = null,
): ScheduledContinuationDecision {
  if (!run) {
    return { state: "missing", reason: "The canonical research run has not been claimed yet." };
  }
  if (run.status === "completed") {
    return { state: "completed", reason: "The canonical research run is already completed." };
  }
  if (run.status === "blocked") {
    return { state: "terminal", reason: `The canonical research run is already ${run.status}.` };
  }
  if (run.status !== "running" && run.status !== "failed") {
    return { state: "terminal", reason: `The canonical research run has unsupported status ${run.status}.` };
  }

  const claimedAt = latestIntelligenceContinuationClaimAt(run.warnings);
  const releasedAt = latestIntelligenceContinuationReleaseAt(run.warnings);
  if (
    claimedAt !== null
    && (releasedAt === null || releasedAt < claimedAt)
    && now.getTime() - claimedAt < INTELLIGENCE_CONTINUATION_CLAIM_STALE_MS
  ) {
    return {
      state: "intelligence_running",
      reason: "A recent intelligence continuation claim is already active.",
    };
  }

  // Once the engine is durable, artifact presence—not the lossy outer status—
  // determines the next safe step. A blocked accuracy gate is intentionally
  // excluded: completed dry-run engine work must not become a publication.
  if (publication?.engineStatus === "completed" && run.accuracy_gate !== "blocked") {
    if (publication.composedEditionId) {
      return {
        state: "publication_complete",
        reason: "The completed engine and composed canonical edition are durable; only outer finalisation remains.",
      };
    }
    if (publication.baseEditionId) {
      return {
        state: "composition_pending",
        reason: "The canonical base edition is durable; only Dossier composition remains.",
      };
    }
    return {
      state: "publication_pending",
      reason: publication.storySnapshotCount
        ? "The completed engine has partial Story snapshots; Story freeze and base publication must resume."
        : "The intelligence engine is complete; Story freeze and base publication must resume.",
    };
  }

  if (run.status === "failed") {
    return { state: "terminal", reason: "The canonical research run failed before engine completion." };
  }
  if (!nonEmptySourceChecks(run.source_checks)) {
    return {
      state: "acquisition_pending",
      reason: "The scheduled acquisition hand-off has not persisted source checks yet.",
    };
  }
  return { state: "ready", reason: "Persisted acquisition is ready for canonical intelligence." };
}

export function mergeScheduledWarnings(...groups: Array<string[] | null | undefined>) {
  return [...new Set(groups.flatMap((group) => group ?? []).filter(Boolean))];
}

export function finalScheduledResearchStatus(
  accuracyGate: string | null,
  intelligenceStatus: string | null | undefined,
): "completed" | "blocked" | "failed" {
  if (intelligenceStatus === "failed") return "failed";
  if (intelligenceStatus !== "completed") return "blocked";
  return accuracyGate === "blocked" ? "blocked" : "completed";
}
