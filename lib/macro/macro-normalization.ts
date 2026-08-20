import { economicTransformation, parseEconomicNumber } from "../economic-metrics.ts";
import { compareMacroSnapshots, type MacroChange } from "./macro-diff.ts";
import { stableMacroHash } from "./macro-indicators-source.ts";
import type { MacroSnapshot, MacroSnapshotRow, MacroSnapshotTable } from "./macro-snapshot.ts";

export const MACRO_NORMALIZATION_VERSION = 1;

export type NormalizedMacroRelease = {
  id: string;
  groupKey: string;
  seriesKey: string;
  releaseName: string;
  releaseDate: string;
  releaseTimeLabel: string;
  referencePeriod: string | null;
  frequency: string;
  status: "scheduled" | "pre_release" | "released_pending_ingestion" | "completed";
  actual: string | null;
  consensus: string | null;
  previous: string | null;
  revisedPrevious: string | null;
  unit: string | null;
  category: string;
  impact: string | null;
  country: string | null;
  sourceUrl: string;
  sourceSnapshotId: string;
  sourceTableId: string;
  sourceRowKey: string | null;
};

export type NormalizedMacroMetric = {
  releaseGroupKey: string;
  metricKey: string;
  label: string;
  transformation: "level" | "mom" | "yoy" | "qoq" | "annualised" | "change";
  unit: string | null;
  previous: number | null;
  revisedPrevious: number | null;
  consensus: number | null;
  actual: number | null;
  sourceUrl: string;
  retrievedAt: string;
  sourceSnapshotId: string;
  sourceTableId: string;
  sourceRowKey: string;
  sourceColumn: string;
};

export type NormalizedMacroSeriesObservation = {
  id: string;
  seriesKey: string;
  seriesId: string;
  seriesName: string;
  agency: string;
  observationDate: string;
  value: number;
  unit: string;
  frequency: string;
  sourceUrl: string;
  sourceSnapshotId: string;
  sourceTableId: string;
  sourceRowKey: string;
  sourceColumn: string;
};

export type MacroNormalizationPlan = {
  releases: NormalizedMacroRelease[];
  metrics: NormalizedMacroMetric[];
  seriesObservations: NormalizedMacroSeriesObservation[];
  skippedTableIds: string[];
};

export type MacroSourceChangeEvent = {
  sourceKey: "macro_indicators";
  previousSnapshotId: string;
  currentSnapshotId: string;
  changeKey: string;
  changeType: "CELL_CHANGED" | "ROW_ADDED" | "ROW_REMOVED" | "TABLE_ADDED" | "TABLE_REMOVED";
  sectionKey: string | null;
  tableId: string;
  tableKind: string | null;
  rowKey: string | null;
  columnKey: string | null;
  oldValue: string | null;
  newValue: string | null;
  rowData: Record<string, string> | null;
  detectedAt: string;
};

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function slug(value: string) {
  return value
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "unlabelled";
}

function cell(row: MacroSnapshotRow, ...names: string[]) {
  const byLower = new Map(Object.entries(row.cells).map(([key, value]) => [key.toLocaleLowerCase("en-US"), value]));
  for (const name of names) {
    const value = byLower.get(name.toLocaleLowerCase("en-US"));
    if (value !== undefined) return value.trim();
  }
  return "";
}

function usable(value: string) {
  return Boolean(value && !/^(?:--?|—|–|n\/?a|na|pending|tbc)$/i.test(value));
}

function parseCalendarTimestamp(dateValue: string, timeValue: string) {
  const date = dateValue.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})$/);
  const time = timeValue.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!date || !time) return null;
  const month = MONTHS[date[2].toLocaleLowerCase("en-US")];
  if (month === undefined) return null;
  const year = date[3].length === 2 ? 2000 + Number(date[3]) : Number(date[3]);
  const day = Number(date[1]);
  const hour = Number(time[1]);
  const minute = Number(time[2]);
  if (![year, day, hour, minute].every(Number.isFinite) || hour > 23 || minute > 59) return null;
  // The source explicitly labels the column CET. Treat that as literal UTC+01:00
  // rather than silently guessing a daylight-saving timezone.
  return new Date(Date.UTC(year, month, day, hour - 1, minute)).toISOString();
}

function parseMonthPeriod(value: string) {
  const trimmed = value.trim();
  let match = trimmed.match(/^([A-Za-z]{3})[-\s](\d{2}|\d{4})$/);
  if (match) {
    const month = MONTHS[match[1].toLocaleLowerCase("en-US")];
    if (month === undefined) return null;
    const year = match[2].length === 2 ? 2000 + Number(match[2]) : Number(match[2]);
    return `${year}-${String(month + 1).padStart(2, "0")}-01`;
  }
  match = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const month = Number(match[2]);
    if (month >= 1 && month <= 12) return `${match[1]}-${match[2]}-01`;
  }
  return null;
}

