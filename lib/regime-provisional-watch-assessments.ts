import type {
  RegimeAssumptionObservationReport,
  RegimeMetricRead,
} from "./regime-assumption-observations.ts";

/**
 * Point-in-time research watch diagnostics, NOT calibrated signals or Regime
 * mutations. One valid market change is neither a causal verdict nor an
 * independently verified second confirmation channel.
 */
export const REGIME_WATCH_ASSESSMENT_VERSION = "regime-watch-assessments/1" as const;

export type ProvisionalWatchStatus =
  | "BELOW_PROVISIONAL_WATCH"
  | "MET_RESEARCH_WATCH_ONLY"
  | "NOT_COMPARABLE"
  | "DATA_GAP"
  | "STALE_OR_INVALID";

export type ProvisionalWatchRead = {
  id: string;
  regime: "AI" | "US_RATES" | "EQUITY";
  label: string;
  status: ProvisionalWatchStatus;
  observedValue: number | null;
  /** May display a contextual non-equivalent value; never compare it to watchThreshold. */
  nonComparableContext: number | null;
  observedUnit: string | null;
  threshold: number | null;
  thresholdUnit: string | null;
  distanceToThreshold: number | null;
  observationAt: string | null;
  canonicalEvidenceUuid: string | null;
  dossierCited: boolean;
  missingRequirements: string[];
  optimisticFalsifier: string;
  interpretation: "UNADJUDICATED";
  calibratedProbability: null;
};

export type ProvisionalWatchReport = {
  contractVersion: typeof REGIME_WATCH_ASSESSMENT_VERSION;
  dossierId: string;
  asOf: string;
  checks: ProvisionalWatchRead[];
  automaticRegimeChanges: false;
  documentation: "RESEARCH_WATCH_ONLY_NOT_A_CALIBRATED_SIGNAL";
};

function metric(report: RegimeAssumptionObservationReport, assumptionId: string, key: string): RegimeMetricRead | null {
  return report.assumptions.find((a) => a.assumptionId === assumptionId)?.metrics.find((m) => m.key === key) ?? null;
}
function base(input: {
  id: string; regime: ProvisionalWatchRead["regime"]; label: string; threshold: number | null;
  thresholdUnit: string | null; missingRequirements: string[]; optimisticFalsifier: string;
}): ProvisionalWatchRead {
  return {
    ...input,
    status: "DATA_GAP",
    observedValue: null,
    nonComparableContext: null,
    observedUnit: null,
    distanceToThreshold: null,
    observationAt: null,
    canonicalEvidenceUuid: null,
    dossierCited: false,
    interpretation: "UNADJUDICATED",
    calibratedProbability: null,
  };
}

/** HY 20-session OAS is a like-for-like bp difference; 50bp is PROVISIONAL. */
function hyCreditWatch(report: RegimeAssumptionObservationReport): ProvisionalWatchRead {
  const item = base({
    id: "credit-hy-oas-20s-watch",
    regime: "US_RATES",
    label: "Broad HY OAS widening over 20 matched sessions",
    threshold: 50,
    thresholdUnit: "basis_points",
    missingRequirements: [
      "Independent borrower/issuer credit or funding corroboration for any Regime change",
      "At least 3–5 years' comparable data to calibrate threshold false positives",
    ],
    optimisticFalsifier: "Matched HY spread tightening with maintained refinancing access.",
  });
  const reading = metric(report, "B3", "hy_oas_20s");
  if (!reading) return item;
  item.observationAt = reading.observationAt;
  item.dossierCited = reading.citedInDossier;
  if (reading.quality !== "CURRENT" || reading.evidenceUuid === null || reading.value === null
      || reading.unit !== "basis_points" || reading.windowSessions !== 20
      || reading.basis !== "OAS_LEVEL_CHANGE") {
    item.status = reading.quality === "MISSING" ? "DATA_GAP" : "STALE_OR_INVALID";
    item.missingRequirements.push("Current canonically identified 20-session HY OAS bp observation");
    return item;
  }
  item.observedValue = reading.value;
  item.observedUnit = reading.unit;
  item.canonicalEvidenceUuid = reading.evidenceUuid;
  item.distanceToThreshold = Number((reading.value - 50).toFixed(2));
  item.status = reading.value >= 50 ? "MET_RESEARCH_WATCH_ONLY" : "BELOW_PROVISIONAL_WATCH";
  return item;
}

