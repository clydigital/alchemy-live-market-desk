export const FINRA_SHORT_VOLUME_BASE = "https://cdn.finra.org/equity/regsho/daily";
export const FINRA_SOURCE_NAME = "Financial Industry Regulatory Authority" as const;
export const FINRA_SCOPE_NOTE = "FINRA daily short-sale volume covers publicly disseminated off-exchange trades reported to FINRA facilities. It is not short interest and is not a complete market-wide short-sale measure." as const;

export type FinraShortVolumeRow = {
  tradeDate: string;
  symbol: string;
  shortVolume: number;
  shortExemptVolume: number;
  totalVolume: number;
  shortShareOfReportedVolume: number | null;
  marketCodes: string[];
};

export type FinraShortVolumeSnapshot = {
  state: "ready" | "unavailable";
  tradeDate: string;
  retrievedAt: string | null;
  rows: FinraShortVolumeRow[];
  sourceName: typeof FINRA_SOURCE_NAME;
  sourceUrl: string;
  scopeNote: typeof FINRA_SCOPE_NOTE;
  note: string | null;
};

function numericValue(value: string) {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function validUtcDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() + 1 === month
    && date.getUTCDate() === day;
}

export function normalizeFinraTradeDate(value: string | Date) {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new Error("FINRA trade date is invalid.");
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}${month}${day}`;
  }

  const compact = value.trim().replace(/-/g, "");
  if (!/^\d{8}$/.test(compact)) {
    throw new Error("FINRA trade date must be YYYY-MM-DD or YYYYMMDD.");
  }
  const year = Number(compact.slice(0, 4));
  const month = Number(compact.slice(4, 6));
  const day = Number(compact.slice(6, 8));
  if (!validUtcDate(year, month, day)) throw new Error("FINRA trade date is invalid.");
  return compact;
}

export function formatFinraTradeDate(value: string | Date) {
  const compact = normalizeFinraTradeDate(value);
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

export function buildFinraConsolidatedNmsUrl(value: string | Date) {
  const compact = normalizeFinraTradeDate(value);
  return `${FINRA_SHORT_VOLUME_BASE}/CNMSshvol${compact}.txt`;
}

export function parseFinraConsolidatedShortVolume(
  text: string,
  options?: { expectedTradeDate?: string | Date; symbols?: string[] },
): FinraShortVolumeRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  const header = lines.shift()?.trim();
  if (header !== "Date|Symbol|ShortVolume|ShortExemptVolume|TotalVolume|Market") {
    throw new Error("FINRA short-volume file header is not recognized.");
  }

  const expectedCompact = options?.expectedTradeDate
    ? normalizeFinraTradeDate(options.expectedTradeDate)
    : null;
  const requestedSymbols = new Set(
    (options?.symbols || []).map((symbol) => symbol.trim().toUpperCase()).filter(Boolean),
  );

  const rows: FinraShortVolumeRow[] = [];
  for (const line of lines) {
    const columns = line.split("|");
    if (columns.length !== 6) continue;
    const [rawDate, rawSymbol, rawShort, rawExempt, rawTotal, rawMarket] = columns;
    let compactDate: string;
    try {
      compactDate = normalizeFinraTradeDate(rawDate);
    } catch {
      continue;
    }
    if (expectedCompact && compactDate !== expectedCompact) continue;

    const symbol = rawSymbol.trim();
    if (!symbol) continue;
    if (requestedSymbols.size && !requestedSymbols.has(symbol.toUpperCase())) continue;

    const shortVolume = numericValue(rawShort);
    const shortExemptVolume = numericValue(rawExempt);
    const totalVolume = numericValue(rawTotal);
    if (shortVolume === null || shortExemptVolume === null || totalVolume === null) continue;
    if (shortVolume < 0 || shortExemptVolume < 0 || totalVolume < 0) continue;

    rows.push({
      tradeDate: formatFinraTradeDate(compactDate),
      symbol,
      shortVolume,
      shortExemptVolume,
      totalVolume,
      shortShareOfReportedVolume: totalVolume > 0 ? shortVolume / totalVolume : null,
      marketCodes: rawMarket.split(",").map((code) => code.trim()).filter(Boolean),
    });
  }

  rows.sort((a, b) => a.symbol.localeCompare(b.symbol));
  return rows;
}

function unavailable(tradeDate: string, sourceUrl: string, retrievedAt: string | null, note: string): FinraShortVolumeSnapshot {
  return {
    state: "unavailable",
    tradeDate,
    retrievedAt,
    rows: [],
    sourceName: FINRA_SOURCE_NAME,
    sourceUrl,
    scopeNote: FINRA_SCOPE_NOTE,
    note,
  };
}

export async function fetchFinraConsolidatedShortVolume(
  tradeDateInput: string | Date,
  options?: { symbols?: string[]; fetchImpl?: typeof fetch },
): Promise<FinraShortVolumeSnapshot> {
  const tradeDate = formatFinraTradeDate(tradeDateInput);
  const sourceUrl = buildFinraConsolidatedNmsUrl(tradeDateInput);
  const retrievedAt = new Date().toISOString();
  const fetchImpl = options?.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(sourceUrl, {
      headers: {
        accept: "text/plain",
        "user-agent": "Alchemy Live Desk FINRA public-file adapter",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return unavailable(
        tradeDate,
        sourceUrl,
        retrievedAt,
        `FINRA consolidated NMS short-volume file returned HTTP ${response.status}.`,
      );
    }

    const rows = parseFinraConsolidatedShortVolume(await response.text(), {
      expectedTradeDate: tradeDateInput,
      symbols: options?.symbols,
    });
    return {
      state: "ready",
      tradeDate,
      retrievedAt,
      rows,
      sourceName: FINRA_SOURCE_NAME,
      sourceUrl,
      scopeNote: FINRA_SCOPE_NOTE,
      note: options?.symbols?.length && rows.length === 0
        ? "FINRA file was available, but none of the requested symbols were present."
        : null,
    };
  } catch (error) {
    return unavailable(
      tradeDate,
      sourceUrl,
      retrievedAt,
      error instanceof Error ? `FINRA short-volume file unavailable: ${error.message}` : "FINRA short-volume file unavailable.",
    );
  }
}
