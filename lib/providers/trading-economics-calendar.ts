export const TRADING_ECONOMICS_US_CALENDAR_ROUTE =
  "https://api.tradingeconomics.com/calendar/country/united%20states";

export type TradingEconomicsCalendarEvent = {
  calendarId: string;
  date: string;
  country: string;
  category: string;
  event: string;
  reference: string | null;
  source: string | null;
  sourceUrl: string | null;
  actual: string | null;
  previous: string | null;
  consensus: string | null;
  teForecast: string | null;
  importance: number | null;
  lastUpdate: string | null;
  url: string | null;
  parsedActual: number | null;
  parsedPrevious: number | null;
  parsedConsensus: number | null;
  surprise: number | null;
};

export type TradingEconomicsUsCalendarSnapshot = {
  state: "ready" | "unconfigured" | "unavailable";
  asOf: string | null;
  retrievedAt: string | null;
  events: TradingEconomicsCalendarEvent[];
  sourceName: "Trading Economics";
  sourceUrl: string;
  note: string | null;
};

type TradingEconomicsRawEvent = {
  CalendarId?: unknown;
  Date?: unknown;
  Country?: unknown;
  Category?: unknown;
  Event?: unknown;
  Reference?: unknown;
  Source?: unknown;
  SourceURL?: unknown;
  Actual?: unknown;
  Previous?: unknown;
  Forecast?: unknown;
  TEForecast?: unknown;
  Importance?: unknown;
  LastUpdate?: unknown;
  URL?: unknown;
};

