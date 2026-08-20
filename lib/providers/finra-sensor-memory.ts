import {
  fetchFinraConsolidatedShortVolume,
  type FinraShortVolumeSnapshot,
} from "./finra-short-volume";
import {
  persistSensorMemory,
} from "./sensor-memory-supabase";
import {
  type SensorMemoryInput,
  type SensorMemoryResult,
} from "./sensor-memory";

export const FINRA_SENSOR_MEMORY_PROVIDER = "finra-cnms" as const;
export const FINRA_SENSOR_MEMORY_METHOD = "finra-cnms-v1" as const;

export type FinraSensorMemoryCaptureResult = {
  state: "ready" | "unavailable";
  tradeDate: string;
  sourceUrl: string;
  rowsFetched: number;
  selectedSymbols: string[];
  memory: SensorMemoryResult | null;
  note: string | null;
};

type FinraSensorMemoryDependencies = {
  fetchSnapshot?: typeof fetchFinraConsolidatedShortVolume;
  persist?: typeof persistSensorMemory;
};

function observedAtForTradeDate(tradeDate: string) {
  return new Date(`${tradeDate}T00:00:00.000Z`).toISOString();
}

function normaliseSymbols(symbols: string[] | undefined) {
  return [...new Set((symbols || [])
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean))]
    .sort();
}

export function buildFinraSensorMemoryInput(
  snapshot: FinraShortVolumeSnapshot,
  symbols?: string[],
): SensorMemoryInput {
  if (snapshot.state !== "ready") {
    throw new Error("Unavailable FINRA data cannot be persisted as successful sensor memory.");
  }

  const selectedSymbols = normaliseSymbols(symbols);
  const selected = new Set(selectedSymbols);
  const rows = snapshot.rows.filter((row) => !selected.size || selected.has(row.symbol.toUpperCase()));
  const observedAt = observedAtForTradeDate(snapshot.tradeDate);

  return {
    provider: FINRA_SENSOR_MEMORY_PROVIDER,
    sourceUrl: snapshot.sourceUrl,
    sourceType: "official_daily_short_sale_volume_file",
    contentType: "application/json",
    rawPayload: {
      tradeDate: snapshot.tradeDate,
      sourceName: snapshot.sourceName,
      scopeNote: snapshot.scopeNote,
      note: snapshot.note,
      rows: snapshot.rows,
    },
    observedAt,
    observations: rows.flatMap((row) => {
      const subjectKey = `US_NMS:${row.symbol.toUpperCase()}`;
      const base = {
        subjectType: "security",
        subjectKey,
        observedAt,
        confidence: 100,
        isPreliminary: false,
        methodologyVersion: FINRA_SENSOR_MEMORY_METHOD,
      } as const;

      return [
        {
          ...base,
          observationType: "finra.short_volume",
          value: row.shortVolume,
          unit: "shares",
        },
        {
          ...base,
          observationType: "finra.short_exempt_volume",
          value: row.shortExemptVolume,
          unit: "shares",
        },
        {
          ...base,
          observationType: "finra.total_reported_volume",
          value: row.totalVolume,
          unit: "shares",
        },
        {
          ...base,
          observationType: "finra.short_share_reported_volume",
          value: row.shortShareOfReportedVolume,
          unit: "ratio",
        },
      ];
    }),
  };
}

export async function captureFinraSensorMemory(
  tradeDate: string | Date,
  symbols?: string[],
  dependencies: FinraSensorMemoryDependencies = {},
): Promise<FinraSensorMemoryCaptureResult> {
  const fetchSnapshot = dependencies.fetchSnapshot ?? fetchFinraConsolidatedShortVolume;
  const persist = dependencies.persist ?? persistSensorMemory;

  // Fetch the complete official daily file for canonical raw-memory identity.
  // Caller-supplied symbols only bound the observations promoted from that raw file.
  const snapshot = await fetchSnapshot(tradeDate);
  const selectedSymbols = normaliseSymbols(symbols);

  if (snapshot.state !== "ready") {
    return {
      state: "unavailable",
      tradeDate: snapshot.tradeDate,
      sourceUrl: snapshot.sourceUrl,
      rowsFetched: 0,
      selectedSymbols,
      memory: null,
      note: snapshot.note,
    };
  }

  const memoryInput = buildFinraSensorMemoryInput(snapshot, selectedSymbols);
  const memory = await persist(memoryInput);
  return {
    state: "ready",
    tradeDate: snapshot.tradeDate,
    sourceUrl: snapshot.sourceUrl,
    rowsFetched: snapshot.rows.length,
    selectedSymbols,
    memory,
    note: snapshot.note,
  };
}
