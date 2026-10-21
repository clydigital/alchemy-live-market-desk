import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  verifiedCanonicalOilPair,
  type CanonicalOilProofInput,
  type OilBenchmark,
} from "../research-gap-exact-oil-proof.ts";
import type { VerifiedOilEvidence } from "./story-oil-price-gate.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Bounded source-chain read only. A context-only canonical UUID is not enough.
 * Uses the SAME archived ORIGINAL/FINAL proof contract as Research Gap #886.
 * A query error fails closed (no positively verified pairs), never fabricates
 * evidence or blocks unrelated Story maintenance.
 */
export async function resolveVerifiedStoryOilPairs(
  evidenceIds: readonly string[],
  asOf: Date,
): Promise<VerifiedOilEvidence> {
  const ids = [...new Set(evidenceIds.filter(id => UUID.test(id)))].slice(0, 12);
  if (!ids.length || !Number.isFinite(asOf.getTime())) return new Map();
  try {
    const db = createSupabaseAdminClient();
    const { data: evidence, error } = await db
      .from("intelligence_evidence")
      .select("id,normalised_observation_id,source_id,measurement_unit,event_at,available_at,affected_assets,provenance_urls,structured_payload")
      .in("id", ids);
    if (error || !evidence?.length) return new Map();
    const observationIds = [...new Set(evidence.map(e => e.normalised_observation_id).filter(Boolean))];
    const sourceIds = [...new Set(evidence.map(e => e.source_id).filter(Boolean))];
    if (!observationIds.length || !sourceIds.length) return new Map();
    const [obs, sources] = await Promise.all([
      db.from("normalised_observations").select("id,raw_record_id,value").in("id", observationIds),
      db.from("intelligence_evidence_sources").select("id,source_tier,source_url").in("id", sourceIds),
    ]);
    if (obs.error || sources.error) return new Map();
    const rawIds = [...new Set((obs.data ?? []).map(o => o.raw_record_id).filter(Boolean))];
    if (!rawIds.length) return new Map();
    const raw = await db.from("raw_source_records")
      .select("id,source_url,content_type,content_hash,provider,payload").in("id", rawIds);
    if (raw.error) return new Map();
    const byObs = new Map((obs.data ?? []).map(o => [o.id, o]));
    const byRaw = new Map((raw.data ?? []).map(o => [o.id, o]));
    const bySource = new Map((sources.data ?? []).map(o => [o.id, o]));
    const verified = new Map<string, Set<OilBenchmark>>();
    for (const row of evidence) {
      const observation = byObs.get(row.normalised_observation_id);
      const original = observation ? byRaw.get(observation.raw_record_id) : null;
      const source = bySource.get(row.source_id);
      if (!observation || !original || !source) continue;
      const proof = { evidence: row, observation, raw: original, source } as CanonicalOilProofInput;
      for (const benchmark of ["WTI", "BRENT"] as const) {
        if (!verifiedCanonicalOilPair(proof, benchmark, asOf)) continue;
        const existing = verified.get(row.id) ?? new Set<OilBenchmark>();
        existing.add(benchmark);
        verified.set(row.id, existing);
      }
    }
    return verified;
  } catch (error) {
    console.warn(JSON.stringify({
      event: "story_oil_original_measurement_proof_unavailable",
      reason: error instanceof Error ? error.name : "unknown",
      evidenceCount: ids.length,
    }));
    return new Map();
  }
}
