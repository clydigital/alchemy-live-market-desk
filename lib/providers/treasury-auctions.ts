export const TREASURY_AUCTIONS_API_URL =
  "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/auctions_query";

export type TreasuryAuctionProviderStatus = "OK" | "STALE" | "PARTIAL" | "UNAVAILABLE";

export type TreasuryAuctionObservation = {
  cusip: string;
  securityType: "Note" | "Bond";
  securityTerm: string;
  auctionDate: string;
  issueDate: string | null;
  maturityDate: string | null;
  highYieldPct: number | null;
  bidToCover: number | null;
  offeringAmountUsd: number | null;
  competitiveAcceptedUsd: number | null;
  primaryDealerAcceptedUsd: number | null;
  directBidderAcceptedUsd: number | null;
  indirectBidderAcceptedUsd: number | null;
  primaryDealerAcceptedPct: number | null;
  directBidderAcceptedPct: number | null;
  indirectBidderAcceptedPct: number | null;
};

export type TreasuryAuctionSnapshot = {
  status: TreasuryAuctionProviderStatus;
  fetchedAt: string;
  asOf: string | null;
  sourceName: "U.S. Department of the Treasury · Fiscal Data";
  sourceUrl: string;
  auctions: TreasuryAuctionObservation[];
  warnings: string[];
};

type FiscalDataAuctionRow = Record<string, string | null | undefined>;

