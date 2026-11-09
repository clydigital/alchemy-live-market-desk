import type { PublicMarketObservation } from "./blue-desk-public-markets.ts";

export type SignalFamily = "all" | "breakout" | "stoch" | "volume" | "relative" | "squeeze";
export type SignalBias = "bullish" | "bearish";
export type SignalFilter = { family: SignalFamily; bias: SignalBias; breakoutDays: "20" | "55" | "252"; minimumAligned: number };

/** One family, one vote. This is discovery only, not a buy/sell signal. */
export function passesMarketSignalFilter(row: PublicMarketObservation, filter: SignalFilter): boolean {
  if (filter.family === "all" && filter.minimumAligned === 0) return true;
  const scan = row.screening;
  if (!scan) return false;
  const tally = scan.alignment[filter.bias];
  if (filter.minimumAligned > 0 && (tally.available < filter.minimumAligned || tally.matched < filter.minimumAligned)) return false;
  const up = filter.bias === "bullish";
  switch (filter.family) {
    case "all": return true;
    case "breakout": return scan.breakout[filter.breakoutDays].state === (up ? "up" : "down");
    case "stoch": return scan.stoch.zone === (up ? "oversold" : "overbought") ||
      scan.stoch.turn === (up ? "bullish" : "bearish");
    case "volume": return scan.volume.state === (up ? "up-surge" : "down-surge");
    case "relative": return scan.relative.state === (up ? "leader" : "laggard");
    case "squeeze": return scan.squeeze.state === "tight" ||
      scan.squeeze.state === (up ? "expanding-up" : "expanding-down");
  }
}
