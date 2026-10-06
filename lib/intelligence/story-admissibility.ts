export type NewStoryMarketAdmissibilityInput = {
  title: string;
  thesis: string;
  question: string;
  causalMechanism: string;
  marketBelief: string;
  affectedAssets: string[];
};

export type NewStoryMarketAdmissibility = {
  admissible: boolean;
  reason: "explicit_asset" | "market_or_economic_mechanism" | "research_process_without_market_mechanism" | "no_market_or_economic_mechanism";
  marketSignals: string[];
  processSignals: string[];
};

const MARKET_DOMAIN_RULES: Array<{ key: string; pattern: RegExp }> = [
  { key: "rates_policy", pattern: /\b(fed|fomc|central bank|interest rates?|policy rates?|rate cuts?|rate hikes?|yield|bond|treasury|sovereign|duration|term premium)\b/i },
  { key: "credit_financing", pattern: /\b(credit|credit spreads?|financing|refinanc|funding|liquidity|default|insolvenc|insurer|insurance|counterparty|debt|leverage|private credit|stable[- ]value|wrap providers?)\b/i },
  { key: "equities_corporates", pattern: /\b(equit(?:y|ies)|stocks?|shares?|earnings|revenue|margins?|valuation|multiple|capex|buybacks?|dividend|merger|acquisition|ipo|guidance)\b/i },
  { key: "macro_economy", pattern: /\b(inflation|cpi|ppi|gdp|growth|recession|employment|unemployment|jobs?|payrolls?|wages?|consumer|retail sales|housing|mortgage)\b/i },
  { key: "fx_reserves", pattern: /\b(fx|forex|currency|dollar|dxy|yen|euro|sterling|reserve diversification|foreign reserves|capital flows?)\b/i },
  { key: "commodities_energy", pattern: /\b(oil|crude|brent|wti|diesel|gasoline|lng|natural gas|gold|silver|copper|commodity|commodities|fertili[sz]er|shipping|freight)\b/i },
  { key: "technology_ai", pattern: /\b(ai|artificial intelligence|semiconductor|chip|gpu|hbm|compute|cloud|data cent(?:er|re)|inference|hyperscaler)\b/i },
  { key: "policy_geopolitics", pattern: /\b(tariffs?|trade policy|export controls?|sanctions?|industrial policy|geopolit|election|fiscal policy|deficit|government borrowing)\b/i },
  { key: "market_structure", pattern: /\b(etf|funds?|flows?|positioning|volatility|options?|futures|spreads?|market breadth|market structure|risk appetite|carry trade)\b/i },
  { key: "digital_assets", pattern: /\b(bitcoin|crypto|cryptocurrency|stablecoin|ethereum|token market)\b/i },
];

const RESEARCH_PROCESS_RULES: Array<{ key: string; pattern: RegExp }> = [
  { key: "source_provenance", pattern: /\b(primary[- ]source|source provenance|provenance metadata|source pages?)\b/i },
  { key: "timestamp_methodology", pattern: /\b(publication timestamps?|creation timestamps?|event timestamps?|temporal ordering)\b/i },
  { key: "record_classification", pattern: /\b(record classifications?|record reclassification|reclassif(?:y|ication)|records authorit(?:y|ies)|archival release|archives?)\b/i },
  { key: "research_process", pattern: /\b(research methodology|research process|evidence handling|evidence provenance|look[- ]ahead bias|interpretive products?)\b/i },
  { key: "pipeline_process", pattern: /\b(ingestion|provider payload|transcript retrieval|prompt|model output|research pipeline)\b/i },
];

function normalise(value: string) {
  return value
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function evaluateNewStoryMarketAdmissibility(
  input: NewStoryMarketAdmissibilityInput,
): NewStoryMarketAdmissibility {
  const explicitAssets = input.affectedAssets
    .map((asset) => normalise(asset))
    .filter(Boolean);

  const text = normalise([
    input.title,
    input.thesis,
    input.question,
    input.causalMechanism,
    input.marketBelief,
  ].join(" "));

  const marketSignals = MARKET_DOMAIN_RULES
    .filter((rule) => rule.pattern.test(text))
    .map((rule) => rule.key);

  const processSignals = RESEARCH_PROCESS_RULES
    .filter((rule) => rule.pattern.test(text))
    .map((rule) => rule.key);

  if (explicitAssets.length > 0) {
    return {
      admissible: true,
      reason: "explicit_asset",
      marketSignals,
      processSignals,
    };
  }

  if (marketSignals.length > 0) {
    return {
      admissible: true,
      reason: "market_or_economic_mechanism",
      marketSignals,
      processSignals,
    };
  }

  if (processSignals.length > 0) {
    return {
      admissible: false,
      reason: "research_process_without_market_mechanism",
      marketSignals,
      processSignals,
    };
  }

  return {
    admissible: false,
    reason: "no_market_or_economic_mechanism",
    marketSignals,
    processSignals,
  };
}
