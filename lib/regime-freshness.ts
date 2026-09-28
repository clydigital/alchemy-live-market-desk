export type RegimeInterpretationFreshness =
  | {
      status: "no_telemetry";
      telemetryAt: null;
      interpretationAt: string | null;
      lagMinutes: null;
    }
  | {
      status: "no_interpretation";
      telemetryAt: string;
      interpretationAt: null;
      lagMinutes: null;
    }
  | {
      status: "new_telemetry";
      telemetryAt: string;
      interpretationAt: string;
      lagMinutes: number;
    }
  | {
      status: "timestamp_current";
      telemetryAt: string;
      interpretationAt: string;
      lagMinutes: 0;
    };

function latestValidTimestamp(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value && Number.isFinite(Date.parse(value))))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] || null;
}

/**
 * Compares deterministic observation time with the latest persisted System 2
 * hypothesis update. This is a presentation freshness check only: it never
 * claims that a later hypothesis necessarily consumed a specific observation.
 */
export function assessRegimeInterpretationFreshness(input: {
  telemetryAt: Array<string | null | undefined>;
  interpretationAt: Array<string | null | undefined>;
}): RegimeInterpretationFreshness {
  const telemetryAt = latestValidTimestamp(input.telemetryAt);
  const interpretationAt = latestValidTimestamp(input.interpretationAt);

  if (!telemetryAt) {
    return {
      status: "no_telemetry",
      telemetryAt: null,
      interpretationAt,
      lagMinutes: null,
    };
  }

  if (!interpretationAt) {
    return {
      status: "no_interpretation",
      telemetryAt,
      interpretationAt: null,
      lagMinutes: null,
    };
  }

  const lagMs = Date.parse(telemetryAt) - Date.parse(interpretationAt);
  if (lagMs > 0) {
    return {
      status: "new_telemetry",
      telemetryAt,
      interpretationAt,
      lagMinutes: Math.max(1, Math.ceil(lagMs / 60_000)),
    };
  }

  return {
    status: "timestamp_current",
    telemetryAt,
    interpretationAt,
    lagMinutes: 0,
  };
}
