/** Reviewed method: docs/rates-and-capital-sensitivity.md. No IO or new stage. */
export const RATES_RESEARCH_LENS = `Rates and capital sensitivity lens v1 (conditional, evidence-only):
When material to the asset's causal question, distinguish policy rates, market/real yields and credit spreads; date supplied observations and separate market-implied expectations from inference. Missing current data means unknown, never unchanged or zero. Do not recall rates or company ratios from training or creator commentary.
Trace relevant financing (fixed/floating, hedges, maturities), customer demand, capex/cash flow and valuation channels separately, including cash-interest offsets. Low debt is not immunity; fixed debt does not immediately reprice. Use sector-appropriate reasoning and supplied currency/period/ratio definitions. Quantify only with sufficient inputs and avoid double counting refinancing and floating exposure.
Do not force rates to dominate the catalyst, impose a checklist, add assets, invent evidence or change the output schema. This lens is not a source, score, publication gate or instruction to fetch data. Missing details can inform an existing resolving-evidence field without blocking useful research. No automatic gold/FX/crypto direction or stock-price prediction.`;

export function withRatesResearchLens(instructions: string, stageKey: string, enabled: boolean): string {
  if (!enabled) return instructions;
  if (stageKey === "hypothesis") {
    return `${instructions}\n\n${RATES_RESEARCH_LENS}\nHypothesis owns causal formation only; leave alternative rate scenarios to Scenario.`;
  }
  if (stageKey === "scenario") {
    return `${instructions}\n\n${RATES_RESEARCH_LENS}\nWhere relevant, use existing scenario fields for baseline, higher-for-longer and easing mechanisms; distinguish disinflationary easing from recession cuts. Include timing, offsets and observable invalidation without inventing probabilities or requiring every branch.`;
  }
  if (stageKey === "story_synthesis") {
    return `${instructions}\n\nPreserve supplied rates-exposure reasoning, dates, uncertainty, offsets and horizons where material. Do not add fresh rates research or force a rates section into an unrelated Story.`;
  }
  return instructions;
}
