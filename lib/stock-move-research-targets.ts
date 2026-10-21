/**
 * Turns existing canonical market-monitor observations into *research queries*.
 * PRICE MOVEMENT IS NOT EVIDENCE FOR WHY IT MOVED.
 * The source clock is the original market observation, never request time.
 */
import type { MarketMonitor, MarketMonitorRow } from "./market-monitor.ts";

const COMPANY_NAMES: Record<string,string> = {
  AMD:"AMD", AAPL:"Apple", MSFT:"Microsoft", AMZN:"Amazon",
  GOOGL:"Alphabet", META:"Meta Platforms", NVDA:"NVIDIA", TSLA:"Tesla",
  AVGO:"Broadcom", TSM:"TSMC", ASML:"ASML", ARM:"Arm Holdings",
  MU:"Micron", MRVL:"Marvell", ORCL:"Oracle", CRWV:"CoreWeave", PLTR:"Palantir",
  NFLX:"Netflix",
};
const MAX_AGE_MS = 4 * 24 * 60 * 60_000;
export type StockMoveResearchTarget = {
  key: string; symbol: string; company: string; asOf: string;
  observedDayChange: number | null; observedGapChange: number | null;
  observedChange5d: number | null; sourceUrl: string;
  query: string; relevance: number; materiality: number; signal: string;
};

function safeDocument(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password
      && u.hostname.includes(".") && u.hostname !== "localhost";
  } catch { return false; }
}
function qualify(row: MarketMonitorRow, now: Date): StockMoveResearchTarget | null {
  const symbol = row.symbol.toUpperCase();
  const company = COMPANY_NAMES[symbol];
  if (!company || row.frequency !== "daily" || !row.asOf || row.points.length < 3
    || !safeDocument(row.sourceUrl) || row.last == null) return null;
  const stamp = Date.parse(row.asOf + "T23:59:59Z");
  if (!Number.isFinite(stamp) || stamp - now.getTime() > 24 * 60 * 60_000 ||
    now.getTime() - stamp > MAX_AGE_MS) return null;
  const daily = row.dayChange != null && Number.isFinite(row.dayChange) ? row.dayChange : null;
  const gap = row.gapChange != null && Number.isFinite(row.gapChange) ? row.gapChange : null;
  const five = row.change5d != null && Number.isFinite(row.change5d) ? row.change5d : null;
  if (!((daily != null && Math.abs(daily) >= 4)
      || (gap != null && Math.abs(gap) >= 3)
      || (five != null && Math.abs(five) >= 8))) return null;
  const group = [...new Set([company, symbol])].map(v=> '"' + v.replace(/[^a-z0-9 .-]/gi,"") + '"').join(" OR ");
  return {
    key:"stock-move-"+symbol.toLowerCase(),symbol,company,asOf:row.asOf,
    observedDayChange:daily,observedGapChange:gap,observedChange5d:five,
    sourceUrl:row.sourceUrl,
    query:"("+group+") AND (earnings OR guidance OR filing OR outlook OR contract OR sales OR capacity OR investment OR forecast OR shares OR stock)",
    relevance:82,materiality:65,
    signal:"Market monitor recorded a notable source-dated "+symbol+
      " price movement. Seek independent event reporting; cause is UNVERIFIED.",
  };
}

/** Only equity *companies*: never SPX/sector ETF, stale monthly yield, FX or synthetic proxy. */
export function selectStockMoveResearchTargets(
  monitor: Pick<MarketMonitor,"rows">,
  now = new Date(),
  limit = 3,
): StockMoveResearchTarget[] {
  return monitor.rows.flatMap(row=> {
    const item = qualify(row,now);
    return item ? [{item, rank:row.attentionScore
      + Math.abs(row.dayChange || 0)*2 + Math.abs(row.gapChange || 0)
      + Math.abs(row.change5d || 0)*0.8}] : [];
  }).sort((a,b)=>b.rank-a.rank || a.item.symbol.localeCompare(b.item.symbol))
    .slice(0,Math.max(0,Math.min(3,limit))).map(x=>x.item);
}

export function stockMoveSearchResultMatches(target: StockMoveResearchTarget, title: string): boolean {
  const text=title.toLowerCase();
  const tokens=[target.company,target.symbol].map(s=>s.toLowerCase());
  return tokens.some(value=>new RegExp("(^|[^a-z0-9])"+value+"([^a-z0-9]|$)","i").test(text));
}
