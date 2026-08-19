import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildMacroSnapshot } from "./macro-snapshot.ts";
import {
  MACRO_NORMALIZATION_VERSION,
  buildMacroNormalizationPlan,
  buildMacroSourceChangeEvents,
  mergeSecondaryReleaseCandidate,
  type NormalizedMacroRelease,
} from "./macro-normalization.ts";

export type MacroNormalizationResult = {
  status: "COMPLETE" | "ALREADY_COMPLETE" | "SKIPPED" | "FAILED";
  snapshotId: string;
  releaseCount: number;
  metricCount: number;
  seriesObservationCount: number;
  changeCount: number;
  skippedTableCount: number;
  note: string;
};

type SnapshotRow = {
  id: string;
  source_key: string;
  source_url: string;
  status: string;
  raw_markdown: string | null;
  capture_completed_at: string;
  normalization_status: string;
  normalization_version: number;
};

type ExistingRelease = {
  id: string;
  series_key: string;
  release_date: string;
  actual: string | null;
  consensus: string | null;
  previous: string | null;
  revised_previous: string | null;
  unit: string | null;
  country: string | null;
  impact: string | null;
  source_snapshot_id: string | null;
};

function day(value: string) {
  return value.slice(0, 10);
}

function releaseMatchKey(seriesKey: string, releaseDate: string) {
  return `${seriesKey}|${day(releaseDate)}`;
}

function releaseRow(candidate: NormalizedMacroRelease, capturedAt: string) {
  const completed = candidate.status === "completed";
  return {
    id: candidate.id,
    series_key: candidate.seriesKey,
    release_name: candidate.releaseName,
    agency: "Macro Indicators aggregation",
    category: candidate.category,
    release_date: candidate.releaseDate,
    release_time_label: candidate.releaseTimeLabel,
    reference_period: candidate.referencePeriod,
    frequency: candidate.frequency,
    status: candidate.status,
    actual: candidate.actual,
    consensus: candidate.consensus,
    previous: candidate.previous,
    revised_previous: candidate.revisedPrevious,
    unit: candidate.unit,
    surprise_direction: null,
    market_interpretation: null,
    watch_question: "What changed versus forecast, previous and the last captured vintage?",
    confirmation_trigger: null,
    invalidation_trigger: null,
    source_url: candidate.sourceUrl,
    source_classification: "secondary_aggregator",
    affected_assets: [],
    published_at: completed ? capturedAt : null,
    released_at: completed ? candidate.releaseDate : null,
    actual_retrieved_at: completed ? capturedAt : null,
    consensus_source: candidate.consensus ? "Macro Indicators" : null,
    consensus_captured_at: candidate.consensus ? capturedAt : null,
    last_ingestion_attempt_at: capturedAt,
    ingestion_gap_reason: completed ? null : "Macro Indicators has not supplied an Actual for this scheduled row in the current COMPLETE snapshot.",
    lifecycle_evaluated_at: capturedAt,
    country: candidate.country,
    impact: candidate.impact,
    local_timezone: "CET",
    source_snapshot_id: candidate.sourceSnapshotId,
    source_table_id: candidate.sourceTableId,
    source_row_key: candidate.sourceRowKey,
    updated_at: capturedAt,
  };
}

