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

type FetchLike = typeof fetch;

type ExpectedSection = (typeof EXPECTED_SECTIONS)[number];
type FocusSection = (typeof FOCUS_SECTIONS)[number];

export type MarkdownTableDiagnostic = {
  index: number;
  section: ExpectedSection | null;
  headers: string[];
  rowCount: number;
  wellFormedRowCount: number;
  raggedRowCount: number;
  firstRow: string[] | null;
  representativeRow: string[] | null;
};

export type FocusSectionSummary = {
  section: FocusSection;
  tableCount: number;
  largestTableRows: number;
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
  tableCatalog: Array<Pick<MarkdownTableDiagnostic, "index" | "section" | "headers" | "rowCount" | "wellFormedRowCount" | "raggedRowCount">>;
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

function containsToken(text: string, token: string) {
  return text.toLocaleLowerCase("en-US").includes(token.toLocaleLowerCase("en-US"));
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
  return headers.map((header) => header.toLocaleLowerCase("en-US").replace(/\s+/g, " ").trim());
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

function classifyTable(headers: string[], fallback: ExpectedSection | null): ExpectedSection | null {
  if (
    hasHeader(headers, "Event") &&
    hasHeader(headers, "Actual") &&
    hasHeader(headers, "Forecast") &&
    hasHeader(headers, "Previous")
  ) {
    return "Calendar";
  }

  if (
    hasHeader(headers, "Instrument") &&
    hasHeaderFragment(headers, "3y %ile") &&
    hasHeaderFragment(headers, "open int")
  ) {
    return "COT";
  }

  if (hasHeader(headers, "Rate") && hasHeader(headers, "Now LIVE")) {
    return "FedWatch";
  }

  if (headers.filter(isMeetingDateHeader).length >= 3) {
    return "FedWatch";
  }

  if (
    hasHeader(headers, "Headline") &&
    hasHeader(headers, "New Ord") &&
    (hasHeader(headers, "Prod/BA") || hasHeader(headers, "Prod")) &&
    hasHeader(headers, "Empl")
  ) {
    return "ISM";
  }

  if (
    hasHeader(headers, "HL") &&
    hasHeader(headers, "NOrd") &&
    (hasHeader(headers, "BusA") || hasHeader(headers, "Prod")) &&
    hasHeader(headers, "Empl") &&
    hasHeader(headers, "Price")
  ) {
    return "ISM";
  }

  return fallback;
}

export function inventoryMarkdownTables(text: string): MarkdownTableDiagnostic[] {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const offsets: number[] = [];
  let runningOffset = 0;

  for (const line of lines) {
    offsets.push(runningOffset);
    runningOffset += line.length + 1;
  }

  const tables: MarkdownTableDiagnostic[] = [];

  for (let i = 0; i < lines.length - 1; i += 1) {
    if (!lines[i]?.trim().startsWith("|") || !isSeparatorRow(lines[i + 1] ?? "")) continue;

    const headers = splitMarkdownRow(lines[i] ?? "");
    const rows: string[][] = [];
    let cursor = i + 2;

    while (cursor < lines.length && lines[cursor]?.trim().startsWith("|")) {
      rows.push(splitMarkdownRow(lines[cursor] ?? ""));
      cursor += 1;
    }

    const before = normalized.slice(0, offsets[i] ?? 0);
    const fallbackSection = nearestSection(before);
    const wellFormedRows = rows.filter((row) => row.length === headers.length);

    tables.push({
      index: tables.length,
      section: classifyTable(headers, fallbackSection),
      headers,
      rowCount: rows.length,
      wellFormedRowCount: wellFormedRows.length,
      raggedRowCount: rows.length - wellFormedRows.length,
      firstRow: rows[0] ?? null,
      representativeRow: wellFormedRows[0] ?? null,
    });

    i = cursor - 1;
  }

  return tables;
}

function summarizeFocusSection(section: FocusSection, tables: MarkdownTableDiagnostic[]): FocusSectionSummary {
  const matches = tables.filter((table) => table.section === section);
  const representative = [...matches].sort((a, b) => b.rowCount - a.rowCount)[0] ?? null;

  return {
    section,
    tableCount: matches.length,
    largestTableRows: representative?.rowCount ?? 0,
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
    tableCatalog: tables.slice(0, 100).map(({ index, section, headers, rowCount, wellFormedRowCount, raggedRowCount }) => ({
      index,
      section,
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

export async function fetchMacroSourceDiagnostic(input: {
  sourceUrl?: string;
  jinaApiKey?: string | null;
  fetchImpl?: FetchLike;
} = {}): Promise<MacroSourceDiagnosticResult> {
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
    analysis: analyzeMacroSourceText(text),
  };
}
