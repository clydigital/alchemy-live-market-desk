import "server-only";

import type { PublicMarketObservation } from "./blue-desk-public-markets";

const POWER_STACK = "https://clydigital.github.io/power-stack/";
const WATCH_URL = POWER_STACK + "data/watchlist.json";
const HOLD_URL = POWER_STACK + "data/holdings-fundamentals.json";

export type PowerStackResearchAsset = {
  ticker: string;
  name: string;
  role: "holding" | "watchlist";
  asOf: string | null;
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
    // The Power Stack GitHub Pages repository is already public; no credentials
    // or owner-only data ever cross into Bluebelly's public market response.
    const response = await fetch(url, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(4500),
    });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    return payload && typeof payload === "object" && !Array.isArray(payload)
      ? payload as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export async function getPowerStackResearchAssets(): Promise<{
  items: PowerStackResearchAsset[];
  status: "available" | "partial" | "unavailable";
}> {
  const [watch, held] = await Promise.all([
    readPublicJson(WATCH_URL),
    readPublicJson(HOLD_URL),
  ]);
  const items = new Map<string, PowerStackResearchAsset>();
  for (const raw of Array.isArray(watch?.candidates) ? watch.candidates.slice(0, 250) : []) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const code = ticker(row.ticker);
    if (!code) continue;
    items.set(code, {
      ticker: code,
      name: clean(row.name) || code,
      role: "watchlist",
      asOf: clean(watch?.asOf, 30) || null,
    });
  }
  for (const raw of Array.isArray(held?.holdings) ? held.holdings.slice(0, 100) : []) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const code = ticker(row.ticker);
    if (!code) continue;
    // Holdings take priority if a security is also on the watchlist.
    items.set(code, {
      ticker: code,
      name: clean(row.name) || items.get(code)?.name || code,
      role: "holding",
      asOf: clean(held?.asOf, 30) || null,
    });
  }
  return {
    items: [...items.values()],
    status: watch && held ? "available" : watch || held ? "partial" : "unavailable",
  };
}

/** Add research discovery to the public instrument search, not to the price feed.
 * Known market rows retain independently sourced prices; PS-only rows have no
 * quote, change, session or invented original-price attribution.
 */
export function mergePowerStackMarketSearch(
  observations: readonly PublicMarketObservation[],
  assets: readonly PowerStackResearchAsset[],
): PublicMarketObservation[] {
  const assetsByTicker = new Map(assets.map(asset => [asset.ticker, asset]));
  const matched = new Set<string>();
  const rows = observations.map(row => {
    const asset = assetsByTicker.get(row.symbol.toUpperCase());
    if (!asset) return row;
    matched.add(asset.ticker);
    return { ...row, researchRole: asset.role, researchAsOf: asset.asOf };
  });
  for (const asset of assets) {
    if (matched.has(asset.ticker)) continue;
    rows.push({
      id: "power-stack:" + asset.ticker,
      label: asset.name,
      symbol: asset.ticker,
      type: "Power Stack",
      last: null,
      change: null,
      change3d: null,
      change5d: null,
      changeUnit: "%",
      asOf: null,
      frequency: "daily",
      sourceName: "Power Stack research registry · no market price",
      sourceUrl: POWER_STACK,
      researchRole: asset.role,
      researchAsOf: asset.asOf,
    });
  }
  return rows;
}
