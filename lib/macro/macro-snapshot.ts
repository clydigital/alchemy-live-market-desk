import {
  EXPECTED_MACRO_SECTIONS,
  parseMacroIndicatorsMarkdown,
  stableMacroHash,
  type MacroSection,
  type MacroTableKind,
  type ParsedMacroTable,
} from "./macro-indicators-source.ts";

export type RequiredMacroTableFamily = "calendar-events" | "ism-main" | "fedwatch" | "cot";

export type MacroSnapshotRow = {
  key: string;
  cells: Record<string, string>;
};

export type MacroSnapshotTable = {
  tableId: string;
  section: MacroSection | null;
  kind: MacroTableKind;
  contextLabel: string | null;
  headers: string[];
  rows: MacroSnapshotRow[];
  fingerprint: string;
};

export type MacroSnapshot = {
  status: "COMPLETE" | "PARTIAL";
  capturedAt: string;
  fingerprint: string;
  tableCount: number;
  missingSections: MacroSection[];
  missingRequiredTableFamilies: RequiredMacroTableFamily[];
  tables: MacroSnapshotTable[];
};

const REQUIRED_TABLE_FAMILIES: RequiredMacroTableFamily[] = [
  "calendar-events",
  "ism-main",
  "fedwatch",
  "cot",
];

const VOLATILE_HEADERS = new Set(["☆", "countdown", "charts"]);

function normalizedHeader(value: string) {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("en-US");
}

function canonicalColumnKeys(headers: string[]) {
  const seen = new Map<string, number>();
  return headers.map((header, index) => {
    const normalized = normalizedHeader(header);
    if (!normalized && index === 0) return "__row";
    if (!normalized || VOLATILE_HEADERS.has(normalized)) return null;

    const base = header.replace(/\s+/g, " ").trim();
    const occurrence = (seen.get(base) ?? 0) + 1;
    seen.set(base, occurrence);
    return occurrence === 1 ? base : `${base}#${occurrence}`;
  });
}

function rowCells(table: ParsedMacroTable, row: string[]) {
  const keys = canonicalColumnKeys(table.headers);
  const cells: Record<string, string> = {};

  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if (!key) continue;
    cells[key] = row[index] ?? "";
  }

  return cells;
}

function firstNonEmpty(...values: Array<string | undefined>) {
  return values.find((value) => value?.trim())?.trim() ?? "";
}

function rowKeyFor(table: ParsedMacroTable, cells: Record<string, string>) {
  if (table.kind === "calendar-events") {
    const date = firstNonEmpty(cells.Date, cells.date);
    const time = firstNonEmpty(cells["Time (CET)"], cells.Time, cells.time);
    const event = firstNonEmpty(cells.Event, cells.event);
    if (date || time || event) return [date, time, event].join("|");
  }

  if (table.kind.startsWith("ism-") || table.kind === "history-matrix") {
    const period = firstNonEmpty(cells.__row, cells.Series);
    if (period) return period;
  }

  if (table.kind.startsWith("fedwatch-")) {
    const rate = firstNonEmpty(cells.Rate, cells.__row);
    if (rate) return rate;
  }

  if (table.kind.startsWith("cot-")) {
    const instrument = firstNonEmpty(cells.Instrument, cells.__row);
    if (instrument) return instrument;
  }

  const preferred = firstNonEmpty(cells.__row, cells.Series, cells.Event, cells.Instrument, cells.Rate);
  if (preferred) return preferred;

  return stableMacroHash(JSON.stringify(cells));
}

function snapshotRows(table: ParsedMacroTable) {
  const collisions = new Map<string, number>();
  const rows: MacroSnapshotRow[] = [];

  for (const rawRow of table.rows) {
    // Ragged rows in COT are structural category separators, not observations.
    if (rawRow.length !== table.headers.length) continue;

    const cells = rowCells(table, rawRow);
    const baseKey = rowKeyFor(table, cells);
    const occurrence = (collisions.get(baseKey) ?? 0) + 1;
    collisions.set(baseKey, occurrence);
    rows.push({
      key: occurrence === 1 ? baseKey : `${baseKey}:${occurrence}`,
      cells,
    });
  }

  return rows;
}

function hasRequiredFamily(tables: ParsedMacroTable[], family: RequiredMacroTableFamily) {
  if (family === "calendar-events") return tables.some((table) => table.kind === "calendar-events");
  if (family === "ism-main") return tables.some((table) => table.kind === "ism-main");
  if (family === "fedwatch") return tables.some((table) => table.kind.startsWith("fedwatch-"));
  return tables.some((table) => table.kind.startsWith("cot-"));
}

function snapshotTable(table: ParsedMacroTable): MacroSnapshotTable {
  const rows = snapshotRows(table);
  const fingerprint = stableMacroHash(JSON.stringify({
    tableId: table.tableId,
    headers: table.headers,
    rows,
  }));

  return {
    tableId: table.tableId,
    section: table.section,
    kind: table.kind,
    contextLabel: table.contextLabel,
    headers: table.headers,
    rows,
    fingerprint,
  };
}

export function buildMacroSnapshot(text: string, capturedAt = new Date().toISOString()): MacroSnapshot {
  const normalized = text.replace(/\r\n/g, "\n");
  const parsedTables = parseMacroIndicatorsMarkdown(normalized);
  const missingSections = EXPECTED_MACRO_SECTIONS.filter(
    (section) => !normalized.toLocaleLowerCase("en-US").includes(section.toLocaleLowerCase("en-US")),
  );
  const missingRequiredTableFamilies = REQUIRED_TABLE_FAMILIES.filter(
    (family) => !hasRequiredFamily(parsedTables, family),
  );
  const tables = parsedTables.map(snapshotTable);
  const status = missingSections.length || missingRequiredTableFamilies.length ? "PARTIAL" : "COMPLETE";
  const fingerprint = stableMacroHash(JSON.stringify({
    status,
    missingSections,
    missingRequiredTableFamilies,
    tables: tables.map((table) => ({ tableId: table.tableId, fingerprint: table.fingerprint })),
  }));

  return {
    status,
    capturedAt,
    fingerprint,
    tableCount: tables.length,
    missingSections,
    missingRequiredTableFamilies,
    tables,
  };
}
