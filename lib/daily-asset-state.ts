import type { MarketMonitor, MarketMonitorRow } from "./market-monitor";
import type { DossierPresentationLens, DossierPresentationV1 } from "./dossier-v2/presentation-adapter";

export const DAILY_ASSET_STATE_V1 = "daily-asset-state/1" as const;

export type DailyAssetBias =
  | "BULLISH"
  | "BEARISH"
  | "MIXED"
  | "HAWKISH"
  | "DOVISH"
  | "UNRESOLVED";

export type DailyAssetConviction = "HIGH" | "MEDIUM" | "LOW" | "UNRESOLVED";

export type DailyAssetCard = {
  key: "SPX" | "NASDAQ" | "CRUDE" | "US_RATES" | "GOLD" | "BITCOIN";
  label: string;
  symbol: string | null;
  sourceLabel: string | null;
  last: number | null;
  dailyChange: number | null;
  dailyChangeUnit: "percent" | "bps";
  asOf: string | null;
  bias: DailyAssetBias;
  conviction: DailyAssetConviction;
  primaryDriver: string;
  confirmingSignal: string | null;
  contradictingSignal: string | null;
  invalidation: string | null;
  keyLevelUp: number | null;
  keyLevelDown: number | null;
  evidenceRefs: string[];
};

export type DailyStockRadarCard = {
  symbol: string;
  companyName: string;
  bias: Exclude<DailyAssetBias, "HAWKISH" | "DOVISH">;
  conviction: DailyAssetConviction;
  whyRelevant: string;
  confirmingSignal: string;
  invalidatingSignal: string;
  linkedStoryId: string;
  evidenceRefs: string[];
};

export type DailyAssetStateV1 = {
  contractVersion: typeof DAILY_ASSET_STATE_V1;
  asOf: string;
  assets: DailyAssetCard[];
  stockRadar: DailyStockRadarCard[];
  limitations: string[];
};

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function rowFor(monitor: MarketMonitor, ...ids: string[]) {
  for (const id of ids) {
    const row = monitor.rows.find((candidate) => candidate.id === id);
    if (row) return row;
  }
  return null;
}

function lensFor(presentation: DossierPresentationV1 | null | undefined, key: string) {
  return presentation?.regimeStrip.find((lens) => lens.key === key) ?? null;
}

function textBias(text: string): "BULLISH" | "BEARISH" | "MIXED" | "UNRESOLVED" {
  const input = text.toLowerCase();
  const positive = /(bullish|constructive|supportive|relief|strength|stronger|improv|rebound|outperform|upside|bid|breakout|easing)/.test(input);
  const negative = /(bearish|fragile|pressure|restrictive|tightening|stress|weaken|deterior|downside|risk-off|breakdown|selling|reject)/.test(input);
  if (positive && negative) return "MIXED";
  if (positive) return "BULLISH";
  if (negative) return "BEARISH";
  return "UNRESOLVED";
}

function lensConviction(lens: DossierPresentationLens | null): DailyAssetConviction {
  if (!lens) return "UNRESOLVED";
  if (lens.observed && lens.evidenceRefs.length >= 2 && lens.unresolvedSignals.length === 0) return "HIGH";
  if (lens.observed && lens.evidenceRefs.length > 0) return "MEDIUM";
  if (lens.evidenceRefs.length > 0 || lens.interpretation.trim()) return "LOW";
  return "UNRESOLVED";
}

function rateBias(presentation: DossierPresentationV1 | null | undefined): DailyAssetBias {
  switch (presentation?.rateRegime?.state) {
    case "HAWKISH": return "HAWKISH";
    case "DOVISH": return "DOVISH";
    case "MIXED": return "MIXED";
    case "NEUTRAL": return "MIXED";
    default: return "UNRESOLVED";
  }
}

function spxBias(presentation: DossierPresentationV1 | null | undefined): DailyAssetBias {
  switch (presentation?.header.regimeFamily) {
    case "GROWTH_SCARE_RISK_OFF": return "BEARISH";
    case "RATES_LED_TIGHTENING": return "MIXED";
    case "MIXED_TRANSITION": return "MIXED";
    default: return "UNRESOLVED";
  }
}

function nasdaqBias(presentation: DossierPresentationV1 | null | undefined): DailyAssetBias {
  const tech = lensFor(presentation, "TECH_AI");
  const techBias = textBias(`${tech?.reaction ?? ""} ${tech?.interpretation ?? ""}`);
  if (presentation?.header.regimeFamily === "GROWTH_SCARE_RISK_OFF") return "BEARISH";
  if (presentation?.rateRegime?.state === "HAWKISH") {
    if (techBias === "BULLISH") return "MIXED";
    if (techBias === "BEARISH") return "BEARISH";
    return "MIXED";
  }
  return techBias === "UNRESOLVED"
    ? (presentation?.header.regimeFamily === "MIXED_TRANSITION" ? "MIXED" : "UNRESOLVED")
    : techBias;
}

function rowChange(row: MarketMonitorRow | null, unit: "percent" | "bps") {
  if (!row) return null;
  if (unit === "percent") return row.dayChange;
  if (row.last == null || row.previousClose == null) return null;
  return Number(((row.last - row.previousClose) * 100).toFixed(1));
}

