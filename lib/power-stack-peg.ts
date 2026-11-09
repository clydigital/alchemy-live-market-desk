/** PEG is a screening input, never an automatic buy recommendation.
 * Growth is expressed in percentage points (20 means 20%, not 0.20).
 * A negative or zero growth estimate makes PEG non-comparable.
 */
export type PegInput = {
  ticker: string;
  forwardPE: number | null;
  expectedAnnualEpsGrowthPct: number | null;
  estimateAsOf: string | null;
  estimateHorizon: string | null;
  estimateSource: string | null;
};

export type PegResult = PegInput & {
  forwardPEG: number | null;
  classification: "below-one" | "one-to-two" | "above-two" | "unavailable";
  warning: string | null;
};

export function evaluatePEG(input: PegInput): PegResult {
  const pe = input.forwardPE;
  const growth = input.expectedAnnualEpsGrowthPct;
  const valid = pe !== null && growth !== null
    && Number.isFinite(pe) && Number.isFinite(growth)
    && pe > 0 && growth > 0;
  const forwardPEG = valid ? pe! / growth! : null;
  const classification = forwardPEG === null ? "unavailable"
    : forwardPEG < 1 ? "below-one"
    : forwardPEG <= 2 ? "one-to-two" : "above-two";
  const warning = !valid
    ? "Positive forward earnings and positive expected EPS growth are required."
    : !input.estimateAsOf || !input.estimateHorizon || !input.estimateSource
      ? "Estimate provenance incomplete; do not rank as an actionable opportunity."
      : null;
  return { ...input, forwardPEG, classification, warning };
}

/** A low PEG alone is insufficient: require verified, dated macro and quality gates. */
export function isResearchCandidate(result: PegResult, gates: {
  growthQualityVerified: boolean;
  macroAlignmentVerified: boolean;
  entryRiskVerified: boolean;
}): boolean {
  return result.classification === "below-one" && result.warning === null
    && gates.growthQualityVerified && gates.macroAlignmentVerified
    && gates.entryRiskVerified;
}
