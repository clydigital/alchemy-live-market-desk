import "server-only";

import { getMarketDossierV2ById } from "./dossier-v2/persistence.ts";
import {
  buildRegimeAssumptionObservationReport,
  type CanonicalMeasuredRow,
  type RegimeAssumptionObservationReport,
} from "./regime-assumption-observations.ts";
import { createSupabaseAdminClient } from "./supabase/admin.ts";

function obj(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
function ids(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

/**
 * Exact point-in-time read: no new Evidence writes, no provider fetch and no
 * comparing measurements acquired AFTER the selected Dossier's timestamp.
 */
export async function loadRegimeAssumptionObservationReport(
  dossierId: string,
  asOf: string,
): Promise<RegimeAssumptionObservationReport | null> {
  if (!dossierId || !Number.isFinite(Date.parse(asOf))) return null;
  const client = createSupabaseAdminClient();
  const dossier = await getMarketDossierV2ById(dossierId, client);
  if (!dossier || Date.parse(dossier.as_of) !== Date.parse(asOf)) return null;

  const { data, error } = await client
    .from("intelligence_evidence")
    .select("id,source_id,normalised_observation_id,external_evidence_id,content_hash,observed_value,measurement_unit,event_at,available_at,received_at,provenance_urls,structured_payload")
    .like("external_evidence_id", "market-crack:%")
    .order("event_at", { ascending: false })
    .limit(60);
  if (error) throw new Error("Could not load canonical quantified Regime observations: " + error.message);

  const payload = obj(dossier.payload);
  const analysis = obj(payload?.analytical_output);
  const main = obj(analysis?.main_thread);
  const storyIds = (Array.isArray(analysis?.major_stories) ? analysis.major_stories : [])
    .flatMap((story) => ids(obj(story)?.evidence_ids));
  const dossierEvidenceIds = [...new Set([...ids(main?.evidence_references), ...storyIds])];

  return buildRegimeAssumptionObservationReport({
    dossierId: dossier.id,
    asOf: dossier.as_of,
    rows: (data ?? []) as CanonicalMeasuredRow[],
    dossierEvidenceIds,
  });
}
