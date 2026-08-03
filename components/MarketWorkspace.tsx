"use client";

import { useMemo, useState } from "react";
import type { AlchemyArticle } from "@/lib/alchemy";
import type { ChartRequest, EarningsCall, GuidanceItem, NewsThread, PublicStatement, Story, Update } from "@/lib/data";
import type { BreadthSnapshot, CrackSeries, MarketData, MarketSeries, PricePoint } from "@/lib/market";

type Props = {
  stories: Story[];
  calls: EarningsCall[];
  updates: Update[];
  charts: ChartRequest[];
  articles: AlchemyArticle[];
  guidance: GuidanceItem[];
  statements: PublicStatement[];
  newsThreads: NewsThread[];
  market: MarketData;
};

type Tab = "Overview" | "Stories" | "Articles" | "AI News" | "Oil System" | "Breadth" | "Guidance" | "Statements" | "Signals" | "Earnings" | "Charts" | "Ledger";
type ArticleFilter = "All" | "Revisit now" | "Material evolution" | "Incremental" | "Little changed";
type Range = "7D" | "30D" | "90D" | "1Y";

type DisplayStory = {
  id: string;
  slug: string;
  title: string;
  thesis: string;
  confidence: number;
  support: string;
  contradiction: string;
  marketQuestion: string;
  next: string;
  status: string;
  assets: string[];
};

type ArticleMemory = AlchemyArticle & {
  story: DisplayStory | null;
  alignment: number;
  changeScore: number;
  changeLabel: Exclude<ArticleFilter, "All">;
  changeKey: "stable" | "incremental" | "material" | "revisit";
  latestChange: string;
  changeDetail: string;
  materialUpdates: Update[];
};

const stopWords = new Set(["the", "and", "for", "with", "that", "this", "from", "into", "after", "before", "over", "under", "what", "will", "can", "could", "should", "market", "markets", "alchemy", "today", "week", "latest", "strong", "higher", "lower"]);

function tokens(value: string) {
  return [...new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !stopWords.has(word)))];
}

function articleDate(value: string | null) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function articleLevel(score: number): Pick<ArticleMemory, "changeLabel" | "changeKey"> {
  if (score >= 70) return { changeLabel: "Revisit now", changeKey: "revisit" };
  if (score >= 45) return { changeLabel: "Material evolution", changeKey: "material" };
  if (score >= 20) return { changeLabel: "Incremental", changeKey: "incremental" };
  return { changeLabel: "Little changed", changeKey: "stable" };
}

function updateWeight(update: Update) {
  const text = `${update.update_type} ${update.headline} ${update.detail || ""}`.toLowerCase();
  if (/invalid|reversal|contradiction|break|shock|intervention/.test(text)) return 30;
  if (/earnings|guidance|policy|confirmed|confirmation|evidence/.test(text)) return 21;
  if (/catalyst|data|price|technical|monitor/.test(text)) return 14;
  return 10;
}

const fallbackStories: DisplayStory[] = [
  {
    id: "earnings-market-support",
    slug: "earnings-market-support",
    title: "Can earnings keep the market alive?",
    thesis: "Strong results can support the index, but guidance, breadth and the rate backdrop decide whether the support lasts.",
    confidence: 60,
    support: "Headline earnings growth remains strong and major cloud platforms are still reporting robust demand.",
    contradiction: "The index can rise while the average stock, free cash flow and market breadth remain fragile.",
    marketQuestion: "Are earnings improving faster than the discount rate and valuation pressure?",
    next: "AMD earnings, ISM data and the US employment report.",
    status: "active",
    assets: ["SPX", "NDX", "RSP"],
  },
  {
    id: "ai-capex-cash-conversion",
    slug: "ai-capex-cash-conversion",
    title: "AI revenue versus capex",
    thesis: "Demand is real, but the market is separating visible monetisation from spending that still requires patience.",
    confidence: 57,
    support: "Cloud growth, backlog and accelerator demand continue to expand.",
    contradiction: "Capex, depreciation and cash-flow pressure are rising faster at several spenders.",
    marketQuestion: "Is AI-linked revenue scaling quickly enough to justify the buildout?",
    next: "AMD Data Center growth, gross margin and guidance.",
    status: "monitor",
    assets: ["AMD", "MSFT", "AMZN", "GOOGL"],
  },
  {
    id: "oil-physical-disruption",
    slug: "oil-physical-disruption",
    title: "Oil peace versus physical tightness",
    thesis: "Crude can price diplomatic relief before tanker access, freight and refined-product supply normalise.",
    confidence: 54,
    support: "Product cracks and shipping constraints can remain tight even as crude falls.",
    contradiction: "OPEC+ supply additions and de-escalation can remove the immediate risk premium.",
    marketQuestion: "Is the market removing geopolitical premium faster than physical conditions improve?",
    next: "Hormuz traffic, freight, inventories and product cracks.",
    status: "monitor",
    assets: ["WTI", "BRENT", "ULSD"],
  },
  {
    id: "yen-carry-unwind",
    slug: "yen-carry-unwind",
    title: "Yen carry unwind",
    thesis: "Intervention can trigger the move, but rates and cross-yen breadth decide whether it becomes durable.",
    confidence: 48,
    support: "Broad yen buying and stretched positioning can accelerate quickly.",
    contradiction: "The carry advantage remains substantial while the US-Japan rate gap stays wide.",
    marketQuestion: "Is the yen move broad enough to become a sustained carry unwind?",
    next: "USDJPY, AUDJPY and GBPJPY confirmation.",
    status: "watch",
    assets: ["USDJPY", "AUDJPY", "GBPJPY"],
  },
  {
    id: "fed-rate-repricing",
    slug: "fed-rate-repricing",
    title: "Fed guidance and hike repricing",
    thesis: "The hold matters less than whether inflation, dissents and front-end yields keep a September hike credible.",
    confidence: 58,
    support: "Three hike dissents and elevated energy inflation keep tightening risk alive.",
    contradiction: "A softer labour path or oil normalisation can quickly reduce the need to tighten.",
    marketQuestion: "Is the market interpreting the Fed more hawkishly than the data can sustain?",
    next: "Payrolls, CPI, Jackson Hole and the US 2-year yield.",
    status: "monitor",
    assets: ["US02Y", "US10Y", "US30Y", "DXY", "NASDAQ"],
  },
  {
    id: "market-breadth-health",
    slug: "market-breadth-health",
    title: "Market breadth versus index strength",
    thesis: "Index resilience is healthier when more stocks hold their 50-day and 200-day averages.",
    confidence: 55,
    support: "Improving breadth reduces dependence on a small group of megacaps.",
    contradiction: "A cap-weighted index can keep rising even while participation narrows.",
    marketQuestion: "Are more stocks confirming the index move or is leadership becoming thinner?",
    next: "Stocks above 20-day, 50-day and 200-day averages; SPX versus RSP.",
    status: "monitor",
    assets: ["SPX", "RSP", "SOXX"],
  },
  {
    id: "china-ai-pressure",
    slug: "china-ai-pressure",
    title: "China AI cost and model pressure",
    thesis: "Cheaper Chinese open-weight models can expand AI usage while pressuring Western model pricing and compute assumptions.",
    confidence: 52,
    support: "Qwen and DeepSeek continue to compete on capability, openness and inference cost.",
    contradiction: "Closed frontier models may retain a capability, distribution and enterprise-security advantage.",
    marketQuestion: "Does China broaden AI demand or compress the returns expected from Western capex?",
    next: "Qwen releases, DeepSeek pricing, export controls and hyperscaler commentary.",
    status: "watch",
    assets: ["BABA", "NVDA", "AMD", "MSFT", "GOOGL", "META"],
  },
  {
    id: "mag7-guidance-dispersion",
    slug: "mag7-guidance-dispersion",
    title: "Mag7 guidance dispersion",
    thesis: "The market is rewarding firms that link AI investment to usage, backlog and cash conversion.",
    confidence: 59,
    support: "Cloud growth and demand signals remain strong at several platforms.",
    contradiction: "Capex, component costs and depreciation can weaken margins and free cash flow.",
    marketQuestion: "Which megacaps are improving guidance faster than their capital burden rises?",
    next: "Next company filing, guidance revision and post-earnings reaction.",
    status: "monitor",
    assets: ["AAPL", "MSFT", "AMZN", "GOOGL", "META", "NVDA", "TSLA"],
  },
];

const fallbackCharts = [
  { id: "c1", instrument: "SPX vs RSP", timeframe: "Daily", question: "Is earnings support broadening beyond megacaps?", overlay: "Equal-weight comparison", status: "requested" },
  { id: "c2", instrument: "AMD · SOXX · Nasdaq", timeframe: "Daily", question: "Is AMD entering results as a leader or crowded rebound?", overlay: "Indexed performance", status: "requested" },
  { id: "c3", instrument: "Hyperscaler capex vs FCF", timeframe: "Quarterly", question: "Which AI spenders are converting investment into cash?", overlay: "Cloud growth", status: "requested" },
];

