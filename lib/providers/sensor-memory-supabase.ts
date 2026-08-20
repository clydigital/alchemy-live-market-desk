import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import {
  persistSensorMemoryWithStore,
  type SensorMemoryInput,
  type SensorMemoryStore,
  type SensorObservationVersion,
} from "./sensor-memory";

type SensorObservationRow = {
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
};

function mapObservation(data: SensorObservationRow): SensorObservationVersion {
  return {
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
  };
}

const OBSERVATION_COLUMNS = "id,observation_type,subject_type,subject_key,observed_at,effective_at,value,unit,confidence,is_preliminary,methodology_version";

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
        .select(OBSERVATION_COLUMNS)
        .eq("observation_type", input.observationType)
        .eq("subject_type", input.subjectType)
        .eq("subject_key", input.subjectKey)
        .eq("observed_at", input.observedAt)
        .eq("methodology_version", input.methodologyVersion)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<SensorObservationRow>();
      if (error) throw new Error(`Could not read prior sensor observation: ${error.message}`);
      return data ? mapObservation(data) : null;
    },

    async latestObservationBefore(input) {
      const { data, error } = await client
        .from("normalised_observations")
        .select(OBSERVATION_COLUMNS)
        .eq("observation_type", input.observationType)
        .eq("subject_type", input.subjectType)
        .eq("subject_key", input.subjectKey)
        .eq("methodology_version", input.methodologyVersion)
        .lt("observed_at", input.observedAt)
        .order("observed_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<SensorObservationRow>();
      if (error) throw new Error(`Could not read earlier sensor observation: ${error.message}`);
      return data ? mapObservation(data) : null;
    },

    async hasSeriesObservation(input) {
      const { data, error } = await client
        .from("normalised_observations")
        .select("id")
        .eq("observation_type", input.observationType)
        .eq("subject_type", input.subjectType)
        .eq("subject_key", input.subjectKey)
        .eq("methodology_version", input.methodologyVersion)
        .limit(1)
        .maybeSingle<{ id: string }>();
      if (error) throw new Error(`Could not inspect sensor series history: ${error.message}`);
      return Boolean(data?.id);
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
      if (error || !data?.id) {
        if (error?.code === "23505") {
          const existing = await client
            .from("normalised_observations")
            .select("id")
            .eq("raw_record_id", input.rawRecordId)
            .eq("observation_type", input.observationType)
            .eq("subject_type", input.subjectType)
            .eq("subject_key", input.subjectKey)
            .eq("observed_at", input.observedAt)
            .eq("methodology_version", input.methodologyVersion)
            .limit(1)
            .maybeSingle<{ id: string }>();
          if (!existing.error && existing.data?.id) {
            return { id: existing.data.id, inserted: false };
          }
        }
        throw new Error(`Could not append sensor observation: ${error?.message || "missing observation id"}`);
      }
      return { id: data.id, inserted: true };
    },
  };
}

export async function persistSensorMemory(input: SensorMemoryInput) {
  return persistSensorMemoryWithStore(input, productionSensorMemoryStore());
}
