import { unstable_cache } from "next/cache";

import { getMarketMonitor, type MarketResearchTrigger } from "@/lib/market-monitor";

export type FlowMetricState = "ready" | "watch" | "coverage_gap";

export type FlowMetric = {
  id: string;
  family: "Central Bank Gold" | "Oil Demand" | "Oil Supply" | "Strategic Reserves" | "Physical Stress" | "Market Confirmation";
  geography: string;
  label: string;
  current: string | null;
  previous: string | null;
  delta: string | null;
  direction: "rising" | "falling" | "flat" | "unknown";
  state: FlowMetricState;
  asOf: string | null;
  cadence: string;
  sourceName: string;
  sourceUrl: string;
  interpretation: string;
};

export type GlobalFlowMonitor = {
  updatedAt: string;
  gold: FlowMetric[];
  oil: FlowMetric[];
  researchTriggers: MarketResearchTrigger[];
  coverageGaps: string[];
};

const WGC_URL = "https://www.gold.org/goldhub/data/gold-reserves-by-country";
const IMF_IFS_URL = "https://data.imf.org/";
const EIA_WEEKLY_URL = "https://www.eia.gov/petroleum/supply/weekly/";
const IEA_OIL_URL = "https://www.iea.org/reports/oil-market-report";
const STRAITS_STATUS_URL = "https://straits.live/status";

function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

async function straitsStatus() {
  try {
    const response = await fetch(STRAITS_STATUS_URL, {
      headers: { accept: "application/json" },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(6500),
    });
    if (!response.ok) return null;
    return response.json() as Promise<Record<string, unknown>>;
  } catch {
    return null;
  }
}

function goldGap(id: string, geography: string): FlowMetric {
  return {
    id,
    family: "Central Bank Gold",
    geography,
    label: "Official gold holdings / net purchase",
    current: null,
    previous: null,
    delta: null,
    direction: "unknown",
    state: "coverage_gap",
    asOf: null,
    cadence: "Monthly",
    sourceName: "World Gold Council / IMF IFS",
    sourceUrl: WGC_URL,
    interpretation: "This sovereign is on the priority watchlist. A structured official/WGC country reading is not yet connected, so the Desk will not infer central-bank buying from the gold price.",
  };
}

function oilGap(id: string, family: FlowMetric["family"], geography: string, label: string, sourceName: string, sourceUrl: string, cadence: string): FlowMetric {
  return {
    id,
    family,
    geography,
    label,
    current: null,
    previous: null,
    delta: null,
    direction: "unknown",
    state: "coverage_gap",
    asOf: null,
    cadence,
    sourceName,
    sourceUrl,
    interpretation: "Deciding monitor identified, but no structured canonical reading is currently connected. The research system should treat this as a data gap rather than substitute crude price direction.",
  };
}