function card(args: {
  key: DailyAssetCard["key"];
  label: string;
  row: MarketMonitorRow | null;
  lens: DossierPresentationLens | null;
  bias: DailyAssetBias;
  conviction?: DailyAssetConviction;
  primaryDriver: string;
  invalidation: string | null;
  extraEvidence?: string[];
  dailyChangeUnit?: "percent" | "bps";
}): DailyAssetCard {
  const unit = args.dailyChangeUnit ?? "percent";
  return {
    key: args.key,
    label: args.label,
    symbol: args.row?.symbol ?? null,
    sourceLabel: args.row?.sourceName ?? null,
    last: args.row?.last ?? null,
    dailyChange: rowChange(args.row, unit),
    dailyChangeUnit: unit,
    asOf: args.row?.asOf ?? null,
    bias: args.bias,
    conviction: args.conviction ?? lensConviction(args.lens),
    primaryDriver: args.primaryDriver,
    confirmingSignal: args.lens?.reaction ?? null,
    contradictingSignal: args.lens?.unresolvedSignals[0] ?? null,
    invalidation: args.invalidation,
    keyLevelUp: null,
    keyLevelDown: null,
    evidenceRefs: unique([...(args.lens?.evidenceRefs ?? []), ...(args.extraEvidence ?? [])]),
  };
}

function stockRadar(presentation: DossierPresentationV1 | null | undefined): DailyStockRadarCard[] {
  return (presentation?.stockRadar ?? []).slice(0, 3).map((item) => {
    const bias = textBias(`${item.why_relevant} ${item.confirming_signal} ${item.invalidating_signal}`);
    return {
      symbol: item.symbol,
      companyName: item.company_name,
      bias,
      conviction: item.evidence_references.length >= 2 ? "MEDIUM" : item.evidence_references.length ? "LOW" : "UNRESOLVED",
      whyRelevant: item.why_relevant,
      confirmingSignal: item.confirming_signal,
      invalidatingSignal: item.invalidating_signal,
      linkedStoryId: item.linked_main_thread_or_story_id,
      evidenceRefs: [...item.evidence_references],
    };
  });
}

export function buildDailyAssetState(args: {
  monitor: MarketMonitor;
  presentation?: DossierPresentationV1 | null;
}): DailyAssetStateV1 {
  const { monitor, presentation = null } = args;
  const ratesLens = lensFor(presentation, "US_RATES");
  const breadthLens = lensFor(presentation, "BREADTH");
  const techLens = lensFor(presentation, "TECH_AI");
  const oilLens = lensFor(presentation, "OIL_WAR_INFLATION");
  const goldLens = lensFor(presentation, "GOLD");

  const spx = rowFor(monitor, "spx");
  const nasdaq = rowFor(monitor, "nasdaq-comp");
  const crude = rowFor(monitor, "wti");
  const rates = rowFor(monitor, "us10y-fred", "us10y");
  const gold = rowFor(monitor, "gold");
  const bitcoin = rowFor(monitor, "btc");

  const headerInvalidation = presentation?.header.whatWouldChangeMind ?? null;
  const assets: DailyAssetCard[] = [
    card({
      key: "SPX",
      label: "S&P 500",
      row: spx,
      lens: breadthLens,
      bias: spxBias(presentation),
      primaryDriver: presentation?.header.regimeImplication ?? "No canonical regime implication is currently published.",
      invalidation: headerInvalidation,
      extraEvidence: unique([...(techLens?.evidenceRefs ?? []), ...(ratesLens?.evidenceRefs ?? [])]),
    }),
    card({
      key: "NASDAQ",
      label: "Nasdaq Composite",
      row: nasdaq,
      lens: techLens,
      bias: nasdaqBias(presentation),
      primaryDriver: techLens?.interpretation ?? "No canonical technology/AI interpretation is currently published.",
      invalidation: headerInvalidation,
      extraEvidence: ratesLens?.evidenceRefs ?? [],
    }),
    card({
      key: "CRUDE",
      label: "Crude oil",
      row: crude,
      lens: oilLens,
      bias: textBias(`${oilLens?.reaction ?? ""} ${oilLens?.interpretation ?? ""}`),
      primaryDriver: oilLens?.interpretation ?? "No canonical oil/war/inflation interpretation is currently published.",
      invalidation: headerInvalidation,
    }),
    card({
      key: "US_RATES",
      label: "US 10Y",
      row: rates,
      lens: ratesLens,
      bias: rateBias(presentation),
      conviction: presentation?.rateRegime?.confidence ?? lensConviction(ratesLens),
      primaryDriver: presentation?.rateRegime?.summary ?? ratesLens?.interpretation ?? "No canonical US-rates interpretation is currently published.",
      invalidation: headerInvalidation,
      extraEvidence: presentation?.rateRegime?.evidenceRefs ?? [],
      dailyChangeUnit: "bps",
    }),
    card({
      key: "GOLD",
      label: "Gold",
      row: gold,
      lens: goldLens,
      bias: textBias(`${goldLens?.reaction ?? ""} ${goldLens?.interpretation ?? ""}`),
      primaryDriver: goldLens?.interpretation ?? "No canonical gold interpretation is currently published.",
      invalidation: headerInvalidation,
    }),
    card({
      key: "BITCOIN",
      label: "Bitcoin",
      row: bitcoin,
      lens: null,
      bias: "UNRESOLVED",
      conviction: "UNRESOLVED",
      primaryDriver: "No canonical Bitcoin-specific thesis is published in the current Dossier; price is observation only.",
      invalidation: null,
    }),
  ];

  const missing = assets.filter((asset) => asset.last == null).map((asset) => asset.label);
  const limitations = [
    ...monitor.limitations,
    ...(missing.length ? [`Missing current market level for: ${missing.join(", ")}.`] : []),
    "Headline asset cards use direct cash/spot series only. If a direct cash/spot series is unavailable, the card fails closed instead of substituting an ETF proxy.",
    "Key levels remain null unless a verified canonical source supplies them; transcript-only support/resistance is not promoted automatically.",
  ];

  return {
    contractVersion: DAILY_ASSET_STATE_V1,
    asOf: monitor.updatedAt || presentation?.asOf || new Date().toISOString(),
    assets,
    stockRadar: stockRadar(presentation),
    limitations: unique(limitations),
  };
}