function impactLabel(raw: string) {
  const stars = [...raw].filter((character) => character === "★" || character === "*").length;
  if (stars >= 3) return "High";
  if (stars === 2) return "Medium";
  if (stars === 1) return "Low";
  return null;
}

function canonicalEvent(event: string) {
  const value = event.toLocaleLowerCase("en-US");
  const mappings: Array<{ pattern: RegExp; seriesKey: string; label: string }> = [
    { pattern: /\b(?:cpi|consumer price index)\b/, seriesKey: "cpi", label: "Consumer Price Index" },
    { pattern: /\b(?:ppi|producer price index)\b/, seriesKey: "ppi", label: "Producer Price Index" },
    { pattern: /\b(?:non[- ]?farm payrolls?|nfp|employment situation)\b/, seriesKey: "employment", label: "Employment Situation" },
    { pattern: /\bjolts\b/, seriesKey: "jolts", label: "JOLTS Job Openings" },
    { pattern: /\bism\b.*\bmanufactur/, seriesKey: "ism-manufacturing", label: "ISM Manufacturing PMI" },
    { pattern: /\bism\b.*\bservices?\b/, seriesKey: "ism-services", label: "ISM Services PMI" },
    { pattern: /\bretail sales\b/, seriesKey: "retail-sales", label: "Retail Sales" },
  ];
  const matched = mappings.find((mapping) => mapping.pattern.test(value));
  return matched ?? { seriesKey: `macro-indicators-${slug(event)}`, label: event.trim() };
}

function inferredUnit(...values: string[]) {
  if (values.some((value) => /%|\bpercent(?:age)?\b/i.test(value))) return "Percent";
  if (values.some((value) => /\b(?:index|points?)\b/i.test(value))) return "Index";
  return null;
}

function releaseStatus(releaseDate: string, actual: string | null, capturedAt: string): NormalizedMacroRelease["status"] {
  if (actual) return "completed";
  const releaseMs = Date.parse(releaseDate);
  const captureMs = Date.parse(capturedAt);
  if (releaseMs > captureMs + 24 * 60 * 60 * 1_000) return "scheduled";
  if (releaseMs > captureMs) return "pre_release";
  return "released_pending_ingestion";
}

function calendarMetric(table: MacroSnapshotTable, row: MacroSnapshotRow, snapshot: MacroSnapshot, snapshotId: string, sourceUrl: string) {
  const event = cell(row, "Event");
  const date = cell(row, "Date");
  const time = cell(row, "Time (CET)", "Time");
  const releaseDate = parseCalendarTimestamp(date, time);
  if (!event || !releaseDate) return null;
  const canonical = canonicalEvent(event);
  const actualRaw = cell(row, "Actual");
  const forecastRaw = cell(row, "Forecast");
  const previousRaw = cell(row, "Previous");
  const revisedRaw = cell(row, "Revised Previous", "Revised");
  const unit = inferredUnit(actualRaw, forecastRaw, previousRaw, revisedRaw);
  const transformation = economicTransformation({
    series_key: canonical.seriesKey,
    release_name: event,
    category: cell(row, "Category", "Charts") || "Calendar",
    unit,
  });
  const parsedActual = parseEconomicNumber(usable(actualRaw) ? actualRaw : null);
  const parsedForecast = parseEconomicNumber(usable(forecastRaw) ? forecastRaw : null);
  const parsedPrevious = parseEconomicNumber(usable(previousRaw) ? previousRaw : null);
  const parsedRevised = parseEconomicNumber(usable(revisedRaw) ? revisedRaw : null);
  const groupKey = `${canonical.seriesKey}|${releaseDate}`;
  return {
    groupKey,
    canonical,
    event,
    releaseDate,
    releaseTimeLabel: `${date} ${time} CET`,
    referencePeriod: cell(row, "Period", "Reference Period") || null,
    category: cell(row, "Category", "Charts") || "Calendar",
    impact: impactLabel(cell(row, "Imp", "Impact")),
    country: cell(row, "Country", "Region") || null,
    actualRaw: usable(actualRaw) ? actualRaw : null,
    forecastRaw: usable(forecastRaw) ? forecastRaw : null,
    previousRaw: usable(previousRaw) ? previousRaw : null,
    revisedRaw: usable(revisedRaw) ? revisedRaw : null,
    unit,
    metric: {
      releaseGroupKey: groupKey,
      metricKey: `${slug(event)}-${transformation}`,
      label: event,
      transformation,
      unit: parsedActual?.unit || parsedForecast?.unit || parsedPrevious?.unit || unit,
      previous: parsedPrevious?.value ?? null,
      revisedPrevious: parsedRevised?.value ?? null,
      consensus: parsedForecast?.value ?? null,
      actual: parsedActual?.value ?? null,
      sourceUrl,
      retrievedAt: snapshot.capturedAt,
      sourceSnapshotId: snapshotId,
      sourceTableId: table.tableId,
      sourceRowKey: row.key,
      sourceColumn: "Actual",
    } satisfies NormalizedMacroMetric,
    sourceTableId: table.tableId,
    sourceRowKey: row.key,
  };
}