const fallbackNewsThreads: NewsThread[] = [
  { id: "ai-open-qwen", domain: "ai", category: "Open-weight models", headline: "Chinese open-weight models keep lowering the cost bar", summary: "Qwen and DeepSeek are competing on capability, inference efficiency and openness.", current_view: "Lower inference costs can broaden usage while challenging Western model pricing and compute assumptions.", source_url: "https://www.alibabagroup.com/en-US/document-2016703577908576256", source_type: "primary", published_at: "2026-07-18", importance: 92, affected_assets: ["BABA","NVDA","AMD","MSFT","GOOGL"] },
  { id: "ai-closed-frontier", domain: "ai", category: "Closed/private models", headline: "Closed frontier models retain the capability and distribution lead", summary: "OpenAI, Anthropic and Google continue to compete through premium private models and enterprise distribution.", current_view: "The key question is whether capability and security justify higher inference prices.", source_url: "https://openai.com/news/product-releases/", source_type: "primary", published_at: "2026-07-09", importance: 84, affected_assets: ["MSFT","GOOGL","AMZN"] },
  { id: "ai-china", domain: "ai", category: "China AI", headline: "China is becoming a pricing threat as well as a capability threat", summary: "Model efficiency, domestic chips and open-weight distribution can alter the expected returns from Western AI capex.", current_view: "Track whether lower-cost models expand total inference demand or mainly compress margins.", source_url: "https://api-docs.deepseek.com/news/news260424", source_type: "primary", published_at: "2026-04-24", importance: 94, affected_assets: ["BABA","NVDA","AMD","META","MSFT"] },
  { id: "ai-chips", domain: "ai", category: "Chips and accelerators", headline: "AMD is the next hardware demand test", summary: "Data Center growth, gross margin, guidance and customer forecasts will test whether accelerator demand remains broad.", current_view: "A strong report supports the hardware leg; weak guidance would expose crowded semiconductor positioning.", source_url: "https://ir.amd.com/news-events/press-releases/detail/1289/amd-to-report-fiscal-second-quarter-2026-financial-results", source_type: "primary", published_at: "2026-07-08", importance: 96, affected_assets: ["AMD","SOXX","NVDA"] },
  { id: "ai-cloud", domain: "ai", category: "Cloud and data centres", headline: "Capacity remains constrained despite record spending", summary: "Microsoft, Alphabet, Amazon and Meta continue to raise infrastructure investment while reporting strong demand.", current_view: "Visible usage, backlog and cash conversion decide who receives a valuation premium.", source_url: "https://www.microsoft.com/en-us/investor/events/fy-2026/earnings-fy-2026-q3", source_type: "primary", published_at: "2026-04-29", importance: 90, affected_assets: ["MSFT","AMZN","GOOGL","META"] },
  { id: "ai-apps", domain: "ai", category: "Applications and agents", headline: "Agent adoption must move from seats to paid workflow usage", summary: "Enterprise products are adding agents, but monetisation quality depends on recurring usage and retention.", current_view: "Track paid seats, usage intensity and whether software margins absorb inference costs.", source_url: "https://openai.com/news/product-releases/", source_type: "primary", published_at: "2026-07-09", importance: 73, affected_assets: ["MSFT","CRM","NOW","ORCL"] },
  { id: "ai-stack", domain: "ai", category: "Power, memory and networking", headline: "The bottleneck is spreading beyond GPUs", summary: "Power availability, memory, networking and cooling increasingly determine how quickly data-centre capacity comes online.", current_view: "Suppliers can outperform spenders when shortages support pricing and backlog.", source_url: "https://www.alibabagroup.com/en-US/document-1994119844504535040", source_type: "primary", published_at: "2026-05-20", importance: 82, affected_assets: ["MU","ANET","VRT","GEV","CEG"] },
  { id: "ai-policy", domain: "ai", category: "Regulation and export controls", headline: "Export rules can redirect revenue without reducing global demand", summary: "Restrictions affect who supplies China and which domestic alternatives receive investment.", current_view: "Separate lost Western revenue from substitution into Chinese chips and models.", source_url: "https://www.whitehouse.gov/presidential-actions/2026/07/securing-americas-defense-supply-chains-and-ensuring-domestic-acquisition-of-critical-materials/", source_type: "official", published_at: "2026-07-20", importance: 78, affected_assets: ["NVDA","AMD","BABA","TSM","ASML"] },
  { id: "oil-war", domain: "oil", category: "War and Hormuz", headline: "Diplomatic relief is not the same as physical normalisation", summary: "Tanker access, insurance and refinery feedstock can remain impaired after crude removes part of the war premium.", current_view: "Require sustained traffic and freight normalisation before declaring the physical squeeze over.", source_url: "https://www.eia.gov/finance/markets/products/prices.php", source_type: "official", published_at: "2026-07-31", importance: 96, affected_assets: ["CL=F","BZ=F","HO=F"] },
  { id: "oil-opec", domain: "oil", category: "OPEC+ supply", headline: "OPEC+ is returning supply gradually", summary: "The group approved another 188,000 barrels per day adjustment while retaining flexibility to pause or reverse.", current_view: "Quota additions matter less when shipping, compliance or refining constraints block delivery.", source_url: "https://www.opec.org/pr-detail/1835609-5-july-2026.html", source_type: "primary", published_at: "2026-07-05", importance: 84, affected_assets: ["CL=F","BZ=F"] },
  { id: "oil-demand", domain: "oil", category: "Demand", headline: "Demand must be separated from supply disruption", summary: "Weak macro data can pressure crude even while products remain tight.", current_view: "Watch mobility, refinery runs, imports and regional product demand rather than crude price alone.", source_url: "https://www.eia.gov/petroleum/", source_type: "official", published_at: "2026-07-30", importance: 76, affected_assets: ["CL=F","XLE"] },
  { id: "oil-inventories", domain: "oil", category: "Inventories", headline: "Product stocks can tell a different story from crude stocks", summary: "Gasoline and distillate inventories determine whether refinery tightness is reaching end users.", current_view: "A crude build is not automatically bearish when product inventories and cracks remain firm.", source_url: "https://www.eia.gov/petroleum/supply/weekly/", source_type: "official", published_at: "2026-07-29", importance: 87, affected_assets: ["CL=F","RB=F","HO=F"] },
  { id: "oil-cracks", domain: "oil", category: "Refining and cracks", headline: "Crack spreads are the live refining stress gauge", summary: "RBOB and ULSD values relative to WTI show whether product scarcity is strengthening or fading.", current_view: "Rising cracks with flat crude indicate downstream tightness; falling cracks weaken the fuel-squeeze thesis.", source_url: "https://www.eia.gov/finance/markets/products/prices.php", source_type: "official", published_at: "2026-07-31", importance: 95, affected_assets: ["RB=F","HO=F","CL=F"] },
  { id: "oil-freight", domain: "oil", category: "Freight and insurance", headline: "Freight and war-risk insurance can block effective supply", summary: "Available barrels do not help quickly when vessels, routes or insurance become constrained.", current_view: "Treat freight and tanker traffic as confirmation for any crude de-escalation move.", source_url: "https://www.eia.gov/international/analysis/special-topics/World_Oil_Transit_Chokepoints", source_type: "official", published_at: "2026-07-25", importance: 89, affected_assets: ["BZ=F","CL=F"] },
  { id: "oil-products", domain: "oil", category: "Product exports", headline: "Export demand can tighten domestic products", summary: "Strong exports can support cracks even when domestic consumption is mixed.", current_view: "Track product exports with refinery utilisation and stocks.", source_url: "https://www.eia.gov/petroleum/supply/weekly/", source_type: "official", published_at: "2026-07-29", importance: 72, affected_assets: ["RB=F","HO=F"] },
  { id: "oil-rates", domain: "oil", category: "Rates and FX", headline: "Oil remains a policy input", summary: "Persistent product inflation can lift breakevens, delay easing and support the dollar.", current_view: "The clean confirmation is oil or cracks rising with the US 2-year yield.", source_url: "https://www.federalreserve.gov/newsevents/pressreleases/monetary20260617a.htm", source_type: "official", published_at: "2026-06-17", importance: 80, affected_assets: ["CL=F","^FVX","DXY"] },
];

