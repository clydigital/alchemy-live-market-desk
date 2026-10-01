import type { ProjectedRegime, ProjectedStory } from "./regimes.ts";

export const MAX_SYSTEM2_ACTIVATION_TARGETS = 4;

export type System1TelemetryStateChange = {
  regimeSlug: string;
  subgroupKey: string;
  subgroupLabel: string;
  telemetryKey: string;
  telemetryLabel: string;
  source: string;
  fromState: string;
  toState: string;
};

export type System2StoryActivationTarget = {
  storyId: string;
  storySlug: string;
  priority: number;
  reason: string;
  changes: System1TelemetryStateChange[];
};

export function openSystem2ActivationStoryIds(
  rows: Array<{ target_id: string; reason: string | null }>,
) {
  return new Set(rows
    .filter((item) =>
      typeof item.reason === "string"
      && item.reason.startsWith("system1_threshold_crossing"))
    .map((item) => item.target_id));
}

type SnapshotTelemetry = {
  key?: unknown;
  label?: unknown;
  state?: unknown;
  source?: unknown;
};

type SnapshotSubgroup = {
  key?: unknown;
  telemetry?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function priorSubgroups(snapshot: unknown): SnapshotSubgroup[] {
  const root = asRecord(snapshot);
  const regime = asRecord(root?.regime);
  return Array.isArray(regime?.subgroups)
    ? regime.subgroups.filter((item): item is SnapshotSubgroup => Boolean(asRecord(item)))
    : [];
}

function roleRank(role: string) {
  if (role === "core") return 0;
  if (role === "bridge") return 1;
  return 2;
}

function storyActivationScore(story: ProjectedStory, regimeSlug: string, subgroupKey: string) {
  const route = story.routes.find((item) => item.regime === regimeSlug && item.subgroup === subgroupKey);
  return {
    role: roleRank(route?.role || "supporting"),
    routeScore: route?.score ?? 0,
    thesisConfidence: story.confidence,
  };
}

/**
 * Detect only a semantic state transition from an already-wired deterministic
 * sensor. New sensors and contract-version changes are ignored so product
 * rollouts cannot masquerade as market events.
 */
export function detectSystem1TelemetryStateChanges(
  priorSnapshot: unknown,
  regime: ProjectedRegime,
): System1TelemetryStateChange[] {
  const previous = new Map<string, SnapshotTelemetry>();
  for (const subgroup of priorSubgroups(priorSnapshot)) {
    if (typeof subgroup.key !== "string" || !Array.isArray(subgroup.telemetry)) continue;
    for (const raw of subgroup.telemetry) {
      const item = asRecord(raw) as SnapshotTelemetry | null;
      if (!item || typeof item.key !== "string") continue;
      previous.set(`${subgroup.key}:${item.key}`, item);
    }
  }

  return regime.subgroups.flatMap((subgroup) =>
    subgroup.telemetry.flatMap((item) => {
      const prior = previous.get(`${subgroup.key}:${item.key}`);
      if (
        !prior
        || typeof prior.state !== "string"
        || typeof prior.source !== "string"
        || prior.source !== item.source
        || prior.state === item.state
      ) return [];

      return [{
        regimeSlug: regime.slug,
        subgroupKey: subgroup.key,
        subgroupLabel: subgroup.label,
        telemetryKey: item.key,
        telemetryLabel: item.label,
        source: item.source,
        fromState: prior.state,
        toState: item.state,
      }];
    }),
  );
}

/**
 * A System 1 transition recruits existing durable Stories for later canonical
 * maintenance. The queue reason is triage context, not evidence, and therefore
 * cannot by itself authorise a thesis mutation.
 */
export function selectSystem2ActivationTargets(
  regime: ProjectedRegime,
  changes: System1TelemetryStateChange[],
  maxTargets = MAX_SYSTEM2_ACTIVATION_TARGETS,
): System2StoryActivationTarget[] {
  if (!changes.length || maxTargets <= 0) return [];
  const changedSubgroups = new Set(changes.map((item) => item.subgroupKey));
  const candidates = new Map<string, {
    story: ProjectedStory;
    score: ReturnType<typeof storyActivationScore>;
    changes: System1TelemetryStateChange[];
  }>();

  for (const subgroup of regime.subgroups) {
    if (!changedSubgroups.has(subgroup.key)) continue;
    const subgroupChanges = changes.filter((item) => item.subgroupKey === subgroup.key);
    for (const story of subgroup.durableStories) {
      const score = storyActivationScore(story, regime.slug, subgroup.key);
      const existing = candidates.get(story.id);
      if (!existing) {
        candidates.set(story.id, { story, score, changes: [...subgroupChanges] });
        continue;
      }
      existing.changes.push(...subgroupChanges);
      if (
        score.role < existing.score.role
        || (score.role === existing.score.role && score.routeScore > existing.score.routeScore)
      ) existing.score = score;
    }
  }

  return [...candidates.values()]
    .sort((left, right) =>
      left.score.role - right.score.role
      || right.score.routeScore - left.score.routeScore
      || right.score.thesisConfidence - left.score.thesisConfidence
      || left.story.id.localeCompare(right.story.id))
    .slice(0, Math.max(0, Math.min(MAX_SYSTEM2_ACTIVATION_TARGETS, maxTargets)))
    .map(({ story, changes: storyChanges }, index) => ({
      storyId: story.id,
      storySlug: story.slug,
      priority: Math.max(60, 80 - index * 5),
      changes: [...new Map(storyChanges.map((item) => [
        `${item.subgroupKey}:${item.telemetryKey}:${item.source}`,
        item,
      ])).values()],
      reason: [
        "system1_threshold_crossing",
        ...[...new Map(storyChanges.map((item) => [
          `${item.subgroupKey}:${item.telemetryKey}:${item.source}`,
          `${item.subgroupLabel} / ${item.telemetryLabel}: ${item.fromState} -> ${item.toState} [${item.source}]`,
        ])).values()],
      ].join(" | "),
    }));
}
