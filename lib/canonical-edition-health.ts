export type CanonicalEditionHealthState = "healthy" | "degraded" | "stale" | "failed" | "not_configured";

export const CANONICAL_EDITION_TOLERANCE_MS = 4 * 60 * 60 * 1_000;
const KUALA_LUMPUR_OFFSET_MS = 8 * 60 * 60 * 1_000;

type ResearchRunHealthInput = {
  id: string;
  schedule_slot: string;
  scheduled_for: string;
  status: string;
  completed_at?: string | null;
  updated_at?: string | null;
  warnings?: string[];
};

type CanonicalEditionInput = {
  snapshotId: string;
  publishedAt: string;
  slot: string | null;
  scheduledFor: string | null;
  researchRunId: string | null;
};

type IntelligenceRunHealthInput = {
  id?: string;
  research_run_id?: string | null;
  status?: string;
  failure_detail?: string | null;
};

type IntelligenceStageHealthInput = {
  engine_run_id?: string | null;
  stage_key?: string | null;
  status?: string;
  failure_code?: string | null;
  failure_detail?: string | null;
};

function validTime(value: string | null | undefined) {
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp) ? timestamp : null;
}

function expectedCycle(now: Date) {
  const local = new Date(now.getTime() + KUALA_LUMPUR_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  const day = local.getUTCDate();
  const morning = Date.UTC(year, month, day, 1, 15);
  const evening = Date.UTC(year, month, day, 13, 15);
  const nowMs = now.getTime();
  if (nowMs >= evening) return { slot: "evening", expectedAt: new Date(evening).toISOString() };
  if (nowMs >= morning) return { slot: "morning", expectedAt: new Date(morning).toISOString() };
  return { slot: "evening", expectedAt: new Date(Date.UTC(year, month, day - 1, 13, 15)).toISOString() };
}

function nearestScheduledRun(runs: ResearchRunHealthInput[], cycle: { slot: string; expectedAt: string }) {
  const expectedAt = Date.parse(cycle.expectedAt);
  return runs
    .filter((run) => run.schedule_slot === cycle.slot)
    .map((run) => ({ run, distance: Math.abs((validTime(run.scheduled_for) || 0) - expectedAt) }))
    .filter(({ distance }) => distance <= CANONICAL_EDITION_TOLERANCE_MS)
    .sort((left, right) => left.distance - right.distance || (validTime(right.run.updated_at) || 0) - (validTime(left.run.updated_at) || 0))[0]?.run || null;
}

function failureDetail(
  run: ResearchRunHealthInput | null,
  intelligenceRuns: IntelligenceRunHealthInput[],
  intelligenceStages: IntelligenceStageHealthInput[],
) {
  if (!run) return null;
  const engine = intelligenceRuns.find((candidate) => candidate.research_run_id === run.id && candidate.status === "failed")
    || intelligenceRuns.find((candidate) => candidate.research_run_id === run.id)
    || null;
  const stage = engine?.id
    ? intelligenceStages.find((candidate) => candidate.engine_run_id === engine.id && candidate.status === "failed")
    : null;
  return {
    engineRunId: engine?.id || null,
    stageKey: stage?.stage_key || null,
    code: stage?.failure_code || null,
    detail: stage?.failure_detail || engine?.failure_detail || null,
  };
}

function editionMatchesCycle(
  edition: CanonicalEditionInput | null,
  run: ResearchRunHealthInput | null,
  cycle: { expectedAt: string },
) {
  if (!edition) return false;
  if (run && edition.researchRunId === run.id) return true;
  const scheduledAt = validTime(edition.scheduledFor);
  return scheduledAt !== null && Math.abs(scheduledAt - Date.parse(cycle.expectedAt)) <= CANONICAL_EDITION_TOLERANCE_MS;
}

/**
 * Live-owned health. The result is based only on persisted research cycles,
 * terminal canonical editions, and recorded engine/stage failures.
 */
export function buildCanonicalEditionHealth({
  now = new Date(),
  researchRuns,
  editions,
  intelligenceRuns,
  intelligenceStages,
}: {
  now?: Date;
  researchRuns: ResearchRunHealthInput[];
  editions: CanonicalEditionInput[];
  intelligenceRuns: IntelligenceRunHealthInput[];
  intelligenceStages: IntelligenceStageHealthInput[];
}) {
  const latestExpectedCycle = expectedCycle(now);
  const latestCycle = nearestScheduledRun(researchRuns, latestExpectedCycle);
  const latestPersistedEdition = editions[0] || null;
  const currentEditionAt = validTime(latestPersistedEdition?.publishedAt);
  const expectedAt = Date.parse(latestExpectedCycle.expectedAt);
  const editionCurrentForCycle = editionMatchesCycle(latestPersistedEdition, latestCycle, latestExpectedCycle);
  const stale = !latestPersistedEdition || !editionCurrentForCycle || currentEditionAt === null
    || currentEditionAt < expectedAt - CANONICAL_EDITION_TOLERANCE_MS;
  const base = {
    latestExpectedCycle,
    latestCycle: latestCycle ? {
      id: latestCycle.id,
      status: latestCycle.status,
      scheduledFor: latestCycle.scheduled_for,
      completedAt: latestCycle.completed_at || null,
      warnings: [...(latestCycle.warnings || [])],
    } : null,
    latestPersistedEdition: latestPersistedEdition ? {
      snapshotId: latestPersistedEdition.snapshotId,
      publishedAt: latestPersistedEdition.publishedAt,
      researchRunId: latestPersistedEdition.researchRunId,
      scheduledFor: latestPersistedEdition.scheduledFor,
    } : null,
    stale,
  };

  if (!latestCycle && !latestPersistedEdition) {
    return { ...base, state: "not_configured" as const, reason: "No persisted scheduled cycle or canonical edition is available.", failure: null };
  }
  if (!latestCycle) {
    return { ...base, state: "stale" as const, reason: "The latest expected cycle has no persisted research run.", failure: null };
  }
  if (latestCycle.status === "failed" || latestCycle.status === "blocked") {
    return { ...base, state: "failed" as const, reason: "The latest expected cycle failed before a current canonical edition could be confirmed.", failure: failureDetail(latestCycle, intelligenceRuns, intelligenceStages) };
  }
  if (latestCycle.status === "completed" && !editionCurrentForCycle) {
    return { ...base, state: "failed" as const, reason: "The latest completed cycle has no matching terminal canonical edition.", failure: failureDetail(latestCycle, intelligenceRuns, intelligenceStages) };
  }
  if (latestCycle.status === "running") {
    return { ...base, state: stale ? "stale" as const : "degraded" as const, reason: "The latest expected cycle is still running.", failure: null };
  }
  if (stale) {
    return { ...base, state: "stale" as const, reason: "The latest persisted canonical edition is outside the expected-cycle tolerance.", failure: null };
  }
  if ((latestCycle.warnings || []).length) {
    return { ...base, state: "degraded" as const, reason: "The latest completed cycle published with warnings.", failure: null };
  }
  return { ...base, state: "healthy" as const, reason: "The latest expected cycle completed with a matching terminal canonical edition.", failure: null };
}
