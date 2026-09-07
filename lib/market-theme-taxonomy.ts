/**
 * Stable, user-owned Market Desk taxonomy.  These keys are persisted in
 * intelligence_themes and linked to Stories; they are intentionally separate
 * from presentation-only keyword tags.
 */
export const MARKET_THEME_TAXONOMY = [
  ["macro-regime", "Macro Regime", ["rates-monetary-policy", "fiscal-sovereign-risk", "inflation-commodities", "global-liquidity"]],
  ["financial-system", "Financial System", ["credit-leverage", "housing", "banking-financial-plumbing", "market-structure-positioning"]],
  ["real-assets-monetary-alternatives", "Real Assets & Monetary Alternatives", ["gold", "bitcoin", "commodities", "energy"]],
  ["geopolitics", "Geopolitics", ["war-security", "trade-sanctions", "multipolarity-de-dollarisation", "strategic-resources"]],
  ["technology-capex", "Technology & Capex", ["ai-demand", "ai-infrastructure", "ai-financing", "ai-economics"]],
  ["structural-risks", "Structural Risks", ["demographics", "political-institutional-risk", "supply-chain-vulnerability", "contrarian-tail-risk-signals"]],
] as const;

export type MarketThemeKey = typeof MARKET_THEME_TAXONOMY[number][2][number];
export type StoryMomentum = "accelerating" | "stable" | "decelerating" | "reversing" | "unknown";

const RULES: Array<{ key: MarketThemeKey; pattern: RegExp }> = [
  { key: "rates-monetary-policy", pattern: /\b(fed|fomc|monetary|rate|rates|hike|cut|yield curve|real yields?)\b/i },
  { key: "fiscal-sovereign-risk", pattern: /\b(fiscal|sovereign|term premium|treasury supply|debt servicing|fiscal dominance)\b/i },
  { key: "inflation-commodities", pattern: /\b(inflation|cpi|ppi|oil shock|commodity prices?)\b/i },
  { key: "global-liquidity", pattern: /\b(liquidity|dollar funding|balance sheet|repo)\b/i },
  { key: "credit-leverage", pattern: /\b(credit|leverage|spread|default|refinanc)\b/i },
  { key: "housing", pattern: /\b(housing|mortgage|homebuyer|home price|property)\b/i },
  { key: "banking-financial-plumbing", pattern: /\b(bank|banking|plumbing|deposit|repo|funding stress)\b/i },
  { key: "market-structure-positioning", pattern: /\b(positioning|volatility|options|market structure|carry trade)\b/i },
  { key: "gold", pattern: /\b(gold|xau|bullion)\b/i },
  { key: "bitcoin", pattern: /\b(bitcoin|btc|crypto)\b/i },
  { key: "commodities", pattern: /\b(commodit|copper|metal|grain)\b/i },
  { key: "energy", pattern: /\b(oil|brent|wti|energy|crude|gas|lng)\b/i },
  { key: "war-security", pattern: /\b(iran|war|security|conflict|hormuz|military)\b/i },
  { key: "trade-sanctions", pattern: /\b(trade|tariff|sanction|export control)\b/i },
  { key: "multipolarity-de-dollarisation", pattern: /\b(de-dollar|dedollar|reserve currency|foreign demand)\b/i },
  { key: "strategic-resources", pattern: /\b(strategic resource|critical mineral|rare earth|commodity security)\b/i },
  { key: "ai-demand", pattern: /\b(ai demand|ai adoption|inference demand)\b/i },
  { key: "ai-infrastructure", pattern: /\b(data cent(re|er)|ai infrastructure|gpu|compute|power grid)\b/i },
  { key: "ai-financing", pattern: /\b(ai financ|capex financ|debt-funded ai|ai credit)\b/i },
  { key: "ai-economics", pattern: /\b(ai economics|ai return|ai monetis|ai monetiz|cash conversion)\b/i },
  { key: "demographics", pattern: /\b(demograph|ageing|aging|population)\b/i },
  { key: "political-institutional-risk", pattern: /\b(political risk|institutional|central-bank independence|policy uncertainty)\b/i },
  { key: "supply-chain-vulnerability", pattern: /\b(supply chain|shipping|chokepoint|bottleneck)\b/i },
  { key: "contrarian-tail-risk-signals", pattern: /\b(tail risk|contrarian|crowded|fragility)\b/i },
];

export function deriveMarketThemeKeys(input: { title?: string | null; thesis?: string | null; causalMechanism?: string | null; assets?: string[] | null }) {
  const text = [input.title, input.thesis, input.causalMechanism, ...(input.assets ?? [])].filter(Boolean).join(" ");
  return RULES.filter((rule) => rule.pattern.test(text)).map((rule) => rule.key);
}

export function momentumForTransition(previous: string | null | undefined, lifecycle: string): StoryMomentum {
  if (["invalidated", "archived"].includes(lifecycle)) return "reversing";
  if (lifecycle === "weakening") return "decelerating";
  if (lifecycle === "confirmed" && previous !== "confirmed") return "accelerating";
  if (["detected", "developing"].includes(lifecycle)) return "unknown";
  return "stable";
}
