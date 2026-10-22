import type { PublicMarketGroup, PublicMarketObservation } from "./blue-desk-public-markets.ts";

/**
 * Source-only daily market map. Eight independent lenses, none created by
 * Dossier reasoning, creator Motion, private providers or language models.
 * Each headline remains an observed level, not a prediction or causal story.
 */
export const BLUE_DESK_MARKET_MAP_CONTRACT = "blue-desk-daily-market-map/1" as const;
export type MarketLensKey =
  | "rates" | "equities" | "breadth" | "energy"
  | "fx" | "credit" | "metals" | "ai";
export type MarketLensObservation = PublicMarketObservation & {
  freshness: "RECENT_OBSERVATION" | "OLDER_OBSERVATION";
};
export type MarketLens = {
  key: MarketLensKey;
  heading: string;
  question: string;
  group: PublicMarketGroup;
  state: "SOURCE_DATED" | "OLDER_SOURCE" | "UNAVAILABLE";
  observations: MarketLensObservation[];
};

const MAP_LENSES: Array<{
  key: MarketLensKey;
  heading: string;
  question: string;
  group: PublicMarketGroup;
  ids: readonly string[];
}> = [
  { key:"rates",heading:"US rates",question:"Watch the 2Y versus 10Y and 30Y yield curve.",group:"rates",ids:["us2y","us10y-fred","us30y-fred"] },
  { key:"equities",heading:"Stock indices",question:"Compare the broad S&P 500 against the Nasdaq and small caps.",group:"equities",ids:["spx","ndx","russell","spx-proxy"] },
  { key:"breadth",heading:"Market breadth",question:"Does the equal-weight S&P 500 move with the headline index?",group:"equities",ids:["rsp","spx"] },
  { key:"energy",heading:"Oil & products",question:"Compare Brent, WTI and refined-products pricing.",group:"energy",ids:["brent","wti","distillate"] },
  { key:"fx",heading:"Dollar & yen",question:"Does the dollar move alongside US yields and USD/JPY?",group:"fx",ids:["dxy","usdjpy","gbp"] },
  { key:"credit",heading:"Credit & volatility",question:"Watch high-yield and investment-grade spreads; a volatility proxy is not MOVE.",group:"credit",ids:["hy-oas","ig-oas","move"] },
  { key:"metals",heading:"Gold & metals",question:"Test gold and miners against real yields and the dollar.",group:"metals",ids:["gold-proxy","gdx","silver","copper"] },
  { key:"ai",heading:"AI & chips",question:"Compare semiconductor exposure with the wider equity market.",group:"ai",ids:["soxx","smh","tsm","avgo"] },
];

/**
 * Freshness only describes when the last source-dated observation was made,
 * not when the page was generated. A dated stale quote is not a current price.
 */
function admitted(row: PublicMarketObservation, nowMs: number): MarketLensObservation | null {
  if (row.last === null || !Number.isFinite(row.last)
    || !row.sourceName.trim() || !row.sourceUrl
    || typeof row.asOf !== "string") return null;
  const observed = Date.parse(row.asOf);
  if (!Number.isFinite(observed) || observed > nowMs + 60_000 || observed < 0) return null;
  const ageHours = Math.max(0, (nowMs - observed) / 3_600_000);
  return { ...row, freshness: ageHours <= 72
    ? "RECENT_OBSERVATION" : "OLDER_OBSERVATION" };
}

/** The approved public market DTO must be supplied by the caller. */
export function buildBlueDeskDailyMarketMap(
  observations: readonly PublicMarketObservation[],
  now = new Date(),
): { contractVersion: typeof BLUE_DESK_MARKET_MAP_CONTRACT; lenses: MarketLens[]; observedCount: number; olderCount: number } {
  const nowMs = now.getTime();
  const valid = Number.isFinite(nowMs)
    ? observations.map(row => admitted(row, nowMs)).filter((row): row is MarketLensObservation => row !== null)
    : [];
  const lenses: MarketLens[] = MAP_LENSES.map(spec => {
    const observationsForLens: MarketLensObservation[] = [];
    for (const id of spec.ids) {
      const match = valid.find(row => row.id === id);
      if (match && !observationsForLens.some(row => row.id === match.id)) observationsForLens.push(match);
      if (observationsForLens.length >= 2) break;
    }
    // Breadth should not imply a confirmed comparison if only one benchmark is available.
    const state: MarketLens["state"] = observationsForLens.length === 0
      ? "UNAVAILABLE"
      : observationsForLens.some(row => row.freshness === "RECENT_OBSERVATION")
        ? "SOURCE_DATED" : "OLDER_SOURCE";
    return { key:spec.key, heading:spec.heading, question:spec.question,
      group:spec.group, state, observations:observationsForLens };
  });
  return {
    contractVersion: BLUE_DESK_MARKET_MAP_CONTRACT,
    lenses, observedCount:lenses.filter(lens => lens.observations.length > 0).length,
    olderCount:lenses.filter(lens => lens.state === "OLDER_SOURCE").length,
  };
}