const fallbackGuidance: GuidanceItem[] = [
  { id:"g-amd", entity:"AMD", ticker:"AMD", category:"company", period:"Q2 2026", guidance_type:"financial", metric:"Revenue and gross margin", current_view:"Revenue approximately $11.2bn, plus or minus $300m; non-GAAP gross margin approximately 56%.", prior_view:"Q1 revenue approximately $9.8bn; gross margin approximately 55%.", wording_change:"Management said server growth should accelerate and customer forecasts for MI450 and Helios exceeded initial expectations.", market_interpretation:"AMD must convert stronger forecasts into Data Center revenue and margin expansion.", source_url:"https://ir.amd.com/news-events/press-releases/detail/1284/amd-reports-first-quarter-2026-financial-results", source_classification:"official_company", published_at:"2026-05-05", assets:["AMD","SOXX","NVDA"] },
  { id:"g-msft", entity:"Microsoft", ticker:"MSFT", category:"company", period:"FY26 Q4", guidance_type:"capex", metric:"Revenue, Azure and capex", current_view:"Q4 revenue guided to $86.7bn-$87.8bn; capex expected above $40bn with capacity constrained through 2026.", prior_view:"Q3 capex was $31.9bn.", wording_change:"Management linked higher spending to demand signals, usage and expected Azure acceleration.", market_interpretation:"The market needs Azure growth and cash generation to stay ahead of depreciation and component costs.", source_url:"https://www.microsoft.com/en-us/investor/events/fy-2026/earnings-fy-2026-q3", source_classification:"official_company", published_at:"2026-04-29", assets:["MSFT","NDX"] },
  { id:"g-meta", entity:"Meta", ticker:"META", category:"company", period:"2026", guidance_type:"capex", metric:"Capex and expenses", current_view:"2026 capex raised to $125bn-$145bn; expenses expected at $162bn-$169bn.", prior_view:"Capex was previously $115bn-$135bn.", wording_change:"Higher component pricing and future data-centre capacity drove the increase.", market_interpretation:"Advertising growth must continue to fund a sharply larger infrastructure programme.", source_url:"https://investor.atmeta.com/investor-news/press-release-details/2026/Meta-Reports-First-Quarter-2026-Results/", source_classification:"official_company", published_at:"2026-04-29", assets:["META","NDX"] },
  { id:"g-googl", entity:"Alphabet", ticker:"GOOGL", category:"company", period:"2026", guidance_type:"capex", metric:"Capex and Cloud demand", current_view:"Full-year capex expected at $175bn-$185bn with investment ramping through the year.", prior_view:"2025 capex was $91.4bn.", wording_change:"Management said AI infrastructure was already translating into growth while supply remained tight.", market_interpretation:"Cloud backlog and cash conversion must justify the step-up in depreciation and infrastructure cost.", source_url:"https://abc.xyz/investor/events/event-details/2026/2025-Q4-Earnings-Call-2026-Dr_C033hS6/default.aspx", source_classification:"official_company", published_at:"2026-02-04", assets:["GOOGL","NDX"] },
  { id:"g-tsla", entity:"Tesla", ticker:"TSLA", category:"company", period:"Q2 2026", guidance_type:"strategy", metric:"AI, autonomy and capital intensity", current_view:"Tesla reported Q2 results and continues to frame autonomy, robotics and AI as central to the outlook.", prior_view:"Q1 guidance already prioritised autonomy and physical AI.", wording_change:"Investors are increasingly testing execution and cash burn rather than accepting long-dated targets alone.", market_interpretation:"The key test is whether AI investment creates measurable subscriptions, deployments and margin improvement.", source_url:"https://ir.tesla.com/press-release/tesla-releases-second-quarter-2026-financial-results", source_classification:"official_company", published_at:"2026-07-22", assets:["TSLA"] },
  { id:"g-fed", entity:"Federal Reserve", ticker:null, category:"fed", period:"July 2026", guidance_type:"policy", metric:"Policy rate and reaction function", current_view:"The Fed held at 3.50%-3.75%; three members preferred a 25bp hike.", prior_view:"June was a unanimous hold.", wording_change:"The dissents strengthened the hawkish tail even without an actual rate increase.", market_interpretation:"Payrolls, inflation and energy prices decide whether September hike risk survives.", source_url:"https://www.federalreserve.gov/newsevents/pressreleases/monetary20260729a.htm", source_classification:"official_central_bank", published_at:"2026-07-29", assets:["^FVX","^TNX","^TYX","DXY","NDX"] },
];

const fallbackStatements: PublicStatement[] = [
  { id:"s-trump-rates", speaker:"Donald Trump", channel:"White House / CNBC interview", statement_date:"2026-04-21", quote_excerpt:"I’ve been in favor of interest rate rises to stop inflation.", topic:"Federal Reserve and inflation", market_interpretation:"The statement supports a politically acceptable hawkish Fed stance when inflation remains high.", affected_assets:["^FVX","DXY","NDX"], source_url:"https://www.whitehouse.gov/releases/2026/04/president-trump-addresses-key-issues-facing-the-nation-in-exclusive-cnbc-interview/", verification_status:"official", follow_up:"Compare later criticism or support of Fed decisions with the official policy path." },
  { id:"s-trump-iran", speaker:"Donald Trump", channel:"White House / CNBC interview", statement_date:"2026-04-21", quote_excerpt:"We’re going to end up with a great deal. I think they have no choice.", topic:"Iran negotiations", market_interpretation:"Negotiation optimism can remove crude risk premium before physical shipping normalises.", affected_assets:["CL=F","BZ=F","DXY"], source_url:"https://www.whitehouse.gov/releases/2026/04/president-trump-addresses-key-issues-facing-the-nation-in-exclusive-cnbc-interview/", verification_status:"official", follow_up:"Require confirmation from Hormuz traffic, insurance and official Iranian responses." },
  { id:"s-trump-ai-power", speaker:"Donald Trump", channel:"White House release", statement_date:"2026-07-23", quote_excerpt:"AI dominance must not force ordinary ratepayers to absorb data-centre power costs.", topic:"AI power and infrastructure", market_interpretation:"Power-price intervention can alter data-centre economics, utility capex and location decisions.", affected_assets:["MSFT","AMZN","GOOGL","META","CEG","GEV"], source_url:"https://www.whitehouse.gov/releases/2026/07/president-trumps-ratepayer-protection-pledge-secures-american-ai-dominance-protects-consumers/", verification_status:"official_paraphrase", follow_up:"Track utility agreements, power procurement and data-centre project delays." },
  { id:"s-elon-ai", speaker:"Elon Musk", channel:"Tesla Q2 2026 results and webcast", statement_date:"2026-07-22", quote_excerpt:"Tesla continues to centre its long-term case on autonomy, robotics and physical AI.", topic:"Tesla AI investment", market_interpretation:"The equity increasingly trades on execution against long-dated AI claims rather than vehicle deliveries alone.", affected_assets:["TSLA","NVDA","AMD"], source_url:"https://ir.tesla.com/press-release/tesla-releases-second-quarter-2026-financial-results", verification_status:"official_paraphrase", follow_up:"Track capex, free cash flow, FSD subscriptions, robotaxi deployment and Optimus production." },
];

function clamp(value: number | null | undefined, fallback = 55) {
  return Math.max(0, Math.min(100, Math.round(value ?? fallback)));
}

