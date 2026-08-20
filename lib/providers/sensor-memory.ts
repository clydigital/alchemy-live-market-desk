import { createHash } from "node:crypto";

import {
  deriveSensorChangeEvent,
  type SensorChangeEvent,
} from "./sensor-change-events";

export type SensorMemoryObservationInput = {
  observationType: string;
  subjectType: string;
  subjectKey: string;
  observedAt: string;
  effectiveAt?: string | null;
  value: unknown;
  unit?: string | null;
  confidence?: number;
  isPreliminary?: boolean;
  methodologyVersion?: string;
};

export type SensorMemoryInput = {
  provider: string;
  sourceUrl: string;
  sourceType: string;
  contentType?: string | null;
  rawPayload: unknown;
  contentText?: string | null;
  publishedAt?: string | null;
  observedAt?: string | null;
  sourceId?: string | null;
  intakeItemId?: string | null;
  researchRunId?: string | null;
  ingestionKey?: string | null;
  supersedesRecordId?: string | null;
  observations: SensorMemoryObservationInput[];
};

export type SensorRawRecord = {
  id: string;
  provider: string;
  sourceUrl: string;
  contentHash: string;
};

export type SensorObservationVersion = {
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

export type SensorMemoryStore = {
  findRawRecord(input: {
    provider: string;
    sourceUrl: string;
    contentHash: string;
  }): Promise<SensorRawRecord | null>;
  insertRawRecord(input: {
    provider: string;
    sourceUrl: string;
    sourceType: string;
    contentType: string | null;
    contentHash: string;
    contentText: string | null;
    payload: unknown;
    publishedAt: string | null;
    observedAt: string | null;
    sourceId: string | null;
    intakeItemId: string | null;
    researchRunId: string | null;
    ingestionKey: string | null;
    supersedesRecordId: string | null;
  }): Promise<SensorRawRecord>;
  latestObservation(input: {
    observationType: string;
    subjectType: string;
    subjectKey: string;
    observedAt: string;
    methodologyVersion: string;
  }): Promise<SensorObservationVersion | null>;
  latestObservationBefore(input: {
    observationType: string;
    subjectType: string;
    subjectKey: string;
    observedAt: string;
    methodologyVersion: string;
  }): Promise<SensorObservationVersion | null>;
  hasSeriesObservation(input: {
    observationType: string;
    subjectType: string;
    subjectKey: string;
    methodologyVersion: string;
  }): Promise<boolean>;
  insertObservation(input: {
    rawRecordId: string;
    sourceId: string | null;
    supersedesObservationId: string | null;
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
  }): Promise<{ id: string; inserted: boolean }>;
};

export type SensorMemoryResult = {
  rawRecordId: string;
  rawRecordInserted: boolean;
  observationsInserted: number;
  observationsUnchanged: number;
  changeEvents: SensorChangeEvent[];
};

function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalise(item)]),
    );
  }
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  return value ?? null;
}

export function stableSensorJson(value: unknown) {
  return JSON.stringify(canonicalise(value));
}

export function sensorContentHash(input: { rawPayload: unknown; contentText?: string | null }) {
  return createHash("sha256")
    .update(stableSensorJson({
      payload: input.rawPayload,
      contentText: input.contentText ?? null,
    }))
    .digest("hex");
}

function cleanRequired(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function validIso(value: string, label: string) {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`${label} must be an ISO-compatible timestamp.`);
  return value;
}

function normaliseConfidence(value: number | undefined) {
  const confidence = value ?? 100;
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 100) {
    throw new Error("Sensor observation confidence must be between 0 and 100.");
  }
  return Math.round(confidence);
}

function equivalentObservation(
  previous: SensorObservationVersion,
  next: {
    effectiveAt: string | null;
    value: unknown;
    unit: string | null;
    confidence: number;
    isPreliminary: boolean;
  },
) {
  return stableSensorJson(previous.value) === stableSensorJson(next.value)
    && previous.unit === next.unit
    && previous.confidence === next.confidence
    && previous.isPreliminary === next.isPreliminary
    && previous.effectiveAt === next.effectiveAt;
}

