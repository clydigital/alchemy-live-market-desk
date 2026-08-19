export const DEFAULT_MACRO_INDICATORS_URL = "https://macro-indicators-a3d.pages.dev/";

export const EXPECTED_MACRO_SECTIONS = [
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

export type MacroSection = (typeof EXPECTED_MACRO_SECTIONS)[number];

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

export type ParsedMacroTable = {
  index: number;
  tableId: string;
  section: MacroSection | null;
  kind: MacroTableKind;
  contextLabel: string | null;
  headers: string[];
  rows: string[][];
  rowCount: number;
  wellFormedRowCount: number;
  raggedRowCount: number;
};

export type MacroSourceAnalysis = {
  contentLength: number;
  sectionsFound: MacroSection[];
  sectionsMissing: MacroSection[];
  tableCount: number;
  tables: ParsedMacroTable[];
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function stableMacroHash(value: string) {
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

function nearestSection(textBeforeTable: string): MacroSection | null {
  let best: { section: MacroSection; index: number } | null = null;
  const lower = textBeforeTable.toLocaleLowerCase("en-US");

  for (const section of EXPECTED_MACRO_SECTIONS) {
    const index = lower.lastIndexOf(section.toLocaleLowerCase("en-US"));
    if (index >= 0 && (!best || index > best.index)) best = { section, index };
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
  fallback: MacroSection | null,
): { section: MacroSection | null; kind: MacroTableKind } {
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
  if (!line || line.length > 120 || line.startsWith("|")) return false;
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
  return stableMacroHash(normalizedHeaders(headers).join("|"));
}

function tableIdentityBase(input: {
  section: MacroSection | null;
  kind: MacroTableKind;
  contextLabel: string | null;
  headers: string[];
}) {
  const section = input.section?.toLocaleLowerCase("en-US") ?? "unknown";
  const signature = headerSignature(input.headers);

  // Dynamic nearby values are diagnostic context only. Known semantic table
  // families must never derive identity from probabilities, timestamps or quotes.
  if (input.kind === "generic") {
    return `${section}:${input.kind}:${slug(input.contextLabel ?? "generic")}:${signature}`;
  }

  return `${section}:${input.kind}:${signature}`;
}

export function parseMacroIndicatorsMarkdown(text: string): ParsedMacroTable[] {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const offsets: number[] = [];
  let runningOffset = 0;

  for (const line of lines) {
    offsets.push(runningOffset);
    runningOffset += line.length + 1;
  }

  const parsed: Array<Omit<ParsedMacroTable, "tableId">> = [];

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
    const classification = classifyTable(headers, nearestSection(before));
    const contextLabel = nearestContextLabel(lines, lineIndex);
    const wellFormedRowCount = rows.filter((row) => row.length === headers.length).length;

    parsed.push({
      index: parsed.length,
      section: classification.section,
      kind: classification.kind,
      contextLabel,
      headers,
      rows,
      rowCount: rows.length,
      wellFormedRowCount,
      raggedRowCount: rows.length - wellFormedRowCount,
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

export function analyzeMacroIndicatorsText(text: string): MacroSourceAnalysis {
  const normalized = text.replace(/\r\n/g, "\n");
  const tables = parseMacroIndicatorsMarkdown(normalized);
  const sectionsFound = EXPECTED_MACRO_SECTIONS.filter((section) => containsToken(normalized, section));
  const sectionsMissing = EXPECTED_MACRO_SECTIONS.filter((section) => !sectionsFound.includes(section));

  return {
    contentLength: normalized.length,
    sectionsFound,
    sectionsMissing,
    tableCount: tables.length,
    tables,
  };
}
