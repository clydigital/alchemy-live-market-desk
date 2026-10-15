/** Strict, unit-preserving extraction from the already verified BLS release summary.
 * Actuals are official observations; consensus must be captured separately before release. */
export type CpiMetricKey = "cpi_headline_mom" | "cpi_headline_yoy" | "cpi_core_mom" | "cpi_core_yoy";

export type OfficialCpiMetric = {
  metric_key: CpiMetricKey;
  label: string;
  transformation: "mom" | "yoy";
  unit: "%";
  actual: number;
  previous: number | null;
};

export type CpiPreviousValues = Partial<Record<CpiMetricKey, number>>;

const PATTERN = /^Headline CPI\s+([+-]?\d+(?:\.\d+)?)%\s+m\/m;\s*([+-]?\d+(?:\.\d+)?)%\s+y\/y;\s*Core\s+([+-]?\d+(?:\.\d+)?)%\s+m\/m;\s*([+-]?\d+(?:\.\d+)?)%\s+y\/y$/i;

export function parseOfficialCpiMetricRows(summary: string, previous: CpiPreviousValues = {}): OfficialCpiMetric[] {
  const match = PATTERN.exec(summary.trim());
  if (!match) return [];
  const actuals = match.slice(1).map(Number);
  if (actuals.some((value) => !Number.isFinite(value) || Math.abs(value) > 100)) return [];
  const specifications = [
    ["cpi_headline_mom", "Headline CPI m/m", "mom"],
    ["cpi_headline_yoy", "Headline CPI y/y", "yoy"],
    ["cpi_core_mom", "Core CPI m/m", "mom"],
    ["cpi_core_yoy", "Core CPI y/y", "yoy"],
  ] as const;

  return specifications.map(([metric_key, label, transformation], index) => ({
    metric_key,
    label,
    transformation,
    unit: "%",
    actual: actuals[index],
    previous: typeof previous[metric_key] === "number" && Number.isFinite(previous[metric_key])
      ? previous[metric_key]!
      : null,
  }));
}