function normalizeCalendar(snapshot: MacroSnapshot, snapshotId: string, sourceUrl: string) {
  const rows = snapshot.tables
    .filter((table) => table.kind === "calendar-events")
    .flatMap((table) => table.rows.map((row) => calendarMetric(table, row, snapshot, snapshotId, sourceUrl)).filter(Boolean));

  const groups = new Map<string, NonNullable<ReturnType<typeof calendarMetric>>[]>();
  for (const row of rows) {
    const bucket = groups.get(row!.groupKey) ?? [];
    bucket.push(row!);
    groups.set(row!.groupKey, bucket);
  }

  const releases: NormalizedMacroRelease[] = [];
  const metrics: NormalizedMacroMetric[] = [];
  for (const [groupKey, group] of groups) {
    const first = group[0];
    const only = group.length === 1 ? first : null;
    const hasActual = group.some((item) => item.actualRaw);
    const units = [...new Set(group.map((item) => item.unit).filter(Boolean))];
    releases.push({
      id: `jina-release:${stableMacroHash(groupKey)}`,
      groupKey,
      seriesKey: first.canonical.seriesKey,
      releaseName: first.canonical.label,
      releaseDate: first.releaseDate,
      releaseTimeLabel: first.releaseTimeLabel,
      referencePeriod: first.referencePeriod,
      frequency: "Unspecified",
      status: releaseStatus(first.releaseDate, hasActual ? "reported" : null, snapshot.capturedAt),
      actual: only?.actualRaw ?? null,
      consensus: only?.forecastRaw ?? null,
      previous: only?.previousRaw ?? null,
      revisedPrevious: only?.revisedRaw ?? null,
      unit: units.length === 1 ? units[0] : null,
      category: first.category,
      impact: group.map((item) => item.impact).find((impact) => impact === "High")
        ?? group.map((item) => item.impact).find((impact) => impact === "Medium")
        ?? first.impact,
      country: first.country,
      sourceUrl,
      sourceSnapshotId: snapshotId,
      sourceTableId: first.sourceTableId,
      sourceRowKey: group.length === 1 ? first.sourceRowKey : null,
    });
    metrics.push(...group.map((item) => item.metric));
  }
  return { releases, metrics };
}

function ismFamily(table: MacroSnapshotTable) {
  const context = (table.contextLabel ?? "").toLocaleLowerCase("en-US");
  if (/manufactur|mfg/.test(context)) return { key: "manufacturing", label: "Manufacturing" };
  if (/services?|non[- ]manufactur/.test(context)) return { key: "services", label: "Services" };
  return { key: "composite", label: "Composite" };
}

function normalizeIsm(snapshot: MacroSnapshot, snapshotId: string, sourceUrl: string) {
  const observations: NormalizedMacroSeriesObservation[] = [];
  for (const table of snapshot.tables.filter((candidate) => candidate.kind === "ism-main")) {
    const family = ismFamily(table);
    for (const row of table.rows) {
      const period = parseMonthPeriod(row.key);
      if (!period) continue;
      for (const [column, raw] of Object.entries(row.cells)) {
        if (column === "__row" || !usable(raw)) continue;
        const parsed = parseEconomicNumber(raw);
        if (!parsed) continue;
        const columnKey = slug(column).replace(/-/g, "_");
        const seriesKey = `ism_${family.key}_${columnKey}`;
        observations.push({
          id: `jina-series:${seriesKey}:${period}`,
          seriesKey,
          seriesId: `macro-indicators:${seriesKey}`,
          seriesName: `ISM ${family.label} ${column}`,
          agency: "Institute for Supply Management",
          observationDate: period,
          value: parsed.value,
          unit: "Index",
          frequency: "Monthly",
          sourceUrl,
          sourceSnapshotId: snapshotId,
          sourceTableId: table.tableId,
          sourceRowKey: row.key,
          sourceColumn: column,
        });
      }
    }
  }
  return observations;
}

