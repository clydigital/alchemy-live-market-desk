// @ts-nocheck
// Hybrid source parity; projection only, no new canonical reasoning writes.
import { canonicalReasoning, canonicalSeriesRefs } from "./canonical-visuals";

const DOMAIN_RULES = [
  { test: /yen|carry|jpy/, name: "Yen" },
  { test: /oil|hormuz|crude|refin/, name: "Oil" },
  { test: /breadth/, name: "Breadth" },
  { test: /fed|rate|yield|long.end/, name: "Rates" },
  { test: /ai|capex|mag7|china|earnings|semi/, name: "AI" },
];

const SERIES_META = {
  cpi_all: { label: "Headline CPI y/y", unit: "%", sourceName: "U.S. Bureau of Labor Statistics", sourceUrl: "https://www.bls.gov/cpi/" },
  cpi_core: { label: "Core CPI y/y", unit: "%", sourceName: "U.S. Bureau of Labor Statistics", sourceUrl: "https://www.bls.gov/cpi/" },
  ppi_final_demand: { label: "PPI final demand y/y", unit: "%", sourceName: "U.S. Bureau of Labor Statistics", sourceUrl: "https://www.bls.gov/ppi/" },
  qqq: { label: "Nasdaq-100 monthly move", unit: "%", sourceName: "Nasdaq official history", sourceUrl: "https://www.nasdaq.com/market-activity/etf/qqq/historical" },
  spy: { label: "S&P 500 monthly move", unit: "%", sourceName: "Nasdaq official history", sourceUrl: "https://www.nasdaq.com/market-activity/etf/spy/historical" },
  uso: { label: "Oil proxy monthly move", unit: "%", sourceName: "Nasdaq official history", sourceUrl: "https://www.nasdaq.com/market-activity/etf/uso/historical" },
  usdjpy: { label: "USD/JPY monthly move", unit: "%", sourceName: "European Central Bank", sourceUrl: "https://data.ecb.europa.eu/data/datasets/EXR" },
  us2y: { label: "U.S. 2-year yield", unit: "%", sourceName: "U.S. Treasury", sourceUrl: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates" },
  us10y: { label: "U.S. 10-year yield", unit: "%", sourceName: "U.S. Treasury", sourceUrl: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates" },
};

function normalizedAsset(value = "") { return String(value).toUpperCase().replace(/^\^/, "").replace(/=F$|=X$/, "").replace(/[^A-Z0-9]/g, ""); }
function normalizedSeries(value = "") { return String(value).toLowerCase(); }

// Cosmetic taxonomy only. This value must never select evidence, series or related Stories.
export function storyDomain(story) {
  const text = `${story?.slug || ""} ${story?.title || ""} ${story?.market_question || story?.marketQuestion || ""}`.toLowerCase();
  return DOMAIN_RULES.find((rule) => rule.test.test(text)) || { name: "Cross-asset" };
}

function relatedStateModules(story, feed) {
  const modules = feed?.marketState || [];
  const exact = modules.filter((item) => item.storySlug === story.slug);
  if (exact.length) return exact;
  const assets = new Set((story.assets || []).map(normalizedAsset));
  if (!assets.size) return [];
  return modules.filter((item) => (item.symbols || []).some((symbol) => assets.has(normalizedAsset(symbol))));
}

function latestSeriesSnapshot(ref, macroObservations, marketObservations) {
  const key = normalizedSeries(ref.seriesId);
  const meta = SERIES_META[key] || { label: ref.label || ref.seriesId, unit: "", sourceName: null, sourceUrl: null };
  const label = ref.label || meta.label;
  const macro = (macroObservations || []).filter((item) => normalizedSeries(item.series_key || item.series_id) === key).sort((a, b) => new Date(a.observation_date) - new Date(b.observation_date));
  if (macro.length) {
    const current = macro.at(-1), previous = macro.at(-2);
    const value = Number(current.yoy_change ?? current.mom_change ?? current.value);
    const priorValue = previous ? Number(previous.yoy_change ?? previous.mom_change ?? previous.value) : null;
    return Number.isFinite(value) ? { key: ref.seriesId, ...meta, label, value, change: Number.isFinite(priorValue) ? value - priorValue : null, date: current.observation_date, observations: macro.length } : null;
  }
  const market = (marketObservations || []).filter((item) => normalizedSeries(item.series_key || item.series_id) === key).sort((a, b) => new Date(a.observation_date) - new Date(b.observation_date));
  if (market.length < 2) return null;
  const current = market.at(-1), previous = market.at(-2), value = Number(current.close), priorValue = Number(previous.close);
  if (!Number.isFinite(value) || !Number.isFinite(priorValue) || priorValue === 0) return null;
  const change = /us2y|us10y|yield/.test(key) ? value - priorValue : ((value / priorValue) - 1) * 100;
  return /us2y|us10y|yield/.test(key)
    ? { key: ref.seriesId, ...meta, label, value, change, date: current.observation_date, observations: market.length }
    : { key: ref.seriesId, ...meta, label, value: change, change: null, level: value, date: current.observation_date, observations: market.length };
}

export function storiesToWatch(story, stories) {
  const currentAssets = new Set((story.assets || []).map(normalizedAsset));
  if (!currentAssets.size) return [];
  return (stories || [])
    .filter((item) => item.id !== story.id && item.status !== "archived")
    .map((item) => ({ item, overlaps: (item.assets || []).filter((asset) => currentAssets.has(normalizedAsset(asset))) }))
    .filter(({ overlaps }) => overlaps.length > 0)
    .map(({ item, overlaps }) => ({
      ...item,
      awarenessScore: overlaps.length * 4 + (item.rank ? Math.max(0, 4 - item.rank) : 0),
      awarenessReason: `${overlaps.slice(0, 3).join(" / ")} explicit asset overlap`,
      displayQuestion: item.market_question || item.marketQuestion || null,
    }))
    .sort((a, b) => b.awarenessScore - a.awarenessScore || (b.confidence || 0) - (a.confidence || 0))
    .slice(0, 3);
}

function canonicalStory(feed, story) { return (feed?.canonical?.storyStates || []).find((item) => item.id === story.id || item.slug === story.slug) || story; }
function canonicalDeltas(feed, story) {
  return (feed?.materialDeltas || []).filter((item) => item.storyId === story.id || item.storySlug === story.slug).slice(0, 7).map((item) => ({
    id: item.id, type: "Desk event", headline: item.headline, detail: item.detail || "Canonical Live Desk event.", publishedAt: item.eventAt, sourceName: "Alchemy Live Desk", sourceUrl: null, signal: null, impact: item.impact || null, confidenceDelta: item.confidenceDelta ?? null, canonical: item.canonical !== false,
  }));
}

export function buildResearchAssessment({ story, feed, macroObservations = [], marketObservations = [], stories = [] }) {
  const deskStory = canonicalStory(feed, story);
  const accuracy = feed?.accuracy || { status: "warning", score: 0, updateGate: "review", summary: "No canonical market-data integrity report accompanied this feed.", checks: [] };
  const statistics = relatedStateModules(deskStory, feed);
  const narrative = canonicalDeltas(feed, deskStory);
  const divergences = (feed?.research?.divergences || []).filter((item) => (item.affected_story_slugs || []).includes(deskStory.slug));
  const divergence = divergences.length > 0;
  const dataGap = !statistics.length || statistics.every((item) => item.direction === "Data gap");
  const accuracyGateOpen = accuracy.status !== "fail";
  const dataIntegrityState = accuracy.status === "pass" ? "healthy" : accuracy.status === "fail" ? "degraded" : "review";
  const refs = canonicalSeriesRefs(deskStory);
  const series = refs.map((ref) => latestSeriesSnapshot(ref, macroObservations, marketObservations)).filter(Boolean);
  const confidence = Number(deskStory.confidence ?? story.confidence) || 50;
  const outcome = deskStory.strongestContradiction ? `Live Desk contradiction: ${deskStory.strongestContradiction}` : deskStory.bestExplanation || deskStory.thesis || "The Live Desk has not published a deeper interpretation for this story yet.";
  const reasoning = canonicalReasoning(deskStory);

  return {
    story: deskStory,
    baseConfidence: confidence,
    adjustedConfidence: confidence,
    adjustment: 0,
    statistics,
    statLean: "Mixed",
    statStrength: 0,
    narrative,
    newsLean: "Mixed",
    divergence,
    agreement: false,
    rawDivergence: divergence,
    rawAgreement: false,
    dataGap,
    accuracy,
    accuracyGateOpen,
    dataIntegrityState,
    outcome,
    series,
    relatedStories: storiesToWatch(deskStory, stories),
    generatedAt: feed?.generatedAt || null,
    marketUpdatedAt: feed?.marketUpdatedAt || null,
    domain: storyDomain(deskStory).name,
    interpretationOwner: "live-desk",
    thesisVersion: deskStory.thesisVersion || deskStory.thesis_version || null,
    causalEdges: reasoning?.causalChain || [],
    assetImpacts: reasoning?.assetImplications || [],
  };
}