function pctText(value: number | null) {
  return value == null ? null : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

async function loadGlobalFlowMonitor(): Promise<GlobalFlowMonitor> {
  const [statusRoot, market] = await Promise.all([straitsStatus(), getMarketMonitor()]);
  const root = rec(statusRoot);
  const transits = rec(root.transits);
  const daily = rec(root.dailyTransits);
  const insurance = rec(root.insurance);
  const carriers = Array.isArray(root.carrierSuspensions) ? root.carrierSuspensions.map(rec) : [];

  const count = num(transits.count) ?? num(daily.nTotal);
  const previousCount = num(daily.previousNTotal);
  const baseline = num(transits.baseline) ?? num(daily.preCrisisBaselineMedian) ?? 73;
  const throughput = num(transits.throughputPct) ?? num(root.throughputPercent);
  const insuranceMultiple = num(insurance.multiple) ?? num(root.insuranceMultiple);
  const stopped = carriers.filter((item) => ["stopped", "rerouting", "suspended"].includes(String(item.hormuzPosture || item.status || "").toLowerCase())).length;
  const asOf = text(root.asOf) || text(daily.updatedAt) || text(transits.asOfDate);

  const row = (id: string) => market.rows.find((item) => item.id === id);
  const wti = row("wti");
  const brent = row("brent");
  const gasolineCrack = row("crack-gasoline");
  const distillateCrack = row("crack-distillate");
  const crack321 = row("crack-321");

  const gold = ["China", "Poland", "India", "Turkey", "Czech Republic", "Kazakhstan"].map((country) => goldGap(`gold-${country.toLowerCase().replace(/[^a-z]+/g, "-")}`, country));
  gold.push({
    id: "gold-global-source",
    family: "Central Bank Gold",
    geography: "Global",
    label: "Central-bank purchase watch",
    current: "Priority source configured",
    previous: null,
    delta: null,
    direction: "unknown",
    state: "watch",
    asOf: null,
    cadence: "Monthly / WGC updates",
    sourceName: "World Gold Council + IMF IFS",
    sourceUrl: IMF_IFS_URL,
    interpretation: "The monitor is deliberately country-first. Once structured holdings are connected, acceleration, pauses and net selling will be calculated from official reserve history.",
  });

  const oil: FlowMetric[] = [
    {
      id: "hormuz-crossings",
      family: "Physical Stress",
      geography: "Strait of Hormuz",
      label: "Commercial crossings",
      current: count == null ? null : `${count} vessels/day`,
      previous: previousCount == null ? null : `${previousCount} vessels/day`,
      delta: count != null && previousCount != null ? `${count - previousCount >= 0 ? "+" : ""}${count - previousCount}` : null,
      direction: count == null || previousCount == null ? "unknown" : count > previousCount ? "rising" : count < previousCount ? "falling" : "flat",
      state: count == null ? "coverage_gap" : "ready",
      asOf,
      cadence: "PortWatch source-driven",
      sourceName: "Straits.live / IMF PortWatch",
      sourceUrl: STRAITS_STATUS_URL,
      interpretation: count == null ? "The physical-flow source did not return a readable crossing count." : `${count} completed crossings versus roughly ${baseline}/day before the crisis. Political headlines are not treated as a reopening unless physical traffic follows.`,
    },
    {
      id: "hormuz-throughput",
      family: "Physical Stress",
      geography: "Strait of Hormuz",
      label: "Throughput versus normal",
      current: throughput == null ? null : `${throughput}%`,
      previous: null,
      delta: null,
      direction: "unknown",
      state: throughput == null ? "coverage_gap" : "ready",
      asOf,
      cadence: "PortWatch source-driven",
      sourceName: "Straits.live / IMF PortWatch",
      sourceUrl: STRAITS_STATUS_URL,
      interpretation: throughput == null ? "A throughput percentage is not available on this refresh." : `${throughput}% of the pre-crisis traffic benchmark. This is a physical normalisation test, not a market-price proxy.`,
    },
    {
      id: "hormuz-insurance",
      family: "Physical Stress",
      geography: "Strait of Hormuz",
      label: "War-risk insurance",
      current: insuranceMultiple == null ? null : `${insuranceMultiple}× peace baseline`,
      previous: null,
      delta: null,
      direction: "unknown",
      state: insuranceMultiple == null ? "coverage_gap" : "ready",
      asOf: text(insurance.updatedAt) || asOf,
      cadence: "Curated / source-driven",
      sourceName: "Straits.live insurance monitor",
      sourceUrl: STRAITS_STATUS_URL,
      interpretation: insuranceMultiple == null ? "The insurance source did not return a readable multiple." : `Commercial war-risk cost remains around ${insuranceMultiple} times the peace baseline.`,
    },
    {
      id: "hormuz-carriers",
      family: "Physical Stress",
      geography: "Strait of Hormuz",
      label: "Major carrier posture",
      current: carriers.length ? `${stopped}/${carriers.length} stopped or rerouting` : null,
      previous: null,
      delta: null,
      direction: "unknown",
      state: carriers.length ? "ready" : "coverage_gap",
      asOf,
      cadence: "Curated / source-driven",
      sourceName: "Straits.live carrier advisories",
      sourceUrl: STRAITS_STATUS_URL,
      interpretation: carriers.length ? `${stopped} of ${carriers.length} tracked major carriers remain stopped, suspended or rerouting.` : "Carrier posture is not populated on this refresh.",
    },
    {
      id: "wti-confirmation",
      family: "Market Confirmation",
      geography: "Global",
      label: "WTI",
      current: wti?.last == null ? null : wti.last.toFixed(2),
      previous: wti?.previousClose == null ? null : wti.previousClose.toFixed(2),
      delta: pctText(wti?.dayChange ?? null),
      direction: wti?.dayChange == null ? "unknown" : wti.dayChange > 0 ? "rising" : wti.dayChange < 0 ? "falling" : "flat",
      state: wti?.last == null ? "coverage_gap" : "ready",
      asOf: wti?.asOf || null,
      cadence: "Daily",
      sourceName: wti?.sourceName || "U.S. EIA",
      sourceUrl: wti?.sourceUrl || EIA_WEEKLY_URL,
      interpretation: "Price confirmation only. WTI does not substitute for shipping, inventories, refinery runs or end-demand data.",
    },
    {
      id: "brent-confirmation",
      family: "Market Confirmation",
      geography: "Global",
      label: "Brent",
      current: brent?.last == null ? null : brent.last.toFixed(2),
      previous: brent?.previousClose == null ? null : brent.previousClose.toFixed(2),
      delta: pctText(brent?.dayChange ?? null),
      direction: brent?.dayChange == null ? "unknown" : brent.dayChange > 0 ? "rising" : brent.dayChange < 0 ? "falling" : "flat",
      state: brent?.last == null ? "coverage_gap" : "ready",
      asOf: brent?.asOf || null,
      cadence: "Daily",
      sourceName: brent?.sourceName || "U.S. EIA",
      sourceUrl: brent?.sourceUrl || EIA_WEEKLY_URL,
      interpretation: "Global crude price confirmation only. Physical demand and supply monitors retain priority.",
    },
    ...[
      ["gasoline-crack", "Gasoline crack proxy", gasolineCrack],
      ["distillate-crack", "Distillate crack proxy", distillateCrack],
      ["321-crack", "3:2:1 refining crack proxy", crack321],
    ].map(([id, label, item]) => {
      const value = item as typeof gasolineCrack;
      return {
        id: String(id),
        family: "Market Confirmation" as const,
        geography: "United States",
        label: String(label),
        current: value?.last == null ? null : value.last.toFixed(2),
        previous: value?.previousClose == null ? null : value.previousClose.toFixed(2),
        delta: pctText(value?.dayChange ?? null),
        direction: value?.dayChange == null ? "unknown" as const : value.dayChange > 0 ? "rising" as const : value.dayChange < 0 ? "falling" as const : "flat" as const,
        state: value?.last == null ? "coverage_gap" as const : "ready" as const,
        asOf: value?.asOf || null,
        cadence: "Daily",
        sourceName: value?.sourceName || "EIA daily spot prices",
        sourceUrl: value?.sourceUrl || EIA_WEEKLY_URL,
        interpretation: "Product-margin confirmation. A widening crack while crude falls can signal refined-product tightness that the flat crude price misses.",
      };
    }),
    oilGap("china-crude-imports", "Oil Demand", "China", "Crude imports", "China General Administration of Customs", "http://english.customs.gov.cn/", "Monthly"),
    oilGap("india-crude-imports", "Oil Demand", "India", "Crude imports / refinery intake", "Government of India PPAC", "https://ppac.gov.in/", "Monthly"),
    oilGap("us-implied-demand", "Oil Demand", "United States", "Petroleum products supplied", "U.S. Energy Information Administration", EIA_WEEKLY_URL, "Weekly"),
    oilGap("oecd-inventories", "Oil Demand", "OECD", "Commercial inventories", "International Energy Agency", IEA_OIL_URL, "Monthly"),
    oilGap("global-refinery-runs", "Oil Demand", "Global", "Refinery runs", "International Energy Agency / EIA", IEA_OIL_URL, "Monthly / weekly"),
    oilGap("us-spr", "Strategic Reserves", "United States", "SPR purchases / releases", "U.S. Energy Information Administration", EIA_WEEKLY_URL, "Weekly"),
    oilGap("china-storage", "Strategic Reserves", "China", "Strategic / commercial storage activity", "Customs + specialist physical-flow data", "http://english.customs.gov.cn/", "Monthly / estimate"),
    oilGap("opec-output", "Oil Supply", "OPEC+", "Crude production", "OPEC Monthly Oil Market Report", "https://www.opec.org/opec_web/en/publications/338.htm", "Monthly"),
    oilGap("us-production", "Oil Supply", "United States", "Crude production", "U.S. Energy Information Administration", EIA_WEEKLY_URL, "Weekly"),
    oilGap("russia-exports", "Oil Supply", "Russia", "Seaborne crude exports", "Specialist physical-flow data", IEA_OIL_URL, "Weekly / monthly"),
    oilGap("iran-exports", "Oil Supply", "Iran", "Crude exports", "Specialist physical-flow data", IEA_OIL_URL, "Weekly / monthly"),
  ];

  const researchTriggers: MarketResearchTrigger[] = [];
  if (wti?.dayChange != null && wti.dayChange <= -2 && ((throughput != null && throughput < 40) || (count != null && count < 30))) {
    researchTriggers.push({
      id: "oil-price-physical-divergence",
      priority: 94,
      assets: ["wti", "brent", "hormuz-crossings"],
      reason: "Crude is falling while Hormuz physical normalisation remains incomplete.",
      researchQuestion: "Is the market discounting diplomatic progress faster than actual shipping, insurance and carrier behaviour are normalising?",
    });
  }
  const strongestCrack = [gasolineCrack, distillateCrack, crack321].filter(Boolean).sort((a, b) => Math.abs((b?.change5d || 0)) - Math.abs((a?.change5d || 0)))[0];
  if (wti?.change5d != null && strongestCrack?.change5d != null && strongestCrack.change5d - wti.change5d >= 5) {
    researchTriggers.push({
      id: "crack-crude-divergence",
      priority: 92,
      assets: ["wti", strongestCrack.id],
      reason: "Refining margins are strengthening materially relative to crude.",
      researchQuestion: "Is refined-product tightness rebuilding an inflation impulse even while headline crude remains soft?",
    });
  }
  researchTriggers.push(...market.researchTriggers.filter((trigger) => trigger.assets.some((asset) => ["wti", "brent", "gold", "silver", "copper"].includes(asset))).slice(0, 6));

  const coverageGaps = [...gold, ...oil].filter((item) => item.state === "coverage_gap").map((item) => `${item.geography} · ${item.label}`);
  return { updatedAt: new Date().toISOString(), gold, oil, researchTriggers: researchTriggers.sort((a, b) => b.priority - a.priority), coverageGaps };
}

export const getGlobalFlowMonitor = unstable_cache(loadGlobalFlowMonitor, ["alchemy-global-flow-monitor-v1"], { revalidate: 300 });
