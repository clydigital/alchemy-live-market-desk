/**
 * Exact-answer check for the real 9–11 October Research Gap failure:
 * vendor documentation about MOVE is not the requested measured MOVE series.
 * No model classification, no new schema/table, and no untrusted LLM
 * evidence text can mint a canonical Evidence UUID.
 */
export const RESEARCH_GAP_MOVE_EXACT_PROOF = "research-gap-move-exact-proof/1" as const;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export type MoveExactProof = {
  contractVersion: typeof RESEARCH_GAP_MOVE_EXACT_PROOF;
  kind: "numeric_series";
  metricOrClaim: "ICE_MOVE";
  period: "CURRENT_REQUESTED_WINDOW";
  units: "index_points";
  proofEvidenceUuid: string | null;
  proofState: "VERIFIED_NUMERIC_SERIES" | "UNRESOLVED";
  nextCheckReason: string | null;
};
export type CanonicalMoveRow = {
  id: string;
  normalised_observation_id: string | null;
  external_evidence_id: string | null;
  observed_value: string | number | null;
  measurement_unit: string | null;
  event_at: string | null;
  available_at: string | null;
  affected_assets: string[] | null;
  provenance_urls: string[] | null;
  structured_payload: Record<string, unknown> | null;
};

export function requiresExactMoveSeriesProof(question:string, requirements:readonly string[]) {
  // Preserve separate "how to access the vendor" source-access questions.
  const q=question.trim();
  if(!/\bMOVE\b/i.test(q))return false;
  if(!/(?:time[-\s]?series|actual (?:index )?(?:value|reading)|index levels?|observations?|missing|absent|not present|not available|not in the packet)/i.test(q))return false;
  return requirements.length===0 || requirements.some(x=>/\bMOVE\b/i.test(x)||x===q);
}
function dateMs(value:string|null) {
  const ms=value?Date.parse(value):NaN;
  return Number.isFinite(ms)?ms:null;
}
function iceOriginalSource(url:string) {
  try{
    const u=new URL(url);
    const host=u.hostname.toLowerCase();
    return u.protocol==="https:"&&(host==="ice.com"||host.endsWith(".ice.com"));
  }catch{return false;}
}

/** A canonical UUID is necessary, but not sufficient without the exact data. */
export function verifiedCanonicalMoveSeries(row:CanonicalMoveRow, evaluatedAt:Date) {
  const at=evaluatedAt.getTime();
  const observed=dateMs(row.event_at), available=dateMs(row.available_at);
  const numeric=typeof row.observed_value==="number"?row.observed_value:Number(row.observed_value);
  const sessions=row.structured_payload?.windowSessions;
  return UUID.test(row.id)
    && Boolean(row.normalised_observation_id&&UUID.test(row.normalised_observation_id))
    && row.measurement_unit==="index_points"
    && Number.isFinite(numeric)
    && row.observed_value!==null && row.observed_value!==""
    && observed!==null && available!==null
    && observed<=at && available<=at
    && at-observed<=14*86_400_000
    && Array.isArray(row.affected_assets)
    && row.affected_assets.some(x=>x.toUpperCase()==="MOVE")
    && Array.isArray(row.provenance_urls)
    && row.provenance_urls.some(iceOriginalSource)
    && row.structured_payload?.metric==="ICE_MOVE"
    && typeof sessions==="number" && Number.isInteger(sessions) && sessions>=2;
}

export function buildMoveExactProof(ids:readonly string[],needed:boolean):MoveExactProof|null {
  if(!needed)return null;
  const proofEvidenceUuid=ids.find(x=>UUID.test(x))??null;
  return{
    contractVersion:RESEARCH_GAP_MOVE_EXACT_PROOF,
    kind:"numeric_series",metricOrClaim:"ICE_MOVE",period:"CURRENT_REQUESTED_WINDOW",
    units:"index_points",proofEvidenceUuid,
    proofState:proofEvidenceUuid?"VERIFIED_NUMERIC_SERIES":"UNRESOLVED",
    nextCheckReason:proofEvidenceUuid?null:
      "A dated, source-verified canonical MOVE index series is still missing. ICE documentation or HTTP handoff is not the numerical answer; retry only after a new eligible provider release or licensed access.",
  };
}