async function persistReleases(
  client: ReturnType<typeof createSupabaseAdminClient>,
  releases: NormalizedMacroRelease[],
  capturedAt: string,
) {
  if (!releases.length) return new Map<string, string>();
  const seriesKeys = [...new Set(releases.map((release) => release.seriesKey))];
  const { data, error } = await client
    .from("macro_releases")
    .select("id,series_key,release_date,actual,consensus,previous,revised_previous,unit,country,impact,source_snapshot_id")
    .in("series_key", seriesKeys);
  if (error) throw new Error(`Could not read canonical macro releases for normalization: ${error.message}`);

  const existingByKey = new Map<string, ExistingRelease[]>();
  for (const existing of (data ?? []) as ExistingRelease[]) {
    const key = releaseMatchKey(existing.series_key, existing.release_date);
    const bucket = existingByKey.get(key) ?? [];
    bucket.push(existing);
    existingByKey.set(key, bucket);
  }

  const releaseIdByGroup = new Map<string, string>();
  for (const candidate of releases) {
    const matches = existingByKey.get(releaseMatchKey(candidate.seriesKey, candidate.releaseDate)) ?? [];
    const exactJina = matches.find((match) => match.id === candidate.id);
    if (exactJina) {
      const { error: upsertError } = await client.from("macro_releases").upsert(releaseRow(candidate, capturedAt), { onConflict: "id" });
      if (upsertError) throw new Error(`Could not refresh Jina canonical macro release ${candidate.id}: ${upsertError.message}`);
      releaseIdByGroup.set(candidate.groupKey, candidate.id);
      continue;
    }

    if (matches.length === 1) {
      const existing = matches[0];
      const patch = mergeSecondaryReleaseCandidate(existing, candidate);
      if (Object.keys(patch).length) {
        const { error: patchError } = await client
          .from("macro_releases")
          .update({ ...patch, last_ingestion_attempt_at: capturedAt, updated_at: capturedAt })
          .eq("id", existing.id);
        if (patchError) throw new Error(`Could not fill canonical macro release gaps for ${existing.id}: ${patchError.message}`);
      }
      releaseIdByGroup.set(candidate.groupKey, existing.id);
      continue;
    }

    const { error: insertError } = await client.from("macro_releases").upsert(releaseRow(candidate, capturedAt), { onConflict: "id" });
    if (insertError) throw new Error(`Could not persist Jina canonical macro release ${candidate.id}: ${insertError.message}`);
    releaseIdByGroup.set(candidate.groupKey, candidate.id);
  }
  return releaseIdByGroup;
}

async function persistMetrics(
  client: ReturnType<typeof createSupabaseAdminClient>,
  metrics: ReturnType<typeof buildMacroNormalizationPlan>["metrics"],
  releaseIdByGroup: Map<string, string>,
) {
  const candidates = metrics.flatMap((metric) => {
    const releaseId = releaseIdByGroup.get(metric.releaseGroupKey);
    return releaseId ? [{ metric, releaseId }] : [];
  });
  if (!candidates.length) return 0;

  const releaseIds = [...new Set(candidates.map((candidate) => candidate.releaseId))];
  const { data, error } = await client
    .from("macro_release_metrics")
    .select("release_id,metric_key,source_snapshot_id")
    .in("release_id", releaseIds);
  if (error) throw new Error(`Could not read persisted macro metrics for normalization: ${error.message}`);
  const existing = new Map((data ?? []).map((row: { release_id: string; metric_key: string; source_snapshot_id: string | null }) => [
    `${row.release_id}|${row.metric_key}`,
    row,
  ]));

  const rows = candidates.flatMap(({ metric, releaseId }) => {
    const key = `${releaseId}|${metric.metricKey}`;
    const current = existing.get(key);
    // Never overwrite an independently persisted/official metric with secondary aggregation.
    if (current && !current.source_snapshot_id) return [];
    return [{
      release_id: releaseId,
      metric_key: metric.metricKey,
      label: metric.label,
      transformation: metric.transformation,
      unit: metric.unit,
      previous: metric.previous,
      revised_previous: metric.revisedPrevious,
      consensus: metric.consensus,
      consensus_source: metric.consensus !== null ? "Macro Indicators" : null,
      consensus_captured_at: metric.consensus !== null ? metric.retrievedAt : null,
      actual: metric.actual,
      source_url: metric.sourceUrl,
      retrieved_at: metric.retrievedAt,
      metadata: {
        source: "macro_indicators",
        normalization_version: MACRO_NORMALIZATION_VERSION,
        source_snapshot_id: metric.sourceSnapshotId,
        source_table_id: metric.sourceTableId,
        source_row_key: metric.sourceRowKey,
        source_column: metric.sourceColumn,
      },
      source_snapshot_id: metric.sourceSnapshotId,
      source_table_id: metric.sourceTableId,
      source_row_key: metric.sourceRowKey,
      source_column: metric.sourceColumn,
      updated_at: metric.retrievedAt,
    }];
  });
  if (!rows.length) return 0;
  const { error: upsertError } = await client.from("macro_release_metrics").upsert(rows, {
    onConflict: "release_id,metric_key",
  });
  if (upsertError) throw new Error(`Could not persist normalized macro metrics: ${upsertError.message}`);
  return rows.length;
}

