/**
 * US employment composition, using a non-overlapping partition of the BLS CES
 * major sectors. Observations are CURRENT API VINTAGE, not necessarily the
 * numbers printed in an archived original release.
 *
 * Sources: BLS CES series structure and published-sector table.
 * Units: seasonally adjusted employment levels in thousands of jobs.
 */
export const BLS_MAJOR_SECTORS = [
  { key: "mining_logging", label: "Mining and logging", id: "CES1000000001" },
  { key: "construction", label: "Construction", id: "CES2000000001" },
  { key: "manufacturing", label: "Manufacturing", id: "CES3000000001" },
  { key: "wholesale", label: "Wholesale trade", id: "CES4142000001" },
  { key: "retail", label: "Retail trade", id: "CES4200000001" },
  { key: "transport_warehousing", label: "Transportation and warehousing", id: "CES4300000001" },
  { key: "utilities", label: "Utilities", id: "CES4422000001" },
  { key: "information", label: "Information", id: "CES5000000001" },
  { key: "financial", label: "Financial activities", id: "CES5500000001" },
  { key: "professional_business", label: "Professional and business services", id: "CES6000000001" },
  { key: "education_health", label: "Private education and health services", id: "CES6500000001" },
  { key: "leisure_hospitality", label: "Leisure and hospitality", id: "CES7000000001" },
  { key: "other_services", label: "Other services", id: "CES8000000001" },
  { key: "government", label: "Government", id: "CES9000000001" },
] as const;

export const BLS_WORKER_CONDITIONS = [
  { key: "u6_rate", label: "U-6 underemployment rate", id: "LNS13327709", unit: "%" },
  { key: "private_weekly_hours", label: "Average private-sector weekly hours", id: "CES0500000002", unit: "hours" },
] as const;

export const BLS_LABOUR_EXTRA_IDS = [
  ...BLS_MAJOR_SECTORS.map(sector => sector.id),
  ...BLS_WORKER_CONDITIONS.map(metric => metric.id),
];

export type BlsMonthlyPoint = { year: string; period: string; value: string };
export type BlsMonthlySeries = { seriesID: string; data: BlsMonthlyPoint[] };

export type LabourSectorChange = {
  key: string;
  label: string;
  seriesId: string;
  currentLevelK: number | null;
  previousLevelK: number | null;
  changeK: number;
};
export type WorkerCondition = {
  key: string;
  label: string;
  seriesId: string;
  unit: string;
  current: number;
  previous: number;
};
export type BlsLabourComposition = {
  referencePeriod: string;
  sectors: LabourSectorChange[];
  conditions: WorkerCondition[];
  missingSeries: string[];
  coverageComplete: boolean;
  /** null unless ALL 14 disjoint major sectors were successfully retrieved */
  breadth: null | {
    growingSectors: number;
    shrinkingSectors: number;
    unchangedSectors: number;
    shrinkingShare: number;
    netSectorChangeK: number;
  };
};

