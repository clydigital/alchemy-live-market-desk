export type SensorId =
  | "finra"
  | "sec"
  | "jodi"
  | "mof"
  | "statcan"
  | "ons"
  | "eurostat"
  | "imf"
  | "eia";

export type SensorIntegrationState = "memory_ready" | "adapter_only";
export type SensorWakeMode = "scheduled" | "relevance" | "event" | "manual";
export type SensorCadence = "daily" | "weekly" | "monthly" | "release_event" | "event_driven";

export type SensorRegistration = {
  id: SensorId;
  provider: string;
  integrationState: SensorIntegrationState;
  cadence: SensorCadence;
  minimumIntervalMinutes: number | null;
  wakeModes: SensorWakeMode[];
  relevanceTokens: string[];
};

export const SENSOR_REGISTRY: readonly SensorRegistration[] = [
  {
    id: "finra",
    provider: "finra-cnms",
    integrationState: "memory_ready",
    cadence: "daily",
    minimumIntervalMinutes: 18 * 60,
    wakeModes: ["scheduled", "relevance", "manual"],
    relevanceTokens: ["equity", "equities", "stocks", "positioning", "short-volume", "us-equities"],
  },
  {
    id: "sec",
    provider: "sec-edgar",
    integrationState: "adapter_only",
    cadence: "event_driven",
    minimumIntervalMinutes: null,
    wakeModes: ["relevance", "event", "manual"],
    relevanceTokens: ["earnings", "filing", "company", "equity", "sec"],
  },
  {
    id: "jodi",
    provider: "jodi-oil",
    integrationState: "adapter_only",
    cadence: "monthly",
    minimumIntervalMinutes: 20 * 24 * 60,
    wakeModes: ["scheduled", "relevance", "event", "manual"],
    relevanceTokens: ["oil", "energy", "crude", "refining", "opec", "hormuz"],
  },
  {
    id: "mof",
    provider: "japan-mof",
    integrationState: "adapter_only",
    cadence: "weekly",
    minimumIntervalMinutes: 5 * 24 * 60,
    wakeModes: ["scheduled", "relevance", "event", "manual"],
    relevanceTokens: ["jpy", "yen", "japan", "carry", "repatriation", "capital-flows"],
  },
  {
    id: "statcan",
    provider: "statistics-canada",
    integrationState: "adapter_only",
    cadence: "release_event",
    minimumIntervalMinutes: null,
    wakeModes: ["scheduled", "relevance", "event", "manual"],
    relevanceTokens: ["canada", "cad", "usdcad", "canadian-economy"],
  },
  {
    id: "ons",
    provider: "ons",
    integrationState: "adapter_only",
    cadence: "release_event",
    minimumIntervalMinutes: null,
    wakeModes: ["relevance", "event", "manual"],
    relevanceTokens: ["uk", "gbp", "britain", "boe", "uk-economy"],
  },
  {
    id: "eurostat",
    provider: "eurostat",
    integrationState: "adapter_only",
    cadence: "release_event",
    minimumIntervalMinutes: null,
    wakeModes: ["relevance", "event", "manual"],
    relevanceTokens: ["eurozone", "europe", "eur", "ecb", "eu-economy"],
  },
  {
    id: "imf",
    provider: "imf-sdmx",
    integrationState: "adapter_only",
    cadence: "release_event",
    minimumIntervalMinutes: null,
    wakeModes: ["relevance", "event", "manual"],
    relevanceTokens: ["global-growth", "imf", "global-economy", "reserves", "cross-country"],
  },
  {
    id: "eia",
    provider: "eia-v2",
    integrationState: "adapter_only",
    cadence: "weekly",
    minimumIntervalMinutes: 5 * 24 * 60,
    wakeModes: ["scheduled", "relevance", "event", "manual"],
    relevanceTokens: ["oil", "energy", "crude", "inventories", "refining", "gasoline"],
  },
] as const;

export type SensorPlanContext = {
  now: string | Date;
  mode?: SensorWakeMode;
  relevance?: string[];
  force?: SensorId[];
  lastSuccessfulAt?: Partial<Record<SensorId, string | null>>;
};

export type SensorPlanReason =
  | "forced"
  | "due_scheduled"
  | "relevance_match"
  | "event_match"
  | "manual"
  | "not_memory_wired"
  | "wake_mode_not_allowed"
  | "not_relevant"
  | "not_due";

export type SensorPlanItem = {
  sensor: SensorRegistration;
  decision: "run" | "skip";
  reason: SensorPlanReason;
  due: boolean;
  relevanceMatched: boolean;
  lastSuccessfulAt: string | null;
};

function toDate(value: string | Date, label: string) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`${label} must be a valid date.`);
  return date;
}

function normalizeTokens(values: string[] | undefined) {
  return new Set((values || []).map((value) => value.trim().toLowerCase()).filter(Boolean));
}

function isDue(
  sensor: SensorRegistration,
  now: Date,
  lastSuccessfulAt: string | null,
) {
  if (sensor.minimumIntervalMinutes === null || !lastSuccessfulAt) return true;
  const previous = toDate(lastSuccessfulAt, `Last successful ${sensor.id} run`);
  return now.getTime() - previous.getTime() >= sensor.minimumIntervalMinutes * 60_000;
}

function matchesRelevance(sensor: SensorRegistration, relevance: Set<string>) {
  if (!relevance.size) return false;
  return sensor.relevanceTokens.some((token) => relevance.has(token));
}

export function planSensorRuns(
  context: SensorPlanContext,
  registry: readonly SensorRegistration[] = SENSOR_REGISTRY,
): SensorPlanItem[] {
  const now = toDate(context.now, "Sensor-plan now");
  const mode = context.mode ?? "scheduled";
  const relevance = normalizeTokens(context.relevance);
  const forced = new Set(context.force || []);

  return registry.map((sensor) => {
    const lastSuccessfulAt = context.lastSuccessfulAt?.[sensor.id] ?? null;
    const due = isDue(sensor, now, lastSuccessfulAt);
    const relevanceMatched = matchesRelevance(sensor, relevance);

    if (sensor.integrationState !== "memory_ready") {
      return {
        sensor,
        decision: "skip" as const,
        reason: "not_memory_wired" as const,
        due,
        relevanceMatched,
        lastSuccessfulAt,
      };
    }

    if (forced.has(sensor.id)) {
      return {
        sensor,
        decision: "run" as const,
        reason: "forced" as const,
        due,
        relevanceMatched,
        lastSuccessfulAt,
      };
    }

    if (!sensor.wakeModes.includes(mode)) {
      return {
        sensor,
        decision: "skip" as const,
        reason: "wake_mode_not_allowed" as const,
        due,
        relevanceMatched,
        lastSuccessfulAt,
      };
    }

    if ((mode === "relevance" || mode === "event") && !relevanceMatched) {
      return {
        sensor,
        decision: "skip" as const,
        reason: "not_relevant" as const,
        due,
        relevanceMatched,
        lastSuccessfulAt,
      };
    }

    if (!due) {
      return {
        sensor,
        decision: "skip" as const,
        reason: "not_due" as const,
        due,
        relevanceMatched,
        lastSuccessfulAt,
      };
    }

    const reason: SensorPlanReason = mode === "relevance"
      ? "relevance_match"
      : mode === "event"
        ? "event_match"
        : mode === "manual"
          ? "manual"
          : "due_scheduled";

    return {
      sensor,
      decision: "run",
      reason,
      due,
      relevanceMatched,
      lastSuccessfulAt,
    };
  });
}
