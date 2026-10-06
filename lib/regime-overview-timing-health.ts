import { assessRegimeInterpretationFreshness } from "./regime-freshness.ts";
import type { RegimeStoryInterpretationClock } from "./regime-live-reasoning.ts";
import type { ProjectedRegime } from "./regimes.ts";

export type RegimeOverviewTimingHealth = {
  status: "current" | "pending" | "partial_coverage" | "no_system1" | "no_system2";
  latestTelemetryAt: string | null;
  latestTelemetryAgeMinutes: number | null;
  latestInterpretationAt: string | null;
  latestInterpretationAgeMinutes: number | null;
  telemetryBearingSubgroups: number;
  storyBackedTelemetrySubgroups: number;
  system1OnlySubgroups: number;
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
 * Read-only overview health.
 *
 * System 2 freshness is the latest accepted Story evaluation clock, not merely
 * the last time the persisted hypothesis wording changed. An unchanged Story
 * reassessment is still a real System 2 read and advances last_evaluated_at.
 *
 * Telemetry-only subgroups are reported as coverage gaps rather than being
 * mislabelled as stale interpretation. With no durable Story identity there is
 * nothing exact to re-evaluate, and the Regime layer must not manufacture one.
 */
export function buildRegimeOverviewTimingHealth(input: {
  regimes: ProjectedRegime[];
  interpretationClocks: RegimeStoryInterpretationClock[];
  now?: string;
}): RegimeOverviewTimingHealth {
  const nowMs = validTimestamp(input.now) ? Date.parse(input.now!) : Date.now();
  const interpretationByStory = new Map(
    input.interpretationClocks.map((item) => [item.storyId, item]),
  );

  const telemetryAt = input.regimes.flatMap((regime) =>
    regime.subgroups.flatMap((subgroup) => subgroup.telemetry.map((item) => item.asOf))
  );
  const interpretationAt = input.interpretationClocks.map((item) => item.evaluatedAt);

  let telemetryBearingSubgroups = 0;
  let storyBackedTelemetrySubgroups = 0;
  let system1OnlySubgroups = 0;
  let pendingInterpretationSubgroups = 0;
  let noTimestampedInterpretationSubgroups = 0;
  let oldestPendingLagMinutes: number | null = null;

  for (const regime of input.regimes) {
    for (const subgroup of regime.subgroups) {
      const subgroupTelemetry = subgroup.telemetry.map((item) => item.asOf);
      if (!subgroupTelemetry.some(validTimestamp)) continue;
      telemetryBearingSubgroups += 1;

      if (!subgroup.durableStories.length) {
        system1OnlySubgroups += 1;
        continue;
      }
      storyBackedTelemetrySubgroups += 1;

      const subgroupInterpretation = subgroup.durableStories.flatMap((story) => {
        const clock = interpretationByStory.get(story.id);
        return clock ? [clock.evaluatedAt] : [];
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
    : storyBackedTelemetrySubgroups > 0 && !latestInterpretationAt
      ? "no_system2"
      : pendingInterpretationSubgroups > 0
        ? "pending"
        : system1OnlySubgroups > 0
          ? "partial_coverage"
          : "current";

  return {
    status,
    latestTelemetryAt,
    latestTelemetryAgeMinutes: ageMinutes(latestTelemetryAt, nowMs),
    latestInterpretationAt,
    latestInterpretationAgeMinutes: ageMinutes(latestInterpretationAt, nowMs),
    telemetryBearingSubgroups,
    storyBackedTelemetrySubgroups,
    system1OnlySubgroups,
    pendingInterpretationSubgroups,
    noTimestampedInterpretationSubgroups,
    oldestPendingLagMinutes,
  };
}
