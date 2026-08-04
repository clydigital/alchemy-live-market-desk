import { NextResponse } from "next/server";

import { runAccuracyCheck } from "@/lib/accuracy";
import { getEconomicCalendar } from "@/lib/calendar";
import { getDeskData, type MarketStateRecord } from "@/lib/data";
import { getMarketData, type MarketData, type MarketSeries } from "@/lib/market";

export const dynamic = "force-dynamic";

type Direction = "Boon" | "Risk" | "Mixed" | "Data gap";

type StateDefinition = {
  id: string;
  sector: "AI" | "Oil" | "Metals" | "FX" | "Yen" | "Wine";
  subIndustry: string;
  symbols?: string[];
  storySlug?: string;
  riskOnRise?: boolean;
  risk: string;
  boon: string;
  beneficiaries: string[];
  losers: string[];
  nextTest: string;
  sourceName: string;
  sourceUrl: string;
  dataGap?: string;
};

const stateDefinitions: StateDefinition[] = [
  { id: "ai-accelerators", sector: "AI", subIndustry: "Accelerators and semiconductors", symbols: ["SOXX"], storySlug: "ai-capex-cash-conversion", risk: "Crowded positioning can unwind if accelerator demand does not reach earnings revisions.", boon: "Broader demand and improving guidance validate the hardware leg of AI spending.", beneficiaries: ["NVDA", "AMD", "AVGO", "MU"], losers: ["Delayed AI capacity", "Low-utilisation spenders"], nextTest: "Semiconductor guidance, backlog and gross-margin revisions.", sourceName: "Nasdaq official history", sourceUrl: "https://www.nasdaq.com/market-activity/etf/soxx/historical" },
  { id: "ai-hyperscalers", sector: "AI", subIndustry: "Hyperscalers and data centres", symbols: ["MSFT", "AMZN", "GOOGL", "META"], storySlug: "ai-capex-cash-conversion", risk: "Capex, depreciation and power costs can rise faster than cash conversion.", boon: "Cloud growth, backlog and constrained capacity can make spending economically visible.", beneficiaries: ["MSFT", "AMZN", "GOOGL", "META"], losers: ["Cash-flow laggards", "Low-utilisation capacity"], nextTest: "Cloud growth, backlog, capex and free-cash-flow guidance.", sourceName: "Nasdaq official company histories", sourceUrl: "https://www.nasdaq.com/market-activity/stocks/msft/historical" },
  { id: "ai-stack", sector: "AI", subIndustry: "Power, memory and networking", symbols: ["MU", "ANET", "VRT", "CEG", "GEV"], storySlug: "ai-capex-cash-conversion", risk: "Power, cooling, memory or networking constraints can delay revenue recognition.", boon: "Bottlenecks can support supplier pricing, backlog and margin durability.", beneficiaries: ["MU", "ANET", "VRT", "CEG", "GEV"], losers: ["Capacity-constrained hyperscalers"], nextTest: "Breadth, supplier lead times and data-centre commissioning dates.", sourceName: "Nasdaq official histories", sourceUrl: "https://www.nasdaq.com/market-activity" },
  { id: "oil-crude", sector: "Oil", subIndustry: "Crude supply and benchmarks", symbols: ["CL=F", "BZ=F"], storySlug: "oil-physical-disruption", riskOnRise: true, risk: "Shipping constraints can keep effective supply tight after diplomatic headlines improve.", boon: "De-escalation and OPEC+ additions can remove the immediate risk premium.", beneficiaries: ["Upstream producers", "Energy exporters"], losers: ["Airlines", "Energy-intensive industry", "Consumers"], nextTest: "Inventories, exports, OPEC compliance and physical flows.", sourceName: "U.S. Energy Information Administration", sourceUrl: "https://www.eia.gov/petroleum/" },
  { id: "oil-refining", sector: "Oil", subIndustry: "Refining and product cracks", symbols: ["RB=F", "HO=F"], storySlug: "oil-physical-disruption", riskOnRise: true, risk: "Rising cracks indicate product scarcity and stronger inflation transmission.", boon: "Falling cracks would show refinery and product supply normalising.", beneficiaries: ["Refiners", "Product exporters"], losers: ["Transport", "Households", "Rate-sensitive assets"], nextTest: "Gasoline and distillate stocks, utilisation and export demand.", sourceName: "U.S. Energy Information Administration", sourceUrl: "https://www.eia.gov/finance/markets/products/prices.php" },
  { id: "oil-shipping", sector: "Oil", subIndustry: "Shipping and chokepoints", storySlug: "oil-physical-disruption", risk: "Freight, insurance and tanker access can block supply that appears available on paper.", boon: "Sustained vessel traffic and falling war-risk costs confirm physical normalisation.", beneficiaries: ["Tanker owners", "Alternative routes"], losers: ["Importers", "Inflexible refiners"], nextTest: "Tanker count, barrels transiting, freight and war-risk insurance.", sourceName: "EIA World Oil Transit Chokepoints", sourceUrl: "https://www.eia.gov/international/analysis/special-topics/World_Oil_Transit_Chokepoints", dataGap: "Licensed vessel-flow feed required" },
  { id: "metals-precious", sector: "Metals", subIndustry: "Gold and silver", symbols: ["GLD", "SLV"], risk: "Higher real yields or a stronger dollar can unwind defensive and inflation hedges.", boon: "Geopolitical stress, inflation uncertainty and easier real rates can sustain demand.", beneficiaries: ["Gold", "Silver", "Royalty companies"], losers: ["Unhedged jewellery demand"], nextTest: "Real yields, dollar direction, ETF demand and central-bank buying.", sourceName: "Nasdaq official ETF history", sourceUrl: "https://www.nasdaq.com/market-activity/etf/gld/historical" },
  { id: "metals-industrial", sector: "Metals", subIndustry: "Copper and industrial demand", symbols: ["CPER"], risk: "Weak China demand or rising inventories can expose an optimistic growth signal.", boon: "Grid investment, electrification and constrained mine supply support demand.", beneficiaries: ["Copper miners", "Grid suppliers"], losers: ["Manufacturers without price pass-through"], nextTest: "China activity, exchange inventories, premia and miner guidance.", sourceName: "Nasdaq official ETF history", sourceUrl: "https://www.nasdaq.com/market-activity/etf/cper/historical" },
  { id: "metals-miners", sector: "Metals", subIndustry: "Miners and operating leverage", symbols: ["GDX"], risk: "Cost inflation and execution can prevent higher spot prices reaching cash flow.", boon: "Miners add operating leverage when metals rise faster than energy and labour costs.", beneficiaries: ["Low-cost miners", "Royalty companies"], losers: ["High-cost operators", "Leveraged developers"], nextTest: "Miner earnings, all-in sustaining costs and capex discipline.", sourceName: "Nasdaq official ETF history", sourceUrl: "https://www.nasdaq.com/market-activity/etf/gdx/historical" },
  { id: "fx-dollar", sector: "FX", subIndustry: "US dollar regime", symbols: ["UUP"], riskOnRise: true, risk: "A stronger dollar tightens global financial conditions and pressures external borrowers.", boon: "Dollar strength can absorb safe-haven demand and soften imported US inflation.", beneficiaries: ["US importers", "Dollar cash"], losers: ["EM borrowers", "US exporters", "Commodities"], nextTest: "G7 rate differentials, US data surprises and safe-haven flows.", sourceName: "Nasdaq official ETF history", sourceUrl: "https://www.nasdaq.com/market-activity/etf/uup/historical" },
  { id: "fx-europe", sector: "FX", subIndustry: "Euro and sterling", symbols: ["FXE", "FXB"], risk: "Growth disappointment or dovish repricing can widen the dollar advantage.", boon: "Improving activity and firmer policy expectations can rebuild carry and inflows.", beneficiaries: ["EUR", "GBP", "European importers"], losers: ["Exporters with adverse translation"], nextTest: "ECB and BoE decisions, inflation, wages and growth surprises.", sourceName: "Nasdaq official ETF history", sourceUrl: "https://www.nasdaq.com/market-activity/etf/fxe/historical" },
  { id: "fx-canada", sector: "FX", subIndustry: "Canadian dollar and oil beta", symbols: ["FXC"], risk: "Weak domestic demand or lower oil can compound dovish Bank of Canada pricing.", boon: "Firm oil and resilient labour can support CAD despite a wide US rate gap.", beneficiaries: ["CAD", "Canadian importers"], losers: ["Unhedged USD liabilities"], nextTest: "Canadian labour, CPI, Bank of Canada and WTI direction.", sourceName: "Nasdaq official ETF history", sourceUrl: "https://www.nasdaq.com/market-activity/etf/fxc/historical" },
  { id: "yen-spot", sector: "Yen", subIndustry: "USDJPY and intervention", symbols: ["JPY=X"], storySlug: "yen-carry-unwind", riskOnRise: true, risk: "A wide rate gap can re-establish carry demand after intervention.", boon: "Broad yen buying and stretched positioning can accelerate quickly.", beneficiaries: ["Japanese importers", "Yen-funded deleveraging"], losers: ["Japanese exporters", "Short-yen carry"], nextTest: "MOF flows, BoJ guidance and cross-yen breadth.", sourceName: "European Central Bank", sourceUrl: "https://data.ecb.europa.eu/data/datasets/EXR/EXR.D.JPY.EUR.SP00.A" },
  { id: "yen-carry", sector: "Yen", subIndustry: "Carry and rate-gap transmission", symbols: ["^FVX"], storySlug: "yen-carry-unwind", riskOnRise: true, risk: "Higher US yields preserve the carry advantage and weaken intervention durability.", boon: "Falling US yields or tighter BoJ policy reduce short-yen returns.", beneficiaries: ["Yen on gap compression", "Japanese domestic assets"], losers: ["Leveraged carry baskets"], nextTest: "US-Japan yield compression and AUDJPY/GBPJPY confirmation.", sourceName: "U.S. Treasury", sourceUrl: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates" },
  { id: "yen-equities", sector: "Yen", subIndustry: "Japan equities and translation", symbols: ["EWJ"], storySlug: "yen-carry-unwind", risk: "A rapid yen rally can pressure exporter translation and foreign positioning.", boon: "Domestic demand and financials can benefit from orderly normalisation.", beneficiaries: ["Banks", "Domestic demand"], losers: ["Exporters on rapid yen strength"], nextTest: "Nikkei breadth, exporter guidance and foreign securities flows.", sourceName: "Nasdaq official ETF history", sourceUrl: "https://www.nasdaq.com/market-activity/etf/ewj/historical" },
  { id: "wine-fine", sector: "Wine", subIndustry: "Fine-wine indices and auctions", risk: "Merchant inventory, weak clearance and falling regional indices can signal collector stress.", boon: "Improving bid-to-offer ratios and broader participation confirm demand recovery.", beneficiaries: ["Scarce vintages", "Low-inventory merchants"], losers: ["Leveraged inventory", "Weak vintages"], nextTest: "Liv-ex 100/1000, auction clearance, bid-offer ratio and merchant inventory.", sourceName: "Liv-ex indices", sourceUrl: "https://www.liv-ex.com/news-insights/indices/", dataGap: "Licensed Liv-ex feed required" },
  { id: "wine-primary", sector: "Wine", subIndustry: "En primeur and release pricing", risk: "Release prices above secondary comparables can strand merchant inventory.", boon: "Disciplined pricing and lower volumes can restore primary-market value.", beneficiaries: ["Value releases", "Disciplined chateaux"], losers: ["Overpriced allocations", "High-carry inventory"], nextTest: "Release price versus back vintages and first-week demand.", sourceName: "Liv-ex market intelligence", sourceUrl: "https://www.liv-ex.com/news-insights/", dataGap: "Editorial review required" },
  { id: "wine-demand", sector: "Wine", subIndustry: "Luxury demand and China exposure", risk: "Weak China luxury demand and a stronger dollar can reduce collector participation.", boon: "Improving luxury sell-through and Asian auctions can broaden recovery.", beneficiaries: ["Auction houses", "Bordeaux", "Burgundy"], losers: ["High-inventory merchants"], nextTest: "China luxury sales, auction participation and regional Liv-ex breadth.", sourceName: "Liv-ex market intelligence", sourceUrl: "https://www.liv-ex.com/news-insights/", dataGap: "Direct source required" },
];

function averageChange(series: Array<MarketSeries | undefined>) {
  const values = series.flatMap((item) => typeof item?.change21d === "number" ? [item.change21d] : []);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function observedAt(series: Array<MarketSeries | undefined>, fallback: string) {
  const timestamp = series.flatMap((item) => item?.points.at(-1)?.time ? [item.points.at(-1)!.time] : [])[0];
  return timestamp ? new Date(timestamp * 1000).toISOString() : fallback;
}

function freshness(value: string | null) {
  if (!value) return "Source pending";
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
  if (days <= 1) return "Current";
  if (days <= 4) return `${days}d old`;
  return `Stale ${days}d`;
}

function generatedState(market: MarketData, records: MarketStateRecord[]) {
  const bySymbol = new Map(market.series.map((item) => [item.symbol, item]));
  const persisted = new Map(records.map((item) => [item.module_key, item]));
  return stateDefinitions.map((definition) => {
    const matching = (definition.symbols || []).map((symbol) => bySymbol.get(symbol));
    const change = averageChange(matching);
    const saved = persisted.get(definition.id);
    const score = definition.dataGap ? 20 : change === null ? 30 : Math.min(100, Math.round(Math.abs(change) * 8 + 38));
    let direction: Direction = definition.dataGap ? "Data gap" : change === null || Math.abs(change) < 2 ? "Mixed" : change > 0 ? "Boon" : "Risk";
    if (definition.riskOnRise && change !== null && Math.abs(change) >= 2) direction = change > 0 ? "Risk" : "Boon";
    const date = definition.dataGap ? null : observedAt(matching, market.updatedAt);
    return {
      id: definition.id,
      sector: definition.sector,
      subIndustry: definition.subIndustry,
      symbols: definition.symbols || [],
      status: saved?.status || definition.dataGap || (change === null ? "Unverified" : change >= 2 ? "Strengthening" : change <= -2 ? "Weakening" : "Range-bound"),
      score: saved?.magnitude ?? score,
      direction: saved?.direction || direction,
      change21d: change,
      move: change === null ? (definition.dataGap || "Awaiting data") : `${change >= 0 ? "+" : ""}${change.toFixed(1)}% / 21D`,
      risk: saved?.risk || definition.risk,
      boon: saved?.boon || definition.boon,
      beneficiaries: saved?.beneficiaries?.length ? saved.beneficiaries : definition.beneficiaries,
      losers: saved?.losers?.length ? saved.losers : definition.losers,
      evidence: saved?.evidence_summary || (matching.filter(Boolean).length ? `${matching.filter(Boolean).map((item) => item!.symbol).join(" + ")} official market histories.` : definition.dataGap || "Source connection pending."),
      sourceName: saved?.source_name || matching.find(Boolean)?.sourceName || definition.sourceName,
      sourceUrl: saved?.source_url || matching.find(Boolean)?.sourceUrl || definition.sourceUrl,
      observedAt: saved?.observed_at || date,
      freshness: saved?.freshness_status || (definition.dataGap ? definition.dataGap : freshness(date)),
      nextTest: saved?.next_test || definition.nextTest,
      storySlug: definition.storySlug || null,
      missionXp: definition.dataGap ? 10 : 15,
    };
  });
}

export async function GET() {
  const [data, market, calendar] = await Promise.all([getDeskData(), getMarketData(), getEconomicCalendar()]);
  const accuracy = runAccuracyCheck(market);
  const marketState = generatedState(market, data.marketStateRecords);
  const tickers = [...new Set([...data.calls.map((item) => item.ticker), ...data.guidance.flatMap((item) => item.ticker ? [item.ticker] : [])])].slice(0, 16);
  const bySymbol = new Map(market.series.map((item) => [item.symbol, item]));
  const earnings = tickers.map((ticker) => {
    const call = data.calls.find((item) => item.ticker === ticker);
    const guidance = data.guidance.find((item) => item.ticker === ticker);
    const story = data.stories.find((item) => item.assets?.includes(ticker));
    const price = bySymbol.get(ticker);
    return {
      id: call?.id || guidance?.id || ticker,
      ticker,
      companyName: call?.company_name || guidance?.entity || ticker,
      fiscalPeriod: call?.fiscal_period || guidance?.period || "Current period",
      callDate: call?.call_date || guidance?.published_at || null,
      transcriptStatus: call?.transcript_status || "guidance_only",
      summary: call?.summary || guidance?.current_view || "Official record awaiting desk summary.",
      guidance: call?.guidance || guidance?.current_view || null,
      capex: call?.capex || null,
      demand: call?.demand || null,
      whatChanged: call?.prior_quarter_change || guidance?.wording_change || null,
      risk: story?.strongest_contradiction || call?.relevance_reason || "The result must be reconciled with price, margins and cash conversion.",
      boon: story?.strongest_support || guidance?.market_interpretation || call?.guidance || "Improving guidance can strengthen the linked story.",
      nextTest: story?.next_catalyst || call?.prior_quarter_change || guidance?.metric || "Next filing and earnings call.",
      storySlug: story?.slug || null,
      sourceUrl: guidance?.source_url || null,
      price: price?.last || null,
      change21d: price?.change21d || null,
      missionXp: call?.transcript_status === "official" ? 25 : 15,
    };
  });
  const stories = data.stories.slice(0, 20).map((story) => ({
    id: story.id,
    slug: story.slug,
    title: story.title,
    marketQuestion: story.market_question,
    confidence: story.confidence,
    status: story.status,
    assets: story.assets,
    nextCatalyst: story.next_catalyst,
  }));
  const recentCutoff = new Date();
  recentCutoff.setUTCDate(recentCutoff.getUTCDate() - 2);
  const cutoffDate = recentCutoff.toISOString().slice(0, 10);
  const feedCalendar = calendar.filter((event) => event.date >= cutoffDate).slice(0, 60);

  return NextResponse.json({
    version: 1,
    source: "alchemy-live-market-desk",
    generatedAt: new Date().toISOString(),
    marketUpdatedAt: market.updatedAt,
    accuracy,
    marketState,
    calendar: feedCalendar.map((event) => ({ ...event, missionXp: event.category === "Central bank" ? 25 : 20 })),
    earnings,
    stories,
  }, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
    },
  });
}
