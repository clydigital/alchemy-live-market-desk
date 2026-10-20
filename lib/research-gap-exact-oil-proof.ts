/**
 * Existing Research Gap server-side proof pattern, extended to oil F1/F2.
 * A web search assessment (gap-web ID) cannot close an exact settlement gap.
 * Exact proof requires canonical Evidence + normalised observation + original
 * exchange file record; model-assessed source quality alone never qualifies.
 */
export type OilBenchmark = "WTI" | "BRENT";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA = /^[a-f0-9]{64}$/i;
const DATE = /^20\d{2}-\d{2}-\d{2}$/;

export type CanonicalOilProofInput = {
  evidence: {
    id: string; normalised_observation_id: string | null; source_id: string | null;
    measurement_unit: string | null; event_at: string | null; available_at: string | null;
    affected_assets: string[] | null; provenance_urls: string[] | null;
    structured_payload: Record<string, unknown> | null;
  };
  observation: { id: string; raw_record_id: string | null; value: Record<string, unknown> | null };
  raw: { id: string; source_url: string | null; content_type: string | null; content_hash: string | null };
  source: { id: string; source_tier: number | null; source_url: string | null };
};

export function requiresExactOilPairProof(question: string, requirements: readonly string[]): OilBenchmark[] {
  const description = [question, ...requirements].join(" ");
  if (!/\b(?:F1[\s/–-]*F2|front[- ](?:month|next)|calendar spread|two[- ]contract|backwardat(?:ion|ed)|dated settl(?:e|ement)|futures curve|forward curve)\b/i.test(description)) return [];
  const required: OilBenchmark[] = [];
  if (/\b(?:WTI|West Texas Intermediate|NYMEX CL)\b/i.test(description)) required.push("WTI");
  if (/\b(?:Brent|ICE B(?:rent)?)\b/i.test(description)) required.push("BRENT");
  return required;
}

function isOriginal(url: string | null, benchmark: OilBenchmark): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const expected = benchmark === "WTI" ? "cmegroup.com" : "ice.com";
    return parsed.protocol === "https:"
      && (host === expected || host.endsWith("." + expected))
      && parsed.pathname.length > 8
      && !/\/(?:current|latest)\//i.test(parsed.pathname);
  } catch { return false; }
}
function numeric(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 && v < 1000;
}

export function verifiedCanonicalOilPair(
  input: CanonicalOilProofInput, benchmark: OilBenchmark, evaluatedAt: Date,
): boolean {
  const { evidence: e, observation: n, raw: r, source: s } = input;
  const val = n.value ?? {};
  const timestamp = Date.parse(e.event_at ?? "");
  const available = Date.parse(e.available_at ?? "");
  const tradeDate = val.tradeDate;
  const front = val.frontSettle;
  const next = val.nextSettle;
  const url = r.source_url;
  const asset = benchmark === "WTI" ? "WTI" : "BRENT";
  return UUID.test(e.id)
    && e.normalised_observation_id === n.id && UUID.test(n.id)
    && n.raw_record_id === r.id && UUID.test(r.id)
    && e.source_id === s.id && UUID.test(s.id)
    && s.source_tier === 1 && isOriginal(s.source_url, benchmark)
    && e.measurement_unit === "USD_per_barrel"
    && e.structured_payload?.signalKind === "official_futures_settlement_pair"
    && Array.isArray(e.affected_assets) && e.affected_assets.includes(asset)
    && Array.isArray(e.provenance_urls) && e.provenance_urls.some(u => isOriginal(u, benchmark))
    && isOriginal(url, benchmark) && url === s.source_url
    && (r.content_type === "application/pdf" || r.content_type === "text/csv")
    && typeof r.content_hash === "string" && SHA.test(r.content_hash)
    && val.originalSourceSha256 === r.content_hash
    && val.benchmark === benchmark
    && val.exchange === (benchmark === "WTI" ? "NYMEX" : "ICE")
    && val.final === true && val.unit === "USD_per_barrel"
    && typeof tradeDate === "string" && DATE.test(tradeDate)
    && e.event_at?.slice(0, 10) === tradeDate
    && typeof val.frontContract === "string" && typeof val.nextContract === "string"
    && val.frontContract !== val.nextContract
    && numeric(front) && numeric(next)
    && Number.isFinite(timestamp) && Number.isFinite(available)
    && timestamp <= evaluatedAt.getTime() && available <= evaluatedAt.getTime();
}
