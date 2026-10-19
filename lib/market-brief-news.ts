/**
 * Public, factual News Brief projection from an already source-verified Motion.
 *
 * The source record is not canonical evidence and never supplies a new
 * Story / Regime / System 2 verdict. Do not add interpretation here.
 */
export type NewsBriefInput = {
  id: string;
  headline: string;
  what_happened: string;
  source_name: string;
  source_url: string;
  source_kind: string;
  verification_state: string;
  lifecycle_state: string;
  effective_state?: string;
  occurred_at: string;
  observed_at: string;
  expires_at: string;
};

export type NewsBriefV1 = {
  contractVersion: "news-brief/1";
  contentType: "NEWS_BRIEF";
  id: string;
  headline: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  sourceKind: string;
  occurredAt: string;
  observedAt: string;
  // Explicitly not a canonical Dossier/Story decision.
  verification: "SOURCE_VERIFIED";
};

const ALLOWED_SOURCE_KINDS = new Set([
  "official", "primary", "filing", "reporting", "market_data",
]);
const PROCESS_HEADLINE =
  /(?:evidence gap|research gap|source audit|source coverage|provider authentication|sensor validation|ingestion pipeline|record reclassification|dossier status|thesis version|system 2|canonical lineage|migration)/i;
const PROCESS_TEXT =
  /^(?:observed by research gap|verification pending|awaiting provider|source retrieval failed)/i;

function documentSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.href.length > 2048) return null;
    // A home page is not a claim-level report.
    if (url.pathname === "/" && !url.search) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Accept independent factual updates without demanding a Story mutation,
 * a second narrative paragraph or first-tier issuer evidence. The upstream
 * VERIFIED status is necessary, but the update remains SOURCE-VERIFIED
 * reporting, not accepted canonical evidence.
 */
export function selectVerifiedNewsBriefs(
  inputs: readonly NewsBriefInput[],
  now = new Date(),
  limit = 6,
): NewsBriefV1[] {
  const seen = new Set<string>();
  const time = now.getTime();
  if (!Number.isFinite(time)) return [];
  return [...inputs]
    .sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at))
    .flatMap(item => {
      if (item.verification_state !== "VERIFIED") return [];
      if (item.lifecycle_state === "EXPIRED" || item.effective_state === "EXPIRED") return [];
      if (!ALLOWED_SOURCE_KINDS.has(item.source_kind.toLowerCase())) return [];
      const published = Date.parse(item.occurred_at);
      const observed = Date.parse(item.observed_at);
      const expiry = Date.parse(item.expires_at);
      if (![published, observed, expiry].every(Number.isFinite)) return [];
      if (published > time || observed > time || expiry <= time) return [];
      const url = documentSourceUrl(item.source_url);
      if (!url || !item.source_name?.trim()) return [];
      const headline = item.headline?.trim() || "";
      const summary = item.what_happened?.trim() || "";
      if (headline.length < 8 || summary.length < 25) return [];
      if (PROCESS_HEADLINE.test(headline) || PROCESS_TEXT.test(summary)) return [];
      if (seen.has(item.id)) return [];
      seen.add(item.id);
      return [{
        contractVersion: "news-brief/1" as const,
        contentType: "NEWS_BRIEF" as const,
        id: item.id,
        headline,
        summary,
        sourceName: item.source_name.trim(),
        sourceUrl: url,
        sourceKind: item.source_kind,
        occurredAt: item.occurred_at,
        observedAt: item.observed_at,
        verification: "SOURCE_VERIFIED" as const,
      }];
    })
    .slice(0, Math.max(0, Math.min(18, limit)));
}
