import { createHash } from "node:crypto";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
  }): Promise<string>;
};

export type SensorMemoryResult = {
  rawRecordId: string;
  rawRecordInserted: boolean;
  observationsInserted: number;
  observationsUnchanged: number;
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

    await store.insertObservation({
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
    observationsInserted += 1;
  }

  return {
    rawRecordId: rawRecord.id,
    rawRecordInserted,
    observationsInserted,
    observationsUnchanged,
  };
}

function productionSensorMemoryStore(): SensorMemoryStore {
  const client = createSupabaseAdminClient();

  async function findRawRecord(input: {
    provider: string;
    sourceUrl: string;
    contentHash: string;
  }) {
    const { data, error } = await client
      .from("raw_source_records")
      .select("id,provider,source_url,content_hash")
      .eq("provider", input.provider)
      .eq("source_url", input.sourceUrl)
      .eq("content_hash", input.contentHash)
      .limit(1)
      .maybeSingle<{ id: string; provider: string; source_url: string; content_hash: string }>();
    if (error) throw new Error(`Could not read raw sensor memory: ${error.message}`);
    return data ? {
      id: data.id,
      provider: data.provider,
      sourceUrl: data.source_url,
      contentHash: data.content_hash,
    } : null;
  }

  return {
    findRawRecord,

    async insertRawRecord(input) {
      const { data, error } = await client
        .from("raw_source_records")
        .insert({
          provider: input.provider,
          source_url: input.sourceUrl,
          source_type: input.sourceType,
          content_type: input.contentType,
          content_hash: input.contentHash,
          content_text: input.contentText,
          payload: input.payload,
          published_at: input.publishedAt,
          observed_at: input.observedAt,
          source_id: input.sourceId,
          intake_item_id: input.intakeItemId,
          research_run_id: input.researchRunId,
          ingestion_key: input.ingestionKey,
          supersedes_record_id: input.supersedesRecordId,
        })
        .select("id,provider,source_url,content_hash")
        .single<{ id: string; provider: string; source_url: string; content_hash: string }>();
      if (error || !data) {
        if (error?.code === "23505") {
          const existing = await findRawRecord({
            provider: input.provider,
            sourceUrl: input.sourceUrl,
            contentHash: input.contentHash,
          });
          if (existing) return existing;
        }
        throw new Error(`Could not append raw sensor memory: ${error?.message || "missing raw record"}`);
      }
      return {
        id: data.id,
        provider: data.provider,
        sourceUrl: data.source_url,
        contentHash: data.content_hash,
      };
    },

    async latestObservation(input) {
      const { data, error } = await client
        .from("normalised_observations")
        .select("id,observation_type,subject_type,subject_key,observed_at,effective_at,value,unit,confidence,is_preliminary,methodology_version")
        .eq("observation_type", input.observationType)
        .eq("subject_type", input.subjectType)
        .eq("subject_key", input.subjectKey)
        .eq("observed_at", input.observedAt)
        .eq("methodology_version", input.methodologyVersion)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{
          id: string;
          observation_type: string;
          subject_type: string;
          subject_key: string;
          observed_at: string;
          effective_at: string | null;
          value: unknown;
          unit: string | null;
          confidence: number;
          is_preliminary: boolean;
          methodology_version: string;
        }>();
      if (error) throw new Error(`Could not read prior sensor observation: ${error.message}`);
      return data ? {
        id: data.id,
        observationType: data.observation_type,
        subjectType: data.subject_type,
        subjectKey: data.subject_key,
        observedAt: data.observed_at,
        effectiveAt: data.effective_at,
        value: data.value,
        unit: data.unit,
        confidence: data.confidence,
        isPreliminary: data.is_preliminary,
        methodologyVersion: data.methodology_version,
      } : null;
    },

    async insertObservation(input) {
      const { data, error } = await client
        .from("normalised_observations")
        .insert({
          raw_record_id: input.rawRecordId,
          source_id: input.sourceId,
          supersedes_observation_id: input.supersedesObservationId,
          observation_type: input.observationType,
          subject_type: input.subjectType,
          subject_key: input.subjectKey,
          observed_at: input.observedAt,
          effective_at: input.effectiveAt,
          value: input.value,
          unit: input.unit,
          confidence: input.confidence,
          is_preliminary: input.isPreliminary,
          methodology_version: input.methodologyVersion,
        })
        .select("id")
        .single<{ id: string }>();
      if (error || !data?.id) throw new Error(`Could not append sensor observation: ${error?.message || "missing observation id"}`);
      return data.id;
    },
  };
}

export async function persistSensorMemory(input: SensorMemoryInput) {
  return persistSensorMemoryWithStore(input, productionSensorMemoryStore());
}
