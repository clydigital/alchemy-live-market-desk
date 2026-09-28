export type ReactionWindowKey = "5m" | "30m" | "4h" | "session_close" | "next_session";
type FixedReactionWindowKey = "5m" | "30m" | "4h";

export type IntradayReactionTrigger = {
  evidenceId: string;
  occurredAt: string;
};

export type ReactionWindow = {
  window: ReactionWindowKey;
  baselineAt: string;
  observedAt: string;
  baseline: number;
  observed: number;
  changePct: number;
};

export type TwelveDataReactionRecord = {
  triggerEvidenceId: string;
  triggerOccurredAt: string;
  monitorId: "dxy" | "gold" | "smh";
  expectedInstrument: "DXY" | "XAUUSD" | "SMH";
  observedInstrument: "UUP" | "GLD" | "SMH";
  isProxy: boolean;
  sourceName: string;
  sourceUrl: string;
  windows: ReactionWindow[];
};

export type TwelveDataReactionSnapshot = {
  state: "ready" | "unconfigured" | "unavailable";
  retrievedAt: string;
  records: TwelveDataReactionRecord[];
  warnings: string[];
};

type FetchLike = typeof fetch;

type InstrumentSpec = {
  monitorId: TwelveDataReactionRecord["monitorId"];
  expectedInstrument: TwelveDataReactionRecord["expectedInstrument"];
  providerSymbol: TwelveDataReactionRecord["observedInstrument"];
  isProxy: boolean;
};

type Bar = {
  at: number;
  close: number;
};

const TWELVE_DATA_URL = "https://api.twelvedata.com/time_series";
const MAX_TRIGGER_AGE_HOURS = 96;
const BAR_INTERVAL_MS = 60_000;
const BASELINE_TOLERANCE_MS = 6 * 60_000;
const TARGET_TOLERANCE_MS = 6 * 60_000;

const INSTRUMENTS: InstrumentSpec[] = [
  {
    monitorId: "dxy",
    expectedInstrument: "DXY",
    providerSymbol: "UUP",
    isProxy: true,
  },
  {
    monitorId: "gold",
    expectedInstrument: "XAUUSD",
    providerSymbol: "GLD",
    isProxy: true,
  },
  {
    monitorId: "smh",
    expectedInstrument: "SMH",
    providerSymbol: "SMH",
    isProxy: false,
  },
];

const WINDOW_MS: Record<FixedReactionWindowKey, number> = {
  "5m": 5 * 60_000,
  "30m": 30 * 60_000,
  "4h": 4 * 60 * 60_000,
};

