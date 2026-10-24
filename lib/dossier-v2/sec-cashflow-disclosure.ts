import type { SecQuarterCashFlow } from "./issuer-sec-quarterly-cashflow.ts";

/**
 * Explicitly source-pinned company-reported non-GAAP FCF, separate from the SEC
 * US-GAAP cumulative cash-flow observation. Never infer this from the raw cash
 * PP&E concept, an issuer name, an AI narrative or a different filing vintage.
 *
 * Meta, October 21 2026 results, Reconciliation of GAAP to Non-GAAP Results.
 * Values are in USD, with issuer presentation rounded to whole $millions.
 */
export type SecIssuerFcfComparison = {
  sourceType: "ISSUER_IR_RELEASE";
  releaseDate: string;
  sourceUrl: string;
  operatingCashFlowUsd: number;
  cashPpeUsd: number;
  financeLeasePrincipalUsd: number;
  reportedFcfUsd: number;
  quarterizedSecCfoDifferenceUsd: number;
  definition: "ISSUER_FCF_CFO_LESS_CASH_PPE_LESS_FINANCE_LEASE_PRINCIPAL";
};

const META_FY26_Q3_IR = {
  sourceType: "ISSUER_IR_RELEASE",
  releaseDate: "2026-10-21",
  sourceUrl: "https://investor.atmeta.com/investor-news/press-release-details/2026/Meta-Reports-Third-Quarter-2026-Results/",
  operatingCashFlowUsd: 32_786_000_000,
  cashPpeUsd: 33_942_000_000,
  financeLeasePrincipalUsd: 964_000_000,
  reportedFcfUsd: -2_120_000_000,
  definition: "ISSUER_FCF_CFO_LESS_CASH_PPE_LESS_FINANCE_LEASE_PRINCIPAL",
} as const;

export function getSecIssuerFcfComparison(item: SecQuarterCashFlow): SecIssuerFcfComparison | null {
  if (item.ticker !== "META" || item.issuerCik !== "0001326801"
    || item.fiscalYear !== 2026 || item.fiscalQuarter !== 3
    || item.periodStart !== "2026-07-01" || item.periodEnd !== "2026-09-30"
    || item.filedDate !== "2026-10-22"
    || item.currentAccession !== "0001628280-26-066773"
    || item.predecessorAccession !== "0001628280-26-050705"
    || item.cfoUsd !== 32_785_000_000
    || item.cashPpeUsd !== META_FY26_Q3_IR.cashPpeUsd
    || item.simpleFcfUsd !== -1_157_000_000) return null;
  const disclosure = META_FY26_Q3_IR;
  // Verify published quarterly equation separately from XBRL YTD subtraction.
  if (disclosure.operatingCashFlowUsd - disclosure.cashPpeUsd
    - disclosure.financeLeasePrincipalUsd !== disclosure.reportedFcfUsd) return null;
  return {
    ...disclosure,
    quarterizedSecCfoDifferenceUsd: disclosure.operatingCashFlowUsd - item.cfoUsd,
  };
}

function billions(value: number): string {
  const absolute = (Math.abs(value) / 1_000_000_000).toFixed(3);
  return value < 0 ? "−$" + absolute + "bn" : "$" + absolute + "bn";
}

/** Evidence claim, not a Story verdict or an AI-only cash-flow estimate. */
export function formatSecIssuerQuarterCashflowClaim(
  entityName: string,
  item: SecQuarterCashFlow,
  comparison = getSecIssuerFcfComparison(item),
): string {
  const method = item.predecessorAccession
    ? "same-fiscal-year YTD figures less the prior-quarter YTD filing"
    : "the direct Q1 filing";
  let claim = entityName + " (" + item.ticker + "), fiscal Q" + item.fiscalQuarter
    + " " + item.fiscalYear + " (ended " + item.periodEnd + "): SEC-derived consolidated"
    + " operating cash flow " + billions(item.cfoUsd)
    + ", cash purchases of PP&E " + billions(item.cashPpeUsd)
    + ", and simple cash FCF (CFO minus cash PP&E) " + billions(item.simpleFcfUsd)
    + ". Derived from " + method + "; SEC filing date " + item.filedDate + "."
    + " This simple FCF EXCLUDES finance-lease principal and is NOT issuer-reported FCF.";
  if (comparison) {
    claim += " Separately, " + entityName + " reported quarterly CFO "
      + billions(comparison.operatingCashFlowUsd)
      + ", finance-lease principal " + billions(comparison.financeLeasePrincipalUsd)
      + ", and issuer-defined non-GAAP FCF " + billions(comparison.reportedFcfUsd)
      + " (IR release " + comparison.releaseDate + "; " + comparison.sourceUrl + ")."
      + " The direct-quarter CFO is " + billions(comparison.quarterizedSecCfoDifferenceUsd)
      + " higher than the subtraction of the filed cumulative figures;"
      + " retain both source-specific values rather than altering either.";
  }
  return claim + " Neither figure isolates AI cash flow or establishes Story causality.";
}
