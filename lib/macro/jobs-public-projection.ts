import {
  BLS_MAJOR_SECTORS,
  BLS_WORKER_CONDITIONS,
  detectBlsLabourDivergences,
  type BlsLabourComposition,
  type LabourDivergence,
  type LabourSectorChange,
  type WorkerCondition,
} from "./bls-labour-composition.ts";

/** Public, source-checked projection. No owner records, no generated research,
 * no original-source fetch, no publication or storage side effects. */
export type JobsReleaseRecord = {
  id: string;
  release_name: string;
  reference_period: string | null;
  release_date: string;
  source_url: string;
  actual: string | null;
  status: string;
  consensus: string | null;
  consensus_source: string | null;
  consensus_captured_at: string | null;
};
export type JobsMetricRecord = {
  metric_key: string;
  actual: number | null;
  previous: number | null;
  unit: string | null;
  source_url: string;
  retrieved_at: string;
  metadata: Record<string, unknown> | null;
};
export type JobsPublicProjection = {
  status: "ready" | "unavailable" | "incomplete" | "unreconciled" | "mixed_vintage";
  period: string | null;
  releasedAt: string | null;
  retrievedAt: string | null;
  sourceUrl: string | null;
  sourceVintage: string | null;
  headlineChangeK: number | null;
  sectors: LabourSectorChange[];
  sectorCount: number;
  growing: number | null;
  shrinking: number | null;
  unchanged: number | null;
  summedChangeK: number | null;
  u6: { current: number; previous: number | null } | null;
  weeklyHours: { current: number; previous: number | null } | null;
  divergences: LabourDivergence[];
  forecastState: "frozen" | "unverified";
  reason: string | null;
};

const ARCHIVE_URL = /^https:\/\/www\.bls\.gov\/news\.release\/archives\/empsit_\d{8}\.htm$/;
const EXPECTED_VINTAGES = new Set(["original_archived_release", "current_api_vintage"]);

function empty(reason: string, status: JobsPublicProjection["status"] = "unavailable"): JobsPublicProjection {
  return {
    status, period: null, releasedAt: null, retrievedAt: null,
    sourceUrl: null, sourceVintage: null, headlineChangeK: null,
    sectors: [], sectorCount: 0, growing: null, shrinking: null,
    unchanged: null, summedChangeK: null, u6: null, weeklyHours: null,
    divergences: [], forecastState: "unverified", reason,
  };
}
function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function validatedMetric(
  row: JobsMetricRecord | undefined,
  sourceUrl: string,
  referencePeriod: string,
  seriesId: string,
): row is JobsMetricRecord {
  if (!row || !finiteNumber(row.actual) || row.source_url !== sourceUrl) return false;
  if (row.metadata?.sourceSeriesId !== seriesId
    || row.metadata?.referencePeriod !== referencePeriod
    || !EXPECTED_VINTAGES.has(String(row.metadata?.sourceVintage || ""))) return false;
  return Number.isFinite(Date.parse(row.retrieved_at));
}

