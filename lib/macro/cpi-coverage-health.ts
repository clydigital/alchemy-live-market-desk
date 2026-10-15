import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "../supabase/admin.ts";

export const CPI_METRIC_KEYS = [
  "cpi_headline_mom", "cpi_headline_yoy", "cpi_core_mom", "cpi_core_yoy",
] as const;

type CpiRelease = {
  id: string;
  release_date: string;
  actual: string | null;
};
type CpiMetric = {
  release_id: string;
  metric_key: string;
  actual: number | null;
  consensus: number | null;
  consensus_source: string | null;
  consensus_captured_at: string | null;
};
type ReactionRow = {
  id: string;
  event_at: string | null;
  available_at: string | null;
  affected_topics: string[] | null;
  structured_payload: Record<string, unknown> | null;
};
export type CpiReleaseCoverage = {
  releaseId: string;
  releaseAt: string;
  stage: "BEFORE_RELEASE" | "AFTER_RELEASE";
  state: "COMPLETE" | "MISSING_DATA";
  missing: string[];
  verifiedEvidenceIds: string[];
};
export type ScheduledCpiCoverage = {
  status: "OK" | "DEGRADED";
  checkedAt: string;
  checks: CpiReleaseCoverage[];
  warnings: string[];
};

function validPreReleaseForecast(metric: CpiMetric, releaseAt: number) {
  const captured = Date.parse(metric.consensus_captured_at ?? "");
  return typeof metric.consensus === "number" && Number.isFinite(metric.consensus)
    && Boolean(metric.consensus_source?.trim())
    && Number.isFinite(captured)
    && captured < releaseAt;
}

function verifiedCpiReaction(
  row: ReactionRow,
  releaseAt: number,
  kind: "economic_release" | "rate_expectation" | "market_reaction",
) {
  const eventAt = Date.parse(row.event_at ?? "");
  const availableAt = Date.parse(row.available_at ?? "");
  const tags = row.affected_topics ?? [];
  return row.structured_payload?.evidenceNature === "verified_macro_data"
    && row.structured_payload?.signalKind === kind
    && (tags.includes("CPI_REACTION") || tags.includes("US_INFLATION"))
    && Number.isFinite(eventAt) && eventAt >= releaseAt
    && eventAt <= releaseAt + 48 * 60 * 60_000
    && Number.isFinite(availableAt);
}

/** Data-availability check, never an explanation of what markets believed.
 * Run in existing scheduled acquisition: missing provider entitlement stays visible. */
export function assessCpiReleaseCoverage(
  releases: CpiRelease[],
  metrics: CpiMetric[],
  reactions: ReactionRow[],
  now: Date,
): ScheduledCpiCoverage {
  const nowMs = now.getTime();
  const checks: CpiReleaseCoverage[] = [];
  for (const release of releases) {
    const eventMs = Date.parse(release.release_date);
    if (!Number.isFinite(eventMs)) continue;
    const beforeRelease = nowMs < eventMs;
    const observed = metrics.filter((metric) => metric.release_id === release.id);
    const missing: string[] = [];
    for (const key of CPI_METRIC_KEYS) {
      const metric = observed.find((item) => item.metric_key === key);
      if (!metric || !validPreReleaseForecast(metric, eventMs)) {
        missing.push("PRE_RELEASE_CONSENSUS:" + key);
      }
      if (!beforeRelease && (!metric || typeof metric.actual !== "number" || !Number.isFinite(metric.actual))) {
        missing.push("BLS_ACTUAL:" + key);
      }
    }
    const verifiedEvidenceIds: string[] = [];
    // Only demand market reaction once a 30m ingestion grace has elapsed.
    // The causal matching still belongs exclusively to System 1.
    if (!beforeRelease && nowMs - eventMs >= 30 * 60_000) {
      for (const kind of ["economic_release", "rate_expectation", "market_reaction"] as const) {
        const matching = reactions.filter((row) => verifiedCpiReaction(row, eventMs, kind));
        if (!matching.length) missing.push("CANONICAL_CPI_EVIDENCE:" + kind);
        else verifiedEvidenceIds.push(...matching.map((row) => row.id));
      }
    }
    checks.push({
      releaseId: release.id,
      releaseAt: release.release_date,
      stage: beforeRelease ? "BEFORE_RELEASE" : "AFTER_RELEASE",
      state: missing.length ? "MISSING_DATA" : "COMPLETE",
      missing,
      verifiedEvidenceIds: [...new Set(verifiedEvidenceIds)],
    });
  }
  return {
    status: checks.some((check) => check.state === "MISSING_DATA") ? "DEGRADED" : "OK",
    checkedAt: now.toISOString(),
    checks,
    warnings: [],
  };
}

/** Look ahead 7 days and back 48 hours. No new scheduler, database table or
 * LLM call; expose gaps in the existing research run's acquisition output. */
export async function checkScheduledCpiCoverage(
  now = new Date(),
  client: SupabaseClient = createSupabaseAdminClient(),
): Promise<ScheduledCpiCoverage> {
  const from = new Date(now.getTime() - 48 * 60 * 60_000).toISOString();
  const until = new Date(now.getTime() + 7 * 86_400_000).toISOString();
  const { data: releases, error: releaseError } = await client.from("macro_releases")
    .select("id,release_date,actual")
    .ilike("release_name", "%consumer price index%")
    .gte("release_date", from).lte("release_date", until).limit(16);
  if (releaseError) throw new Error("CPI release coverage read failed: " + releaseError.message);
  if (!releases?.length) return assessCpiReleaseCoverage([], [], [], now);
  const ids = releases.map((item) => item.id);
  const [{ data: metrics, error: metricError }, { data: reactions, error: reactionError }] = await Promise.all([
    client.from("macro_release_metrics")
      .select("release_id,metric_key,actual,consensus,consensus_source,consensus_captured_at")
      .in("release_id", ids).limit(100),
    client.from("intelligence_evidence")
      .select("id,event_at,available_at,affected_topics,structured_payload")
      .gte("event_at", from).lte("event_at", now.toISOString()).limit(300),
  ]);
  if (metricError || reactionError) {
    throw new Error("CPI coverage source read failed: " + (metricError?.message ?? reactionError?.message));
  }
  return assessCpiReleaseCoverage(
    releases as CpiRelease[],
    (metrics ?? []) as CpiMetric[],
    (reactions ?? []) as ReactionRow[],
    now,
  );
}
