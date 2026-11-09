/** Public-market technical discovery. One condition per family; no trade recommendations.
 * Calculated server-side from dated daily bars. Missing inputs are unknown, never zero.
 */
export type ScanBar = { time: number; close: number; high?: number | null; low?: number | null; volume?: number | null };
export type BreakoutState = "up" | "down" | "near-high" | "near-low" | "inside" | "unavailable";
export type ScanBreakout = { state: BreakoutState; basis: "high-low" | "closing" | null };
export type MarketSignalSnapshot = {
  asOf: string;
  breakout: Record<"20" | "55" | "252", ScanBreakout>;
  stoch: { k: number | null; d: number | null; zone: "oversold" | "overbought" | "middle" | "unavailable"; turn: "bullish" | "bearish" | "none" };
  volume: { multiple: number | null; state: "up-surge" | "down-surge" | "normal" | "unavailable" };
  relative: { excess20d: number | null; state: "leader" | "laggard" | "neutral" | "unavailable" };
  squeeze: { state: "tight" | "expanding-up" | "expanding-down" | "normal" | "unavailable" };
  alignment: { bullish: { matched: number; available: number }; bearish: { matched: number; available: number } };
};

function cleanBars(bars: readonly ScanBar[]): ScanBar[] {
  const sorted = bars.filter(b => Number.isFinite(b.time) && b.time > 0 &&
    Number.isFinite(b.close) && b.close > 0).sort((a, b) => a.time - b.time);
  return [...new Map(sorted.map(b => [b.time, b])).values()];
}
function round(n: number | null, decimals = 2): number | null {
  return n !== null && Number.isFinite(n) ? Number(n.toFixed(decimals)) : null;
}
export function scanBreakout(bars: readonly ScanBar[], length: 20 | 55 | 252): ScanBreakout {
  const points = cleanBars(bars);
  if (points.length < length + 1) return { state: "unavailable", basis: null };
  const previous = points.slice(-(length + 1), -1);
  const fullOhlc = previous.every(b => b.high != null && b.low != null &&
    Number.isFinite(b.high) && Number.isFinite(b.low) && b.high >= b.low);
  const upper = Math.max(...previous.map(b => fullOhlc ? b.high! : b.close));
  const lower = Math.min(...previous.map(b => fullOhlc ? b.low! : b.close));
  const close = points[points.length - 1].close;
  const state: BreakoutState = close > upper ? "up" : close < lower ? "down" :
    close >= upper * 0.98 ? "near-high" : close <= lower * 1.02 ? "near-low" : "inside";
  return { state, basis: fullOhlc ? "high-low" : "closing" };
}
function rsiSeries(closes: number[], period = 14): Array<number | null> {
  const output: Array<number | null> = Array(closes.length).fill(null);
  if (closes.length <= period) return output;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const delta = closes[i] - closes[i - 1];
    gains += Math.max(0, delta); losses += Math.max(0, -delta);
  }
  gains /= period; losses /= period;
  const value = () => losses === 0 ? (gains === 0 ? 50 : 100) : 100 - 100 / (1 + gains / losses);
  output[period] = value();
  for (let i = period + 1; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1];
    gains = (gains * (period - 1) + Math.max(0, delta)) / period;
    losses = (losses * (period - 1) + Math.max(0, -delta)) / period;
    output[i] = value();
  }
  return output;
}
function stochRsi(bars: ScanBar[]): MarketSignalSnapshot["stoch"] {
  const empty = { k: null, d: null, zone: "unavailable" as const, turn: "none" as const };
  const rsi = rsiSeries(bars.map(b => b.close));
  const raw: Array<number | null> = Array(bars.length).fill(null);
  for (let i = 27; i < rsi.length; i++) {
    const window = rsi.slice(i - 13, i + 1);
    if (window.some(v => v === null)) continue;
    const values = window as number[];
    const low = Math.min(...values), high = Math.max(...values);
    raw[i] = high === low ? 50 : (values[values.length - 1] - low) / (high - low) * 100;
  }
  function smooth(input: Array<number | null>, period: number) {
    return input.map((_, i) => {
      const values = input.slice(i - period + 1, i + 1);
      return values.length === period && values.every(v => v !== null)
        ? (values as number[]).reduce((sum, v) => sum + v, 0) / period : null;
    });
  }
  const kSeries = smooth(raw, 3), dSeries = smooth(kSeries, 3);
  const k = kSeries.at(-1), d = dSeries.at(-1);
  if (k == null || d == null) return empty;
  const prevK = kSeries.at(-2), prevD = dSeries.at(-2);
  const zone = k <= 20 ? "oversold" : k >= 80 ? "overbought" : "middle";
  const bullish = prevK != null && prevD != null &&
    ((prevK <= prevD && k > d && (prevK <= 30 || k <= 30)) || (prevK <= 20 && k > 20));
  const bearish = prevK != null && prevD != null &&
    ((prevK >= prevD && k < d && (prevK >= 70 || k >= 70)) || (prevK >= 80 && k < 80));
  return { k: round(k, 1), d: round(d, 1), zone, turn: bullish ? "bullish" : bearish ? "bearish" : "none" };
}
function volumeSignal(bars: ScanBar[]): MarketSignalSnapshot["volume"] {
  if (bars.length < 21) return { multiple: null, state: "unavailable" };
  const previous = bars.slice(-21, -1).map(p => p.volume);
  const latest = bars.at(-1)!, previousClose = bars.at(-2)!.close;
  if (latest.volume == null || !Number.isFinite(latest.volume) || latest.volume <= 0 ||
    previous.some(v => v == null || !Number.isFinite(v) || v <= 0)) return { multiple: null, state: "unavailable" };
  const average = (previous as number[]).reduce((sum, v) => sum + v, 0) / 20;
  const multiple = latest.volume / average;
  return { multiple: round(multiple), state: multiple < 1.5 ? "normal" :
    latest.close > previousClose ? "up-surge" : latest.close < previousClose ? "down-surge" : "normal" };
}
function relativeSignal(bars: ScanBar[], benchmark: readonly ScanBar[] | null): MarketSignalSnapshot["relative"] {
  const unknown = { excess20d: null, state: "unavailable" as const };
  if (!benchmark || bars.length < 21) return unknown;
  const comparison = cleanBars(benchmark);
  if (comparison.length < 21 || bars.at(-1)!.time !== comparison.at(-1)!.time) return unknown;
  const asset = (bars.at(-1)!.close / bars.at(-21)!.close - 1) * 100;
  const base = (comparison.at(-1)!.close / comparison.at(-21)!.close - 1) * 100;
  const excess = asset - base;
  return { excess20d: round(excess), state: excess >= 1 ? "leader" : excess <= -1 ? "laggard" : "neutral" };
}
function squeezeSignal(bars: ScanBar[]): MarketSignalSnapshot["squeeze"] {
  if (bars.length < 100) return { state: "unavailable" };
  const widths: number[] = [];
  const closes = bars.map(b => b.close);
  for (let i = 19; i < closes.length; i++) {
    const window = closes.slice(i - 19, i + 1);
    const mean = window.reduce((sum, v) => sum + v, 0) / 20;
    const sd = Math.sqrt(window.reduce((sum, v) => sum + (v - mean) ** 2, 0) / 20);
    widths.push(mean > 0 ? 4 * sd / mean : NaN);
  }
  const current = widths.at(-1)!, prior = widths.at(-2)!;
  const sample = widths.slice(-102, -2);
  if (sample.length < 60 || !Number.isFinite(current) || !Number.isFinite(prior)) return { state: "unavailable" };
  const cutoff = [...sample].sort((a, b) => a - b)[Math.floor((sample.length - 1) * 0.2)];
  if (prior <= cutoff && current > prior * 1.05) {
    const latest = closes.at(-1)!, before = closes.at(-2)!;
    const mean = closes.slice(-20).reduce((sum, v) => sum + v, 0) / 20;
    return { state: latest > before && latest > mean ? "expanding-up" :
      latest < before && latest < mean ? "expanding-down" : "normal" };
  }
  return { state: current <= cutoff ? "tight" : "normal" };
}
export function evaluateMarketSignals(
  sourceBars: readonly ScanBar[], benchmarkBars: readonly ScanBar[] | null = null,
): MarketSignalSnapshot | null {
  const bars = cleanBars(sourceBars);
  if (!bars.length) return null;
  const breakout = { "20": scanBreakout(bars, 20), "55": scanBreakout(bars, 55), "252": scanBreakout(bars, 252) };
  const stoch = stochRsi(bars);
  const volume = volumeSignal(bars);
  const relative = relativeSignal(bars, benchmarkBars);
  const squeeze = squeezeSignal(bars);
  const breakoutKnown = breakout["20"].state !== "unavailable";
  const states = [breakoutKnown, stoch.zone !== "unavailable", volume.state !== "unavailable",
    relative.state !== "unavailable", squeeze.state !== "unavailable"];
  const available = states.filter(Boolean).length;
  const bullish = [breakoutKnown && Object.values(breakout).some(s => s.state === "up"),
    stoch.turn === "bullish", volume.state === "up-surge", relative.state === "leader",
    squeeze.state === "expanding-up"];
  const bearish = [breakoutKnown && Object.values(breakout).some(s => s.state === "down"),
    stoch.turn === "bearish", volume.state === "down-surge", relative.state === "laggard",
    squeeze.state === "expanding-down"];
  return {
    asOf: new Date(bars.at(-1)!.time * 1000).toISOString().slice(0, 10),
    breakout, stoch, volume, relative, squeeze,
    alignment: { bullish: { matched: bullish.filter(Boolean).length, available },
      bearish: { matched: bearish.filter(Boolean).length, available } },
  };
}