export function buildJobsPublicProjection(
  release: JobsReleaseRecord | null,
  metrics: readonly JobsMetricRecord[],
): JobsPublicProjection {
  if (!release || release.status !== "completed"
    || !/^Employment Situation for /i.test(release.release_name)
    || !release.reference_period || !ARCHIVE_URL.test(release.source_url)) {
    return empty("No completed first-party employment release is available.");
  }
  const headlineMatch = release.actual?.match(/\bNonfarm payrolls\s+([+-]?\d+(?:\.\d+)?)k\b/i);
  const headline = headlineMatch ? Number(headlineMatch[1]) : null;
  if (headline === null || !Number.isFinite(headline)) {
    return empty("The official headline payroll change could not be verified.", "incomplete");
  }

  const byKey = new Map<string, JobsMetricRecord>();
  let duplicate = false;
  for (const row of metrics) {
    if (byKey.has(row.metric_key)) duplicate = true;
    byKey.set(row.metric_key, row);
  }

  const sectors: LabourSectorChange[] = [];
  for (const sector of BLS_MAJOR_SECTORS) {
    const metric = byKey.get("employment_sector_" + sector.key + "_net_change");
    if (!validatedMetric(metric, release.source_url, release.reference_period, sector.id)) continue;
    sectors.push({
      key: sector.key,
      label: sector.label,
      seriesId: sector.id,
      changeK: metric.actual!,
      currentLevelK: finiteNumber(metric.metadata?.currentLevelK) ? metric.metadata.currentLevelK : null,
      previousLevelK: finiteNumber(metric.metadata?.previousLevelK) ? metric.metadata.previousLevelK : null,
    });
  }

  const workerByKey = new Map<string, WorkerCondition>();
  for (const condition of BLS_WORKER_CONDITIONS) {
    const metric = byKey.get("labour_" + condition.key);
    if (!validatedMetric(metric, release.source_url, release.reference_period, condition.id)) continue;
    if (!finiteNumber(metric.previous)) continue; // A change cannot be inferred from absent prior data.
    workerByKey.set(condition.key, {
      key: condition.key, label: condition.label, seriesId: condition.id,
      unit: condition.unit, current: metric.actual!, previous: metric.previous,
    });
  }
  const u6 = workerByKey.get("u6_rate");
  const weeklyHours = workerByKey.get("private_weekly_hours");
  const isComplete = sectors.length === BLS_MAJOR_SECTORS.length && !duplicate;
  const summedChangeK = sectors.length
    ? Math.round(sectors.reduce((sum, sector) => sum + sector.changeK, 0) * 1000) / 1000
    : null;
  const differenceK = summedChangeK === null ? null : Math.abs(summedChangeK - headline);
  const vintageSet = new Set(metrics
    .filter(m => (m.metric_key.startsWith("employment_sector_") || m.metric_key.startsWith("labour_"))
      && validatedMetric(m, release.source_url, release.reference_period, String(m.metadata?.sourceSeriesId || "")))
    .map(m => String(m.metadata?.sourceVintage)));
  const vintages = [...vintageSet];
  const sourceVintage = vintages.length === 1 ? vintages[0] : null;
  const status = !isComplete ? "incomplete"
    : differenceK === null || differenceK > 3 ? "unreconciled"
    : vintages.length !== 1 ? "mixed_vintage" : "ready";
  const growing = sectors.filter(x => x.changeK > 0).length;
  const shrinking = sectors.filter(x => x.changeK < 0).length;
  const unchanged = sectors.filter(x => x.changeK === 0).length;

  const composition: BlsLabourComposition = {
    referencePeriod: release.reference_period,
    sectors,
    conditions: [...workerByKey.values()],
    missingSeries: BLS_MAJOR_SECTORS.filter(s => !sectors.some(x => x.seriesId === s.id)).map(s => s.id),
    coverageComplete: isComplete && status === "ready",
    breadth: isComplete && status === "ready" ? {
      growingSectors: growing, shrinkingSectors: shrinking, unchangedSectors: unchanged,
      shrinkingShare: shrinking / BLS_MAJOR_SECTORS.length,
      netSectorChangeK: summedChangeK!,
    } : null,
  };

  const retrievedDates = metrics
    .filter(x => Number.isFinite(Date.parse(x.retrieved_at)))
    .map(x => x.retrieved_at).sort();
  return {
    status,
    period: release.reference_period, releasedAt: release.release_date,
    retrievedAt: retrievedDates.at(-1) || null,
    sourceUrl: release.source_url, sourceVintage,
    headlineChangeK: headline,
    sectors: sectors.sort((a, b) => b.changeK - a.changeK),
    sectorCount: sectors.length,
    growing: status === "ready" ? growing : null,
    shrinking: status === "ready" ? shrinking : null,
    unchanged: status === "ready" ? unchanged : null,
    summedChangeK,
    u6: u6 ? { current: u6.current, previous: u6.previous } : null,
    weeklyHours: weeklyHours ? { current: weeklyHours.current, previous: weeklyHours.previous } : null,
    divergences: status === "ready"
      ? detectBlsLabourDivergences(headline, composition) : [],
    forecastState: release.consensus !== null && Boolean(release.consensus_source)
      && Boolean(release.consensus_captured_at)
      && Date.parse(release.consensus_captured_at!) < Date.parse(release.release_date)
      ? "frozen" : "unverified",
    reason: status === "ready" ? null
      : status === "incomplete" ? "Sector source coverage is incomplete; breadth is withheld."
      : status === "mixed_vintage" ? "Mixed data vintages cannot be compared without reconciliation."
      : "Sector totals do not reconcile to the headline within the expected rounding margin.",
  };
}