export function buildMacroNormalizationPlan(
  snapshot: MacroSnapshot,
  snapshotId: string,
  sourceUrl: string,
): MacroNormalizationPlan {
  if (snapshot.status !== "COMPLETE") {
    return { releases: [], metrics: [], seriesObservations: [], skippedTableIds: snapshot.tables.map((table) => table.tableId) };
  }
  const calendar = normalizeCalendar(snapshot, snapshotId, sourceUrl);
  const seriesObservations = normalizeIsm(snapshot, snapshotId, sourceUrl);
  const normalizedTableIds = new Set([
    ...calendar.releases.map((release) => release.sourceTableId),
    ...seriesObservations.map((observation) => observation.sourceTableId),
  ]);
  return {
    releases: calendar.releases,
    metrics: calendar.metrics,
    seriesObservations,
    skippedTableIds: snapshot.tables.filter((table) => !normalizedTableIds.has(table.tableId)).map((table) => table.tableId),
  };
}

function eventFromChange(
  change: MacroChange,
  previousSnapshotId: string,
  currentSnapshotId: string,
  detectedAt: string,
): MacroSourceChangeEvent {
  const common = {
    sourceKey: "macro_indicators" as const,
    previousSnapshotId,
    currentSnapshotId,
    sectionKey: change.section,
    tableId: change.tableId,
    tableKind: change.kind,
    rowKey: "rowKey" in change ? change.rowKey : null,
    detectedAt,
  };
  const payload = change.type === "CELL_CHANGED"
    ? { columnKey: change.column, oldValue: change.oldValue, newValue: change.newValue, rowData: null }
    : change.type === "ROW_ADDED" || change.type === "ROW_REMOVED"
      ? { columnKey: null, oldValue: null, newValue: null, rowData: change.row }
      : { columnKey: null, oldValue: null, newValue: null, rowData: null };
  const changeKey = stableMacroHash(JSON.stringify({
    type: change.type,
    tableId: change.tableId,
    rowKey: "rowKey" in change ? change.rowKey : null,
    column: change.type === "CELL_CHANGED" ? change.column : null,
    oldValue: change.type === "CELL_CHANGED" ? change.oldValue : null,
    newValue: change.type === "CELL_CHANGED" ? change.newValue : null,
    row: change.type === "ROW_ADDED" || change.type === "ROW_REMOVED" ? change.row : null,
  }));
  return { ...common, ...payload, changeKey, changeType: change.type };
}

export function buildMacroSourceChangeEvents(
  previous: MacroSnapshot | null,
  current: MacroSnapshot,
  previousSnapshotId: string | null,
  currentSnapshotId: string,
): MacroSourceChangeEvent[] {
  if (!previous || !previousSnapshotId || previous.status !== "COMPLETE" || current.status !== "COMPLETE") return [];
  const comparison = compareMacroSnapshots(previous, current);
  const events = comparison.changes.map((change) => eventFromChange(change, previousSnapshotId, currentSnapshotId, current.capturedAt));
  const previousTables = new Map(previous.tables.map((table) => [table.tableId, table]));
  for (const tableId of comparison.missingTableIds) {
    const table = previousTables.get(tableId);
    if (!table) continue;
    const changeKey = stableMacroHash(JSON.stringify({ type: "TABLE_REMOVED", tableId }));
    events.push({
      sourceKey: "macro_indicators",
      previousSnapshotId,
      currentSnapshotId,
      changeKey,
      changeType: "TABLE_REMOVED",
      sectionKey: table.section,
      tableId,
      tableKind: table.kind,
      rowKey: null,
      columnKey: null,
      oldValue: null,
      newValue: null,
      rowData: null,
      detectedAt: current.capturedAt,
    });
  }
  return events;
}

export function mergeSecondaryReleaseCandidate<T extends {
  actual: string | null;
  consensus: string | null;
  previous: string | null;
  revised_previous: string | null;
  unit: string | null;
  country: string | null;
  impact: string | null;
}>(existing: T, candidate: NormalizedMacroRelease) {
  const patch: Record<string, unknown> = {};
  const fill = (field: keyof T, value: unknown) => {
    if ((existing[field] === null || existing[field] === "") && value !== null && value !== "") patch[String(field)] = value;
  };
  fill("actual", candidate.actual);
  fill("consensus", candidate.consensus);
  fill("previous", candidate.previous);
  fill("revised_previous", candidate.revisedPrevious);
  fill("unit", candidate.unit);
  fill("country", candidate.country);
  fill("impact", candidate.impact);
  if (Object.keys(patch).length) {
    patch.source_snapshot_id = candidate.sourceSnapshotId;
    patch.source_table_id = candidate.sourceTableId;
    patch.source_row_key = candidate.sourceRowKey;
  }
  return patch;
}