function shorten(value: string, max = 26) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function formatPct(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatValue(value: number | null | undefined, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-GB", { maximumFractionDigits: digits });
}

function rangeSessions(range: Range) {
  return range === "7D" ? 7 : range === "30D" ? 30 : range === "90D" ? 90 : 260;
}

function rangePoints(points: PricePoint[], range: Range) {
  return points.slice(-rangeSessions(range));
}

function linePath(points: PricePoint[], width = 920, height = 300, padding = 12) {
  if (points.length < 2) return "";
  const values = points.map((point) => point.close);
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  return points.map((point, index) => {
    const x = padding + (index / (points.length - 1)) * (width - padding * 2);
    const y = height - padding - ((point.close - min) / span) * (height - padding * 2);
    return `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}

function normalisedPath(points: PricePoint[], width = 920, height = 300, padding = 12) {
  if (points.length < 2) return "";
  const base = points[0].close || 1;
  return linePath(points.map((point) => ({ ...point, close: point.close / base * 100 })), width, height, padding);
}

function storySeries(story: DisplayStory | null, series: MarketSeries[]) {
  if (!story) return series.find((item) => item.symbol === "^GSPC") || series[0];
  const aliases: Record<string, string[]> = {
    USDJPY: ["JPY=X"], JPY: ["JPY=X"], WTI: ["CL=F"], USOIL: ["CL=F"], BRENT: ["BZ=F"],
    SPX: ["^GSPC"], SANDP: ["^GSPC"], NDX: ["^IXIC"], NASDAQ: ["^IXIC"], SEMIS: ["SOXX"],
  };
  for (const asset of story.assets) {
    const upper = asset.toUpperCase();
    const exact = series.find((item) => item.symbol.toUpperCase() === upper || item.label.toUpperCase().includes(upper));
    if (exact) return exact;
    for (const alias of aliases[upper] || []) {
      const match = series.find((item) => item.symbol === alias);
      if (match) return match;
    }
  }
  const text = `${story.title} ${story.thesis}`.toLowerCase();
  if (text.includes("yen")) return series.find((item) => item.symbol === "JPY=X");
  if (text.includes("oil") || text.includes("hormuz")) return series.find((item) => item.symbol === "CL=F");
  if (text.includes("ai") || text.includes("capex")) return series.find((item) => item.symbol === "SOXX");
  if (text.includes("earnings") || text.includes("breadth")) return series.find((item) => item.symbol === "^GSPC");
  return series.find((item) => item.symbol === "^GSPC") || series[0];
}

function Icon({ name }: { name: string }) {
  const icons: Record<string, string> = {
    Overview: "▦",
    Stories: "⌘",
    Articles: "▤",
    Signals: "⌁",
    Earnings: "◫",
    Charts: "⌁",
    "AI News": "AI",
    "Oil System": "◉",
    Breadth: "▥",
    Guidance: "◎",
    Statements: "✦",
    Ledger: "▣",
  };
  return <span aria-hidden="true">{icons[name] || "✦"}</span>;
}

export default function MarketWorkspace({ stories, calls, updates, charts, articles, guidance, statements, newsThreads, market }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [range, setRange] = useState<Range>("30D");
  const [showActions, setShowActions] = useState(false);
  const [signalWindow, setSignalWindow] = useState<"This week" | "This month">("This week");
  const [articleFilter, setArticleFilter] = useState<ArticleFilter>("All");
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [selectedMarketSymbol, setSelectedMarketSymbol] = useState("^GSPC");
  const [statementSpeaker, setStatementSpeaker] = useState<"All" | "Donald Trump" | "Elon Musk">("All");

  const storyViews = useMemo<DisplayStory[]>(() => {
    const live = stories.map((story) => ({
      id: story.id,
      slug: story.slug,
      title: story.title,
      thesis: story.thesis,
      confidence: clamp(story.confidence),
      support: story.strongest_support || story.best_explanation || "Primary evidence remains under review.",
      contradiction: story.strongest_contradiction || "The tape and the evidence are not fully aligned.",
      marketQuestion: story.market_question || "What would force the market to change its current view?",
      next: story.next_catalyst || "Next official release or cross-asset confirmation.",
      status: story.article_verdict || story.status,
      assets: story.assets || [],
    }));
    const liveSlugs = new Set(live.map((story) => story.slug));
    return [...live, ...fallbackStories.filter((story) => !liveSlugs.has(story.slug))].slice(0, 14);
  }, [stories]);

  const articleMemory = useMemo<ArticleMemory[]>(() => {
    return articles.map((article) => {
      const articleWords = tokens(`${article.title} ${article.summary} ${article.category}`);
      const articleText = `${article.title} ${article.summary}`.toLowerCase();
      const ranked = storyViews.map((story) => {
        const storyWords = tokens(`${story.title} ${story.thesis} ${story.marketQuestion} ${story.assets.join(" ")}`);
        const shared = articleWords.filter((word) => storyWords.includes(word));
        const assetHit = story.assets.some((asset) => articleText.includes(asset.toLowerCase()));
        const score = Math.min(100, shared.length * 15 + (assetHit ? 25 : 0));
        return { story, score };
      }).sort((a, b) => b.score - a.score);
      const match = ranked[0]?.score >= 15 ? ranked[0] : null;
      const published = article.publishedAt ? new Date(article.publishedAt).getTime() : 0;
      const materialUpdates = match ? updates
        .filter((update) => update.story_id === match.story.id && (!published || new Date(update.created_at).getTime() > published))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) : [];
      const updateScore = materialUpdates.reduce((sum, update) => sum + updateWeight(update), 0);
      const latestAge = materialUpdates[0] ? (Date.now() - new Date(materialUpdates[0].created_at).getTime()) / 86400000 : 999;
      const recencyBoost = materialUpdates.length ? (latestAge <= 2 ? 16 : latestAge <= 7 ? 10 : 4) : 0;
      const confidenceBoost = materialUpdates.length && match && match.story.confidence >= 65 ? 6 : 0;
      const changeScore = Math.min(100, materialUpdates.length ? updateScore + recencyBoost + confidenceBoost : match ? 8 : 0);
      const level = articleLevel(changeScore);
      const latest = materialUpdates[0];
      return {
        ...article,
        story: match?.story || null,
        alignment: match?.score || 0,
        changeScore,
        ...level,
        latestChange: latest?.headline || "No material change recorded since publication.",
        changeDetail: latest?.detail || (match ? `The published view still maps to ${match.story.title}, but the research ledger has not recorded enough new evidence to justify a full recovery yet.` : "No active desk story currently has a strong enough overlap with this article."),
        materialUpdates,
      };
    }).sort((a, b) => b.changeScore - a.changeScore || new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime());
  }, [articles, storyViews, updates]);

  const filteredArticles = articleMemory.filter((article) => articleFilter === "All" || article.changeLabel === articleFilter);
  const selectedArticle = articleMemory.find((article) => article.id === selectedArticleId) || filteredArticles[0] || articleMemory[0];
  const revisitArticles = articleMemory.filter((article) => article.changeKey === "revisit" || article.changeKey === "material");

  const chartViews = charts.length
    ? charts.slice(0, 6).map((chart) => ({
        id: chart.id,
        instrument: chart.instrument,
        timeframe: chart.timeframe,
        question: chart.question,
        overlay: chart.overlay || "No overlay",
        status: chart.status,
      }))
    : fallbackCharts;

  const activeStory = storyViews[selectedIndex % storyViews.length];
  const pulse = signalWindow === "This week" ? market.pulseWeek : market.pulseMonth;
  const activeSignals = storyViews.slice(0, 6);
  const dataSources = Math.max(7, charts.length + calls.length + guidance.length + newsThreads.length + 3);
  const keySignals = Math.max(12, storyViews.length * 3 + market.breadth.length * 3);
  const hypotheses = Math.max(4, Math.ceil(storyViews.length / 2));
  const marketBySymbol = new Map(market.series.map((series) => [series.symbol, series]));
  const selectedSeries = marketBySymbol.get(selectedMarketSymbol) || market.series[0];
  const spxSeries = marketBySymbol.get("^GSPC");
  const equalWeightSeries = marketBySymbol.get("RSP");
  const selectedSeriesPoints = selectedSeries ? rangePoints(selectedSeries.points, range) : [];
  const spxPoints = spxSeries ? rangePoints(spxSeries.points, range) : [];
  const equalWeightPoints = equalWeightSeries ? rangePoints(equalWeightSeries.points, range) : [];
  const liveGuidance = guidance.length ? guidance : fallbackGuidance;
  const liveStatements = statements.length ? statements : fallbackStatements;
  const liveThreads = newsThreads.length ? newsThreads : fallbackNewsThreads;
  const aiThreads = liveThreads.filter((thread) => thread.domain === "ai");
  const oilThreads = liveThreads.filter((thread) => thread.domain === "oil");
  const filteredStatements = liveStatements.filter((statement) => statementSpeaker === "All" || statement.speaker === statementSpeaker);
  const selectedArticleSeries = selectedArticle ? storySeries(selectedArticle.story, market.series) : undefined;
  const pulsePoints = spxSeries ? spxSeries.points.slice(signalWindow === "This week" ? -7 : -30) : [];
  const pulseMove = signalWindow === "This week" ? spxSeries?.change5d : spxSeries?.change21d;
  const mainBreadth = market.breadth.find((item) => item.id === "large-cap") || market.breadth[0];

  function openAction(tab: Tab) {
    setActiveTab(tab);
    setShowActions(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="site-stage">
      <section className="workspace-shell">
        <header className="workspace-hero">
          <div>
            <span className="eyebrow">RESEARCH WORKSPACE</span>
            <h1>Market Intelligence<br />Workspace</h1>
            <p>Connect evidence, test hypotheses and track what can change the market.</p>
          </div>
          <button className="new-research" onClick={() => setShowActions(true)}><span>✣</span> New research <b>＋</b></button>
        </header>

        <nav className="workspace-tabs" aria-label="Workspace sections">
          {(["Overview", "Stories", "Articles", "AI News", "Oil System", "Breadth", "Guidance", "Statements", "Signals", "Earnings", "Charts", "Ledger"] as Tab[]).map((tab) => (
            <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>
              <Icon name={tab} /> {tab}
            </button>
          ))}
        </nav>

        {activeTab === "Overview" && (
          <div className="overview-grid">
            <article className="panel snapshot-panel">
              <PanelTitle icon="✦" title="Research snapshot" />
              <div className="metric-row">
                <Metric value={storyViews.length} label="Active stories" tone="purple" />
                <Metric value={dataSources} label="Data sources" tone="blue" />
                <Metric value={keySignals} label="Key signals" tone="green" />
                <Metric value={hypotheses} label="Hypotheses" tone="amber" />
              </div>
              <div className="mini-chart-head"><span>S&P 500 momentum · {signalWindow.toLowerCase()} <i>i</i></span><strong className={(pulseMove || 0) >= 0 ? "positive" : "negative"}>{formatPct(pulseMove)}</strong></div>
              <svg className="mini-chart" viewBox="0 0 700 190" preserveAspectRatio="none" aria-label="Live S&P 500 momentum from Yahoo Finance">
                <defs><linearGradient id="miniFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#8d4dff" stopOpacity=".48"/><stop offset="100%" stopColor="#8d4dff" stopOpacity="0"/></linearGradient></defs>
                <path className="chart-grid" d="M0 45H700 M0 95H700 M0 145H700" />
                {pulsePoints.length > 1 && <path className="chart-line" d={linePath(pulsePoints, 700, 190, 8)} />}
              </svg>
              <div className="chart-dates"><span>Start</span><span>{pulsePoints.length} sessions</span><a href={spxSeries?.sourceUrl} target="_blank" rel="noreferrer">Yahoo chart ↗</a></div>
            </article>

            <article className="panel pulse-panel">
              <div className="panel-title-row">
                <PanelTitle icon="⌁" title="Market pulse" />
                <button className="select-button" onClick={() => setSignalWindow(signalWindow === "This week" ? "This month" : "This week")}>{signalWindow}⌄</button>
              </div>
              <div className="pulse-content">
                <div><b>{pulse}</b><span>Market score · {signalWindow.toLowerCase()}</span><strong className={pulse >= 60 ? "positive" : pulse >= 48 ? "mixed" : "negative"}>{pulse >= 60 ? "Constructive" : pulse >= 48 ? "Balanced" : "Fragile"}</strong></div>
                <div className="donut" style={{ "--score": `${pulse * 3.6}deg` } as React.CSSProperties}><span>{pulse}</span></div>
              </div>
              <div className="pulse-drivers">
                <span><b>{formatPct(pulseMove)}</b>S&P 500</span>
                <span><b>{mainBreadth ? `${mainBreadth.current.above50}%` : "—"}</b>above 50-day</span>
                <span><b>{mainBreadth ? `${mainBreadth.current.above200}%` : "—"}</b>above 200-day</span>
              </div>
              <p className="pulse-method">Score combines benchmark momentum, equal-weight and semiconductor performance, current breadth and breadth change versus the selected window.</p>
            </article>

            <article className="panel story-map-panel">
              <div className="panel-title-row"><PanelTitle icon="⌘" title="Story map" /><button className="ghost-button" onClick={() => setActiveTab("Stories")}>View all</button></div>
              <div className="story-map">
                <svg viewBox="0 0 600 360" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M300 182 C245 88 185 83 112 75" />
                  <path d="M300 182 C355 88 425 78 500 90" />
                  <path d="M300 182 C380 208 452 240 515 286" />
                  <path d="M300 182 C220 225 170 255 92 282" />
                  <path d="M300 182 C300 122 298 76 300 28" />
                </svg>
                <button className="story-core" onClick={() => setActiveTab("Stories")}><small>SELECTED STORY</small><b>{shorten(activeStory.title, 32)}</b><span>{activeStory.confidence}%</span></button>
                {storyViews.slice(0, 5).map((story, index) => (
                  <button key={story.id} className={`story-node node-${index + 1} ${selectedIndex === index ? "selected" : ""}`} onClick={() => setSelectedIndex(index)}>{shorten(story.title, 22)}</button>
                ))}
              </div>
            </article>

            <article className="panel signals-panel">
              <div className="panel-title-row"><PanelTitle icon="ϟ" title="Top signals" /><button className="ghost-link" onClick={() => setActiveTab("Signals")}>View all</button></div>
              <div className="signal-list">
                {activeSignals.map((story, index) => (
                  <button key={story.id} onClick={() => { setSelectedIndex(index); setActiveTab("Stories"); }}>
                    <i className={story.confidence >= 60 ? "up" : story.confidence >= 50 ? "mixed" : "down"}>{story.confidence >= 60 ? "↗" : story.confidence >= 50 ? "⌁" : "↘"}</i>
                    <span><b>{shorten(story.title, 28)}</b><small>{story.status} · {story.next}</small></span>
                    <strong>{story.confidence}</strong>
                  </button>
                ))}
              </div>
            </article>

            <article className="panel trend-panel">
              <div className="panel-title-row">
                <PanelTitle icon="▥" title="Trend preview" />
                <div className="range-tabs">{(["7D", "30D", "90D", "1Y"] as Range[]).map((item) => <button key={item} className={range === item ? "active" : ""} onClick={() => setRange(item)}>{item}</button>)}</div>
              </div>
              <div className="trend-legend"><span>Indexed performance</span><i className="purple-dot"/>S&P 500<i className="blue-dot"/>Equal weight <a href={spxSeries?.sourceUrl} target="_blank" rel="noreferrer">Yahoo ↗</a></div>
              <svg className="trend-chart" viewBox="0 0 920 300" preserveAspectRatio="none" aria-label="Live S&P 500 versus equal-weight performance from Yahoo Finance">
                <path className="chart-grid" d="M0 55H920 M0 115H920 M0 175H920 M0 235H920" />
                {spxPoints.length > 1 && <path className="trend-primary" d={normalisedPath(spxPoints)} />}
                {equalWeightPoints.length > 1 && <path className="trend-secondary" d={normalisedPath(equalWeightPoints)} />}
              </svg>
              <div className="trend-axis"><span>Start</span><span>25%</span><span>50%</span><span>75%</span><span>Now</span></div>
            </article>

            <article className="panel coverage-preview">
              <div className="panel-title-row"><PanelTitle icon="▤" title="Alchemy article memory" /><button className="ghost-button" onClick={() => setActiveTab("Articles")}>Open coverage map</button></div>
              <div className="coverage-summary"><div><b>{articleMemory.length}</b><span>recent pieces scanned</span></div><div><b>{revisitArticles.length}</b><span>materially evolved</span></div><p>Prior coverage is not a reason to ignore a story. The colour shows how much the evidence has changed since publication.</p></div>
              <div className="coverage-preview-list">{articleMemory.slice(0, 3).map((article) => <button key={article.id} className={`change-${article.changeKey}`} onClick={() => { setSelectedArticleId(article.id); setActiveTab("Articles"); }}><span><small>{article.author} · {articleDate(article.publishedAt)}</small><b>{article.title}</b><em>{article.story ? `Aligns with ${article.story.title}` : "No strong current match"}</em></span><strong>{article.changeScore}<small>change</small></strong></button>)}</div>
            </article>
          </div>
        )}

        {activeTab === "Stories" && (
          <div className="stories-layout tab-page">
            <section className="story-list-panel panel">
              <div className="section-heading"><span>ACTIVE STORIES</span><h2>Choose the question, not the headline</h2></div>
              <div className="story-list">
                {storyViews.map((story, index) => (
                  <button key={story.id} className={selectedIndex === index ? "active" : ""} onClick={() => setSelectedIndex(index)}>
                    <i>{String(index + 1).padStart(2, "0")}</i>
                    <span><b>{story.title}</b><small>{story.marketQuestion}</small></span>
                    <strong>{story.confidence}%</strong>
                  </button>
                ))}
              </div>
            </section>
            <article className="panel story-detail">
              <header><div><span>{activeStory.status}</span><h2>{activeStory.title}</h2></div><div className="confidence-orb"><b>{activeStory.confidence}</b><small>confidence</small></div></header>
              <p className="story-thesis">{activeStory.thesis}</p>
              <MiniMarketChart series={storySeries(activeStory, market.series)} range={range} title="Live aligned market chart" large />
              <div className="evidence-grid">
                <Evidence title="Why the market may be right" text={activeStory.support} tone="support" />
                <Evidence title="Strongest contradiction" text={activeStory.contradiction} tone="risk" />
                <Evidence title="Central question" text={activeStory.marketQuestion} tone="neutral" />
                <Evidence title="Next deciding test" text={activeStory.next} tone="next" />
              </div>
              <footer>{activeStory.assets.map((asset) => <span key={asset}>{asset}</span>)}</footer>
              <div className="related-coverage"><div><small>PRIOR ALCHEMY COVERAGE</small><b>Has this story moved enough to revisit?</b></div>{articleMemory.filter((article) => article.story?.id === activeStory.id).slice(0, 3).map((article) => <button className={`change-${article.changeKey}`} key={article.id} onClick={() => { setSelectedArticleId(article.id); setActiveTab("Articles"); }}><span>{article.title}</span><strong>{article.changeScore}</strong></button>)}{!articleMemory.some((article) => article.story?.id === activeStory.id) && <p>No recent Alchemy piece has a strong match with this story.</p>}</div>
            </article>
          </div>
        )}

        {activeTab === "Articles" && (
          <div className="articles-page tab-page">
            <header className="article-memory-header"><div><span>ALCHEMY ARTICLE MEMORY</span><h2>What have we already said, and what changed?</h2><p>Every piece keeps its published view. Live stories and material updates decide whether it is stable, evolving or ready to revisit.</p></div><div className="change-legend"><span className="change-stable">Little changed</span><span className="change-incremental">Incremental</span><span className="change-material">Material evolution</span><span className="change-revisit">Revisit now</span></div></header>
            <div className="article-filters">{(["All", "Revisit now", "Material evolution", "Incremental", "Little changed"] as ArticleFilter[]).map((filter) => <button key={filter} className={articleFilter === filter ? "active" : ""} onClick={() => setArticleFilter(filter)}>{filter}<b>{filter === "All" ? articleMemory.length : articleMemory.filter((article) => article.changeLabel === filter).length}</b></button>)}</div>
            <div className="article-memory-layout">
              <section className="article-feed">{filteredArticles.map((article) => <article key={article.id} className={`article-card change-${article.changeKey} ${selectedArticle?.id === article.id ? "selected" : ""}`} tabIndex={0} role="button" onClick={() => setSelectedArticleId(article.id)} onKeyDown={(event) => { if (event.key === "Enter") setSelectedArticleId(article.id); }}><div className="article-image" style={article.image ? { backgroundImage: `linear-gradient(180deg, rgba(15,17,43,.05), rgba(15,17,43,.88)), url(${article.image})` } : undefined}><span>{article.category}</span><strong>{article.changeScore}<small>change</small></strong></div><div className="article-copy"><small>{article.author} · {articleDate(article.publishedAt)}</small><h3>{article.title}</h3><p>{article.summary}</p><div><span>{article.story ? `↳ ${article.story.title}` : "No current match"}</span><a href={article.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Open piece ↗</a></div></div></article>)}</section>
              {selectedArticle && <aside className={`panel article-detail-panel change-${selectedArticle.changeKey}`}><div className="article-detail-image" style={selectedArticle.image ? { backgroundImage: `linear-gradient(180deg, rgba(14,16,42,.1), #15183a), url(${selectedArticle.image})` } : undefined}><span>{selectedArticle.category}</span><b>{selectedArticle.changeLabel}</b></div><small>{selectedArticle.author} · {articleDate(selectedArticle.publishedAt)}</small><h2>{selectedArticle.title}</h2><div className="change-meter"><span style={{ width: `${selectedArticle.changeScore}%` }} /><b>{selectedArticle.changeScore}/100 change intensity</b></div>{selectedArticleSeries && <MiniMarketChart series={selectedArticleSeries} range={range} title="Current aligned chart" large />}<section><small>PUBLISHED VIEW</small><p>{selectedArticle.summary}</p></section><section><small>CURRENT STORY ALIGNMENT</small><p>{selectedArticle.story ? `${selectedArticle.alignment}% match with “${selectedArticle.story.title}”. ${selectedArticle.story.thesis}` : "No active story currently clears the alignment threshold."}</p></section><section><small>WHAT CHANGED</small><h3>{selectedArticle.latestChange}</h3><p>{selectedArticle.changeDetail}</p></section><div className="article-detail-actions"><a href={selectedArticle.url} target="_blank" rel="noreferrer">Read original article ↗</a>{selectedArticle.story && <button onClick={() => { const index = storyViews.findIndex((story) => story.id === selectedArticle.story?.id); if (index >= 0) setSelectedIndex(index); setActiveTab("Stories"); }}>Open aligned story →</button>}</div></aside>}
            </div>
          </div>
        )}


        {activeTab === "AI News" && (
          <div className="domain-page tab-page">
            <header className="domain-hero ai-domain"><div><span>AI INTELLIGENCE SYSTEM</span><h2>Separate the model race from the capex trade.</h2><p>Open-weight models, closed frontier systems, China, chips, cloud capacity and applications can move in different directions. Each thread keeps its own source and market mechanism.</p></div><div className="domain-stat"><b>{aiThreads.length}</b><span>moving parts monitored</span><small>{aiThreads.filter((thread) => thread.category.includes("China") || thread.category.includes("Open")).length} open-weight or China-linked</small></div></header>
            <div className="domain-layout">
              <section className="thread-grid">{aiThreads.map((thread) => <article className={`panel thread-card ${thread.category.includes("China") ? "china-thread" : ""}`} key={thread.id}><header><span>{thread.category}</span><b>{thread.importance}</b></header><h3>{thread.headline}</h3><p>{thread.summary}</p><div className="thread-view"><small>CURRENT MARKET QUESTION</small><p>{thread.current_view || "Monitor the next primary release."}</p></div><footer><div>{thread.affected_assets.map((asset) => <span key={asset}>{asset}</span>)}</div><a href={thread.source_url} target="_blank" rel="noreferrer">Source ↗</a></footer></article>)}</section>
              <aside className="panel domain-side"><PanelTitle icon="AI" title="AI market map" /><div className="layer-map">{["Open-weight models","Closed/private models","China AI","Chips and accelerators","Cloud and data centres","Applications and agents","Power, memory and networking","Regulation and export controls"].map((category) => { const items = aiThreads.filter((thread) => thread.category === category); return <button key={category} onClick={() => { const storyIndex = storyViews.findIndex((story) => category.includes("China") ? story.slug.includes("china-ai") : category.includes("Cloud") || category.includes("Chips") ? story.slug.includes("ai-capex") : false); if (storyIndex >= 0) { setSelectedIndex(storyIndex); setActiveTab("Stories"); } }}><span>{category}</span><b>{items.length}</b></button>; })}</div><MiniMarketChart series={marketBySymbol.get("SOXX")} range={range} title="Semiconductor confirmation" /><div className="range-tabs compact">{(["7D","30D","90D","1Y"] as Range[]).map((item) => <button key={item} className={range === item ? "active" : ""} onClick={() => setRange(item)}>{item}</button>)}</div></aside>
            </div>
          </div>
        )}

        {activeTab === "Oil System" && (
          <div className="domain-page tab-page">
            <header className="domain-hero oil-domain"><div><span>OIL TRANSMISSION SYSTEM</span><h2>Crude, products and physical access are different stories.</h2><p>War headlines, OPEC+ barrels, demand, stocks, refining margins and freight are separated so one signal cannot stand in for the whole oil system.</p></div><div className="domain-stat"><b>{market.cracks.length}</b><span>live crack proxies</span><small>Calculated from Yahoo futures and linked to EIA methodology</small></div></header>
            <section className="crack-grid">{market.cracks.map((crack) => <CrackCard key={crack.id} crack={crack} range={range} />)}</section>
            <div className="domain-layout oil-layout"><section className="thread-grid">{oilThreads.map((thread) => <article className="panel thread-card" key={thread.id}><header><span>{thread.category}</span><b>{thread.importance}</b></header><h3>{thread.headline}</h3><p>{thread.summary}</p><div className="thread-view"><small>CURRENT MARKET QUESTION</small><p>{thread.current_view || "Monitor the next primary release."}</p></div><footer><div>{thread.affected_assets.map((asset) => <span key={asset}>{asset}</span>)}</div><a href={thread.source_url} target="_blank" rel="noreferrer">Source ↗</a></footer></article>)}</section><aside className="panel domain-side"><PanelTitle icon="◉" title="Physical confirmation" /><MiniMarketChart series={marketBySymbol.get("CL=F")} range={range} title="WTI crude" /><MiniMarketChart series={marketBySymbol.get("HO=F")} range={range} title="ULSD / heating oil" /><a className="method-link" href="https://www.eia.gov/finance/markets/products/prices.php" target="_blank" rel="noreferrer">EIA crack-spread methodology ↗</a><p className="method-note">The app uses futures-based proxies. They are useful for direction and comparison, but they are not a replacement for regional physical-market cracks.</p></aside></div>
          </div>
        )}

        {activeTab === "Breadth" && (
          <div className="breadth-page tab-page">
            <header className="domain-hero breadth-domain"><div><span>MARKET BREADTH</span><h2>Is the index move being confirmed by more stocks?</h2><p>Track participation above the 20-day, 50-day and 200-day moving averages. Every card shows the exact live sample size.</p></div><div className="domain-stat"><b>{mainBreadth?.current.above50 ?? "—"}%</b><span>large-cap proxy above 50-day</span><small>{mainBreadth?.sampleSize ?? 0} Yahoo histories in the live sample</small></div></header>
            <section className="breadth-grid">{market.breadth.map((snapshot) => <BreadthCard key={snapshot.id} snapshot={snapshot} window={signalWindow} />)}</section>
            <article className="panel breadth-chart-panel"><div className="panel-title-row"><div><span className="panel-kicker">CAP-WEIGHTED VERSUS EQUAL-WEIGHT</span><h2>S&P 500 versus RSP</h2><p>Equal-weight confirmation helps distinguish broad participation from megacap concentration.</p></div><div className="range-tabs">{(["7D","30D","90D","1Y"] as Range[]).map((item) => <button key={item} className={range === item ? "active" : ""} onClick={() => setRange(item)}>{item}</button>)}</div></div><svg className="large-chart" viewBox="0 0 920 360" preserveAspectRatio="none"><path className="chart-grid" d="M0 70H920 M0 140H920 M0 210H920 M0 280H920" />{spxPoints.length > 1 && <path className="trend-primary" d={normalisedPath(spxPoints,920,360,14)} />}{equalWeightPoints.length > 1 && <path className="trend-secondary" d={normalisedPath(equalWeightPoints,920,360,14)} />}</svg><div className="trend-legend"><i className="purple-dot"/>S&P 500<i className="blue-dot"/>RSP<a href={equalWeightSeries?.sourceUrl} target="_blank" rel="noreferrer">Yahoo chart ↗</a></div>{market.limitation && <p className="data-limitation">{market.limitation}</p>}</article>
          </div>
        )}

        {activeTab === "Guidance" && (
          <div className="guidance-page tab-page">
            <header className="domain-hero guidance-domain"><div><span>GUIDANCE INTELLIGENCE</span><h2>Track what management and the Fed expect next.</h2><p>Guidance is separated from reported results. Wording changes, assumptions and the market’s interpretation remain visible beside the original source.</p></div><div className="domain-stat"><b>{liveGuidance.length}</b><span>guidance items</span><small>{liveGuidance.filter((item) => item.category === "fed").length} central-bank items</small></div></header>
            <section className="guidance-section"><div className="section-heading"><span>COMPANY GUIDANCE</span><h2>AI and Mag7</h2></div><div className="guidance-grid">{liveGuidance.filter((item) => item.category !== "fed").map((item) => <GuidanceCard key={item.id} item={item} />)}</div></section>
            <section className="guidance-section fed-section"><div className="section-heading"><span>FED GUIDANCE</span><h2>Decision, wording and market interpretation</h2></div><div className="guidance-grid">{liveGuidance.filter((item) => item.category === "fed").map((item) => <GuidanceCard key={item.id} item={item} />)}</div><div className="fed-market-strip"><MiniMarketChart series={marketBySymbol.get("^FVX")} range={range} title="US 5-year yield" /><MiniMarketChart series={marketBySymbol.get("^TNX")} range={range} title="US 10-year yield" /><MiniMarketChart series={marketBySymbol.get("^TYX")} range={range} title="US 30-year yield" /></div></section>
          </div>
        )}

        {activeTab === "Statements" && (
          <div className="statements-page tab-page">
            <header className="domain-hero statement-domain"><div><span>PUBLIC STATEMENT MONITOR</span><h2>Trump and Elon, separated from normal reporting.</h2><p>Each item carries a channel, verification label, affected assets and the follow-up needed before treating it as a durable market signal.</p></div><div className="statement-filters">{(["All","Donald Trump","Elon Musk"] as const).map((speaker) => <button key={speaker} className={statementSpeaker === speaker ? "active" : ""} onClick={() => setStatementSpeaker(speaker)}>{speaker}</button>)}</div></header>
            <section className="statement-grid">{filteredStatements.map((statement) => <article className={`panel statement-card ${statement.speaker === "Donald Trump" ? "trump" : "elon"}`} key={statement.id}><header><div><span>{statement.speaker}</span><small>{statement.channel} · {articleDate(statement.statement_date)}</small></div><b>{statement.verification_status}</b></header><blockquote>{statement.quote_excerpt}</blockquote><div className="statement-topic"><small>{statement.topic}</small><p>{statement.market_interpretation || "Interpretation pending."}</p></div><div className="statement-follow"><small>REQUIRED FOLLOW-UP</small><p>{statement.follow_up || "Wait for official implementation or market confirmation."}</p></div><footer><div>{statement.affected_assets.map((asset) => <span key={asset}>{asset}</span>)}</div><a href={statement.source_url} target="_blank" rel="noreferrer">Verify source ↗</a></footer></article>)}</section>
          </div>
        )}

        {activeTab === "Signals" && (
          <div className="signals-page tab-page">
            <article className="panel central-question">
              <span>CENTRAL QUESTION 01</span>
              <h2>Can earnings quality outrun yields, valuation and weak breadth?</h2>
              <div className="question-score"><div className="donut small" style={{ "--score": `${pulse * 3.6}deg` } as React.CSSProperties}><span>{pulse}</span></div><p>Support remains possible, but good results must create broader positive reactions rather than only protect the index.</p></div>
              <div className="condition-row"><Condition label="Confirms" text="Beat breadth, better guidance and stronger equal-weight participation."/><Condition label="Invalidates" text="Good results are sold while yields and volatility rise."/></div>
            </article>
            <article className="panel central-question ai-question">
              <span>CENTRAL QUESTION 02</span>
              <h2>Is AI-linked revenue scaling fast enough to justify capex?</h2>
              <div className="pipeline-row">{["CAPEX", "CAPACITY", "USAGE", "REVENUE", "CASH"].map((step, index) => <div key={step}><i>{index + 1}</i><b>{step}</b></div>)}</div>
              <p className="pipeline-note">The market increasingly rewards visible utilisation, backlog and cash conversion while penalising spending that extends the payback period.</p>
            </article>
            <article className="panel causal-panel">
              <PanelTitle icon="⌁" title="Causal transmission" />
              <div className="causal-chain"><span>Results</span><b>→</b><span>Guidance</span><b>→</b><span>Estimate revisions</span><b>→</b><span>Breadth</span><b>→</b><span>Index durability</span></div>
              <div className="signal-cards">{activeSignals.map((story) => <div key={story.id}><small>{story.status}</small><b>{story.title}</b><span>{story.confidence}%</span></div>)}</div>
            </article>
          </div>
        )}

        {activeTab === "Earnings" && (
          <div className="earnings-page tab-page">
            <article className="panel amd-focus">
              <div className="amd-chip"><span>AMD</span><small>04 AUG</small></div>
              <div><span>THE WEEK'S AI PROOF POINT</span><h2>AMD must validate the hardware leg.</h2><p>Data Center growth, gross margin, forward guidance, supply constraints and management confidence decide whether semiconductor enthusiasm has fundamental support.</p><div className="scenario-row"><b>Acceleration</b><b>In-line</b><b>Disappointment</b></div></div>
            </article>
            <section className="call-cards">
              {(calls.length ? calls.slice(0, 6) : []).map((call) => (
                <article className="panel call-card" key={call.id}><header><b>{call.ticker}</b><span>{call.transcript_status}</span></header><h3>{call.company_name}</h3><p>{call.summary || call.relevance_reason || "Tracked because this call can change an active thesis."}</p><dl><dt>GUIDANCE</dt><dd>{call.guidance || "Monitoring"}</dd><dt>CAPEX</dt><dd>{call.capex || "Monitoring"}</dd><dt>DEMAND</dt><dd>{call.demand || "Monitoring"}</dd></dl></article>
              ))}
              {!calls.length && <article className="panel empty-state"><b>No new calls ingested yet.</b><p>The panel will populate automatically when a relevant earnings call enters the research system.</p></article>}
            </section>
          </div>
        )}

        {activeTab === "Charts" && (
          <div className="charts-page tab-page">
            <article className="panel primary-chart-panel">
              <div className="panel-title-row"><div><span className="panel-kicker">YAHOO MARKET CHART</span><h2>{selectedSeries?.label || "Market series unavailable"}</h2><p>{selectedSeries?.symbol || "—"} · last {formatValue(selectedSeries?.last)}</p></div><div className="range-tabs">{(["7D", "30D", "90D", "1Y"] as Range[]).map((item) => <button key={item} className={range === item ? "active" : ""} onClick={() => setRange(item)}>{item}</button>)}</div></div>
              <svg className="large-chart" viewBox="0 0 1000 430" preserveAspectRatio="none" aria-label={`Live ${selectedSeries?.label || "market"} chart from Yahoo Finance`}>
                <path className="chart-grid" d="M0 80H1000 M0 160H1000 M0 240H1000 M0 320H1000 M180 0V400 M380 0V400 M580 0V400 M780 0V400" />
                {selectedSeriesPoints.length > 1 && <path className="large-line" d={linePath(selectedSeriesPoints, 1000, 430, 18)} />}
              </svg>
              <div className="chart-footer"><span>{range}</span><span>5D {formatPct(selectedSeries?.change5d)}</span><span>21D {formatPct(selectedSeries?.change21d)}</span>{selectedSeries?.sourceUrl && <a href={selectedSeries.sourceUrl} target="_blank" rel="noreferrer">Open Yahoo chart ↗</a>}</div>
            </article>
            <aside className="chart-request-list panel"><PanelTitle icon="▥" title="Live series" />{market.series.map((series, index) => <button key={series.symbol} className={selectedMarketSymbol === series.symbol ? "active" : ""} onClick={() => setSelectedMarketSymbol(series.symbol)}><i>{String(index + 1).padStart(2, "0")}</i><span><b>{series.label}</b><small>{series.symbol} · 21D {formatPct(series.change21d)}</small></span><em>{formatValue(series.last)}</em></button>)}<div className="request-divider"><span>RESEARCH REQUESTS</span></div>{chartViews.map((chart, index) => <button key={chart.id}><i>{String(index + 1).padStart(2, "0")}</i><span><b>{chart.instrument}</b><small>{chart.question}</small></span><em>{chart.status}</em></button>)}</aside>
          </div>
        )}

        {activeTab === "Ledger" && (
          <div className="ledger-page tab-page">
            <article className="panel ledger-panel"><div className="section-heading"><span>RESEARCH LEDGER</span><h2>Only material changes enter the record</h2></div><div className="timeline">{updates.length ? updates.slice(0, 12).map((update, index) => <div key={update.id}><i>{String(index + 1).padStart(2, "0")}</i><span><small>{update.update_type}</small><b>{update.headline}</b><p>{update.detail || "Material update recorded."}</p></span></div>) : <div className="empty-state"><b>The ledger is quiet.</b><p>Repeated background information is excluded until the evidence changes.</p></div>}</div></article>
            <aside className="panel monitor-panel"><PanelTitle icon="◉" title="Persistent monitors" /><div><span>01</span><b>Can earnings keep the market alive?</b><small>Probability history, breadth, guidance and yields.</small></div><div><span>02</span><b>AI revenue versus capex</b><small>Backlog, usage, depreciation and cash conversion.</small></div><div><span>03</span><b>Oil physical disruption</b><small>Cracks, freight, tanker traffic and inventories.</small></div></aside>
          </div>
        )}

        <footer className="workspace-footer"><span>Alchemy Markets · Persistent research state</span><span>Educational use only</span></footer>
      </section>

      {showActions && (
        <div className="action-backdrop" onClick={() => setShowActions(false)}>
          <div className="action-modal" onClick={(event) => event.stopPropagation()}>
            <header><div><span>NEW RESEARCH</span><h2>Where should the desk go next?</h2></div><button onClick={() => setShowActions(false)}>×</button></header>
            <button onClick={() => openAction("Stories")}><i>01</i><span><b>Open Story Lab</b><small>Compare support, contradiction and the next test.</small></span><em>→</em></button>
            <button onClick={() => openAction("Articles")}><i>02</i><span><b>Review prior Alchemy coverage</b><small>See what was said, how the story evolved and whether it is ready to revisit.</small></span><em>→</em></button>
            <button onClick={() => openAction("Charts")}><i>03</i><span><b>Request a chart</b><small>Choose the visual that answers a defined question.</small></span><em>→</em></button>
            <button onClick={() => openAction("Earnings")}><i>04</i><span><b>Review earnings intelligence</b><small>Inspect guidance, capex, demand and wording shifts.</small></span><em>→</em></button>
          </div>
        </div>
      )}
    </main>
  );
}


function MiniMarketChart({ series, range, title, large = false }: { series?: MarketSeries; range: Range; title: string; large?: boolean }) {
  const points = series ? rangePoints(series.points, range) : [];
  return <div className={`linked-market-chart ${large ? "large" : ""}`}><div><span>{title}</span><b>{series?.label || "Series unavailable"}</b><small>{series ? `${series.symbol} · 21D ${formatPct(series.change21d)}` : "Yahoo data unavailable"}</small></div><svg viewBox="0 0 620 190" preserveAspectRatio="none"><path className="chart-grid" d="M0 48H620 M0 95H620 M0 142H620" />{points.length > 1 && <path className="chart-line" d={linePath(points,620,190,10)} />}</svg><footer><span>Last {formatValue(series?.last)}</span>{series?.sourceUrl && <a href={series.sourceUrl} target="_blank" rel="noreferrer">Yahoo chart ↗</a>}</footer></div>;
}

function CrackCard({ crack, range }: { crack: CrackSeries; range: Range }) {
  const points = rangePoints(crack.points, range);
  return <article className="panel crack-card"><header><div><span>FUTURES-BASED PROXY</span><h3>{crack.label}</h3></div><b>{formatValue(crack.last,1)}</b></header><svg viewBox="0 0 520 180" preserveAspectRatio="none"><path className="chart-grid" d="M0 45H520 M0 90H520 M0 135H520" />{points.length > 1 && <path className="chart-line" d={linePath(points,520,180,9)} />}</svg><div className="crack-metrics"><span>5D <b>{formatPct(crack.change5d)}</b></span><span>21D <b>{formatPct(crack.change21d)}</b></span></div><p>{crack.formula}</p><a href={crack.sourceUrl} target="_blank" rel="noreferrer">EIA method ↗</a></article>;
}

function BreadthCard({ snapshot, window }: { snapshot: BreadthSnapshot; window: "This week" | "This month" }) {
  const prior = window === "This week" ? snapshot.weekAgo : snapshot.monthAgo;
  const metrics = [
    ["Above 20-day", snapshot.current.above20, snapshot.current.above20 - prior.above20],
    ["Above 50-day", snapshot.current.above50, snapshot.current.above50 - prior.above50],
    ["Above 200-day", snapshot.current.above200, snapshot.current.above200 - prior.above200],
  ] as const;
  return <article className="panel breadth-card"><header><div><span>{snapshot.label}</span><small>{snapshot.sampleSize} live Yahoo histories</small></div><b>{snapshot.current.above50}%</b></header><div className="breadth-bars">{metrics.map(([label,value,delta]) => <div key={label}><div><span>{label}</span><b>{value}% <small className={delta >= 0 ? "positive" : "negative"}>{delta >= 0 ? "+" : ""}{delta} pts</small></b></div><i><span style={{ width: `${value}%` }} /></i></div>)}</div><footer><span>20-day highs <b>{snapshot.current.newHighs20}</b></span><span>20-day lows <b>{snapshot.current.newLows20}</b></span></footer></article>;
}

function GuidanceCard({ item }: { item: GuidanceItem }) {
  return <article className={`panel guidance-card ${item.category === "fed" ? "fed" : ""}`}><header><div><span>{item.entity}</span><small>{item.period || "Current"} · {item.guidance_type}</small></div><b>{item.ticker || "FED"}</b></header><h3>{item.metric}</h3><p className="guidance-current">{item.current_view}</p>{item.prior_view && <div><small>PRIOR VIEW</small><p>{item.prior_view}</p></div>}{item.wording_change && <div><small>WORDING CHANGE</small><p>{item.wording_change}</p></div>}{item.market_interpretation && <div className="guidance-interpretation"><small>MARKET INTERPRETATION</small><p>{item.market_interpretation}</p></div>}<footer><div>{item.assets.map((asset) => <span key={asset}>{asset}</span>)}</div><a href={item.source_url} target="_blank" rel="noreferrer">Primary source ↗</a></footer></article>;
}

function PanelTitle({ icon, title }: { icon: string; title: string }) {
  return <div className="panel-title"><i>{icon}</i><h2>{title}</h2></div>;
}

function Metric({ value, label, tone }: { value: number; label: string; tone: string }) {
  return <div className="metric"><b className={tone}>{value}</b><span>{label}</span></div>;
}

function Evidence({ title, text, tone }: { title: string; text: string; tone: string }) {
  return <div className={`evidence ${tone}`}><small>{title}</small><p>{text}</p></div>;
}

function Condition({ label, text }: { label: string; text: string }) {
  return <div><small>{label}</small><p>{text}</p></div>;
}