function monthlyValue(
  series: BlsMonthlySeries | undefined,
  year: number,
  month: number,
): number | null {
  const period = "M" + String(month).padStart(2, "0");
  const point = series?.data?.find(row => row.year === String(year) && row.period === period);
  if (!point || !point.value.trim() || point.value.trim() === ".") return null;
  const value = Number(point.value);
  return Number.isFinite(value) ? value : null;
}
function priorMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}
function rounded(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

/** Do not aggregate parent+child CES groups; count the disjoint major sectors only.
 * Do not call a single shrinking sector "job losses across the economy".
 * Missing or invalid source cells never become zero.
 */
export function parseBlsLabourComposition(
  input: readonly BlsMonthlySeries[],
  year: number,
  month: number,
): BlsLabourComposition {
  if (!Number.isInteger(year) || year < 1939 || year > 2100
      || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Invalid BLS reference month");
  }
  const byId = new Map(input.map(item => [item.seriesID, item]));
  const prior = priorMonth(year, month);
  const missingSeries: string[] = [];
  const sectors: LabourSectorChange[] = [];
  const conditions: WorkerCondition[] = [];

  for (const sector of BLS_MAJOR_SECTORS) {
    const current = monthlyValue(byId.get(sector.id), year, month);
    const previous = monthlyValue(byId.get(sector.id), prior.year, prior.month);
    if (current === null || previous === null) {
      missingSeries.push(sector.id);
      continue;
    }
    sectors.push({
      key: sector.key, label: sector.label, seriesId: sector.id,
      currentLevelK: current, previousLevelK: previous,
      changeK: rounded(current - previous),
    });
  }
  for (const condition of BLS_WORKER_CONDITIONS) {
    const current = monthlyValue(byId.get(condition.id), year, month);
    const previous = monthlyValue(byId.get(condition.id), prior.year, prior.month);
    if (current === null || previous === null) {
      missingSeries.push(condition.id);
      continue;
    }
    conditions.push({
      key: condition.key, label: condition.label, seriesId: condition.id,
      unit: condition.unit, current, previous,
    });
  }

  const coverageComplete = sectors.length === BLS_MAJOR_SECTORS.length;
  const growingSectors = sectors.filter(row => row.changeK > 0).length;
  const shrinkingSectors = sectors.filter(row => row.changeK < 0).length;
  const unchangedSectors = sectors.filter(row => row.changeK === 0).length;
  const breadth = coverageComplete ? {
    growingSectors, shrinkingSectors, unchangedSectors,
    shrinkingShare: rounded(shrinkingSectors / sectors.length),
    netSectorChangeK: rounded(sectors.reduce((sum, row) => sum + row.changeK, 0)),
  } : null;
  return {
    referencePeriod: String(year) + "-" + String(month).padStart(2, "0"),
    sectors, conditions, missingSeries, coverageComplete, breadth,
  };
}


export type LabourDivergence = {
  code: "PAYROLL_VS_U6" | "PAYROLL_VS_WEEKLY_HOURS" |
    "PAYROLL_VS_BREADTH" | "CONSUMER_EXPOSED_SECTORS";
  severity: "watch";
  finding: string;
  /** A candidate relationship, NOT proof of a recession or spending collapse. */
  nextTest: string;
};

/**
 * Detect observed, point-in-time contradictions, not causal explanations.
 * Positive payroll CHANGE is not a consensus beat. That requires a separate
 * pre-release frozen forecast that this function deliberately does not accept.
 * A single sector decline is never counted as a company layoff or gross loss.
 */
export function detectBlsLabourDivergences(
  payrollChangeK: number | null,
  composition: BlsLabourComposition,
): LabourDivergence[] {
  if (payrollChangeK === null || !Number.isFinite(payrollChangeK) || payrollChangeK <= 0) return [];
  const output: LabourDivergence[] = [];
  const u6 = composition.conditions.find(condition => condition.key === "u6_rate");
  if (u6 && u6.current - u6.previous >= 0.2 - 0.00001) {
    output.push({
      code: "PAYROLL_VS_U6", severity: "watch",
      finding: "Payrolls increased while U-6 underemployment rose at least 0.2 percentage points.",
      nextTest: "Check involuntary part-time employment, participation and persistence over subsequent releases.",
    });
  }
  const hours = composition.conditions.find(condition => condition.key === "private_weekly_hours");
  if (hours && hours.previous - hours.current >= 0.1 - 0.00001) {
    output.push({
      code: "PAYROLL_VS_WEEKLY_HOURS", severity: "watch",
      finding: "Payrolls increased while average private-sector weekly hours declined.",
      nextTest: "Check aggregate hours worked, real weekly earnings and whether hours rebound next month.",
    });
  }
  if (composition.coverageComplete && composition.breadth
    && composition.breadth.shrinkingSectors >= 7) {
    output.push({
      code: "PAYROLL_VS_BREADTH", severity: "watch",
      finding: "Payrolls grew while at least half of the 14 nonoverlapping major industries contracted.",
      nextTest: "Check three-month sector breadth, revisions and sampling uncertainty.",
    });
  }
  // For this observation to be meaningful, BOTH sectors must be present.
  // Retail and services spending are different series; this is a research lead only.
  const leisure = composition.sectors.find(sector => sector.key === "leisure_hospitality");
  const wholesale = composition.sectors.find(sector => sector.key === "wholesale");
  if (leisure && wholesale && leisure.changeK < 0 && wholesale.changeK < 0) {
    output.push({
      code: "CONSUMER_EXPOSED_SECTORS", severity: "watch",
      finding: "Leisure/hospitality and wholesale employment declined despite rising aggregate payrolls.",
      nextTest: "Check retail sales, real PCE, leisure spending, sector volatility and subsequent revisions; do not infer spending from employment alone.",
    });
  }
  return output;
}
