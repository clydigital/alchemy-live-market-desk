export type TreasuryBillProviderStatus = "OK" | "STALE" | "PARTIAL" | "UNAVAILABLE";

export type TreasuryBillPoint = {
  tenor: "3M" | "6M";
  date: string;
  yieldPercent: number;
};

export type TreasuryBillSnapshot = {
  status: TreasuryBillProviderStatus;
  fetchedAt: string;
  asOf: string | null;
  sourceName: "U.S. Department of the Treasury";
  sourceUrl: string;
  points: TreasuryBillPoint[];
  warnings: string[];
};

export function treasuryYieldCurveUrl(now = new Date()) {
  const year = now.getUTCFullYear();
  return `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=${year}`;
}

function tagValue(entry: string, localName: string) {
  const match = entry.match(new RegExp(`<(?:[A-Za-z0-9_-]+:)?${localName}\\b[^>]*>([^<]+)</(?:[A-Za-z0-9_-]+:)?${localName}>`, "i"));
  return match?.[1]?.trim() ?? null;
}

function numeric(value: string | null) {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function dateOnly(value: string | null) {
  const match = value?.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

function ageDays(value: string | null, now: Date) {
  if (!value) return Infinity;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) ? Math.max(0, (now.getTime() - parsed) / 86_400_000) : Infinity;
}

export function parseTreasuryBillSnapshot(
  xml: string,
  now = new Date(),
  sourceUrl = treasuryYieldCurveUrl(now),
): TreasuryBillSnapshot {
  const fetchedAt = now.toISOString();
  const entries = xml.match(/<(?:[A-Za-z0-9_-]+:)?entry\b[\s\S]*?<\/(?:[A-Za-z0-9_-]+:)?entry>/gi) ?? [];
  const observations = entries.flatMap((entry) => {
    const date = dateOnly(tagValue(entry, "NEW_DATE"));
    if (!date) return [];
    return [{
      date,
      m3: numeric(tagValue(entry, "BC_3MONTH")),
      m6: numeric(tagValue(entry, "BC_6MONTH")),
    }];
  }).sort((a, b) => b.date.localeCompare(a.date));

  const latest3 = observations.find((item) => item.m3 !== null) ?? null;
  const latest6 = observations.find((item) => item.m6 !== null) ?? null;
  const points: TreasuryBillPoint[] = [
    ...(latest3 ? [{ tenor: "3M" as const, date: latest3.date, yieldPercent: latest3.m3! }] : []),
    ...(latest6 ? [{ tenor: "6M" as const, date: latest6.date, yieldPercent: latest6.m6! }] : []),
  ];
  const asOf = points.map((item) => item.date).sort().at(-1) ?? null;
  const warnings: string[] = [];
  if (!latest3) warnings.push("3M Treasury yield is missing from the Treasury feed.");
  if (!latest6) warnings.push("6M Treasury yield is missing from the Treasury feed.");
  const stale = ageDays(asOf, now) > 5;
  if (stale && asOf) warnings.push(`Latest Treasury bill-tenor observation ${asOf} is more than five calendar days old.`);

  const status: TreasuryBillProviderStatus = !points.length
    ? "UNAVAILABLE"
    : points.length < 2
      ? "PARTIAL"
      : stale
        ? "STALE"
        : "OK";

  return {
    status,
    fetchedAt,
    asOf,
    sourceName: "U.S. Department of the Treasury",
    sourceUrl,
    points,
    warnings,
  };
}

export async function fetchTreasuryBills(
  now = new Date(),
): Promise<TreasuryBillSnapshot> {
  const sourceUrl = treasuryYieldCurveUrl(now);
  try {
    const response = await fetch(sourceUrl, {
      headers: {
        Accept: "application/xml,text/xml;q=0.9,*/*;q=0.1",
        "User-Agent": "Alchemy Live Desk monetary signals",
      },
      next: { revalidate: 60 * 60 * 6 },
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parseTreasuryBillSnapshot(await response.text(), now, sourceUrl);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown provider failure";
    return {
      status: "UNAVAILABLE",
      fetchedAt: now.toISOString(),
      asOf: null,
      sourceName: "U.S. Department of the Treasury",
      sourceUrl,
      points: [],
      warnings: [`Treasury bill-tenor acquisition failed: ${detail}`],
    };
  }
}
