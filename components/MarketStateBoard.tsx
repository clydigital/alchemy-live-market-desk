"use client";

import { useMemo, useState } from "react";
import type { MarketStateRecord, Story, Update } from "@/lib/data";
import type { CrackSeries, MarketData, MarketSeries } from "@/lib/market";

type Sector = "AI" | "Oil" | "Metals" | "FX" | "Yen" | "Wine";
type Filter = "All" | Sector;

type StateModule = {
  id: string;
  sector: Sector;
  subIndustry: string;
  status: string;
  score: number;
  direction: "Boon" | "Risk" | "Mixed" | "Data gap";
  move: string;
  risk: string;
  boon: string;
  beneficiaries: string[];
  losers: string[];
  evidence: string;
  sourceName: string;
  sourceUrl: string;
  observedAt: string | null;
  freshness: string;
  nextTest: string;
  storySlug: string | null;
};

function pct(value: number | null | undefined) {
  if (typeof value !== "number") return "Awaiting data";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}% / 21D`;
}

function observationDate(series?: MarketSeries) {
  const timestamp = series?.points.at(-1)?.time;
  return timestamp ? new Date(timestamp * 1000).toISOString() : null;
}

function crackDate(series?: CrackSeries) {
  const timestamp = series?.points.at(-1)?.time;
  return timestamp ? new Date(timestamp * 1000).toISOString() : null;
}

function freshness(value: string | null) {
  if (!value) return "Source pending";
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
  if (days <= 1) return "Current";
  if (days <= 4) return `${days}d old`;
  return `Stale ${days}d`;
}

function moveScore(change: number | null | undefined) {
  if (typeof change !== "number") return 0;
  return Math.min(100, Math.round(Math.abs(change) * 8 + 34));
}

function averageMove(series: Array<MarketSeries | undefined>) {
  const values = series.flatMap((item) => typeof item?.change21d === "number" ? [item.change21d] : []);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function statusFromMove(change: number | null, positive = "Strengthening", negative = "Weakening") {
  if (change === null) return "Unverified";
  if (change >= 2) return positive;
  if (change <= -2) return negative;
  return "Range-bound";
}

function storyFor(stories: Story[], slug: string) {
  return stories.find((story) => story.slug === slug);
}

function buildModules(market: MarketData, stories: Story[], updates: Update[]): StateModule[] {
  const bySymbol = new Map(market.series.map((series) => [series.symbol, series]));
  const series = (symbol: string) => bySymbol.get(symbol);
  const latestUpdate = (storyId?: string) => updates
    .filter((update) => storyId && update.story_id === storyId)
    .sort((a, b) => new Date(b.observed_at || b.created_at).getTime() - new Date(a.observed_at || a.created_at).getTime())[0];
  const aiStory = storyFor(stories, "ai-capex-cash-conversion");
  const oilStory = storyFor(stories, "oil-physical-disruption");
  const yenStory = storyFor(stories, "yen-carry-unwind");
  const semis = series("SOXX");
  const hyperscalers = [series("MSFT"), series("AMZN"), series("GOOGL"), series("META")];
  const hyperMove = averageMove(hyperscalers);
  const aiBreadth = market.breadth.find((item) => item.id === "ai-basket");
  const wti = series("CL=F");
  const brent = series("BZ=F");
  const crack = market.cracks.find((item) => item.id === "321");
  const gold = series("GLD");
  const silver = series("SLV");
  const copper = series("CPER");
  const miners = series("GDX");
  const dollar = series("UUP");
  const euro = series("FXE");
  const sterling = series("FXB");
  const cad = series("FXC");
  const usdjpy = series("JPY=X");
  const japan = series("EWJ");
  const fiveYear = series("^FVX");
  const oilMove = averageMove([wti, brent]);
  const preciousMove = averageMove([gold, silver]);
  const europeFxMove = averageMove([euro, sterling]);
  const latestAi = latestUpdate(aiStory?.id);
  const latestOil = latestUpdate(oilStory?.id);
  const latestYen = latestUpdate(yenStory?.id);

  return [
    {
      id: "ai-accelerators", sector: "AI", subIndustry: "Accelerators and semiconductors",
      status: statusFromMove(semis?.change21d ?? null), score: moveScore(semis?.change21d), direction: (semis?.change21d || 0) >= 0 ? "Boon" : "Risk", move: pct(semis?.change21d),
      risk: `A ${pct(semis?.change21d)} move can expose crowded positioning if earnings revisions do not follow.`,
      boon: "Broad accelerator demand and improving guidance would validate the hardware leg of AI spending.",
      beneficiaries: ["NVDA", "AMD", "AVGO", "MU"], losers: ["AI spenders with delayed capacity"],
      evidence: `${semis?.label || "SOXX"} plus the AI-infrastructure breadth basket.`, sourceName: semis?.sourceName || "Nasdaq official history", sourceUrl: semis?.sourceUrl || "https://www.nasdaq.com/market-activity/etf/soxx/historical",
      observedAt: observationDate(semis), freshness: freshness(observationDate(semis)), nextTest: "Semiconductor guidance, backlog and gross-margin revisions.", storySlug: aiStory?.slug || "ai-capex-cash-conversion",
    },
    {
      id: "ai-hyperscalers", sector: "AI", subIndustry: "Hyperscalers and data centres",
      status: statusFromMove(hyperMove), score: moveScore(hyperMove), direction: (hyperMove || 0) >= 0 ? "Boon" : "Mixed", move: pct(hyperMove),
      risk: aiStory?.strongest_contradiction || "Capex, depreciation and power costs can rise faster than cash conversion.",
      boon: aiStory?.strongest_support || "Cloud growth, backlog and constrained capacity can make spending economically visible.",
      beneficiaries: ["MSFT", "AMZN", "GOOGL", "META"], losers: ["Low-utilisation capacity", "Cash-flow laggards"],
      evidence: latestAi?.headline || "Equal-weight movement across Microsoft, Amazon, Alphabet and Meta.", sourceName: "Nasdaq official company histories", sourceUrl: series("MSFT")?.sourceUrl || "https://www.nasdaq.com/market-activity/stocks/msft/historical",
      observedAt: observationDate(hyperscalers.find(Boolean)), freshness: freshness(observationDate(hyperscalers.find(Boolean))), nextTest: aiStory?.next_catalyst || "Cloud growth, backlog, capex and free-cash-flow guidance.", storySlug: aiStory?.slug || "ai-capex-cash-conversion",
    },
    {
      id: "ai-stack", sector: "AI", subIndustry: "Power, memory and networking",
      status: aiBreadth ? `${aiBreadth.current.above50}% above 50D` : "Unverified", score: aiBreadth ? Math.abs(aiBreadth.current.above50 - 50) + 45 : 0, direction: aiBreadth && aiBreadth.current.above50 >= 55 ? "Boon" : "Mixed", move: aiBreadth ? `${aiBreadth.current.above50}% breadth` : "Awaiting data",
      risk: "Power, cooling, memory or networking constraints can delay revenue recognition for the spenders.", boon: "Bottlenecks can support supplier pricing, backlog and margin durability.",
      beneficiaries: ["MU", "ANET", "VRT", "CEG", "GEV"], losers: ["Capacity-constrained hyperscalers"],
      evidence: aiBreadth ? `${aiBreadth.sampleSize}/${aiBreadth.targetSize} eligible Nasdaq histories.` : "AI basket coverage is unavailable.", sourceName: aiBreadth?.sourceName || "Nasdaq official histories", sourceUrl: "https://www.nasdaq.com/market-activity",
      observedAt: market.updatedAt, freshness: freshness(market.updatedAt), nextTest: "Breadth, supplier lead times and data-centre commissioning dates.", storySlug: aiStory?.slug || "ai-capex-cash-conversion",
    },
    {
      id: "oil-crude", sector: "Oil", subIndustry: "Crude supply and benchmarks",
      status: statusFromMove(oilMove, "Tightening", "Easing"), score: moveScore(oilMove), direction: Math.abs(oilMove || 0) >= 5 ? "Risk" : "Mixed", move: pct(oilMove),
      risk: oilStory?.strongest_support || "Shipping constraints can keep effective supply tight even after diplomatic headlines improve.", boon: oilStory?.strongest_contradiction || "De-escalation and OPEC+ additions can remove the immediate risk premium.",
      beneficiaries: ["Upstream producers", "Energy exporters"], losers: ["Airlines", "Energy-intensive industry", "Consumers"],
      evidence: latestOil?.headline || "EIA WTI and Brent daily spot series.", sourceName: wti?.sourceName || "U.S. Energy Information Administration", sourceUrl: wti?.sourceUrl || "https://www.eia.gov/petroleum/",
      observedAt: observationDate(wti), freshness: freshness(observationDate(wti)), nextTest: oilStory?.next_catalyst || "Inventories, exports, OPEC compliance and physical flows.", storySlug: oilStory?.slug || "oil-physical-disruption",
    },
    {
      id: "oil-refining", sector: "Oil", subIndustry: "Refining and product cracks",
      status: statusFromMove(crack?.change21d ?? null, "Tightening", "Normalising"), score: moveScore(crack?.change21d), direction: (crack?.change21d || 0) >= 2 ? "Risk" : "Boon", move: pct(crack?.change21d),
      risk: "Rising cracks indicate product scarcity and a stronger inflation transmission than crude alone implies.", boon: "Falling cracks would show refinery and product supply normalising.",
      beneficiaries: ["Refiners", "Product exporters"], losers: ["Transport", "Households", "Rate-sensitive assets"],
      evidence: crack?.formula || "EIA gasoline, heating-oil and WTI spot-price proxy.", sourceName: crack?.sourceName || "U.S. Energy Information Administration", sourceUrl: crack?.sourceUrl || "https://www.eia.gov/finance/markets/products/prices.php",
      observedAt: crackDate(crack), freshness: freshness(crackDate(crack)), nextTest: "Gasoline and distillate stocks, utilisation and export demand.", storySlug: oilStory?.slug || "oil-physical-disruption",
    },
    {
      id: "oil-shipping", sector: "Oil", subIndustry: "Shipping and chokepoints",
      status: latestOil ? "Research active" : "Source gap", score: latestOil ? 70 : 20, direction: latestOil ? "Risk" : "Data gap", move: "Physical feed required",
      risk: "Freight, insurance and tanker access can block supply that appears available on paper.", boon: "Sustained vessel traffic and falling war-risk costs would confirm physical normalisation.",
      beneficiaries: ["Tanker owners", "Alternative routes"], losers: ["Importers", "Refiners without feedstock flexibility"],
      evidence: latestOil?.detail || "No licensed vessel-flow series is connected yet.", sourceName: "EIA World Oil Transit Chokepoints", sourceUrl: "https://www.eia.gov/international/analysis/special-topics/World_Oil_Transit_Chokepoints",
      observedAt: latestOil?.observed_at || null, freshness: latestOil ? freshness(latestOil.observed_at || latestOil.created_at) : "Licensed feed required", nextTest: "Tanker count, barrels transiting, freight and war-risk insurance.", storySlug: oilStory?.slug || "oil-physical-disruption",
    },
    {
      id: "metals-precious", sector: "Metals", subIndustry: "Gold and silver",
      status: statusFromMove(preciousMove, "Bid", "Offered"), score: moveScore(preciousMove), direction: (preciousMove || 0) >= 0 ? "Boon" : "Mixed", move: pct(preciousMove),
      risk: "Higher real yields or a stronger dollar can unwind defensive and inflation hedges.", boon: "Geopolitical stress, inflation uncertainty and easier real rates can sustain demand.",
      beneficiaries: ["Gold", "Silver", "Royalty companies"], losers: ["Unhedged jewellery demand", "Short-duration momentum"],
      evidence: "Nasdaq official GLD and SLV ETF histories as liquid market proxies.", sourceName: gold?.sourceName || "Nasdaq official ETF history", sourceUrl: gold?.sourceUrl || "https://www.nasdaq.com/market-activity/etf/gld/historical",
      observedAt: observationDate(gold), freshness: freshness(observationDate(gold)), nextTest: "Real yields, dollar direction, ETF demand and central-bank buying.", storySlug: null,
    },
    {
      id: "metals-industrial", sector: "Metals", subIndustry: "Copper and industrial demand",
      status: statusFromMove(copper?.change21d ?? null), score: moveScore(copper?.change21d), direction: (copper?.change21d || 0) >= 0 ? "Boon" : "Risk", move: pct(copper?.change21d),
      risk: "Weak China demand, inventories or construction activity can expose an optimistic growth signal.", boon: "Grid investment, electrification and constrained mine supply support the structural case.",
      beneficiaries: ["Copper miners", "Grid suppliers"], losers: ["Manufacturers with no price pass-through"],
      evidence: "Nasdaq official CPER ETF history as a liquid copper proxy.", sourceName: copper?.sourceName || "Nasdaq official ETF history", sourceUrl: copper?.sourceUrl || "https://www.nasdaq.com/market-activity/etf/cper/historical",
      observedAt: observationDate(copper), freshness: freshness(observationDate(copper)), nextTest: "China activity, exchange inventories, premia and miner guidance.", storySlug: null,
    },
    {
      id: "metals-miners", sector: "Metals", subIndustry: "Miners and operating leverage",
      status: statusFromMove(miners?.change21d ?? null), score: moveScore(miners?.change21d), direction: (miners?.change21d || 0) >= 0 ? "Boon" : "Risk", move: pct(miners?.change21d),
      risk: "Cost inflation and execution can prevent miners from translating higher spot prices into cash flow.", boon: "Miners can add operating leverage when metals rise faster than energy and labour costs.",
      beneficiaries: ["Low-cost miners", "Royalty companies"], losers: ["High-cost operators", "Overleveraged developers"],
      evidence: "Nasdaq official GDX ETF history as a gold-miner proxy.", sourceName: miners?.sourceName || "Nasdaq official ETF history", sourceUrl: miners?.sourceUrl || "https://www.nasdaq.com/market-activity/etf/gdx/historical",
      observedAt: observationDate(miners), freshness: freshness(observationDate(miners)), nextTest: "Miner earnings, all-in sustaining costs and capex discipline.", storySlug: null,
    },
    {
      id: "fx-dollar", sector: "FX", subIndustry: "US dollar regime",
      status: statusFromMove(dollar?.change21d ?? null, "Strengthening", "Weakening"), score: moveScore(dollar?.change21d), direction: (dollar?.change21d || 0) >= 2 ? "Risk" : "Mixed", move: pct(dollar?.change21d),
      risk: "A stronger dollar tightens global financial conditions and pressures commodities and external borrowers.", boon: "Dollar strength can absorb safe-haven demand and soften imported US inflation.",
      beneficiaries: ["US importers", "Dollar cash"], losers: ["EM borrowers", "US exporters", "Commodities"],
      evidence: "Nasdaq official UUP ETF history as a liquid dollar proxy.", sourceName: dollar?.sourceName || "Nasdaq official ETF history", sourceUrl: dollar?.sourceUrl || "https://www.nasdaq.com/market-activity/etf/uup/historical",
      observedAt: observationDate(dollar), freshness: freshness(observationDate(dollar)), nextTest: "G7 rate differentials, US data surprises and safe-haven flows.", storySlug: null,
    },
    {
      id: "fx-europe", sector: "FX", subIndustry: "Euro and sterling",
      status: statusFromMove(europeFxMove), score: moveScore(europeFxMove), direction: (europeFxMove || 0) >= 0 ? "Boon" : "Risk", move: pct(europeFxMove),
      risk: "Growth disappointment or dovish policy repricing can widen the dollar advantage.", boon: "Improving activity and firmer policy expectations can rebuild carry and capital inflows.",
      beneficiaries: ["EUR", "GBP", "European importers"], losers: ["Exporters with adverse translation"],
      evidence: "Nasdaq official FXE and FXB ETF histories.", sourceName: euro?.sourceName || "Nasdaq official ETF history", sourceUrl: euro?.sourceUrl || "https://www.nasdaq.com/market-activity/etf/fxe/historical",
      observedAt: observationDate(euro), freshness: freshness(observationDate(euro)), nextTest: "ECB and BoE decisions, inflation, wages and growth surprises.", storySlug: null,
    },
    {
      id: "fx-canada", sector: "FX", subIndustry: "Canadian dollar and oil beta",
      status: statusFromMove(cad?.change21d ?? null), score: moveScore(cad?.change21d), direction: (cad?.change21d || 0) >= 0 ? "Boon" : "Risk", move: pct(cad?.change21d),
      risk: "Weak domestic demand or lower oil can compound dovish Bank of Canada pricing.", boon: "Firm oil and resilient labour data can support CAD despite a wide US rate gap.",
      beneficiaries: ["CAD", "Canadian importers"], losers: ["Unhedged USD liabilities"],
      evidence: "Nasdaq official FXC ETF history as a liquid CAD proxy.", sourceName: cad?.sourceName || "Nasdaq official ETF history", sourceUrl: cad?.sourceUrl || "https://www.nasdaq.com/market-activity/etf/fxc/historical",
      observedAt: observationDate(cad), freshness: freshness(observationDate(cad)), nextTest: "Canadian labour, CPI, Bank of Canada and WTI direction.", storySlug: null,
    },
    {
      id: "yen-spot", sector: "Yen", subIndustry: "USDJPY and intervention",
      status: usdjpy ? ((usdjpy.change21d || 0) < 0 ? "Yen strengthening" : "Yen weakening") : "Unverified", score: moveScore(usdjpy?.change21d), direction: (usdjpy?.change21d || 0) > 0 ? "Risk" : "Boon", move: pct(usdjpy?.change21d),
      risk: yenStory?.strongest_contradiction || "A wide rate gap can re-establish carry demand after intervention.", boon: yenStory?.strongest_support || "Broad yen buying and stretched positioning can accelerate quickly.",
      beneficiaries: ["Japanese importers", "Yen-funded deleveraging"], losers: ["Japanese exporters", "Short-yen carry"],
      evidence: latestYen?.headline || "ECB daily USDJPY cross plus the intervention research ledger.", sourceName: usdjpy?.sourceName || "European Central Bank", sourceUrl: usdjpy?.sourceUrl || "https://data.ecb.europa.eu/data/datasets/EXR/EXR.D.JPY.EUR.SP00.A",
      observedAt: observationDate(usdjpy), freshness: freshness(observationDate(usdjpy)), nextTest: yenStory?.next_catalyst || "MOF flows, BoJ guidance and cross-yen breadth.", storySlug: yenStory?.slug || "yen-carry-unwind",
    },
    {
      id: "yen-carry", sector: "Yen", subIndustry: "Carry and rate-gap transmission",
      status: fiveYear ? `${fiveYear.last?.toFixed(2)}% US 5Y` : "Yield gap unavailable", score: moveScore(fiveYear?.change21d), direction: (fiveYear?.change21d || 0) > 0 ? "Risk" : "Boon", move: pct(fiveYear?.change21d),
      risk: "Higher US yields preserve the carry advantage and can weaken intervention durability.", boon: "Falling US yields or tighter BoJ policy reduce the reward for rebuilding short-yen positions.",
      beneficiaries: ["Yen on gap compression", "Japanese domestic assets"], losers: ["Leveraged carry baskets"],
      evidence: "U.S. Treasury five-year history compared with the ECB USDJPY cross.", sourceName: fiveYear?.sourceName || "U.S. Treasury", sourceUrl: fiveYear?.sourceUrl || "https://home.treasury.gov/resource-center/data-chart-center/interest-rates",
      observedAt: observationDate(fiveYear), freshness: freshness(observationDate(fiveYear)), nextTest: "US-Japan yield compression and AUDJPY/GBPJPY confirmation.", storySlug: yenStory?.slug || "yen-carry-unwind",
    },
    {
      id: "yen-equities", sector: "Yen", subIndustry: "Japan equities and translation",
      status: statusFromMove(japan?.change21d ?? null), score: moveScore(japan?.change21d), direction: (japan?.change21d || 0) >= 0 ? "Boon" : "Mixed", move: pct(japan?.change21d),
      risk: "A rapid yen rally can pressure exporter earnings translation and unwind foreign positioning.", boon: "Domestic demand and financials can benefit when normalisation is orderly rather than disorderly.",
      beneficiaries: ["Banks", "Domestic demand"], losers: ["Exporters on rapid yen strength"],
      evidence: "Nasdaq official EWJ ETF history as a liquid Japan-equity proxy.", sourceName: japan?.sourceName || "Nasdaq official ETF history", sourceUrl: japan?.sourceUrl || "https://www.nasdaq.com/market-activity/etf/ewj/historical",
      observedAt: observationDate(japan), freshness: freshness(observationDate(japan)), nextTest: "Nikkei breadth, exporter guidance and foreign securities flows.", storySlug: yenStory?.slug || "yen-carry-unwind",
    },
    {
      id: "wine-fine", sector: "Wine", subIndustry: "Fine-wine indices and auctions",
      status: "Licensed feed pending", score: 0, direction: "Data gap", move: "No live series",
      risk: "Merchant inventory, weak auction clearance and falling regional indices can signal collector stress.", boon: "Improving bid-to-offer ratios and broader regional participation would confirm demand recovery.",
      beneficiaries: ["Scarce vintages", "Low-inventory merchants"], losers: ["Leveraged inventory", "Weak vintages"],
      evidence: "Liv-ex is the required source of truth; no substitute price series is shown.", sourceName: "Liv-ex indices", sourceUrl: "https://www.liv-ex.com/news-insights/indices/",
      observedAt: null, freshness: "Licensed feed required", nextTest: "Liv-ex 100/1000, auction clearance, bid-offer ratio and merchant inventory.", storySlug: null,
    },
    {
      id: "wine-primary", sector: "Wine", subIndustry: "En primeur and release pricing",
      status: "Editorial monitor", score: 25, direction: "Mixed", move: "Release-led",
      risk: "Release prices above secondary-market comparables can strand merchant and collector inventory.", boon: "Disciplined pricing and lower volumes can restore primary-market value.",
      beneficiaries: ["Value releases", "Disciplined chateaux"], losers: ["Overpriced allocations", "High-carry inventory"],
      evidence: "Release calendars and merchant pricing require a reviewed source workflow.", sourceName: "Liv-ex market intelligence", sourceUrl: "https://www.liv-ex.com/news-insights/",
      observedAt: null, freshness: "Editorial update required", nextTest: "Release price versus back vintages and first-week demand.", storySlug: null,
    },
    {
      id: "wine-demand", sector: "Wine", subIndustry: "Luxury demand and China exposure",
      status: "Research monitor", score: 30, direction: "Mixed", move: "Cross-asset proxy only",
      risk: "Weak China luxury demand and a stronger dollar can reduce international collector participation.", boon: "Improving luxury sell-through and Asian auction demand can broaden the recovery.",
      beneficiaries: ["Global auction houses", "Bordeaux", "Burgundy"], losers: ["High-inventory merchants"],
      evidence: "No direct wine-demand feed is connected; the desk will not use a luxury-equity proxy as equivalent evidence.", sourceName: "Liv-ex market intelligence", sourceUrl: "https://www.liv-ex.com/news-insights/",
      observedAt: null, freshness: "Direct source required", nextTest: "China luxury sales, auction participation and regional Liv-ex breadth.", storySlug: null,
    },
  ];
}

function mergePersisted(modules: StateModule[], records: MarketStateRecord[]) {
  return modules.map((module) => {
    const record = records.find((item) => item.module_key === module.id);
    if (!record) return module;
    return {
      ...module,
      status: record.status || module.status,
      score: record.magnitude ?? module.score,
      direction: (record.direction as StateModule["direction"]) || module.direction,
      risk: record.risk || module.risk,
      boon: record.boon || module.boon,
      beneficiaries: record.beneficiaries?.length ? record.beneficiaries : module.beneficiaries,
      losers: record.losers?.length ? record.losers : module.losers,
      evidence: record.evidence_summary || module.evidence,
      sourceName: record.source_name || module.sourceName,
      sourceUrl: record.source_url || module.sourceUrl,
      observedAt: record.observed_at || module.observedAt,
      freshness: record.freshness_status || freshness(record.observed_at),
      nextTest: record.next_test || module.nextTest,
    };
  });
}

export default function MarketStateBoard({ market, stories, updates, records }: { market: MarketData; stories: Story[]; updates: Update[]; records: MarketStateRecord[] }) {
  const [filter, setFilter] = useState<Filter>("All");
  const modules = useMemo(() => mergePersisted(buildModules(market, stories, updates), records), [market, stories, updates, records]);
  const visible = filter === "All" ? modules : modules.filter((module) => module.sector === filter);
  const risks = modules.filter((module) => module.direction === "Risk").length;
  const boons = modules.filter((module) => module.direction === "Boon").length;
  const gaps = modules.filter((module) => module.direction === "Data gap").length;

  return <div className="market-state-page tab-page">
    <header className="market-state-hero">
      <div>
        <span>MARKET STATE</span>
        <h2>Risks and boons before the story.</h2>
        <p>Sub-industry evidence is kept separate from the narrative so a material change can create, strengthen or kill a story.</p>
      </div>
      <div className="state-summary" aria-label="Market state summary">
        <span><b>{modules.length}</b>modules</span>
        <span><b className="positive">{boons}</b>boons</span>
        <span><b className="negative">{risks}</b>risks</span>
        <span><b className="mixed">{gaps}</b>data gaps</span>
      </div>
    </header>

    <div className="state-toolbar">
      <div className="state-filters" role="tablist" aria-label="Market state sectors">
        {(["All", "AI", "Oil", "Metals", "FX", "Yen", "Wine"] as Filter[]).map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}
      </div>
      <span>Prices refreshed {new Date(market.updatedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
    </div>

    <div className="state-table-head" aria-hidden="true"><span>Module</span><span>State</span><span>Risk</span><span>Boon</span><span>Evidence / next test</span></div>
    <section className="state-module-list">
      {visible.map((module) => <article className={`state-module direction-${module.direction.toLowerCase().replace(" ", "-")}`} key={module.id}>
        <div className="state-module-name"><span>{module.sector}</span><h3>{module.subIndustry}</h3><small>{module.move}</small></div>
        <div className="state-reading"><b>{module.status}</b><i><span style={{ width: `${Math.max(5, module.score)}%` }} /></i><small>{module.direction} · {module.freshness}</small></div>
        <div className="state-risk"><span>RISK</span><p>{module.risk}</p><small>{module.losers.join(" · ")}</small></div>
        <div className="state-boon"><span>BOON</span><p>{module.boon}</p><small>{module.beneficiaries.join(" · ")}</small></div>
        <div className="state-evidence"><p>{module.evidence}</p><small>NEXT TEST</small><b>{module.nextTest}</b><a href={module.sourceUrl} target="_blank" rel="noreferrer">{module.sourceName} ↗</a></div>
      </article>)}
    </section>
  </div>;
}
