import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getMarketMonitor } from "@/lib/market-monitor-public";
import { getGlobalFlowMonitor } from "@/lib/global-flow-monitor";

export async function refreshMarketStateLedger() {
  const client = createSupabaseAdminClient();

  // 1. Load active stories to match story_id cleanly
  const { data: stories } = await client
    .from("stories")
    .select("id, slug")
    .neq("status", "archived");
  const storyMap = new Map<string, string>(stories?.map((s) => [s.slug, s.id]) || []);

  // 2. Fetch current market monitor and global flow monitor (which are now cached / warm)
  let monitor;
  let flow;
  try {
    monitor = await getMarketMonitor();
    flow = await getGlobalFlowMonitor();
  } catch (error) {
    console.error("Failed to load monitors for market state ledger:", error);
    return;
  }

  const row = (id: string) => monitor.rows.find((item) => item.id === id);
  const wti = row("wti");
  const brent = row("brent");
  const us10y = row("us10y");
  const us30y = row("us30y");
  const soxx = row("soxx");
  const rsp = row("rsp");
  const spx = row("spx");

  const nowStr = new Date().toISOString();

  // Helper to upsert a record cleanly into market_state_ledger
  const upsertRecord = async (payload: {
    module_key: string;
    sector: string;
    sub_industry: string;
    status: string;
    direction: "Boon" | "Risk" | "Mixed" | "Data gap";
    magnitude: number;
    probability: number;
    risk: string;
    boon: string;
    beneficiaries: string[];
    losers: string[];
    evidence_summary: string;
    source_name: string;
    source_url: string;
    observed_at: string;
    freshness_status: string;
    next_test: string;
    story_id: string | null;
  }) => {
    const { error } = await client.from("market_state_ledger").upsert(payload, {
      onConflict: "module_key",
    });
    if (error) {
      console.error(`Failed to upsert market state ledger for ${payload.module_key}:`, error);
    }
  };

  // --- Module 1: energy-crude-oil ---
  let oilDirection: "Boon" | "Risk" | "Mixed" | "Data gap" = "Mixed";
  let crossingsStr = "unavailable";
  const hormuzCrossing = flow.oil.find((m) => m.id === "hormuz-crossings");

  if (hormuzCrossing && hormuzCrossing.current) {
    crossingsStr = hormuzCrossing.current;
    if (hormuzCrossing.state === "coverage_gap") {
      oilDirection = "Data gap";
    } else if (hormuzCrossing.direction === "rising" || (hormuzCrossing.current && parseInt(hormuzCrossing.current) >= 60)) {
      oilDirection = "Boon";
    } else if (hormuzCrossing.direction === "falling" || (hormuzCrossing.current && parseInt(hormuzCrossing.current) < 30)) {
      oilDirection = "Risk";
    }
  } else if (wti && wti.dayChange !== null) {
    if (wti.dayChange > 2) {
      oilDirection = "Risk";
    } else if (wti.dayChange < -2) {
      oilDirection = "Boon";
    }
  }

  const oilSummary = crossingsStr !== "unavailable"
    ? `Physical crossings count stands at ${crossingsStr} vs pre-crisis baseline of 73.`
    : `Oil market price action is monitoring key levels with Brent at ${brent?.last ? `$${brent.last.toFixed(2)}` : "n/a"} and WTI at ${wti?.last ? `$${wti.last.toFixed(2)}` : "n/a"}.`;

  await upsertRecord({
    module_key: "energy-crude-oil",
    sector: "Energy",
    sub_industry: "Crude Oil Physical",
    status: "monitoring",
    direction: oilDirection,
    magnitude: 70,
    probability: 80,
    risk: "Sustained physical flow disruption or carrier rerouting in the Strait of Hormuz increases global carrying costs.",
    boon: "Tanker crossing volume and carrier postures returning to baseline levels.",
    beneficiaries: ["XLE", "USO"],
    losers: ["SPY", "QQQ"],
    evidence_summary: oilSummary,
    source_name: "Straits.live / IMF PortWatch",
    source_url: "https://straits.live/status",
    observed_at: nowStr,
    freshness_status: "current",
    next_test: "EIA weekly petroleum reports and Straits.live transit updates.",
    story_id: storyMap.get("oil-physical-disruption") || null,
  });

  // --- Module 2: macro-rates-long-end ---
  let ratesDirection: "Boon" | "Risk" | "Mixed" | "Data gap" = "Mixed";
  if (us10y && us10y.dayChange !== null) {
    if (us10y.dayChange > 1.5) {
      ratesDirection = "Risk";
    } else if (us10y.dayChange < -1.5) {
      ratesDirection = "Boon";
    }
  }

  const ratesSummary = us10y && us30y
    ? `US 10Y Yield stands at ${us10y.last ? `${us10y.last.toFixed(2)}%` : "n/a"} and 30Y Yield stands at ${us30y.last ? `${us30y.last.toFixed(2)}%` : "n/a"}.`
    : "US Treasury yield curve observations are currently stable.";

  await upsertRecord({
    module_key: "macro-rates-long-end",
    sector: "Rates",
    sub_industry: "US Treasuries Long-End",
    status: "monitoring",
    direction: ratesDirection,
    magnitude: 65,
    probability: 75,
    risk: "Rising long-end Treasury yields increase borrow costs and discount rate pressure on equities.",
    boon: "Yield compression eases duration burden and financial conditions.",
    beneficiaries: ratesDirection === "Risk" ? ["TBT", "PST"] : ["TLT"],
    losers: ["SPY", "QQQ"],
    evidence_summary: ratesSummary,
    source_name: "Federal Reserve Economic Data",
    source_url: "https://fred.stlouisfed.org/",
    observed_at: nowStr,
    freshness_status: "current",
    next_test: "Treasury refunding announcements and CPI releases.",
    story_id: storyMap.get("fed-long-end-stress") || null,
  });

  // --- Module 3: tech-semiconductors ---
  let techDirection: "Boon" | "Risk" | "Mixed" | "Data gap" = "Mixed";
  if (soxx && soxx.change5d !== null) {
    if (soxx.change5d > 2) {
      techDirection = "Boon";
    } else if (soxx.change5d < -2) {
      techDirection = "Risk";
    }
  }

  const techSummary = soxx
    ? `Semiconductors SOXX ETF stands at ${soxx.last ? soxx.last.toFixed(2) : "n/a"} with 5-day change of ${soxx.change5d ? `${soxx.change5d.toFixed(1)}%` : "0%"} .`
    : "AI demand and chip supply observations are monitoring guidance.";

  await upsertRecord({
    module_key: "tech-semiconductors",
    sector: "Technology",
    sub_industry: "AI Semiconductors",
    status: "monitoring",
    direction: techDirection,
    magnitude: 75,
    probability: 80,
    risk: "AI semiconductor demand slowdown, supply chain bottlenecks or export controls.",
    boon: "Robust enterprise AI adoption, capex expansion, and strong guidance from semiconductor leaders.",
    beneficiaries: ["SOXX", "NVDA", "AMD"],
    losers: ["XLU", "XLP"],
    evidence_summary: techSummary,
    source_name: "Nasdaq Exchange",
    source_url: "https://www.nasdaq.com/",
    observed_at: nowStr,
    freshness_status: "current",
    next_test: "Nvidia earnings and ASML booking updates.",
    story_id: storyMap.get("china-ai-pressure") || null,
  });

  // --- Module 4: equity-market-breadth ---
  let breadthDirection: "Boon" | "Risk" | "Mixed" | "Data gap" = "Mixed";
  if (rsp && spx && rsp.change5d !== null && spx.change5d !== null) {
    const spread = rsp.change5d - spx.change5d;
    if (spread > 1) {
      breadthDirection = "Boon";
    } else if (spread < -1) {
      breadthDirection = "Risk";
    }
  }

  const breadthSummary = rsp && spx
    ? `RSP equal-weight index 5-day change stands at ${rsp.change5d ? `${rsp.change5d.toFixed(1)}%` : "n/a"} vs SPX headline change of ${spx.change5d ? `${spx.change5d.toFixed(1)}%` : "n/a"}.`
    : "Equity participation and concentration metrics are monitoring key levels.";

  await upsertRecord({
    module_key: "equity-market-breadth",
    sector: "Equity Markets",
    sub_industry: "Market Breadth",
    status: "monitoring",
    direction: breadthDirection,
    magnitude: 60,
    probability: 70,
    risk: "Narrow concentration in a few mega-cap names leaves indices vulnerable to correction.",
    boon: "Broad participation across mid and small-cap stocks confirms macro constructive environment.",
    beneficiaries: ["RSP", "IWM"],
    losers: ["VIXY"],
    evidence_summary: breadthSummary,
    source_name: "Nasdaq Exchange",
    source_url: "https://www.nasdaq.com/",
    observed_at: nowStr,
    freshness_status: "current",
    next_test: "S&P 500 advance-decline line and equal-weight participation.",
    story_id: storyMap.get("market-breadth-health") || null,
  });
}
