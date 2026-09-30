export const PRESENTER_MECHANISM_CODES = [
  "PRICED_IN",
  "HAWKISH_SURPRISE",
  "DOVISH_SURPRISE",
  "SHORT_COVERING",
  "LONG_LIQUIDATION",
  "DEALER_GAMMA",
  "OPTIONS_EXPIRY",
  "CTA_FLOW",
  "REAL_YIELD",
  "USD_MOVE",
  "TERM_PREMIUM",
  "INFLATION_EXPECTATIONS",
  "GEO_SAFE_HAVEN",
  "DEESCALATION",
  "PHYSICAL_MARKET_STRESS",
  "RELATIVE_STRENGTH",
  "TECHNICAL_BREAK",
  "OVERSOLD_REBOUND",
  "SEASONALITY",
  "UNKNOWN",
] as const;

export type PresenterMechanismCode = typeof PRESENTER_MECHANISM_CODES[number];

type Rule = { code: Exclude<PresenterMechanismCode, "UNKNOWN">; pattern: RegExp };

const RULES: Rule[] = [
  { code: "PRICED_IN", pattern: /\b(?:priced[ -]?in|already priced|fully priced|pre[- ]?positioned|expected event|event risk was priced)\b/i },
  { code: "HAWKISH_SURPRISE", pattern: /\b(?:hawkish surprise|more hawkish|unexpected(?:ly)? hawkish|hike odds? (?:rose|rising|higher)|hotter.*(?:rates|fed|policy))\b/i },
  { code: "DOVISH_SURPRISE", pattern: /\b(?:dovish surprise|more dovish|unexpected(?:ly)? dovish|cut odds? (?:rose|rising|higher)|softer.*(?:rates|fed|policy))\b/i },
  { code: "SHORT_COVERING", pattern: /\b(?:short covering|short squeeze|shorts? covered|covering rally)\b/i },
  { code: "LONG_LIQUIDATION", pattern: /\b(?:long liquidation|longs? liquidat|forced selling|position liquidation)\b/i },
  { code: "DEALER_GAMMA", pattern: /\b(?:dealer gamma|gamma squeeze|gamma hedg|dealer hedg)\b/i },
  { code: "OPTIONS_EXPIRY", pattern: /\b(?:options? expir|option expir|triple witch|quadruple witch|opex)\b/i },
  { code: "CTA_FLOW", pattern: /\b(?:cta flow|systematic flow|trend[- ]?following flow|cta threshold)\b/i },
  { code: "REAL_YIELD", pattern: /\b(?:real yields?|tips yields?|inflation[- ]?adjusted yields?)\b/i },
  { code: "USD_MOVE", pattern: /\b(?:dxy|dollar (?:strength|weakness|move|fell|rose)|usd (?:strength|weakness|move|fell|rose))\b/i },
  { code: "TERM_PREMIUM", pattern: /\b(?:term premium|duration premium|treasury supply|auction demand|fiscal supply)\b/i },
  { code: "INFLATION_EXPECTATIONS", pattern: /\b(?:inflation expectations?|breakevens?|inflation compensation)\b/i },
  { code: "GEO_SAFE_HAVEN", pattern: /\b(?:safe[- ]?haven|geopolitical risk|flight to safety|risk haven)\b/i },
  { code: "DEESCALATION", pattern: /\b(?:de[- ]?escalat|ceasefire|tensions eased|risk premium fell)\b/i },
  { code: "PHYSICAL_MARKET_STRESS", pattern: /\b(?:physical market|physical stress|product scarcity|refinery margin|crack spread|shipping stress|inventory scarcity|diesel scarcity)\b/i },
  { code: "RELATIVE_STRENGTH", pattern: /\b(?:relative strength|outperform|underperform|breadth divergence|leadership)\b/i },
  { code: "TECHNICAL_BREAK", pattern: /\b(?:technical break|breakout|breakdown|support broke|resistance broke|trendline break)\b/i },
  { code: "OVERSOLD_REBOUND", pattern: /\b(?:oversold rebound|oversold bounce|mean reversion|technical rebound)\b/i },
  { code: "SEASONALITY", pattern: /\b(?:seasonality|seasonal pattern|month[- ]?end|quarter[- ]?end seasonal)\b/i },
];

export function classifyPresenterMechanism(...values: Array<string | null | undefined>): PresenterMechanismCode {
  const text = values.filter((value): value is string => Boolean(value?.trim())).join(" ");
  if (!text) return "UNKNOWN";
  return RULES.find((rule) => rule.pattern.test(text))?.code ?? "UNKNOWN";
}
