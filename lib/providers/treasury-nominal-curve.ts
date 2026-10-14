/** Official U.S. Treasury nominal constant-maturity yields; dated source observations only. */
import { treasuryYieldCurveUrl } from "./treasury-bills.ts";

export const NOMINAL_TREASURY_TENORS = {
  "us2y": "BC_2YEAR",
  "us5y-fred": "BC_5YEAR",
  "us10y-fred": "BC_10YEAR",
  "us20y-fred": "BC_20YEAR",
  "us30y-fred": "BC_30YEAR",
} as const;
export type NominalTreasuryMonitorId = keyof typeof NOMINAL_TREASURY_TENORS;
export type TreasuryCurvePoint = { date: string; yieldPercent: number };
export type TreasuryNominalCurve = {
  status: "OK" | "PARTIAL" | "UNAVAILABLE";
  sourceUrl: string;
  series: Record<NominalTreasuryMonitorId, TreasuryCurvePoint[]>;
  warning: string | null;
};

function tagValue(entry: string, localName: string): string | null {
  const pattern = new RegExp("<(?:[A-Za-z0-9_-]+:)?" + localName + "\\b[^>]*>([^<]+)</(?:[A-Za-z0-9_-]+:)?" + localName + ">", "i");
  return entry.match(pattern)?.[1]?.trim() ?? null;
}

/** Parse the Treasury Atom feed without substituting a different instrument. */
export function parseTreasuryNominalCurve(xml: string): TreasuryNominalCurve["series"] {
  const series = Object.fromEntries(Object.keys(NOMINAL_TREASURY_TENORS).map((id) => [id, []])) as TreasuryNominalCurve["series"];
  const entries = xml.match(/<(?:[A-Za-z0-9_-]+:)?entry\b[\s\S]*?<\/(?:[A-Za-z0-9_-]+:)?entry>/gi) ?? [];
  for (const entry of entries) {
    const rawDate = tagValue(entry, "NEW_DATE");
    const day = rawDate?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
    if (!day || !Number.isFinite(Date.parse(day + "T00:00:00Z"))) continue;
    for (const [id, tag] of Object.entries(NOMINAL_TREASURY_TENORS) as [NominalTreasuryMonitorId, string][]) {
      const raw = tagValue(entry, tag);
      if (raw === null || raw === "") continue;
      const value = Number(raw.replace(/,/g, ""));
      if (!Number.isFinite(value) || value < 0 || value > 30) continue;
      series[id].push({ date: day, yieldPercent: value });
    }
  }
  for (const id of Object.keys(NOMINAL_TREASURY_TENORS) as NominalTreasuryMonitorId[]) {
    const unique = new Map(series[id].map((point) => [point.date, point]));
    series[id] = [...unique.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-300);
  }
  return series;
}

export async function fetchTreasuryNominalCurve(now = new Date()): Promise<TreasuryNominalCurve> {
  const sourceUrl = treasuryYieldCurveUrl(now);
  const empty = parseTreasuryNominalCurve("");
  try {
    const response = await fetch(sourceUrl, {
      headers: { accept: "application/xml,text/xml;q=0.9,*/*;q=0.1", "user-agent": "Alchemy Live Desk nominal rates" },
      next: { revalidate: 60 * 60 },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return { status: "UNAVAILABLE", sourceUrl, series: empty, warning: "TREASURY_HTTP_" + response.status };
    const series = parseTreasuryNominalCurve(await response.text());
    const available = Object.values(series).filter((points) => points.length > 0).length;
    return { status: available === 5 ? "OK" : available > 0 ? "PARTIAL" : "UNAVAILABLE", sourceUrl, series, warning: available === 5 ? null : "TREASURY_CURVE_" + available + "_OF_5" };
  } catch {
    return { status: "UNAVAILABLE", sourceUrl, series: empty, warning: "TREASURY_REQUEST_FAILED" };
  }
}
