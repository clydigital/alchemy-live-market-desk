import { consecutiveOilContractMonths } from "./oil-futures-contracts.ts";

export type OilBenchmark = "WTI" | "BRENT";
const HASH = /^[a-f0-9]{64}$/i;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const DAY = /^20\d{2}-\d{2}-\d{2}$/;

export type OilExpiryOriginal = {
  id: string;
  source_url: string | null;
  content_hash: string | null;
  provider: string | null;
  content_type: string | null;
  payload: Record<string, unknown> | null;
};

function day(value: unknown): value is string {
  if (typeof value !== "string" || !DAY.test(value)) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function publisher(url: string, benchmark: OilBenchmark): boolean {
  try {
    const u = new URL(url);
    const host = benchmark === "WTI" ? "cmegroup.com" : "ice.com";
    return u.protocol === "https:" && (u.hostname === host || u.hostname.endsWith("." + host))
      && u.pathname.length > 8 && !/\/(?:current|latest)\//i.test(u.pathname);
  } catch { return false; }
}
function monthOrdinal(symbol: string, benchmark: OilBenchmark): number | null {
  const p = benchmark === "WTI" ? /^CL([FGHJKMNQUVXZ])(\d{2})$/ : /^(?:LCO|B)([FGHJKMNQUVXZ])(\d{2})$/;
  const m = p.exec(symbol.toUpperCase());
  if (!m) return null;
  const month = "FGHJKMNQUVXZ".indexOf(m[1]);
  return month < 0 ? null : Number(m[2]) * 12 + month;
}

/**
 * No normalised Evidence claim can manufacture its own F1 designation.
 * Original (publisher, content-addressed and byte-readback verified) expiry
 * calendar metadata must cover the full monthly listing for the trade date.
 * An adjacent contract pair is NOT automatically the first two eligible ones.
 *
 * A separate lawful calendar archival adapter must create the manifest.
 * With no authoritative expiry original, we intentionally return false.
 */
export function verifiedOilFrontEligibility(input: {
  benchmark: OilBenchmark;
  tradeDate: string;
  frontContract: string;
  nextContract: string;
  expiryRawRecordId: unknown;
  expiryOriginal: OilExpiryOriginal | null | undefined;
  availableAt: string | null;
}): boolean {
  const { benchmark, tradeDate, frontContract, nextContract, expiryRawRecordId, expiryOriginal: r } = input;
  // Both ICE codes must use the same approved publisher's symbology profile.
  const samePrefix = benchmark === "WTI" || (
    (frontContract.toUpperCase().startsWith("LCO") && nextContract.toUpperCase().startsWith("LCO"))
    || (/^B[FGHJKMNQUVXZ]\d{2}$/i.test(frontContract) && /^B[FGHJKMNQUVXZ]\d{2}$/i.test(nextContract))
  );
  if (!samePrefix || !day(tradeDate) || !consecutiveOilContractMonths(benchmark, frontContract, nextContract)
    || typeof expiryRawRecordId !== "string" || !UUID.test(expiryRawRecordId)
    || !r || r.id !== expiryRawRecordId || r.provider !== "OIL_EXPIRY_ORIGINAL"
    || typeof r.content_hash !== "string" || !HASH.test(r.content_hash)
    || typeof r.source_url !== "string" || !publisher(r.source_url, benchmark)
    || !["application/pdf", "text/csv", "text/html"].includes(r.content_type ?? "")) return false;

  const p = r.payload ?? {};
  const cap = typeof p.capturedAt === "string" ? Date.parse(p.capturedAt) : NaN;
  const av = Date.parse(input.availableAt ?? "");
  const calendar = p.expiries;
  const extension = r.content_type === "application/pdf" ? "pdf" :
    r.content_type === "text/csv" ? "csv" : "html";
  const provider = benchmark === "WTI" ? "CME" : "ICE";
  if (p.contractVersion !== "oil-expiry-original-archive/1"
    || p.benchmark !== benchmark || p.provider !== provider
    || p.archiveVerified !== true || p.fullMonthlyListing !== true
    || p.extractorProfileApproved !== true
    || p.archiveBucket !== "alchemy-oil-originals-private"
    || p.archivePath !== "EXPIRY/" + provider + "/" + r.content_hash.toLowerCase() + "." + extension
    || p.originalSourceSha256 !== r.content_hash.toLowerCase()
    || p.sourceUrl !== r.source_url || !Array.isArray(calendar) || calendar.length < 3
    || !Number.isFinite(cap) || !Number.isFinite(av) || cap > av
    || cap < Date.parse(tradeDate + "T00:00:00.000Z")) return false;

  const listing: Array<{ contract: string; lastTradeDate: string; ordinal: number }> = [];
  const seen = new Set<string>();
  for (const entry of calendar) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    const obj = entry as Record<string, unknown>;
    const symbol = obj.contract;
    const lastTradeDate = obj.lastTradeDate;
    if (typeof symbol !== "string" || !day(lastTradeDate)) return false;
    const ordinal = monthOrdinal(symbol, benchmark);
    if (ordinal === null || seen.has(symbol.toUpperCase())) return false;
    seen.add(symbol.toUpperCase());
    listing.push({ contract: symbol.toUpperCase(), lastTradeDate, ordinal });
  }
  // The original full listing must include the immediate prior contract,
  // proving it had already expired by the requested session.
  const frontOrdinal = monthOrdinal(frontContract, benchmark);
  if (frontOrdinal === null) return false;
  const previous = listing.find(x => x.ordinal === frontOrdinal - 1);
  if (!previous || previous.lastTradeDate >= tradeDate) return false;
  // Every earlier listed contract must have expired, and the two earliest
  // still-tradable monthly futures are the requested F1 and F2.
  if (listing.some(x => x.ordinal < frontOrdinal && x.lastTradeDate >= tradeDate)) return false;
  const active = listing.filter(x => x.lastTradeDate >= tradeDate).sort((a, b) => a.ordinal - b.ordinal);
  return active.length >= 2
    && active[0].contract === frontContract.toUpperCase()
    && active[1].contract === nextContract.toUpperCase()
    && active[0].lastTradeDate < active[1].lastTradeDate;
}
