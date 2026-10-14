/** Dated, directly observed five-session nominal Treasury movements. */
export const NOMINAL_CURVE_IDS = ["us2y", "us5y-fred", "us10y-fred", "us20y-fred", "us30y-fred"] as const;
export type NominalCurveId = (typeof NOMINAL_CURVE_IDS)[number];
export type DatedRateHistoryRow = {
  id: string;
  asOf: string | null;
  last: number | null;
  sourceName: string;
  points?: Array<{ time: number; close: number }>;
};
export type MatchedNominalCurveChange = {
  baselineDate: string;
  latestDate: string;
  matchedSessions: 5;
  changeBp: Record<NominalCurveId, number>;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TRUSTED_SOURCES = new Set(["U.S. Department of the Treasury", "Federal Reserve Economic Data"]);

/**
 * Uses exactly six common **observation** dates (five intervals), not five
 * calendar days or percentage returns on yields. Incomplete/mismatched
 * maturity histories fail closed rather than manufacturing a movement.
 */
export function deriveMatchedNominalCurveChange(
  rows: DatedRateHistoryRow[], asOf: string,
): MatchedNominalCurveChange | null {
  if (!DATE_RE.test(asOf) || !Number.isFinite(Date.parse(asOf + "T00:00:00Z"))) return null;
  const series = new Map<NominalCurveId, Map<string, number>>();
  for (const id of NOMINAL_CURVE_IDS) {
    const row = rows.find((candidate) => candidate.id === id);
    if (!row || row.asOf !== asOf || !TRUSTED_SOURCES.has(row.sourceName) || !row.points?.length
      || row.last === null || !Number.isFinite(row.last)) return null;
    const history = new Map<string, number>();
    for (const point of row.points) {
      if (!Number.isFinite(point.time) || !Number.isFinite(point.close)
        || point.close < -10 || point.close > 30) continue;
      const date = new Date(point.time * 1000).toISOString().slice(0, 10);
      if (date > asOf) continue;
      const previous = history.get(date);
      if (previous !== undefined && previous !== point.close) return null;
      history.set(date, point.close);
    }
    if (history.get(asOf) !== row.last) return null;
    series.set(id, history);
  }
  const first = series.get(NOMINAL_CURVE_IDS[0])!;
  const commonDays = [...first.keys()]
    .filter((day) => NOMINAL_CURVE_IDS.every((id) => series.get(id)?.has(day)))
    .sort((left, right) => left.localeCompare(right));
  if (commonDays.at(-1) !== asOf || commonDays.length < 6) return null;
  const baselineDate = commonDays.at(-6)!;
  const baselineMs = Date.parse(baselineDate + "T00:00:00Z");
  const latestMs = Date.parse(asOf + "T00:00:00Z");
  // Prevent a prolonged gap being presented as normal five-session momentum.
  if (latestMs - baselineMs > 14 * 86_400_000) return null;
  const changeBp = {} as Record<NominalCurveId, number>;
  for (const id of NOMINAL_CURVE_IDS) {
    const history = series.get(id)!;
    changeBp[id] = Number(((history.get(asOf)! - history.get(baselineDate)!) * 100).toFixed(1));
  }
  return { baselineDate, latestDate: asOf, matchedSessions: 5, changeBp };
}