async function persistSeriesObservations(
  client: ReturnType<typeof createSupabaseAdminClient>,
  observations: ReturnType<typeof buildMacroNormalizationPlan>["seriesObservations"],
  capturedAt: string,
) {
  if (!observations.length) return 0;
  const rows = observations.map((observation) => ({
    id: observation.id,
    series_key: observation.seriesKey,
    series_id: observation.seriesId,
    series_name: observation.seriesName,
    agency: observation.agency,
    observation_date: observation.observationDate,
    value: observation.value,
    mom_change: null,
    yoy_change: null,
    unit: observation.unit,
    frequency: observation.frequency,
    source_url: observation.sourceUrl,
    is_preliminary: false,
    notes: "Normalized from a COMPLETE Macro Indicators snapshot. Immutable raw vintages and deterministic change events preserve revisions.",
    source_snapshot_id: observation.sourceSnapshotId,
    source_table_id: observation.sourceTableId,
    source_row_key: observation.sourceRowKey,
    source_column: observation.sourceColumn,
    updated_at: capturedAt,
  }));
  const { error } = await client.from("macro_series_observations").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`Could not persist normalized ISM observations: ${error.message}`);
  return rows.length;
}

async function persistChangeEvents(
  client: ReturnType<typeof createSupabaseAdminClient>,
  current: SnapshotRow,
  currentSnapshot: ReturnType<typeof buildMacroSnapshot>,
) {
  const { data: previousData, error: previousError } = await client
    .from("macro_source_snapshots")
    .select("id,source_key,source_url,status,raw_markdown,capture_completed_at,normalization_status,normalization_version")
    .eq("source_key", current.source_key)
    .eq("status", "complete")
    .lt("capture_completed_at", current.capture_completed_at)
    .order("capture_completed_at", { ascending: false })
    .limit(1)
    .maybeSingle<SnapshotRow>();
  if (previousError) throw new Error(`Could not read previous COMPLETE macro snapshot: ${previousError.message}`);
  if (!previousData?.raw_markdown) return 0;
  const previousSnapshot = buildMacroSnapshot(previousData.raw_markdown, previousData.capture_completed_at);
  const events = buildMacroSourceChangeEvents(previousSnapshot, currentSnapshot, previousData.id, current.id);
  if (!events.length) return 0;
  const rows = events.map((event) => ({
    source_key: event.sourceKey,
    previous_snapshot_id: event.previousSnapshotId,
    current_snapshot_id: event.currentSnapshotId,
    change_key: event.changeKey,
    change_type: event.changeType,
    section_key: event.sectionKey,
    table_id: event.tableId,
    table_kind: event.tableKind,
    row_key: event.rowKey,
    column_key: event.columnKey,
    old_value: event.oldValue,
    new_value: event.newValue,
    row_data: event.rowData,
    detected_at: event.detectedAt,
  }));
  const { error } = await client.from("macro_source_change_events").upsert(rows, {
    onConflict: "current_snapshot_id,change_key",
    ignoreDuplicates: true,
  });
  if (error) throw new Error(`Could not persist deterministic macro change events: ${error.message}`);
  return rows.length;
}

