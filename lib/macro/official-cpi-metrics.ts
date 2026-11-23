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

/** Official BLS October 2026 annual CPI rates are unavailable because most October
 * 2025 comparison indexes were not published. Never infer or fill these values. */
const PUBLISHED_MONTHLY_ONLY = /^Headline CPI\s+([+-]?\d+(?:\.\d+)?)%\s+m\/m;\s+y\/y unavailable \(BLS\);\s*Core\s+([+-]?\d+(?:\.\d+)?)%\s+m\/m;\s+y\/y unavailable \(BLS\)$/i;

export function parseOfficialCpiMetricRows(summary: string, previous: CpiPreviousValues = {}): OfficialCpiMetric[] {
  const partial = PUBLISHED_MONTHLY_ONLY.exec(summary.trim());
  if (partial) {
    const monthly = [Number(partial[1]),Number(partial[2])];
    if(monthly.some(value=>!Number.isFinite(value)||Math.abs(value)>20))return [];
    return [
      {metric_key:"cpi_headline_mom",label:"Headline CPI m/m",transformation:"mom",unit:"%",actual:monthly[0],
        previous:typeof previous.cpi_headline_mom==="number"?previous.cpi_headline_mom:null},
      {metric_key:"cpi_core_mom",label:"Core CPI m/m",transformation:"mom",unit:"%",actual:monthly[1],
        previous:typeof previous.cpi_core_mom==="number"?previous.cpi_core_mom:null},
    ];
  }
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
