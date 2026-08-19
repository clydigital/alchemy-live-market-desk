export const DEFAULT_MACRO_SOURCE_URL = "https://macro-indicators-a3d.pages.dev/";

const EXPECTED_SECTIONS = [
  "Calendar",
  "ISM",
  "NFIB",
  "Housing",
  "Energy",
  "Bonds",
  "Retail",
  "Employment",
  "Inflation",
  "FedWatch",
  "Credit",
  "COT",
  "Commodities",
] as const;

const CALENDAR_FIELDS = ["Actual", "Surprise", "Forecast", "Previous"] as const;
const FOCUS_SECTIONS = ["Calendar", "ISM", "FedWatch", "COT", "Inflation"] as const;
const REQUIRED_TABLE_KINDS = ["calendar-events", "ism-main", "fedwatch", "cot"] as const;
const VOLATILE_HEADERS = new Set(["", "☆", "countdown", "charts"]);

type FetchLike = typeof fetch;

type ExpectedSection = (typeof EXPECTED_SECTIONS)[number];
type FocusSection = (typeof FOCUS_SECTIONS)[number];
export type MacroTableKind =
  | "calendar-events"
  | "ism-main"
  | "ism-breadth"
  | "fedwatch-matrix"
  | "fedwatch-rate-path"
  | "cot-legacy"
  | "cot-disaggregated"
  | "cot-tff"
  | "history-matrix"
  | "generic";

type RequiredTableKind = (typeof REQUIRED_TABLE_KINDS)[number];

export type MarkdownTableDiagnostic = {
  index: number;
  tableId: string;
  section: ExpectedSection | null;
  kind: MacroTableKind;
  contextLabel: string | null;
  headers: string[];
  rowCount: number;
  wellFormedRowCount: number;
  raggedRowCount: number;
  firstRow: string[] | null;
  representativeRow: string[] | null;
};

type ParsedMarkdownTable = MarkdownTableDiagnostic & {
  rows: string[][];
};

export type FocusSectionSummary = {
  section: FocusSection;
  tableCount: number;
  largestTableRows: number;
  representativeTableId: string | null;
  representativeHeaders: string[] | null;
  representativeRow: string[] | null;
  representativeRowMatchesHeaders: boolean;
};

export type MacroSourceTextAnalysis = {
  contentLength: number;
  sectionsFound: string[];
  sectionsMissing: string[];
  calendarFieldsFound: string[];
  calendarFieldsMissing: string[];
  hasMeaningfulContent: boolean;
  markdownTableCount: number;
  tableCatalog: Array<Pick<
    MarkdownTableDiagnostic,
    | "index"
    | "tableId"
    | "section"
    | "kind"
    | "contextLabel"
    | "headers"
    | "rowCount"
    | "wellFormedRowCount"
    | "raggedRowCount"
  >>;
  focusTables: MarkdownTableDiagnostic[];
  focusSectionSummary: FocusSectionSummary[];
  sample: string;
};

export type MacroSourceDiagnosticResult = {
  ok: boolean;
  sourceUrl: string;
  readerUrl: string;
  readerStatus: number;
  readerStatusText: string;
  usedAuthenticatedReader: boolean;
  analysis: MacroSourceTextAnalysis;
};

export type MacroSourceFetchResult = {
  ok: boolean;
  sourceUrl: string;
  readerUrl: string;
  readerStatus: number;
  readerStatusText: string;
  usedAuthenticatedReader: boolean;
  text: string;
};

export type MacroSnapshotRow = {
  key: string;
  cells: Record<string, string>;
};

export type MacroSnapshotTable = {
  tableId: string;
  section: ExpectedSection | null;
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
  missingSections: string[];
  missingRequiredTableKinds: RequiredTableKind[];
  tables: MacroSnapshotTable[];
};

export type MacroChange =
  | {
      type: "CELL_CHANGED";
      tableId: string;
      section: ExpectedSection | null;
      kind: MacroTableKind;
      rowKey: string;
      column: string;
      oldValue: string;
      newValue: string;
    }
  | {
      type: "ROW_ADDED" | "ROW_REMOVED";
      tableId: string;
      section: ExpectedSection | null;
      kind: MacroTableKind;
      rowKey: string;
      row: Record<string, string>;
    }
  | {
      type: "TABLE_ADDED";
      tableId: string;
      section: ExpectedSection | null;
      kind: MacroTableKind;
    };