function numeric(value: string | null | undefined) {
  if (!value || value === "null") return null;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function dateOnly(value: string | null | undefined) {
  const match = value?.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

function pctOf(part: number | null, whole: number | null) {
  if (part === null || whole === null || whole <= 0) return null;
  return Number(((part / whole) * 100).toFixed(1));
}

function ageDays(value: string | null, now: Date) {
  if (!value) return Infinity;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) ? Math.max(0, (now.getTime() - parsed) / 86_400_000) : Infinity;
}

const NOMINAL_TERMS = new Set([
  "2-Year",
  "3-Year",
  "5-Year",
  "7-Year",
  "10-Year",
  "20-Year",
  "30-Year",
]);

export function parseTreasuryAuctionSnapshot(
  payload: unknown,
  now = new Date(),
  sourceUrl = TREASURY_AUCTIONS_API_URL,
): TreasuryAuctionSnapshot {
  const fetchedAt = now.toISOString();
  const rows = payload && typeof payload === "object" && !Array.isArray(payload)
    && Array.isArray((payload as { data?: unknown }).data)
    ? ((payload as { data: FiscalDataAuctionRow[] }).data)
    : [];

  const observations = rows.flatMap((row) => {
    const securityType = row.security_type === "Note" || row.security_type === "Bond"
      ? row.security_type
      : null;
    const securityTerm = (row.original_security_term || row.security_term || "").trim();
    const auctionDate = dateOnly(row.auction_date);
    const cusip = row.cusip?.trim() || "";
    if (!securityType || !NOMINAL_TERMS.has(securityTerm) || !auctionDate || !cusip) return [];
    if (String(row.inflation_index_security ?? "").toLowerCase() === "yes") return [];
    if (String(row.floating_rate ?? "").toLowerCase() === "yes") return [];

    const competitiveAccepted = numeric(row.comp_accepted);
    const primaryDealerAccepted = numeric(row.primary_dealer_accepted);
    const directBidderAccepted = numeric(row.direct_bidder_accepted);
    const indirectBidderAccepted = numeric(row.indirect_bidder_accepted);

    return [{
      cusip,
      securityType,
      securityTerm,
      auctionDate,
      issueDate: dateOnly(row.issue_date),
      maturityDate: dateOnly(row.maturity_date),
      highYieldPct: numeric(row.high_yield),
      bidToCover: numeric(row.bid_to_cover_ratio),
      offeringAmountUsd: numeric(row.offering_amt),
      competitiveAcceptedUsd: competitiveAccepted,
      primaryDealerAcceptedUsd: primaryDealerAccepted,
      directBidderAcceptedUsd: directBidderAccepted,
      indirectBidderAcceptedUsd: indirectBidderAccepted,
      primaryDealerAcceptedPct: pctOf(primaryDealerAccepted, competitiveAccepted),
      directBidderAcceptedPct: pctOf(directBidderAccepted, competitiveAccepted),
      indirectBidderAcceptedPct: pctOf(indirectBidderAccepted, competitiveAccepted),
    } satisfies TreasuryAuctionObservation];
  })
    .sort((a, b) => b.auctionDate.localeCompare(a.auctionDate));

  // Preserve the latest nominal coupon auction for each governed maturity so a
  // busy bill calendar cannot crowd out long-end demand evidence.
  const byTerm = new Map<string, TreasuryAuctionObservation>();
  for (const item of observations) {
    if (!byTerm.has(item.securityTerm)) byTerm.set(item.securityTerm, item);
  }
  const auctions = [...byTerm.values()]
    .sort((a, b) => b.auctionDate.localeCompare(a.auctionDate))
    .slice(0, 7);
  const asOf = auctions[0]?.auctionDate ?? null;
  const warnings: string[] = [];

  if (!auctions.length) warnings.push("No recent nominal coupon Treasury auctions were returned.");
  const stale = ageDays(asOf, now) > 45;
  if (stale && asOf) warnings.push(`Latest nominal coupon auction ${asOf} is more than 45 calendar days old.`);
  if (auctions.some((item) => item.highYieldPct === null || item.bidToCover === null)) {
    warnings.push("One or more Treasury auction rows are missing high-yield or bid-to-cover fields.");
  }

  const status: TreasuryAuctionProviderStatus = !auctions.length
    ? "UNAVAILABLE"
    : stale
      ? "STALE"
      : auctions.length < 3
        ? "PARTIAL"
        : "OK";

  return {
    status,
    fetchedAt,
    asOf,
    sourceName: "U.S. Department of the Treasury · Fiscal Data",
    sourceUrl,
    auctions,
    warnings,
  };
}

export function treasuryAuctionQueryUrl(now = new Date()) {
  const end = now.toISOString().slice(0, 10);
  const start = new Date(now.getTime() - 45 * 86_400_000).toISOString().slice(0, 10);
  const fields = [
    "cusip",
    "security_type",
    "security_term",
    "original_security_term",
    "auction_date",
    "issue_date",
    "maturity_date",
    "high_yield",
    "bid_to_cover_ratio",
    "offering_amt",
    "comp_accepted",
    "primary_dealer_accepted",
    "direct_bidder_accepted",
    "indirect_bidder_accepted",
    "inflation_index_security",
    "floating_rate",
  ].join(",");
  const params = new URLSearchParams({
    fields,
    filter: `auction_date:gte:${start},auction_date:lte:${end}`,
    sort: "-auction_date",
    "page[size]": "100",
  });
  return `${TREASURY_AUCTIONS_API_URL}?${params.toString()}`;
}

export async function fetchTreasuryAuctions(
  now = new Date(),
  fetchImpl: typeof fetch = fetch,
): Promise<TreasuryAuctionSnapshot> {
  const sourceUrl = treasuryAuctionQueryUrl(now);
  try {
    const response = await fetchImpl(sourceUrl, {
      headers: {
        accept: "application/json",
        "user-agent": "Alchemy Live Desk Treasury auction adapter",
      },
      next: { revalidate: 60 * 30 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parseTreasuryAuctionSnapshot(await response.json(), now, sourceUrl);
  } catch (error) {
    return {
      status: "UNAVAILABLE",
      fetchedAt: now.toISOString(),
      asOf: null,
      sourceName: "U.S. Department of the Treasury · Fiscal Data",
      sourceUrl,
      auctions: [],
      warnings: [`Treasury auction acquisition failed: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}
