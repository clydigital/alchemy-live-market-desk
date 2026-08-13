import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type EconomicConsensusMetric = {
  releaseId: string;
  metricKey: string;
  label: string;
  consensus: number | null;
  forecastLow: number | null;
  forecastHigh: number | null;
  source: string | null;
  capturedAt: string | null;
};

export type EconomicConsensusSnapshot = {
  releaseId: string;
  scheduledAt: string;
  metrics: EconomicConsensusMetric[];
  pointInTimeAvailable: boolean;
  coverageGap: string | null;
};

export interface EconomicConsensusProvider {
  getUpcomingEvents(input?: { from?: string; to?: string }): Promise<EconomicConsensusSnapshot[]>;
  getEventSnapshot(releaseId: string): Promise<EconomicConsensusSnapshot | null>;
  getPointInTimeSnapshot(releaseId: string, asOf: string): Promise<EconomicConsensusSnapshot | null>;
}

type ReleaseRow = { id: string; release_date: string };
type MetricRow = {
  release_id: string;
  metric_key: string;
  label: string;
  consensus: number | null;
  forecast_low: number | null;
  forecast_high: number | null;
  consensus_source: string | null;
  consensus_captured_at: string | null;
};

function snapshot(release: ReleaseRow, metrics: MetricRow[], asOf?: string): EconomicConsensusSnapshot {
  const eligible = metrics.filter((metric) => {
    if (!asOf) return true;
    return Boolean(metric.consensus_captured_at && Date.parse(metric.consensus_captured_at) <= Date.parse(asOf));
  });
  const normalized = eligible.map((metric) => ({
    releaseId: metric.release_id,
    metricKey: metric.metric_key,
    label: metric.label,
    consensus: metric.consensus,
    forecastLow: metric.forecast_low,
    forecastHigh: metric.forecast_high,
    source: metric.consensus_source,
    capturedAt: metric.consensus_captured_at,
  }));
  const pointInTimeAvailable = normalized.some((metric) => metric.consensus !== null && Boolean(metric.capturedAt));
  return {
    releaseId: release.id,
    scheduledAt: release.release_date,
    metrics: normalized,
    pointInTimeAvailable,
    coverageGap: pointInTimeAvailable ? null : "No pre-release, point-in-time consensus snapshot is stored for this event.",
  };
}

/** Reads reviewed consensus already persisted in Supabase; it never manufactures a forecast. */
export class StoredEconomicConsensusProvider implements EconomicConsensusProvider {
  constructor(private readonly client: SupabaseClient = createSupabaseAdminClient()) {}

  async getUpcomingEvents(input: { from?: string; to?: string } = {}) {
    let request = this.client.from("macro_releases").select("id,release_date").order("release_date", { ascending: true });
    if (input.from) request = request.gte("release_date", input.from);
    if (input.to) request = request.lte("release_date", input.to);
    const { data: releases, error } = await request;
    if (error) throw new Error(`load consensus events: ${error.message}`);
    const ids = (releases || []).map((release) => release.id);
    const { data: metrics, error: metricError } = ids.length
      ? await this.client.from("macro_release_metrics").select("release_id,metric_key,label,consensus,forecast_low,forecast_high,consensus_source,consensus_captured_at").in("release_id", ids)
      : { data: [], error: null };
    if (metricError) throw new Error(`load consensus metrics: ${metricError.message}`);
    return (releases || []).map((release) => snapshot(release as ReleaseRow, (metrics || []) as MetricRow[]));
  }

  async getEventSnapshot(releaseId: string) {
    return this.loadOne(releaseId);
  }

  async getPointInTimeSnapshot(releaseId: string, asOf: string) {
    return this.loadOne(releaseId, asOf);
  }

  private async loadOne(releaseId: string, asOf?: string) {
    const [{ data: release, error }, { data: metrics, error: metricError }] = await Promise.all([
      this.client.from("macro_releases").select("id,release_date").eq("id", releaseId).maybeSingle(),
      this.client.from("macro_release_metrics").select("release_id,metric_key,label,consensus,forecast_low,forecast_high,consensus_source,consensus_captured_at").eq("release_id", releaseId),
    ]);
    if (error || metricError) throw new Error(`load consensus snapshot: ${error?.message || metricError?.message}`);
    return release ? snapshot(release as ReleaseRow, (metrics || []) as MetricRow[], asOf) : null;
  }
}