/** 20-session price-return SMH/QQQ is NOT 10-session total return. */
function smhTotalReturnWatch(report: RegimeAssumptionObservationReport): ProvisionalWatchRead {
  const item = base({
    id: "ai-equity-leadership-divergence",
    regime: "AI",
    label: "SMH minus QQQ 10-session adjusted total-return divergence",
    threshold: -5,
    thresholdUnit: "percentage_points",
    missingRequirements: [
      "10 matched completed trading sessions (not 20)",
      "Dividend/split-adjusted total returns, same closing calendar and currency",
      "Independent semiconductor guidance/earnings revision confirmation",
    ],
    optimisticFalsifier: "Restored SMH/QQQ participation accompanied by rising supplier earnings estimates.",
  });
  const reading = metric(report, "A5", "smh_qqq_20s");
  if (reading?.quality === "CURRENT" && reading.value !== null) {
    item.status = "NOT_COMPARABLE";
    item.nonComparableContext = reading.value;
    item.observationAt = reading.observationAt;
    item.dossierCited = reading.citedInDossier;
    // Do not borrow a source UUID to assert the requested total-return test.
  } else if (reading && reading.quality !== "MISSING") item.status = "STALE_OR_INVALID";
  return item;
}

/** XLF vs S&P 500 *cash* price return is NOT XLF vs SPY total return. */
function xlfTotalReturnWatch(report: RegimeAssumptionObservationReport): ProvisionalWatchRead {
  const item = base({
    id: "xlf-relative-leadership",
    regime: "EQUITY",
    label: "XLF minus SPY 20-session adjusted total-return divergence",
    threshold: -5,
    thresholdUnit: "percentage_points",
    missingRequirements: [
      "Matched XLF and SPY total-return observations (not S&P 500 cash-index close)",
      "Dividend-adjusted comparable source and corporate-action adjustments",
      "Independent bank loss/provisions or HY credit confirmation before escalation",
    ],
    optimisticFalsifier: "Financial leadership stabilises alongside falling delinquencies and steady credit spreads.",
  });
  const reading = metric(report, "B3", "xlf_spx_20s");
  if (reading?.quality === "CURRENT" && reading.value !== null) {
    item.status = "NOT_COMPARABLE";
    item.nonComparableContext = reading.value;
    item.observationAt = reading.observationAt;
    item.dossierCited = reading.citedInDossier;
  } else if (reading && reading.quality !== "MISSING") item.status = "STALE_OR_INVALID";
  return item;
}

export function buildProvisionalRegimeWatchReport(report: RegimeAssumptionObservationReport): ProvisionalWatchReport {
  return {
    contractVersion: REGIME_WATCH_ASSESSMENT_VERSION,
    dossierId: report.dossierId,
    asOf: report.asOf,
    checks: [
      hyCreditWatch(report),
      smhTotalReturnWatch(report),
      xlfTotalReturnWatch(report),
      base({
        id: "ai-capex-cash-coverage",
        regime: "AI",
        label: "Issuer capex to operating cash flow for two quarters",
        threshold: 1,
        thresholdUnit: "capex_to_positive_CFO_ratio",
        missingRequirements: [
          "Two comparable issuer cash-flow statements with CFO > 0 and cash capex definition",
          "Net liquidity and debt/lease changes; do not substitute market HY index spreads",
        ],
        optimisticFalsifier: "Paid demand, margin and cash conversion rise while capex/CFO coverage improves.",
      }),
      base({
        id: "broad-credit-spread-levels",
        regime: "US_RATES",
        label: "Simultaneous broad HY and IG absolute OAS spread levels",
        threshold: null,
        thresholdUnit: null,
        missingRequirements: [
          "Dated absolute HY >=400bp and rising >=75bp/20s, or IG >=150bp with material HY widening",
          "Current comparable OAS spread levels; measured 20-session differences cannot substitute",
        ],
        optimisticFalsifier: "Investment-grade and high-yield spreads tighten with sustainable issuance.",
      }),
    ],
    automaticRegimeChanges: false,
    documentation: "RESEARCH_WATCH_ONLY_NOT_A_CALIBRATED_SIGNAL",
  };
}