function stringValue(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isoTimestamp(value: unknown): string | null {
  const text = stringValue(value);
  if (!text) return null;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

export function parseTradingEconomicsNumber(value: unknown): number | null {
  const text = stringValue(value);
  if (!text) return null;

  const normalized = text
    .replace(/,/g, "")
    .replace(/[−–—]/g, "-")
    .replace(/\s+/g, "")
    .toUpperCase();

  const match = normalized.match(/[-+]?\d+(?:\.\d+)?/);
  if (!match) return null;

  const base = Number(match[0]);
  if (!Number.isFinite(base)) return null;

  const suffixMatch = normalized.match(/[-+]?\d+(?:\.\d+)?([KMBT])(?:[^A-Z]|$)/);
  const multiplier =
    suffixMatch?.[1] === "K" ? 1_000 :
    suffixMatch?.[1] === "M" ? 1_000_000 :
    suffixMatch?.[1] === "B" ? 1_000_000_000 :
    suffixMatch?.[1] === "T" ? 1_000_000_000_000 :
    1;

  return base * multiplier;
}

function importanceValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function buildTradingEconomicsUsCalendarUrl(input: {
  from: Date;
  to: Date;
  importance?: number;
}) {
  const url = new URL(
    `${TRADING_ECONOMICS_US_CALENDAR_ROUTE}/${dateOnly(input.from)}/${dateOnly(input.to)}`,
  );
  url.searchParams.set("importance", String(input.importance ?? 3));
  url.searchParams.set("f", "json");
  return url.toString();
}

export function parseTradingEconomicsUsCalendarPayload(
  payload: unknown,
  options: { retrievedAt?: string | null } = {},
): TradingEconomicsUsCalendarSnapshot {
  const retrievedAt = options.retrievedAt ?? new Date().toISOString();

  if (!Array.isArray(payload)) {
    return {
      state: "unavailable",
      asOf: null,
      retrievedAt: options.retrievedAt ?? null,
      events: [],
      sourceName: "Trading Economics",
      sourceUrl: TRADING_ECONOMICS_US_CALENDAR_ROUTE,
      note: "Trading Economics returned a response without a valid calendar array.",
    };
  }

  const events: TradingEconomicsCalendarEvent[] = [];

  for (const raw of payload as TradingEconomicsRawEvent[]) {
    const date = isoTimestamp(raw.Date);
    const event = stringValue(raw.Event);
    const category = stringValue(raw.Category);
    if (!date || !event || !category) continue;

    const country = stringValue(raw.Country) ?? "United States";
    if (country.toLowerCase() !== "united states") continue;

    const importance = importanceValue(raw.Importance);
    if (importance !== null && importance < 3) continue;

    const actual = stringValue(raw.Actual);
    const previous = stringValue(raw.Previous);
    // Trading Economics' Calendar API names the survey-consensus field Forecast;
    // TEForecast is its separate model/analyst forecast.
    const consensus = stringValue(raw.Forecast);
    const teForecast = stringValue(raw.TEForecast);

    const parsedActual = parseTradingEconomicsNumber(actual);
    const parsedPrevious = parseTradingEconomicsNumber(previous);
    const parsedConsensus = parseTradingEconomicsNumber(consensus);

    events.push({
      calendarId: stringValue(raw.CalendarId) ?? `${category}:${event}:${date}`,
      date,
      country,
      category,
      event,
      reference: stringValue(raw.Reference),
      source: stringValue(raw.Source),
      sourceUrl: stringValue(raw.SourceURL),
      actual,
      previous,
      consensus,
      teForecast,
      importance,
      lastUpdate: isoTimestamp(raw.LastUpdate),
      url: stringValue(raw.URL),
      parsedActual,
      parsedPrevious,
      parsedConsensus,
      surprise:
        parsedActual !== null && parsedConsensus !== null
          ? parsedActual - parsedConsensus
          : null,
    });
  }

  events.sort((left, right) =>
    right.date.localeCompare(left.date) ||
    left.calendarId.localeCompare(right.calendarId));

  const bounded = events.slice(0, 60);
  return {
    state: "ready",
    asOf:
      bounded
        .map((item) => item.lastUpdate ?? item.date)
        .sort()
        .at(-1) ?? null,
    retrievedAt,
    events: bounded,
    sourceName: "Trading Economics",
    sourceUrl: TRADING_ECONOMICS_US_CALENDAR_ROUTE,
    note: bounded.length
      ? null
      : "No high-importance U.S. calendar events were returned for the requested window.",
  };
}

export async function fetchTradingEconomicsUsCalendarSnapshot(
  input: {
    apiKey?: string | null;
    from: Date;
    to: Date;
    fetcher?: typeof fetch;
  },
): Promise<TradingEconomicsUsCalendarSnapshot> {
  const apiKey =
    input.apiKey === undefined
      ? process.env.TRADING_ECONOMICS_API_KEY?.trim()
      : input.apiKey?.trim();

  if (!apiKey) {
    return {
      state: "unconfigured",
      asOf: null,
      retrievedAt: null,
      events: [],
      sourceName: "Trading Economics",
      sourceUrl: TRADING_ECONOMICS_US_CALENDAR_ROUTE,
      note: "TRADING_ECONOMICS_API_KEY is not configured; optional event-surprise enrichment is skipped.",
    };
  }

  const retrievedAt = new Date().toISOString();
  const fetcher = input.fetcher ?? fetch;

  try {
    const response = await fetcher(buildTradingEconomicsUsCalendarUrl(input), {
      headers: {
        accept: "application/json",
        authorization: apiKey,
        "user-agent": "Alchemy Live Desk Trading Economics calendar adapter",
      },
      signal: AbortSignal.timeout(6_000),
    });

    if (!response.ok) {
      return {
        state: "unavailable",
        asOf: null,
        retrievedAt,
        events: [],
        sourceName: "Trading Economics",
        sourceUrl: TRADING_ECONOMICS_US_CALENDAR_ROUTE,
        note: `Trading Economics Calendar API returned HTTP ${response.status}; optional enrichment was skipped.`,
      };
    }

    return parseTradingEconomicsUsCalendarPayload(await response.json(), {
      retrievedAt,
    });
  } catch (error) {
    return {
      state: "unavailable",
      asOf: null,
      retrievedAt,
      events: [],
      sourceName: "Trading Economics",
      sourceUrl: TRADING_ECONOMICS_US_CALENDAR_ROUTE,
      note:
        error instanceof Error
          ? `Trading Economics Calendar API unavailable: ${error.message}`
          : "Trading Economics Calendar API unavailable.",
    };
  }
}
