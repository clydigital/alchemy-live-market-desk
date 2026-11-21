import type { NewsBriefV1 } from "./market-brief-news.ts";

/**
 * Bluebelly public-news/1: intentionally smaller than every historical
 * Live/Hybrid intelligence feed. It carries already-source-verified facts
 * that Bluebelly Today can display, but NO Dossier decisions, raw evidence,
 * user notes, creator transcripts, private source receipts or operations.
 *
 * A server reader must supply eligible NewsBriefV1 records. This function
 * never upgrades an unverified claim to public status.
 */
export type BluebellyPublicNewsItemV1 = {
  id: string;
  headline: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  sourceKind: "official" | "primary" | "filing" | "reporting" | "market_data";
  occurredAt: string;
  observedAt: string;
  verification: "SOURCE_VERIFIED";
  authority: "FACTUAL_NEWS_NOT_CANONICAL_STORY";
};

export const BLUEBELLY_PUBLIC_NEWS_VERSION = "bluebelly-public-news/1" as const;
export const BLUEBELLY_PUBLIC_NEWS_MAX_AGE_MS = 48 * 60 * 60 * 1000;
const SOURCE_KINDS = new Set(["official", "primary", "filing", "reporting", "market_data"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function originalSource(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.href.length > 2048
      || (url.pathname === "/" && !url.search)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function projectBluebellyPublicNews(
  candidates: readonly NewsBriefV1[],
  now = new Date(),
  requestedLimit = 12,
): BluebellyPublicNewsItemV1[] {
  const clock = now.getTime();
  if (!Number.isFinite(clock)) return [];
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(0, Math.min(12, Math.trunc(requestedLimit)))
    : 0;
  if (limit === 0) return [];

  const seen = new Set<string>();
  const output: BluebellyPublicNewsItemV1[] = [];

  for (const row of candidates) {
    if (row.contractVersion !== "news-brief/1" || row.contentType !== "NEWS_BRIEF"
      || row.verification !== "SOURCE_VERIFIED" || !UUID.test(row.id)
      || !SOURCE_KINDS.has(row.sourceKind)) continue;
    const sourceUrl = originalSource(row.sourceUrl);
    if (!sourceUrl) continue;
    const occurred = Date.parse(row.occurredAt);
    const observed = Date.parse(row.observedAt);
    if (!Number.isFinite(occurred) || !Number.isFinite(observed) ||
      occurred > clock || observed > clock || observed < occurred ||
      clock - occurred > BLUEBELLY_PUBLIC_NEWS_MAX_AGE_MS) continue;

    const headline = row.headline.trim().replace(/\s+/g, " ");
    const summary = row.summary.trim().replace(/\s+/g, " ");
    const sourceName = row.sourceName.trim().replace(/\s+/g, " ");
    if (headline.length < 8 || summary.length < 25 || !sourceName ||
      sourceName.length > 160) continue;

    const key = sourceUrl + "|" + headline.toLowerCase() + "|" + row.occurredAt;
    if (seen.has(key)) continue;
    seen.add(key);

    // EXPLICIT positive field list. NEVER spread the input or append a raw
    // nested evidence/provenance/diagnostics object in a later refactor.
    output.push({
      id: row.id,
      headline: headline.slice(0, 240),
      summary: summary.slice(0, 700),
      sourceName,
      sourceUrl,
      sourceKind: row.sourceKind as BluebellyPublicNewsItemV1["sourceKind"],
      occurredAt: new Date(occurred).toISOString(),
      observedAt: new Date(observed).toISOString(),
      verification: "SOURCE_VERIFIED",
      authority: "FACTUAL_NEWS_NOT_CANONICAL_STORY",
    });
    if (output.length === limit) break;
  }
  return output;
}
