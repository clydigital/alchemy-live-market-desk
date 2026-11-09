import type { PublicMarketObservation } from "./blue-desk-public-markets.ts";
import type { MarketSignalSnapshot } from "./bluebelly-signal-scan.ts";

export type SignalFamily = "all" | "breakout" | "stoch" | "volume" | "relative" | "squeeze";
export type SignalBias = "bullish" | "bearish";
export type SignalFilter = { family: SignalFamily; bias: SignalBias; breakoutDays: "20" | "55" | "252"; minimumAligned: number };


/** Align the displayed tally with the user-selected Donchian window.
 * Squeeze compression and Stoch extremes are discovery filters, not directional votes.
 */
export function marketSignalAlignment(
  scan: MarketSignalSnapshot | null | undefined,
  bias: SignalBias,
  breakoutDays: "20" | "55" | "252",
): { matched: number; available: number } {
  if (!scan) return { matched: 0, available: 0 };
  const bullish = bias === "bullish";
  const breakout = scan.breakout[breakoutDays]?.state ?? "unavailable";
  const available = [
    breakout !== "unavailable",
    scan.stoch.zone !== "unavailable",
    scan.volume.state !== "unavailable",
    scan.relative.state !== "unavailable",
    scan.squeeze.state !== "unavailable",
  ].filter(Boolean).length;
  const matched = [
    breakout === (bullish ? "up" : "down"),
    scan.stoch.turn === (bullish ? "bullish" : "bearish"),
    scan.volume.state === (bullish ? "up-surge" : "down-surge"),
    scan.relative.state === (bullish ? "leader" : "laggard"),
    scan.squeeze.state === (bullish ? "expanding-up" : "expanding-down"),
  ].filter(Boolean).length;
  return { matched, available };
}

/** One family, one vote. This is discovery only, not a buy/sell signal. */
export function passesMarketSignalFilter(row: PublicMarketObservation, filter: SignalFilter): boolean {
  if (filter.family === "all" && filter.minimumAligned === 0) return true;
  const scan = row.screening;
  if (!scan) return false;
  const tally = marketSignalAlignment(scan, filter.bias, filter.breakoutDays);
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
