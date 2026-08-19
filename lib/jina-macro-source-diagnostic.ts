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

type FetchLike = typeof fetch;

export type MacroSourceTextAnalysis = {
  contentLength: number;
  sectionsFound: string[];
  sectionsMissing: string[];
  calendarFieldsFound: string[];
  calendarFieldsMissing: string[];
  hasMeaningfulContent: boolean;
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
  return new RegExp(`(^|\\W)${token.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}(?=\\W|$)`, "i").test(text);
}

export function analyzeMacroSourceText(text: string): MacroSourceTextAnalysis {
  const normalized = text.replace(/\r\n/g, "\n");
  const sectionsFound = EXPECTED_SECTIONS.filter((section) => containsToken(normalized, section));
  const calendarFieldsFound = CALENDAR_FIELDS.filter((field) => containsToken(normalized, field));

  return {
    contentLength: normalized.length,
    sectionsFound: [...sectionsFound],
    sectionsMissing: EXPECTED_SECTIONS.filter((section) => !sectionsFound.includes(section)),
    calendarFieldsFound: [...calendarFieldsFound],
    calendarFieldsMissing: CALENDAR_FIELDS.filter((field) => !calendarFieldsFound.includes(field)),
    hasMeaningfulContent: normalized.trim().length >= 500,
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
