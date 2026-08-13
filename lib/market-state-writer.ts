import "server-only";

import { getMarketData } from "@/lib/market";
import { intelligenceRest } from "@/lib/intelligence/supabase";
import type { MarketStateRecord } from "@/lib/data";

export async function updateMarketStateLedger(): Promise<void> {
  const data = await getMarketData();
  const records: Array<Partial<MarketStateRecord> & { module_key: string }> = [];

  const nowStr = new Date().toISOString();

  // 1. Module: energy-crude
  const wtiSeries = data.series.find(s => s.symbol === "CL=F");
  if (wtiSeries) {
    const lastPrice = wtiSeries.last ?? 0;
    const change5d = wtiSeries.change5d ?? 0;

    let direction = "Mixed";
    let magnitude = 50;
    let probability = 50;
    let risk = "Energy inflation pressure is currently balanced.";
    let boon = "Crude prices are stable in the current range.";
    let beneficiaries = ["Energy producers", "Commodity funds"];
    let losers = ["Airlines", "Consumers", "Chemical companies"];

    if (change5d > 3.0) {
      direction = "Risk";
      magnitude = Math.min(100, Math.round(50 + change5d * 3));
      probability = 80;
      risk = "Rising crude oil prices increase global energy inflation and carry costs.";
      boon = "Improves margins for energy producers.";
    } else if (change5d < -3.0) {
      direction = "Boon";
      magnitude = Math.min(100, Math.round(50 + Math.abs(change5d) * 3));
      probability = 85;
      risk = "Can signal slowing global demand.";
      boon = "Falling energy prices ease headline inflation pressure and carry costs.";
    }

    records.push({
      module_key: "energy-crude",
      sector: "Energy",
      sub_industry: "Crude oil and physical energy",
      status: "active",
      direction,
      magnitude,
      probability,
      risk,
      boon,
      beneficiaries,
      losers,
      evidence_summary: `WTI spot crude is trading at $${lastPrice.toFixed(2)} (change: ${change5d >= 0 ? "+" : ""}${change5d.toFixed(1)}% over 5 days).`,
      source_name: "U.S. EIA daily spot prices",
      source_url: "https://www.eia.gov/petroleum/supply/weekly/",
      source_type: "official",
      observed_at: nowStr,
      freshness_status: "current",
      next_test: "Refinery runs, crude stocks and geopolitical escalation.",
      owner_status: "active"
    } as any);
  }

  // 2. Module: us-equities
  const spySeries = data.series.find(s => s.symbol === "^GSPC");
  if (spySeries) {
    const lastPrice = spySeries.last ?? 0;
    const change5d = spySeries.change5d ?? 0;

    let direction = "Mixed";
    let magnitude = 50;
    let probability = 50;
    let risk = "Equity risk premium is neutral.";
    let boon = "Equities are stable at current levels.";
    let beneficiaries = ["Index funds", "Growth assets"];
    let losers = ["Short sellers", "Cash holders"];

    if (change5d > 1.5) {
      direction = "Boon";
      magnitude = Math.min(100, Math.round(50 + change5d * 5));
      probability = 75;
      risk = "High valuation multiples relative to historical averages.";
      boon = "Constructive momentum in US large-cap equities confirms macro resilience.";
    } else if (change5d < -1.5) {
      direction = "Risk";
      magnitude = Math.min(100, Math.round(50 + Math.abs(change5d) * 5));
      probability = 80;
      risk = "Correction in large-cap equities signals rising equity premium or growth concerns.";
      boon = "Lower valuations improve long-term entry points.";
    }

    records.push({
      module_key: "us-equities",
      sector: "Equities",
      sub_industry: "US large-cap and equal-weight equity participation",
      status: "active",
      direction,
      magnitude,
      probability,
      risk,
      boon,
      beneficiaries,
      losers,
      evidence_summary: `S&P 500 proxy is trading at ${lastPrice.toFixed(2)} (change: ${change5d >= 0 ? "+" : ""}${change5d.toFixed(1)}% over 5 days).`,
      source_name: "Nasdaq official Daily histories",
      source_url: "https://www.nasdaq.com/market-activity/etf/spy/historical",
      source_type: "official",
      observed_at: nowStr,
      freshness_status: "current",
      next_test: "Index breadth, earnings growth and valuation multiples.",
      owner_status: "active"
    } as any);
  }

  // 3. Module: us-rates
  const ratesSeries = data.series.find(s => s.symbol === "^TNX");
  if (ratesSeries) {
    const points = ratesSeries.points;
    if (points.length >= 2) {
      const lastYield = points[points.length - 1].close;
      const priorYield = points[points.length - 2].close;
      const yield5DaysAgo = points.length >= 6 ? points[points.length - 6].close : points[0].close;

      const move5d_bps = (lastYield - yield5DaysAgo) * 100;

      let direction = "Mixed";
      let magnitude = 50;
      let probability = 50;
      let risk = "Yield volatility is balanced.";
      let boon = "Yields are consolidating in the current range.";
      let beneficiaries = ["Commercial banks", "Income investors"];
      let losers = ["Real estate", "High-duration tech", "Borrowers"];

      if (move5d_bps > 15) {
        direction = "Risk";
        magnitude = Math.min(100, Math.round(50 + move5d_bps * 1.5));
        probability = 80;
        risk = "Rising long-term yields increase borrowing costs and compress valuation multiples.";
        boon = "Yield compression eases after significant spikes.";
      } else if (move5d_bps < -15) {
        direction = "Boon";
        magnitude = Math.min(100, Math.round(50 + Math.abs(move5d_bps) * 1.5));
        probability = 80;
        risk = "Falling yields can signal a growth slowdown or flight to safety.";
        boon = "Easing long-term yields reduce cost of capital for corporate and mortgage credit.";
      }

      records.push({
        module_key: "us-rates",
        sector: "Fixed Income",
        sub_industry: "US Treasury yields and credit spreads",
        status: "active",
        direction,
        magnitude,
        probability,
        risk,
        boon,
        beneficiaries,
        losers,
        evidence_summary: `US 10Y Yield is trading at ${lastYield.toFixed(2)}% (change: ${move5d_bps >= 0 ? "+" : ""}${move5d_bps.toFixed(0)} bps over 5 days).`,
        source_name: "U.S. Treasury",
        source_url: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/",
        source_type: "official",
        observed_at: nowStr,
        freshness_status: "current",
        next_test: "FOMC path, term premium and deficit supply projections.",
        owner_status: "active"
      } as any);
    }
  }

  if (records.length > 0) {
    await intelligenceRest("market_state_ledger?on_conflict=module_key", {
      method: "POST",
      headers: {
        "Prefer": "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify(records)
    });
    console.log(`[LEDGER] Successfully updated ${records.length} market state records.`);
  }
}
