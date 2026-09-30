export type IntradayReactionWindowKey = "5m" | "30m" | "4h" | "close" | "next_session";

export type IntradayReactionTrigger = {
  evidenceId: string;
  occurredAt: string;
};

export type IntradayReactionWindow = {
  window: IntradayReactionWindowKey;
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
  windows: IntradayReactionWindow[];
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
const MAX_TRIGGER_AGE_HOURS = 120;
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

const FIXED_WINDOW_MS = {
  "5m": 5 * 60_000,
  "30m": 30 * 60_000,
  "4h": 4 * 60 * 60_000,
} as const;

type FixedReactionWindowKey = keyof typeof FIXED_WINDOW_MS;

const NEW_YORK_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function newYorkSessionParts(timestamp: number) {
  const parts = Object.fromEntries(
    NEW_YORK_PARTS.formatToParts(new Date(timestamp))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  if (!parts.year || !parts.month || !parts.day || !Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minuteOfDay: hour * 60 + minute,
  };
}

function completedRegularSessionCloses(bars: Bar[], asOfAt: number): Bar[] {
  const byDate = new Map<string, Bar>();
  for (const bar of bars) {
    const closeAt = barCloseAt(bar);
    if (closeAt > asOfAt) continue;
    const session = newYorkSessionParts(closeAt);
    if (!session) continue;
    // Use the latest completed regular-session bar in the final ten minutes.
    // This tolerates a missing exact 15:59 bar while excluding after-hours data.
    if (session.minuteOfDay < 15 * 60 + 50 || session.minuteOfDay > 16 * 60) continue;
    const prior = byDate.get(session.date);
    if (!prior || barCloseAt(prior) < closeAt) byDate.set(session.date, bar);
  }
  return [...byDate.values()].sort((left, right) => barCloseAt(left) - barCloseAt(right));
}

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

function reactionWindow(
  key: IntradayReactionWindowKey,
  baseline: Bar,
  observed: Bar,
): IntradayReactionWindow {
  return {
    window: key,
    baselineAt: new Date(barCloseAt(baseline)).toISOString(),
    observedAt: new Date(barCloseAt(observed)).toISOString(),
    baseline: baseline.close,
    observed: observed.close,
    changePct: Number((((observed.close / baseline.close) - 1) * 100).toFixed(4)),
  };
}

function reactionWindows(bars: Bar[], triggerAt: number, asOfAt: number): IntradayReactionWindow[] {
  const baseline = baselineBar(bars, triggerAt);
  if (!baseline || baseline.close === 0) return [];

  const windows: IntradayReactionWindow[] = [];
  for (const key of ["5m", "30m", "4h"] as const satisfies readonly FixedReactionWindowKey[]) {
    const targetAt = triggerAt + FIXED_WINDOW_MS[key];
    if (targetAt > asOfAt) continue;
    const observed = targetBar(bars, targetAt);
    if (observed) windows.push(reactionWindow(key, baseline, observed));
  }

  const closes = completedRegularSessionCloses(bars, asOfAt);
  const firstCloseIndex = closes.findIndex((bar) => barCloseAt(bar) >= triggerAt);
  if (firstCloseIndex >= 0) {
    windows.push(reactionWindow("close", baseline, closes[firstCloseIndex]));
    const nextSession = closes[firstCloseIndex + 1];
    if (nextSession) windows.push(reactionWindow("next_session", baseline, nextSession));
  }

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
  // Session-close and next-session reactions are discovered from actual bars.
  // Fetch through the Dossier as-of so weekends and exchange holidays fail
  // closed naturally instead of relying on a hand-coded trading calendar.
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