export async function normalizeMacroIndicatorsSnapshot(snapshotId: string): Promise<MacroNormalizationResult> {
  const client = createSupabaseAdminClient();
  let snapshot: SnapshotRow | null = null;
  try {
    const { data, error } = await client
      .from("macro_source_snapshots")
      .select("id,source_key,source_url,status,raw_markdown,capture_completed_at,normalization_status,normalization_version")
      .eq("id", snapshotId)
      .maybeSingle<SnapshotRow>();
    if (error) throw new Error(`Could not read Macro Indicators snapshot ${snapshotId}: ${error.message}`);
    snapshot = data;
    if (!snapshot || snapshot.status !== "complete" || !snapshot.raw_markdown) {
      return {
        status: "SKIPPED",
        snapshotId,
        releaseCount: 0,
        metricCount: 0,
        seriesObservationCount: 0,
        changeCount: 0,
        skippedTableCount: 0,
        note: "Only fully persisted COMPLETE Macro Indicators snapshots are eligible for canonical normalization.",
      };
    }
    if (snapshot.normalization_status === "complete" && snapshot.normalization_version >= MACRO_NORMALIZATION_VERSION) {
      return {
        status: "ALREADY_COMPLETE",
        snapshotId,
        releaseCount: 0,
        metricCount: 0,
        seriesObservationCount: 0,
        changeCount: 0,
        skippedTableCount: 0,
        note: `Normalization version ${snapshot.normalization_version} is already complete for this snapshot.`,
      };
    }

    const { error: markError } = await client.from("macro_source_snapshots").update({
      normalization_status: "processing",
      normalization_version: MACRO_NORMALIZATION_VERSION,
      normalization_note: null,
    }).eq("id", snapshotId).eq("status", "complete");
    if (markError) throw new Error(`Could not claim Macro Indicators normalization: ${markError.message}`);

    const currentSnapshot = buildMacroSnapshot(snapshot.raw_markdown, snapshot.capture_completed_at);
    if (currentSnapshot.status !== "COMPLETE") throw new Error("Persisted source row says complete but deterministic snapshot validation is PARTIAL.");
    const plan = buildMacroNormalizationPlan(currentSnapshot, snapshot.id, snapshot.source_url);
    const releaseIdByGroup = await persistReleases(client, plan.releases, snapshot.capture_completed_at);
    const metricCount = await persistMetrics(client, plan.metrics, releaseIdByGroup);
    const seriesObservationCount = await persistSeriesObservations(client, plan.seriesObservations, snapshot.capture_completed_at);
    const changeCount = await persistChangeEvents(client, snapshot, currentSnapshot);
    const note = `Normalized ${releaseIdByGroup.size} release group(s), ${metricCount} metric(s), ${seriesObservationCount} ISM observation(s), and ${changeCount} deterministic change event(s); ${plan.skippedTableIds.length} table(s) remain raw-only by design.`;

    const { error: finishError } = await client.from("macro_source_snapshots").update({
      normalization_status: "complete",
      normalization_version: MACRO_NORMALIZATION_VERSION,
      normalized_at: new Date().toISOString(),
      normalization_note: note,
    }).eq("id", snapshotId);
    if (finishError) throw new Error(`Could not finalise Macro Indicators normalization: ${finishError.message}`);

    return {
      status: "COMPLETE",
      snapshotId,
      releaseCount: releaseIdByGroup.size,
      metricCount,
      seriesObservationCount,
      changeCount,
      skippedTableCount: plan.skippedTableIds.length,
      note,
    };
  } catch (error) {
    const note = error instanceof Error ? error.message : String(error);
    if (snapshot?.id) {
      await client.from("macro_source_snapshots").update({
        normalization_status: "failed",
        normalization_version: MACRO_NORMALIZATION_VERSION,
        normalization_note: note.slice(0, 1_000),
      }).eq("id", snapshot.id).catch(() => undefined);
    }
    return {
      status: "FAILED",
      snapshotId,
      releaseCount: 0,
      metricCount: 0,
      seriesObservationCount: 0,
      changeCount: 0,
      skippedTableCount: 0,
      note: `Macro Indicators normalization failed without invalidating the raw COMPLETE snapshot: ${note}`,
    };
  }
}