export async function persistSensorMemoryWithStore(
  input: SensorMemoryInput,
  store: SensorMemoryStore,
): Promise<SensorMemoryResult> {
  const provider = cleanRequired(input.provider, "Sensor provider");
  const sourceUrl = cleanRequired(input.sourceUrl, "Sensor source URL");
  const sourceType = cleanRequired(input.sourceType, "Sensor source type");
  const contentHash = sensorContentHash(input);

  let rawRecord = await store.findRawRecord({ provider, sourceUrl, contentHash });
  let rawRecordInserted = false;
  if (!rawRecord) {
    rawRecord = await store.insertRawRecord({
      provider,
      sourceUrl,
      sourceType,
      contentType: input.contentType ?? null,
      contentHash,
      contentText: input.contentText ?? null,
      payload: canonicalise(input.rawPayload),
      publishedAt: input.publishedAt ?? null,
      observedAt: input.observedAt ?? null,
      sourceId: input.sourceId ?? null,
      intakeItemId: input.intakeItemId ?? null,
      researchRunId: input.researchRunId ?? null,
      ingestionKey: input.ingestionKey ?? null,
      supersedesRecordId: input.supersedesRecordId ?? null,
    });
    rawRecordInserted = true;
  }

  let observationsInserted = 0;
  let observationsUnchanged = 0;
  const changeEvents: SensorChangeEvent[] = [];

  for (const observation of input.observations) {
    const observationType = cleanRequired(observation.observationType, "Observation type");
    const subjectType = cleanRequired(observation.subjectType, "Observation subject type");
    const subjectKey = cleanRequired(observation.subjectKey, "Observation subject key");
    const observedAt = validIso(observation.observedAt, "Observation observedAt");
    const methodologyVersion = cleanRequired(observation.methodologyVersion ?? "sensor-v1", "Methodology version");
    const effectiveAt = observation.effectiveAt
      ? validIso(observation.effectiveAt, "Observation effectiveAt")
      : null;
    const confidence = normaliseConfidence(observation.confidence);
    const unit = observation.unit?.trim() || null;
    const isPreliminary = observation.isPreliminary ?? false;
    const value = canonicalise(observation.value);

    const previous = await store.latestObservation({
      observationType,
      subjectType,
      subjectKey,
      observedAt,
      methodologyVersion,
    });

    if (previous && equivalentObservation(previous, {
      effectiveAt,
      value,
      unit,
      confidence,
      isPreliminary,
    })) {
      observationsUnchanged += 1;
      continue;
    }

    const priorPeriod = previous ? null : await store.latestObservationBefore({
      observationType,
      subjectType,
      subjectKey,
      observedAt,
      methodologyVersion,
    });
    const seriesAlreadyExists = Boolean(previous || priorPeriod || await store.hasSeriesObservation({
      observationType,
      subjectType,
      subjectKey,
      methodologyVersion,
    }));

    const inserted = await store.insertObservation({
      rawRecordId: rawRecord.id,
      sourceId: input.sourceId ?? null,
      supersedesObservationId: previous?.id ?? null,
      observationType,
      subjectType,
      subjectKey,
      observedAt,
      effectiveAt,
      value,
      unit,
      confidence,
      isPreliminary,
      methodologyVersion,
    });

    // A concurrent replay can lose the unique-index race after reading the same
    // prior state. Treat that as unchanged rather than emitting a duplicate event.
    if (!inserted.inserted) {
      observationsUnchanged += 1;
      continue;
    }

    observationsInserted += 1;
    changeEvents.push(deriveSensorChangeEvent({
      provider,
      rawRecordId: rawRecord.id,
      observationId: inserted.id,
      current: {
        observationType,
        subjectType,
        subjectKey,
        observedAt,
        effectiveAt,
        value,
        unit,
        confidence,
        isPreliminary,
        methodologyVersion,
      },
      samePeriodPrevious: previous,
      priorPeriod,
      seriesAlreadyExists,
    }));
  }

  return {
    rawRecordId: rawRecord.id,
    rawRecordInserted,
    observationsInserted,
    observationsUnchanged,
    changeEvents,
  };
}