function parseTime(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function utcParam(value: number): string {
  return new Date(value).toISOString().slice(0, 19);
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseUtcBarTime(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const normalised = value.trim().replace(" ", "T");
  const parsed = Date.parse(normalised.endsWith("Z") ? normalised : `${normalised}Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

function barsFromSeries(value: unknown): Bar[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;
  if (record.status !== "ok" || !Array.isArray(record.values)) return [];

  return record.values
    .flatMap((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) return [];
      const item = row as Record<string, unknown>;
      const at = parseUtcBarTime(item.datetime);
      const close = numberValue(item.close);
      return at === null || close === null ? [] : [{ at, close }];
    })
    .sort((left, right) => left.at - right.at);
}

function seriesBySymbol(payload: unknown, symbols: string[]): Map<string, Bar[]> {
  const output = new Map<string, Bar[]>();
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return output;
  const root = payload as Record<string, unknown>;

  // Twelve Data returns the direct time-series shape for one symbol and a
  // symbol-keyed object for batch requests.
  if (root.status === "ok" && root.meta && Array.isArray(root.values) && symbols.length === 1) {
    output.set(symbols[0], barsFromSeries(root));
    return output;
  }

  for (const symbol of symbols) {
    const candidate = root[symbol];
    const bars = barsFromSeries(candidate);
    if (bars.length) output.set(symbol, bars);
  }
  return output;
}

function barCloseAt(bar: Bar): number {
  return bar.at + BAR_INTERVAL_MS;
}

function baselineBar(bars: Bar[], triggerAt: number): Bar | null {
  // Twelve Data timestamps a 1-minute bar by the minute it OPENS. The event
  // minute itself is therefore contaminated by post-trigger trading. Use only
  // a bar that was fully complete before the trigger.
  const eligible = bars.filter((bar) => {
    const closeAt = barCloseAt(bar);
    return closeAt <= triggerAt && triggerAt - closeAt <= BASELINE_TOLERANCE_MS;
  });
  return eligible.at(-1) ?? null;
}

function targetBar(bars: Bar[], targetAt: number): Bar | null {
  // Same no-look-ahead rule for the reaction endpoint: use the latest fully
  // completed 1-minute bar at or before the requested horizon.
  const eligible = bars.filter((bar) => {
    const closeAt = barCloseAt(bar);
    return closeAt <= targetAt && targetAt - closeAt <= TARGET_TOLERANCE_MS;
  });
  return eligible.at(-1) ?? null;
}

const NEW_YORK_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function newYorkParts(value: number) {
  return Object.fromEntries(
    NEW_YORK_PARTS
      .formatToParts(new Date(value))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

function newYorkDateKey(value: number): string {
  const parts = newYorkParts(value);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function regularSessionCloseAt(dateKey: string): number | null {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // US regular-session close is 16:00 New York. Depending on DST that is
  // either 20:00 or 21:00 UTC. Verify through Intl instead of hard-coding the
  // offset so DST transitions remain correct.
  for (const utcHour of [20, 21]) {
    const candidate = Date.UTC(year, month - 1, day, utcHour, 0, 0);
    const parts = newYorkParts(candidate);
    if (
      parts.year === match[1]
      && parts.month === match[2]
      && parts.day === match[3]
      && parts.hour === "16"
      && parts.minute === "00"
    ) return candidate;
  }
  return null;
}

function completedWindow(
  window: ReactionWindowKey,
  baseline: Bar,
  observed: Bar,
): ReactionWindow {
  return {
    window,
    baselineAt: new Date(barCloseAt(baseline)).toISOString(),
    observedAt: new Date(barCloseAt(observed)).toISOString(),
    baseline: baseline.close,
    observed: observed.close,
    changePct: Number((((observed.close / baseline.close) - 1) * 100).toFixed(4)),
  };
}

function sessionCloseWindow(
  bars: Bar[],
  triggerAt: number,
  asOfAt: number,
  baseline: Bar,
): ReactionWindow | null {
  const triggerDate = newYorkDateKey(triggerAt);
  const closeAt = regularSessionCloseAt(triggerDate);
  if (closeAt === null || asOfAt < closeAt) return null;
  const observed = targetBar(bars, closeAt);
  if (
    !observed
    || barCloseAt(observed) <= triggerAt
    || newYorkDateKey(barCloseAt(observed)) !== triggerDate
  ) return null;
  return completedWindow("session_close", baseline, observed);
}

function nextSessionWindow(
  bars: Bar[],
  triggerAt: number,
  asOfAt: number,
  baseline: Bar,
): ReactionWindow | null {
  const triggerDate = newYorkDateKey(triggerAt);
  const nextDate = [...new Set(
    bars
      .map((bar) => newYorkDateKey(barCloseAt(bar)))
      .filter((dateKey) => dateKey > triggerDate),
  )].sort()[0];
  if (!nextDate) return null;

  const closeAt = regularSessionCloseAt(nextDate);
  if (closeAt === null || asOfAt < closeAt) return null;
  const observed = targetBar(bars, closeAt);

  // Do not skip an early-close/incomplete next session and relabel a later
  // session as "next session". If the first later trading date has no regular
  // 16:00 close bar, leave the horizon unresolved.
  if (!observed || newYorkDateKey(barCloseAt(observed)) !== nextDate) return null;
  return completedWindow("next_session", baseline, observed);
}

function reactionWindows(bars: Bar[], triggerAt: number, asOfAt: number): ReactionWindow[] {
  const baseline = baselineBar(bars, triggerAt);
  if (!baseline || baseline.close === 0) return [];

  const windows: ReactionWindow[] = [];
  for (const key of ["5m", "30m", "4h"] as const) {
    const targetAt = triggerAt + WINDOW_MS[key];
    if (targetAt > asOfAt) continue;
    const observed = targetBar(bars, targetAt);
    if (!observed) continue;
    windows.push(completedWindow(key, baseline, observed));
  }

  const sessionClose = sessionCloseWindow(bars, triggerAt, asOfAt, baseline);
  if (sessionClose) windows.push(sessionClose);

  const nextSession = nextSessionWindow(bars, triggerAt, asOfAt, baseline);
  if (nextSession) windows.push(nextSession);

  return windows;
}

function eligibleTriggers(
  triggers: IntradayReactionTrigger[],
  asOfAt: number,
): Array<IntradayReactionTrigger & { occurredAtMs: number }> {
  const floor = asOfAt - MAX_TRIGGER_AGE_HOURS * 60 * 60_000;
  return triggers
    .flatMap((trigger) => {
      const occurredAtMs = parseTime(trigger.occurredAt);
      if (occurredAtMs === null || occurredAtMs > asOfAt || occurredAtMs < floor) return [];
      return [{ ...trigger, occurredAtMs }];
    })
    .sort((a, b) => a.occurredAtMs - b.occurredAtMs)
    .slice(-4);
}

export async function fetchTwelveDataReactionSnapshot(options: {
  asOf: string;
  triggers: IntradayReactionTrigger[];
  apiKey?: string | null;
  fetchImpl?: FetchLike;
}): Promise<TwelveDataReactionSnapshot> {
  const retrievedAt = new Date().toISOString();
  const apiKey = options.apiKey === undefined
    ? process.env.TWELVE_DATA_API_KEY ?? null
    : options.apiKey;
  if (!apiKey?.trim()) {
    return {
      state: "unconfigured",
      retrievedAt,
      records: [],
      warnings: ["TWELVE_DATA_API_KEY is not configured; intraday event-reaction enrichment is disabled."],
    };
  }

  const asOfAt = parseTime(options.asOf);
  if (asOfAt === null) {
    return {
      state: "unavailable",
      retrievedAt,
      records: [],
      warnings: ["Invalid Dossier as-of timestamp for intraday reaction acquisition."],
    };
  }

  const triggers = eligibleTriggers(options.triggers, asOfAt);
  if (!triggers.length) {
    return {
      state: "ready",
      retrievedAt,
      records: [],
      warnings: ["No eligible timestamped policy/macro trigger occurred inside the intraday reaction lookback."],
    };
  }

  const earliestAt = Math.max(
    triggers[0].occurredAtMs - 10 * 60_000,
    asOfAt - MAX_TRIGGER_AGE_HOURS * 60 * 60_000,
  );
  // Fetch through as-of so the same bounded request can capture session-close
  // and next-session persistence when those horizons have actually completed.
  const latestNeeded = asOfAt;
  const symbols = INSTRUMENTS.map((item) => item.providerSymbol);

  const url = new URL(TWELVE_DATA_URL);
  url.searchParams.set("symbol", symbols.join(","));
  url.searchParams.set("interval", "1min");
  url.searchParams.set("timezone", "UTC");
  url.searchParams.set("order", "asc");
  url.searchParams.set("start_date", utcParam(earliestAt));
  url.searchParams.set("end_date", utcParam(latestNeeded));
  url.searchParams.set("outputsize", "5000");

  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(url.toString(), {
      headers: {
        Authorization: `apikey ${apiKey.trim()}`,
        accept: "application/json",
        "user-agent": "Alchemy Live Desk",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      return {
        state: "unavailable",
        retrievedAt,
        records: [],
        warnings: [`Twelve Data intraday request failed with HTTP ${response.status}.`],
      };
    }

    const payload = await response.json();
    const bars = seriesBySymbol(payload, symbols);
    const records: TwelveDataReactionRecord[] = [];
    const warnings: string[] = [];

    for (const spec of INSTRUMENTS) {
      const instrumentBars = bars.get(spec.providerSymbol) ?? [];
      if (!instrumentBars.length) {
        warnings.push(`No intraday bars returned for ${spec.providerSymbol}.`);
        continue;
      }
      for (const trigger of triggers) {
        const windows = reactionWindows(instrumentBars, trigger.occurredAtMs, asOfAt);
        if (!windows.length) continue;
        records.push({
          triggerEvidenceId: trigger.evidenceId,
          triggerOccurredAt: trigger.occurredAt,
          monitorId: spec.monitorId,
          expectedInstrument: spec.expectedInstrument,
          observedInstrument: spec.providerSymbol,
          isProxy: spec.isProxy,
          sourceName: "Twelve Data intraday time series",
          sourceUrl: "https://twelvedata.com/docs",
          windows,
        });
      }
    }

    return {
      state: "ready",
      retrievedAt,
      records,
      warnings,
    };
  } catch (error) {
    return {
      state: "unavailable",
      retrievedAt,
      records: [],
      warnings: [`Twelve Data intraday enrichment failed closed: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}
