import { assessRegimeInterpretationFreshness } from "./regime-freshness.ts";
import type { RegimeLiveStoryReasoning } from "./regime-live-reasoning.ts";
import type { ProjectedRegime } from "./regimes.ts";

export type RegimeOverviewTimingHealth = {
  status: "current" | "pending" | "no_system1" | "no_system2";
  latestTelemetryAt: string | null;
  latestTelemetryAgeMinutes: number | null;
  latestInterpretationAt: string | null;
  latestInterpretationAgeMinutes: number | null;
  telemetryBearingSubgroups: number;
  pendingInterpretationSubgroups: number;
  noTimestampedInterpretationSubgroups: number;
  oldestPendingLagMinutes: number | null;
};

function validTimestamp(value: string | null | undefined) {
  return Boolean(value && Number.isFinite(Date.parse(value)));
}

function latestTimestamp(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => validTimestamp(value))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] || null;
}

function ageMinutes(value: string | null, nowMs: number) {
  if (!value) return null;
  return Math.max(0, Math.floor((nowMs - Date.parse(value)) / 60_000));
}

/**
 * Read-only overview health. It reuses the same subgroup freshness comparison
 * as Regime LIVE and never mutates projection, Story or hypothesis state.
 */
export function buildRegimeOverviewTimingHealth(input: {
  regimes: ProjectedRegime[];
  liveReasoning: RegimeLiveStoryReasoning[];
  now?: string;
}): RegimeOverviewTimingHealth {
  const nowMs = validTimestamp(input.now) ? Date.parse(input.now!) : Date.now();
  const reasoningByStory = new Map(input.liveReasoning.map((item) => [item.storyId, item]));

  const telemetryAt = input.regimes.flatMap((regime) =>
    regime.subgroups.flatMap((subgroup) => subgroup.telemetry.map((item) => item.asOf))
  );
  const interpretationAt = input.liveReasoning.map((item) => item.updatedAt);

  let telemetryBearingSubgroups = 0;
  let pendingInterpretationSubgroups = 0;
  let noTimestampedInterpretationSubgroups = 0;
  let oldestPendingLagMinutes: number | null = null;

  for (const regime of input.regimes) {
    for (const subgroup of regime.subgroups) {
      const subgroupTelemetry = subgroup.telemetry.map((item) => item.asOf);
      if (!subgroupTelemetry.some(validTimestamp)) continue;
      telemetryBearingSubgroups += 1;

      const subgroupInterpretation = subgroup.durableStories.flatMap((story) => {
        const reasoning = reasoningByStory.get(story.id);
        return reasoning ? [reasoning.updatedAt] : [];
      });
      const freshness = assessRegimeInterpretationFreshness({
        telemetryAt: subgroupTelemetry,
        interpretationAt: subgroupInterpretation,
      });

      if (freshness.status === "new_telemetry") {
        pendingInterpretationSubgroups += 1;
        oldestPendingLagMinutes = Math.max(oldestPendingLagMinutes || 0, freshness.lagMinutes);
      } else if (freshness.status === "no_interpretation") {
        pendingInterpretationSubgroups += 1;
        noTimestampedInterpretationSubgroups += 1;
        const pendingAge = ageMinutes(freshness.telemetryAt, nowMs) || 0;
        oldestPendingLagMinutes = Math.max(oldestPendingLagMinutes || 0, pendingAge);
      }
    }
  }

  const latestTelemetryAt = latestTimestamp(telemetryAt);
  const latestInterpretationAt = latestTimestamp(interpretationAt);

  const status: RegimeOverviewTimingHealth["status"] = !latestTelemetryAt
    ? "no_system1"
    : !latestInterpretationAt
      ? "no_system2"
      : pendingInterpretationSubgroups > 0
        ? "pending"
        : "current";

  return {
    status,
    latestTelemetryAt,
    latestTelemetryAgeMinutes: ageMinutes(latestTelemetryAt, nowMs),
    latestInterpretationAt,
    latestInterpretationAgeMinutes: ageMinutes(latestInterpretationAt, nowMs),
    telemetryBearingSubgroups,
    pendingInterpretationSubgroups,
    noTimestampedInterpretationSubgroups,
    oldestPendingLagMinutes,
  };
}
