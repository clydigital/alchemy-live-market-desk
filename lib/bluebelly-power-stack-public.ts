import "server-only";

import type { PublicMarketObservation } from "./blue-desk-public-markets";
import {sourceDateFresh} from "./bluebelly-breadth-dated";

const POWER_STACK = "https://clydigital.github.io/power-stack/";
const WATCH_URL = POWER_STACK + "data/watchlist.json";
const HOLD_URL = POWER_STACK + "data/holdings-fundamentals.json";
const HOLD_TAPE_URL = POWER_STACK + "data/holding-tape.json";
const WATCH_TAPE_URL = POWER_STACK + "data/watchlist-market-tape.json";

export type PowerStackDatedPrice = {
  last: number;
  change: number;
  change3d: number | null;
  change5d: number | null;
  asOf: string;
  sourceName: string;
  sourceUrl: string;
};

export type PowerStackResearchAsset = {
  ticker: string;
  name: string;
  role: "holding" | "watchlist";
  asOf: string | null;
  price?: PowerStackDatedPrice;
};

function clean(value: unknown, max = 100): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function ticker(value: unknown): string | null {
  const code = clean(value, 24).toUpperCase();
  return /^[A-Z0-9][A-Z0-9.\-]{0,17}$/.test(code) ? code : null;
}

async function readPublicJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    // Public GitHub Pages research and market tape. Never read broker data.
    const response = await fetch(url, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(4500),
    });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    return payload && typeof payload === "object" && !Array.isArray(payload)
      ? payload as Record<string, unknown> : null;
  } catch { return null; }
}

export function validPowerStackPrice(raw: unknown, now = new Date()): PowerStackDatedPrice | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const asOf = clean(row.sessionDate, 15);
  const sourceUrl = clean(row.sourceUrl, 600);
  const price = row.close, one = row.changePct;
  const three = row.change3dPct, five = row.change5dPct;
  if (row.status !== "CLOSED" || !sourceDateFresh(asOf,now) ||
    typeof price !== "number" || !Number.isFinite(price) || price <= 0 ||
    typeof one !== "number" || !Number.isFinite(one) ||
    ![three,five].every(value => value === null || value === undefined ||
      typeof value === "number" && Number.isFinite(value)) ||
    !/^https:\/\/(query1|query2)\.finance\.yahoo\.com\//.test(sourceUrl) &&
    !/^https:\/\/finnhub\.io\/api\/v1\/quote\?symbol=/.test(sourceUrl)) return null;
  return {
    last:price, change:one,
    change3d:typeof three==="number"?three:null,
    change5d:typeof five==="number"?five:null,
    asOf,
    sourceName:clean(row.sourceName) || "Dated market quote",
    sourceUrl,
  };
}

export async function getPowerStackResearchAssets(): Promise<{
  items: PowerStackResearchAsset[];
  status: "available" | "partial" | "unavailable";
  tapeStatus: "available" | "partial" | "unavailable";
}> {
  const [watch, held, watchTape, holdingTape] = await Promise.all([
    readPublicJson(WATCH_URL), readPublicJson(HOLD_URL),
    readPublicJson(WATCH_TAPE_URL), readPublicJson(HOLD_TAPE_URL),
  ]);
  const now = new Date();
  const prices = new Map<string,PowerStackDatedPrice>();
  for (const raw of Array.isArray(watchTape?.rows) ? watchTape.rows : []) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string,unknown>;
    const code = ticker(item.ticker), value=validPowerStackPrice(item,now);
    if(code && value)prices.set(code,value);
  }
  for (const raw of Array.isArray(holdingTape?.holdings) ? holdingTape.holdings : []) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string,unknown>;
    const code = ticker(item.ticker), value=validPowerStackPrice(item,now);
    if(!code || !value)continue;
    const previous = prices.get(code);
    const fullness = (p:PowerStackDatedPrice) => Number(p.change3d!==null)+Number(p.change5d!==null);
    if(!previous || value.asOf>previous.asOf ||
       value.asOf===previous.asOf && fullness(value)>=fullness(previous))prices.set(code,value);
  }

  const items = new Map<string,PowerStackResearchAsset>();
  for (const raw of Array.isArray(watch?.candidates) ? watch.candidates.slice(0, 250) : []) {
    if (!raw || typeof raw !== "object")continue;
    const row=raw as Record<string,unknown>, code=ticker(row.ticker);
    if(!code)continue;
    items.set(code,{
      ticker:code,name:clean(row.name)||code,role:"watchlist",
      asOf:clean(watch?.asOf,30)||null,price:prices.get(code),
    });
  }
  for (const raw of Array.isArray(held?.holdings) ? held.holdings.slice(0, 100) : []) {
    if (!raw || typeof raw !== "object")continue;
    const row=raw as Record<string,unknown>, code=ticker(row.ticker);
    if(!code)continue;
    items.set(code,{
      ticker:code,name:clean(row.name)||items.get(code)?.name||code,
      role:"holding",asOf:clean(held?.asOf,30)||null,price:prices.get(code),
    });
  }
  return {
    items:[...items.values()],
    status:watch && held?"available":watch || held?"partial":"unavailable",
    tapeStatus:watchTape && holdingTape?"available":watchTape || holdingTape?"partial":"unavailable",
  };
}

/** Price source authority remains in upstream providers. PS is the registry for
 * research membership, not a second independently validating market source.
 */
export function mergePowerStackMarketSearch(
  observations: readonly PublicMarketObservation[],
  assets: readonly PowerStackResearchAsset[],
): PublicMarketObservation[] {
  const byCode = new Map(assets.map(asset=>[asset.ticker,asset]));
  const matched = new Set<string>();
  const rows = observations.map(row=>{
    const asset=byCode.get(row.symbol.toUpperCase());
    if(!asset)return row;
    matched.add(asset.ticker);
    return {...row,researchRole:asset.role,researchAsOf:asset.asOf};
  });
  for(const asset of assets) {
    if(matched.has(asset.ticker))continue;
    const price=asset.price;
    rows.push({
      id:"power-stack:"+asset.ticker,
      label:asset.name,symbol:asset.ticker,type:"Power Stack",
      last:price?.last??null,change:price?.change??null,
      change3d:price?.change3d??null,change5d:price?.change5d??null,
      changeUnit:"%",asOf:price?.asOf??null,frequency:"daily",
      sourceName:price?.sourceName||"Power Stack research registry · price unavailable",
      sourceUrl:price?.sourceUrl||POWER_STACK,
      researchRole:asset.role,researchAsOf:asset.asOf,
      dataStatus:price?"SOURCE_DATED_SECONDARY":"UNAVAILABLE_OR_STALE",
    });
  }
  return rows;
}
