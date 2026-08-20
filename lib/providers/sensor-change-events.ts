export type SensorChangeEventType = "NEW_SERIES" | "NEW_PERIOD" | "REVISION";

export type SensorChangeComparableObservation = {
  id: string;
  observationType: string;
  subjectType: string;
  subjectKey: string;
  observedAt: string;
  effectiveAt: string | null;
  value: unknown;
  unit: string | null;
  confidence: number;
  isPreliminary: boolean;
  methodologyVersion: string;
};

export type SensorChangeEvent = {
  eventType: SensorChangeEventType;
  provider: string;
  rawRecordId: string;
  observationId: string;
  observationType: string;
  subjectType: string;
  subjectKey: string;
  observedAt: string;
  effectiveAt: string | null;
  methodologyVersion: string;
  currentValue: unknown;
  previousObservationId: string | null;
  previousObservedAt: string | null;
  previousValue: unknown;
  unit: string | null;
  absoluteChange: number | null;
  relativeChange: number | null;
  confidence: number;
  isPreliminary: boolean;
};

function finiteScalar(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function numericChange(
  previous: SensorChangeComparableObservation | null,
  currentValue: unknown,
  currentUnit: string | null,
) {
  if (!previous || previous.unit !== currentUnit) {
    return { absoluteChange: null, relativeChange: null };
  }

  const previousValue = finiteScalar(previous.value);
  const nextValue = finiteScalar(currentValue);
  if (previousValue === null || nextValue === null) {
    return { absoluteChange: null, relativeChange: null };
  }

  const absoluteChange = nextValue - previousValue;
  return {
    absoluteChange,
    relativeChange: previousValue === 0 ? null : absoluteChange / Math.abs(previousValue),
  };
}

export function deriveSensorChangeEvent(input: {
  provider: string;
  rawRecordId: string;
  observationId: string;
  current: Omit<SensorChangeComparableObservation, "id">;
  samePeriodPrevious: SensorChangeComparableObservation | null;
  priorPeriod: SensorChangeComparableObservation | null;
  seriesAlreadyExists: boolean;
}): SensorChangeEvent {
  const eventType: SensorChangeEventType = input.samePeriodPrevious
    ? "REVISION"
    : input.seriesAlreadyExists
      ? "NEW_PERIOD"
      : "NEW_SERIES";

  // Revisions compare against the prior version of the same source period.
  // New periods compare only with an earlier period. A backfilled older period can
  // therefore be NEW_PERIOD without a numeric comparison to a future observation.
  const comparison = input.samePeriodPrevious ?? input.priorPeriod;
  const numeric = numericChange(comparison, input.current.value, input.current.unit);

  return {
    eventType,
    provider: input.provider,
    rawRecordId: input.rawRecordId,
    observationId: input.observationId,
    observationType: input.current.observationType,
    subjectType: input.current.subjectType,
    subjectKey: input.current.subjectKey,
    observedAt: input.current.observedAt,
    effectiveAt: input.current.effectiveAt,
    methodologyVersion: input.current.methodologyVersion,
    currentValue: input.current.value,
    previousObservationId: comparison?.id ?? null,
    previousObservedAt: comparison?.observedAt ?? null,
    previousValue: comparison?.value ?? null,
    unit: input.current.unit,
    absoluteChange: numeric.absoluteChange,
    relativeChange: numeric.relativeChange,
    confidence: input.current.confidence,
    isPreliminary: input.current.isPreliminary,
  };
}