export type MacroSnapshotComparison = {
  status: "COMPLETE" | "PARTIAL";
  previousFingerprint: string;
  currentFingerprint: string;
  changedTableCount: number;
  changeCount: number;
  missingSections: string[];
  missingRequiredTableKinds: RequiredTableKind[];
  missingTableIds: string[];
  changes: MacroChange[];
};

function containsToken(text: string, token: string) {
  return text.toLocaleLowerCase("en-US").includes(token.toLocaleLowerCase("en-US"));
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function slug(value: string) {
  return normalizeWhitespace(value)
    .toLocaleLowerCase("en-US")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "unlabelled";
}

function splitMarkdownRow(line: string) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return [];
  return trimmed
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isSeparatorRow(line: string) {
  const cells = splitMarkdownRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function nearestSection(textBeforeTable: string): ExpectedSection | null {
  let best: { section: ExpectedSection; index: number } | null = null;
  const lower = textBeforeTable.toLocaleLowerCase("en-US");

  for (const section of EXPECTED_SECTIONS) {
    const index = lower.lastIndexOf(section.toLocaleLowerCase("en-US"));
    if (index >= 0 && (!best || index > best.index)) {
      best = { section, index };
    }
  }

  return best?.section ?? null;
}

function normalizedHeaders(headers: string[]) {
  return headers.map((header) => normalizeWhitespace(header).toLocaleLowerCase("en-US"));
}

function hasHeader(headers: string[], token: string) {
  return normalizedHeaders(headers).some((header) => header === token.toLocaleLowerCase("en-US"));
}

function hasHeaderFragment(headers: string[], fragment: string) {
  return normalizedHeaders(headers).some((header) => header.includes(fragment.toLocaleLowerCase("en-US")));
}

function isMeetingDateHeader(value: string) {
  return /^[A-Z][a-z]{2}\s+\d{1,2}\s+'\d{2}$/.test(value.trim());
}

function isMonthHeader(value: string) {
  return /^[A-Z][a-z]{2}-\d{2}$/.test(value.trim());
}

function classifyTable(
  headers: string[],
  fallback: ExpectedSection | null,
): { section: ExpectedSection | null; kind: MacroTableKind } {
  if (
    hasHeader(headers, "Event") &&
    hasHeader(headers, "Actual") &&
    hasHeader(headers, "Forecast") &&
    hasHeader(headers, "Previous")
  ) {
    return { section: "Calendar", kind: "calendar-events" };
  }

  if (
    hasHeader(headers, "Instrument") &&
    hasHeaderFragment(headers, "3y %ile") &&
    hasHeaderFragment(headers, "open int")
  ) {
    if (hasHeaderFragment(headers, "producer/merchant")) {
      return { section: "COT", kind: "cot-disaggregated" };
    }
    if (hasHeaderFragment(headers, "dealer/intermediary")) {
      return { section: "COT", kind: "cot-tff" };
    }
    return { section: "COT", kind: "cot-legacy" };
  }

  if (hasHeader(headers, "Rate") && hasHeader(headers, "Now LIVE")) {
    return { section: "FedWatch", kind: "fedwatch-rate-path" };
  }

  if (headers.filter(isMeetingDateHeader).length >= 3) {
    return { section: "FedWatch", kind: "fedwatch-matrix" };
  }

  if (
    hasHeader(headers, "Headline") &&
    hasHeader(headers, "New Ord") &&
    (hasHeader(headers, "Prod/BA") || hasHeader(headers, "Prod")) &&
    hasHeader(headers, "Empl")
  ) {
    return { section: "ISM", kind: "ism-main" };
  }

  if (
    hasHeader(headers, "HL") &&
    hasHeader(headers, "NOrd") &&
    (hasHeader(headers, "BusA") || hasHeader(headers, "Prod")) &&
    hasHeader(headers, "Empl") &&
    hasHeader(headers, "Price")
  ) {
    return { section: "ISM", kind: "ism-breadth" };
  }

  if (hasHeader(headers, "Series") && headers.filter(isMonthHeader).length >= 5) {
    return { section: fallback, kind: "history-matrix" };
  }

  return { section: fallback, kind: "generic" };
}

function cleanContextLine(value: string) {
  return normalizeWhitespace(
    value
      .replace(/^#{1,6}\s+/, "")
      .replace(/^\*+|\*+$/g, "")
      .replace(/^_+|_+$/g, ""),
  );
}

function isUsefulContextLine(value: string) {
  const line = cleanContextLine(value);
  if (!line || line.length > 120) return false;
  if (line.startsWith("|")) return false;
  if (/^(Title:|URL Source:|Markdown Content:|Updated:)/i.test(line)) return false;
  if (/^Macro Indicators/i.test(line)) return false;
  if (/^\[?(Calendar|ISM|NFIB|Housing|Energy|Bonds|Retail|Employment|Inflation|FedWatch|Credit|COT|Commodities)\]?\s*\|?$/i.test(line)) {
    return false;
  }
  return true;
}

function nearestContextLabel(lines: string[], tableLineIndex: number) {
  for (let offset = 1; offset <= 30 && tableLineIndex - offset >= 0; offset += 1) {
    const raw = lines[tableLineIndex - offset] ?? "";
    if (/^#{1,6}\s+\S/.test(raw.trim())) return cleanContextLine(raw);
  }

  for (let offset = 1; offset <= 12 && tableLineIndex - offset >= 0; offset += 1) {
    const raw = lines[tableLineIndex - offset] ?? "";
    if (isUsefulContextLine(raw)) return cleanContextLine(raw);
  }

  return null;
}

function headerSignature(headers: string[]) {
  return stableHash(normalizedHeaders(headers).join("|"));
}

function tableIdentityBase(input: {
  section: ExpectedSection | null;
  kind: MacroTableKind;
  contextLabel: string | null;
  headers: string[];
}) {
  const section = input.section?.toLocaleLowerCase("en-US") ?? "unknown";
  const signature = headerSignature(input.headers);

  // Live values, timestamps, quotes and row counts can appear immediately before a table.
  // They are useful diagnostics but must never become part of canonical table identity.
  // Only generic tables use a context slug because their schemas have no stronger semantic role.
  if (input.kind === "generic") {
    return `${section}:${input.kind}:${slug(input.contextLabel ?? "generic")}:${signature}`;
  }

  return `${section}:${input.kind}:${signature}`;
}

function parseMarkdownTables(text: string): ParsedMarkdownTable[] {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const offsets: number[] = [];
  let runningOffset = 0;

  for (const line of lines) {
    offsets.push(runningOffset);
    runningOffset += line.length + 1;
  }

  const parsed: Array<Omit<ParsedMarkdownTable, "tableId">> = [];

  for (let lineIndex = 0; lineIndex < lines.length - 1; lineIndex += 1) {
    if (!lines[lineIndex]?.trim().startsWith("|") || !isSeparatorRow(lines[lineIndex + 1] ?? "")) {
      continue;
    }

    const headers = splitMarkdownRow(lines[lineIndex] ?? "");
    const rows: string[][] = [];
    let cursor = lineIndex + 2;

    while (cursor < lines.length && lines[cursor]?.trim().startsWith("|")) {
      rows.push(splitMarkdownRow(lines[cursor] ?? ""));
      cursor += 1;
    }

    const before = normalized.slice(0, offsets[lineIndex] ?? 0);
    const fallbackSection = nearestSection(before);
    const classification = classifyTable(headers, fallbackSection);
    const contextLabel = nearestContextLabel(lines, lineIndex);
    const wellFormedRows = rows.filter((row) => row.length === headers.length);

    parsed.push({
      index: parsed.length,
      section: classification.section,
      kind: classification.kind,
      contextLabel,
      headers,
      rowCount: rows.length,
      wellFormedRowCount: wellFormedRows.length,
      raggedRowCount: rows.length - wellFormedRows.length,
      firstRow: rows[0] ?? null,
      representativeRow: wellFormedRows[0] ?? null,
      rows,
    });

    lineIndex = cursor - 1;
  }

  const collisions = new Map<string, number>();
  return parsed.map((table) => {
    const base = tableIdentityBase(table);
    const occurrence = (collisions.get(base) ?? 0) + 1;
    collisions.set(base, occurrence);
    return {
      ...table,
      tableId: occurrence === 1 ? base : `${base}:${occurrence}`,
    };
  });
}

export function inventoryMarkdownTables(text: string): MarkdownTableDiagnostic[] {
  return parseMarkdownTables(text).map(({ rows: _rows, ...diagnostic }) => diagnostic);
}

function summarizeFocusSection(section: FocusSection, tables: MarkdownTableDiagnostic[]): FocusSectionSummary {
  const matches = tables.filter((table) => table.section === section);
  const representative = [...matches].sort((a, b) => b.rowCount - a.rowCount)[0] ?? null;

  return {
    section,
    tableCount: matches.length,
    largestTableRows: representative?.rowCount ?? 0,
    representativeTableId: representative?.tableId ?? null,
    representativeHeaders: representative?.headers ?? null,
    representativeRow: representative?.representativeRow ?? null,
    representativeRowMatchesHeaders: Boolean(
      representative?.representativeRow &&
      representative.representativeRow.length === representative.headers.length,
    ),
  };
}

export function analyzeMacroSourceText(text: string): MacroSourceTextAnalysis {
  const normalized = text.replace(/\r\n/g, "\n");
  const sectionsFound = EXPECTED_SECTIONS.filter((section) => containsToken(normalized, section));
  const calendarFieldsFound = CALENDAR_FIELDS.filter((field) => containsToken(normalized, field));
  const tables = inventoryMarkdownTables(normalized);
  const focusTables = tables.filter((table) =>
    table.section !== null && FOCUS_SECTIONS.includes(table.section as FocusSection)
  );

  return {
    contentLength: normalized.length,
    sectionsFound: [...sectionsFound],
    sectionsMissing: EXPECTED_SECTIONS.filter((section) => !sectionsFound.includes(section)),
    calendarFieldsFound: [...calendarFieldsFound],
    calendarFieldsMissing: CALENDAR_FIELDS.filter((field) => !calendarFieldsFound.includes(field)),
    hasMeaningfulContent: normalized.trim().length >= 500,
    markdownTableCount: tables.length,
    tableCatalog: tables.slice(0, 100).map(({
      index,
      tableId,
      section,
      kind,
      contextLabel,
      headers,
      rowCount,
      wellFormedRowCount,
      raggedRowCount,
    }) => ({
      index,
      tableId,
      section,
      kind,
      contextLabel,
      headers,
      rowCount,
      wellFormedRowCount,
      raggedRowCount,
    })),
    focusTables: focusTables.slice(0, 40),
    focusSectionSummary: FOCUS_SECTIONS.map((section) => summarizeFocusSection(section, tables)),
    sample: normalized.slice(0, 4_000),
  };
}

function plainMarkdownCell(value: string) {
  return normalizeWhitespace(
    value.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, (_match, label: string, href: string) => `${label} <${href}>`),
  );
}

function headerKey(header: string, index: number) {
  const normalized = normalizeWhitespace(header);
  return normalized || `column_${index}`;
}

function isVolatileHeader(header: string) {
  return VOLATILE_HEADERS.has(normalizeWhitespace(header).toLocaleLowerCase("en-US"));
}

function rowIdentity(table: ParsedMarkdownTable, row: string[], index: number, inheritedDate: string) {
  const headers = table.headers.map((header) => normalizeWhitespace(header).toLocaleLowerCase("en-US"));
  const get = (name: string) => {
    const position = headers.indexOf(name.toLocaleLowerCase("en-US"));
    return position >= 0 ? plainMarkdownCell(row[position] ?? "") : "";
  };

  if (table.kind === "calendar-events") {
    const date = get("Date") || inheritedDate;
    const time = get("Time (CET)");
    const event = get("Event");
    return `${date}|${time}|${event}`;
  }

  const first = plainMarkdownCell(row[0] ?? "");
  return first || `row_${index + 1}`;
}

function snapshotRows(table: ParsedMarkdownTable): MacroSnapshotRow[] {
  const rows = table.rows.filter((row) => row.length === table.headers.length);
  const duplicateKeys = new Map<string, number>();
  let inheritedDate = "";
  const dateIndex = normalizedHeaders(table.headers).indexOf("date");

  return rows.map((row, index) => {
    if (dateIndex >= 0 && normalizeWhitespace(row[dateIndex] ?? "")) {
      inheritedDate = plainMarkdownCell(row[dateIndex] ?? "");
    }

    const baseKey = rowIdentity(table, row, index, inheritedDate);
    const occurrence = (duplicateKeys.get(baseKey) ?? 0) + 1;
    duplicateKeys.set(baseKey, occurrence);
    const key = occurrence === 1 ? baseKey : `${baseKey}#${occurrence}`;

    const cells: Record<string, string> = {};
    table.headers.forEach((header, columnIndex) => {
      if (isVolatileHeader(header)) return;
      cells[headerKey(header, columnIndex)] = plainMarkdownCell(row[columnIndex] ?? "");
    });

    return { key, cells };
  });
}

function requiredKindPresent(kind: RequiredTableKind, tables: ParsedMarkdownTable[]) {
  switch (kind) {
    case "calendar-events":
      return tables.some((table) => table.kind === "calendar-events");
    case "ism-main":
      return tables.some((table) => table.kind === "ism-main");
    case "fedwatch":
      return tables.some((table) => table.kind === "fedwatch-matrix" || table.kind === "fedwatch-rate-path");
    case "cot":
      return tables.some((table) => table.kind.startsWith("cot-"));
  }
}

export function buildMacroSnapshot(text: string, capturedAt = new Date().toISOString()): MacroSnapshot {
  const normalized = text.replace(/\r\n/g, "\n");
  const tables = parseMarkdownTables(normalized);
  const missingSections = EXPECTED_SECTIONS.filter((section) => !containsToken(normalized, section));
  const missingRequiredTableKinds = REQUIRED_TABLE_KINDS.filter((kind) => !requiredKindPresent(kind, tables));

  const snapshotTables = tables.map<MacroSnapshotTable>((table) => {
    const rows = snapshotRows(table);
    const fingerprint = stableHash(JSON.stringify({
      tableId: table.tableId,
      headers: table.headers.filter((header) => !isVolatileHeader(header)),
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
  });

  const status = missingSections.length === 0 && missingRequiredTableKinds.length === 0
    ? "COMPLETE"
    : "PARTIAL";
  const fingerprint = stableHash(
    snapshotTables
      .map((table) => `${table.tableId}:${table.fingerprint}`)
      .sort()
      .join("|"),
  );

  return {
    status,
    capturedAt,
    fingerprint,
    tableCount: snapshotTables.length,
    missingSections: [...missingSections],
    missingRequiredTableKinds: [...missingRequiredTableKinds],
    tables: snapshotTables,
  };
}

function tableMap(snapshot: MacroSnapshot) {
  return new Map(snapshot.tables.map((table) => [table.tableId, table]));
}

function rowMap(table: MacroSnapshotTable) {
  return new Map(table.rows.map((row) => [row.key, row]));
}

function changedColumns(previous: MacroSnapshotRow, current: MacroSnapshotRow) {
  const columns = new Set([...Object.keys(previous.cells), ...Object.keys(current.cells)]);
  return [...columns]
    .sort()
    .filter((column) => (previous.cells[column] ?? "") !== (current.cells[column] ?? ""));
}

export function compareMacroSnapshots(
  previous: MacroSnapshot,
  current: MacroSnapshot,
): MacroSnapshotComparison {
  const previousTables = tableMap(previous);
  const currentTables = tableMap(current);
  const missingTableIds = [...previousTables.keys()]
    .filter((tableId) => !currentTables.has(tableId))
    .sort();
  const comparisonStatus = current.status === "PARTIAL" || missingTableIds.length > 0
    ? "PARTIAL"
    : "COMPLETE";
  const changes: MacroChange[] = [];
  const changedTableIds = new Set<string>();

  for (const currentTable of current.tables) {
    const previousTable = previousTables.get(currentTable.tableId);
    if (!previousTable) {
      changes.push({
        type: "TABLE_ADDED",
        tableId: currentTable.tableId,
        section: currentTable.section,
        kind: currentTable.kind,
      });
      changedTableIds.add(currentTable.tableId);
      continue;
    }

    if (previousTable.fingerprint === currentTable.fingerprint) continue;

    const previousRows = rowMap(previousTable);
    const currentRows = rowMap(currentTable);

    for (const currentRow of currentTable.rows) {
      const previousRow = previousRows.get(currentRow.key);
      if (!previousRow) {
        changes.push({
          type: "ROW_ADDED",
          tableId: currentTable.tableId,
          section: currentTable.section,
          kind: currentTable.kind,
          rowKey: currentRow.key,
          row: currentRow.cells,
        });
        changedTableIds.add(currentTable.tableId);
        continue;
      }

      for (const column of changedColumns(previousRow, currentRow)) {
        changes.push({
          type: "CELL_CHANGED",
          tableId: currentTable.tableId,
          section: currentTable.section,
          kind: currentTable.kind,
          rowKey: currentRow.key,
          column,
          oldValue: previousRow.cells[column] ?? "",
          newValue: currentRow.cells[column] ?? "",
        });
        changedTableIds.add(currentTable.tableId);
      }
    }

    if (comparisonStatus === "COMPLETE") {
      for (const previousRow of previousTable.rows) {
        if (currentRows.has(previousRow.key)) continue;
        changes.push({
          type: "ROW_REMOVED",
          tableId: currentTable.tableId,
          section: currentTable.section,
          kind: currentTable.kind,
          rowKey: previousRow.key,
          row: previousRow.cells,
        });
        changedTableIds.add(currentTable.tableId);
      }
    }
  }

  return {
    status: comparisonStatus,
    previousFingerprint: previous.fingerprint,
    currentFingerprint: current.fingerprint,
    changedTableCount: changedTableIds.size,
    changeCount: changes.length,
    missingSections: current.missingSections,
    missingRequiredTableKinds: current.missingRequiredTableKinds,
    missingTableIds,
    changes,
  };
}

export function summarizeMacroSnapshot(snapshot: MacroSnapshot) {
  return {
    status: snapshot.status,
    capturedAt: snapshot.capturedAt,
    fingerprint: snapshot.fingerprint,
    tableCount: snapshot.tableCount,
    missingSections: snapshot.missingSections,
    missingRequiredTableKinds: snapshot.missingRequiredTableKinds,
    tableIdentities: snapshot.tables.map((table) => ({
      tableId: table.tableId,
      section: table.section,
      kind: table.kind,
      contextLabel: table.contextLabel,
      rowCount: table.rows.length,
      fingerprint: table.fingerprint,
    })),
  };
}

export async function fetchMacroSourceText(input: {
  sourceUrl?: string;
  jinaApiKey?: string | null;
  fetchImpl?: FetchLike;
} = {}): Promise<MacroSourceFetchResult> {
  const sourceUrl = input.sourceUrl?.trim() || DEFAULT_MACRO_SOURCE_URL;
  const readerUrl = `https://r.jina.ai/${sourceUrl}`;
  const jinaApiKey = input.jinaApiKey?.trim();
  const fetchImpl = input.fetchImpl ?? fetch;

  const headers = new Headers({
    Accept: "text/plain, text/markdown;q=0.9, */*;q=0.1",
    "X-Return-Format": "markdown",
  });
  if (jinaApiKey) headers.set("Authorization", `Bearer ${jinaApiKey}`);

  const response = await fetchImpl(readerUrl, {
    method: "GET",
    headers,
    cache: "no-store",
  });
  const text = await response.text();

  return {
    ok: response.ok,
    sourceUrl,
    readerUrl,
    readerStatus: response.status,
    readerStatusText: response.statusText,
    usedAuthenticatedReader: Boolean(jinaApiKey),
    text,
  };
}

export async function fetchMacroSourceDiagnostic(input: {
  sourceUrl?: string;
  jinaApiKey?: string | null;
  fetchImpl?: FetchLike;
} = {}): Promise<MacroSourceDiagnosticResult> {
  const result = await fetchMacroSourceText(input);
  return {
    ok: result.ok,
    sourceUrl: result.sourceUrl,
    readerUrl: result.readerUrl,
    readerStatus: result.readerStatus,
    readerStatusText: result.readerStatusText,
    usedAuthenticatedReader: result.usedAuthenticatedReader,
    analysis: analyzeMacroSourceText(result.text),
  };
}
