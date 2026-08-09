import type {
  MacroRelease,
  PublicStatement,
  ResearchIntakeQueueItem,
  Story,
  Update,
} from "@/lib/data";
import type { BreadthSnapshot, CrackSeries, MarketData, MarketSeries, PricePoint } from "@/lib/market";

export type MonitorState = "confirmed" | "not_confirmed" | "mixed" | "waiting" | "unavailable";
export type MonitorDirectness = "direct" | "context";

export type StoryMonitorPoint = {
  at: string;
  value: number;
  label?: string;
};

export type StoryMonitor = {
  id: string;
  storyId: string;
  storySlug: string;
  label: string;
  question: string;
  category: "physical_flow" | "market" | "macro" | "breadth" | "earnings" | "statement" | "video" | "social";
  directness: MonitorDirectness;
  state: MonitorState;
  stateLabel: string;
  current: string;
  previous?: string | null;
  baseline?: string | null;
  delta?: string | null;
  interpretation: string;
  sourceName: string;
  sourceUrl: string | null;
  observedAt: string | null;
  cadence: string;
  freshnessNote?: string | null;
  confirmationCondition: string | null;
  invalidationCondition: string | null;
  series?: StoryMonitorPoint[];
};

export type StoryQuestionAssessment = {
  state: MonitorState;
  label: string;
  answer: string;
  reason: string;
  updatedAt: string | null;
};

export type StoryMonitorPack = {
  storyId: string;
  storySlug: string;
  marketQuestion: string | null;
  assessment: StoryQuestionAssessment;
  monitors: StoryMonitor[];
  directMonitorCount: number;
  sourceCount: number;
};

type StoryMonitorContext = {
  story: Story;
  market: MarketData;
  macroReleases: MacroRelease[];
  statements: PublicStatement[];
  researchIntake: ResearchIntakeQueueItem[];
  updates: Update[];
};

type HormuzStatus = {
  asOf?: string;
  status?: string;
  verdict?: { status?: string; short?: string; long?: string; basis?: string };
  transits?: {
    count?: number;
    baseline?: number;
    throughputPct?: number;
    asOfDate?: string;
    asOfAgeDays?: number;
    cadence?: string;
  };
  dailyTransits?: {
    date?: string;
    nTotal?: number;
    nTanker?: number;
    nCargo?: number;
    previousNTotal?: number;
    previousDate?: string;
    preCrisisBaselineMedian?: number;
    updatedAt?: string;
  };
  insurance?: {
    multiple?: number;
    vlccPremiumLow?: number;
    vlccPremiumHigh?: number;
    sourceName?: string;
    sourceUrl?: string;
    updatedAt?: string;
  };
  carrierSuspensions?: Array<{
    carrier?: string;
    status?: string;
    hormuzPosture?: string;
    updatedAt?: string;
  }>;
  aisConcurrentInZone?: number;
  stranded?: number;
  strandedOffshore?: number;
  brent?: number;
  wti?: number;
  change24h?: number;
  oilAsOf?: string;
  hormuzIndex?: {
    crisisPressure?: { value?: number; band?: string; delta24h?: number; asOf?: string };
    escalationProbability?: { value?: number; band?: string; delta24h?: number; asOf?: string };
  };
};

type StoryRule = {
  marketSymbols?: string[];
  breadthId?: "large-cap" | "ai-basket" | "mag7";
  macroTerms?: RegExp[];
};

const HORMUZ_STORIES = new Set(["oil-physical-disruption", "refining-crack-spread-stress"]);

const STORY_RULES: Record<string, StoryRule> = {
  "refining-crack-spread-stress": { marketSymbols: ["CL=F", "BZ=F"], macroTerms: [/petroleum/i, /inventory/i] },
  "oil-physical-disruption": { marketSymbols: ["CL=F", "BZ=F"], macroTerms: [/petroleum/i, /inventory/i] },
  "fed-rate-repricing": { marketSymbols: ["^FVX", "^TNX", "UUP"], macroTerms: [/consumer price|\bcpi\b/i, /producer price|\bppi\b/i, /real earnings/i] },
  "productivity-labor-share": { marketSymbols: ["^GSPC", "RSP"], macroTerms: [/productivity/i, /real earnings/i, /retail sales/i] },
  "ai-capex-cash-conversion": { marketSymbols: ["SOXX", "AMD"], breadthId: "ai-basket" },
  "earnings-market-support": { marketSymbols: ["^GSPC", "RSP", "SOXX"], breadthId: "large-cap" },
  "yen-carry-unwind": { marketSymbols: ["JPY=X", "EWJ", "^TNX"], macroTerms: [/japan/i, /bank of japan/i] },
  "fed-long-end-stress": { marketSymbols: ["^TYX", "^TNX", "UUP"], macroTerms: [/consumer price|\bcpi\b/i, /producer price|\bppi\b/i] },
  "china-ai-pressure": { marketSymbols: ["SOXX", "NVDA", "AMD"], breadthId: "ai-basket" },
  "mag7-guidance-dispersion": { marketSymbols: ["MSFT", "GOOGL", "META"], breadthId: "mag7" },
  "market-breadth-health": { marketSymbols: ["^GSPC", "RSP", "SOXX"], breadthId: "large-cap" },
};

const ASSET_ALIASES: Record<string, string[]> = {
  USOIL: ["USOIL", "CL=F", "WTI"],
  UKOIL: ["UKOIL", "BZ=F", "BRENT"],
  DXY: ["DXY", "UUP"],
  SPX: ["SPX", "^GSPC", "SPY"],
  NASDAQ: ["NASDAQ", "^IXIC", "QQQ"],
  USDJPY: ["USDJPY", "JPY=X"],
  US30Y: ["US30Y", "^TYX"],
  US10Y: ["US10Y", "^TNX"],
  SOXX: ["SOXX"],
  RSP: ["RSP"],
};

function upper(value: string | null | undefined) {
  return String(value || "").trim().toUpperCase();
}

function expandedAssets(assets: string[]) {
  const result = new Set(assets.map(upper));
  for (const [key, aliases] of Object.entries(ASSET_ALIASES)) {
    if (result.has(key) || aliases.some((alias) => result.has(upper(alias)))) {
      aliases.forEach((alias) => result.add(upper(alias)));
      result.add(key);
    }
  }
  return result;
}

function intersectsStoryAssets(story: Story, assets: string[] | null | undefined) {
  if (!assets?.length || !story.assets?.length) return false;
  const storyAssets = expandedAssets(story.assets);
  const candidateAssets = expandedAssets(assets);
  return [...candidateAssets].some((asset) => storyAssets.has(asset));
}

function isoFromPoint(point: PricePoint | undefined) {
  if (!point) return null;
  return new Date(point.time * 1000).toISOString();
}

function chartPoints(points: PricePoint[], limit = 24): StoryMonitorPoint[] {
  return points.slice(-limit).map((point) => ({
    at: new Date(point.time * 1000).toISOString(),
    value: Number(point.close.toFixed(4)),
  }));
}

function formatNumber(value: number | null | undefined, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Unavailable";
  return value.toLocaleString("en-GB", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function formatPct(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function average(points: PricePoint[], limit: number) {
  const values = points.slice(-limit).map((point) => point.close).filter(Number.isFinite);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function fetchHormuzStatus(): Promise<HormuzStatus | null> {
  try {
    const response = await fetch("https://straits.live/status", {
      headers: { accept: "application/json", "user-agent": "Alchemy Markets Live Desk" },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function baseMonitor(story: Story, input: Omit<StoryMonitor, "storyId" | "storySlug" | "confirmationCondition" | "invalidationCondition">): StoryMonitor {
  return {
    ...input,
    storyId: story.id,
    storySlug: story.slug,
    confirmationCondition: story.confirmation_trigger,
    invalidationCondition: story.invalidation_trigger,
  };
}

function hormuzMonitors(story: Story, status: HormuzStatus | null): StoryMonitor[] {
  if (!status) {
    return [baseMonitor(story, {
      id: `${story.id}-hormuz-status`,
      label: "Strait of Hormuz physical monitor",
      question: "Has commercial activity returned to normal conditions?",
      category: "physical_flow",
      directness: "direct",
      state: "unavailable",
      stateLabel: "FEED UNAVAILABLE",
      current: "No live reading returned",
      interpretation: "Do not infer reopening from headlines while the physical feed is unavailable.",
      sourceName: "Straits.live",
      sourceUrl: "https://straits.live/",
      observedAt: null,
      cadence: "Live snapshot, polled every 60 seconds",
      freshnessNote: "The monitor failed closed rather than substituting an estimate.",
    })];
  }

  const transitCount = status.transits?.count ?? status.dailyTransits?.nTotal;
  const previousCount = status.dailyTransits?.previousNTotal;
  const baseline = status.transits?.baseline ?? status.dailyTransits?.preCrisisBaselineMedian;
  const throughput = status.transits?.throughputPct;
  const transitAt = status.dailyTransits?.updatedAt || (status.transits?.asOfDate ? `${status.transits.asOfDate}T00:00:00Z` : status.asOf || null);
  const verdict = status.verdict?.status || status.status || "unknown";
  const transitState: MonitorState = verdict === "open" ? "confirmed" : verdict === "closed" ? "not_confirmed" : "mixed";
  const disruptedCarriers = (status.carrierSuspensions || []).filter((item) => !["transiting", "normal"].includes(String(item.status || item.hormuzPosture || "").toLowerCase())).length;
  const carrierTotal = status.carrierSuspensions?.length || 0;
  const insuranceMultiple = status.insurance?.multiple;

  const transitSeries: StoryMonitorPoint[] = [];
  if (typeof previousCount === "number" && status.dailyTransits?.previousDate) transitSeries.push({ at: `${status.dailyTransits.previousDate}T00:00:00Z`, value: previousCount, label: "Previous published day" });
  if (typeof transitCount === "number" && status.dailyTransits?.date) transitSeries.push({ at: `${status.dailyTransits.date}T00:00:00Z`, value: transitCount, label: "Latest published day" });

  const monitors: StoryMonitor[] = [
    baseMonitor(story, {
      id: `${story.id}-hormuz-transits`,
      label: "Commercial transits",
      question: "Are repeated commercial crossings moving back toward pre-crisis normal?",
      category: "physical_flow",
      directness: "direct",
      state: transitState,
      stateLabel: transitState === "confirmed" ? "REOPENING CONFIRMED" : transitState === "not_confirmed" ? "NORMALISATION NOT CONFIRMED" : "PARTIAL / MIXED",
      current: typeof transitCount === "number" ? `${transitCount} vessels/day${typeof throughput === "number" ? ` · ${throughput}% of normal` : ""}` : "Unavailable",
      previous: typeof previousCount === "number" ? `${previousCount} vessels/day${status.dailyTransits?.previousDate ? ` on ${status.dailyTransits.previousDate}` : ""}` : null,
      baseline: typeof baseline === "number" ? `${baseline} vessels/day pre-crisis baseline` : null,
      delta: typeof transitCount === "number" && typeof previousCount === "number" ? `${transitCount - previousCount >= 0 ? "+" : ""}${transitCount - previousCount} versus previous published day` : null,
      interpretation: status.verdict?.long || "Commercial throughput remains the primary physical reopening test.",
      sourceName: "Straits.live / IMF PortWatch",
      sourceUrl: "https://straits.live/how-many-ships-passed-through-the-strait-of-hormuz-today",
      observedAt: transitAt,
      cadence: status.transits?.cadence ? `${status.transits.cadence} underlying transit series` : "IMF PortWatch daily series, re-fetched daily",
      freshnessNote: typeof status.transits?.asOfAgeDays === "number" ? `Latest PortWatch day is ${status.transits.asOfAgeDays} day(s) behind the current date.` : null,
      series: transitSeries,
    }),
    baseMonitor(story, {
      id: `${story.id}-hormuz-insurance`,
      label: "War-risk insurance",
      question: "Has the commercial cost of crossing normalised enough for operators to return?",
      category: "physical_flow",
      directness: "direct",
      state: typeof insuranceMultiple === "number" && insuranceMultiple <= 1.25 ? "confirmed" : typeof insuranceMultiple === "number" ? "not_confirmed" : "unavailable",
      stateLabel: typeof insuranceMultiple === "number" && insuranceMultiple <= 1.25 ? "NEAR NORMAL" : typeof insuranceMultiple === "number" ? "STILL STRESSED" : "UNAVAILABLE",
      current: typeof insuranceMultiple === "number" ? `${insuranceMultiple.toFixed(1)}× normal` : "Unavailable",
      baseline: "1.0× normal war-risk premium",
      delta: typeof status.insurance?.vlccPremiumLow === "number" && typeof status.insurance?.vlccPremiumHigh === "number" ? `$${status.insurance.vlccPremiumLow.toLocaleString("en-GB")} to $${status.insurance.vlccPremiumHigh.toLocaleString("en-GB")} cited VLCC voyage premium range` : null,
      interpretation: typeof insuranceMultiple === "number" && insuranceMultiple > 1.25 ? "Insurance remains far from peacetime conditions, so a diplomatic headline has not translated into normal commercial risk pricing." : "Insurance is moving closer to normal commercial conditions.",
      sourceName: status.insurance?.sourceName || "Straits.live market-risk monitor",
      sourceUrl: status.insurance?.sourceUrl || "https://straits.live/api",
      observedAt: status.insurance?.updatedAt || status.asOf || null,
      cadence: "Weekly underlying insurance review, live snapshot timestamp",
    }),
    baseMonitor(story, {
      id: `${story.id}-hormuz-carriers`,
      label: "Carrier posture",
      question: "Are major commercial carriers actually resuming normal Hormuz service?",
      category: "physical_flow",
      directness: "direct",
      state: carrierTotal && disruptedCarriers === 0 ? "confirmed" : carrierTotal ? "not_confirmed" : "unavailable",
      stateLabel: carrierTotal && disruptedCarriers === 0 ? "NORMAL SERVICE" : carrierTotal ? "REROUTING / LIMITS REMAIN" : "UNAVAILABLE",
      current: carrierTotal ? `${disruptedCarriers} of ${carrierTotal} tracked top carriers remain rerouted, limited or stopped` : "Unavailable",
      baseline: "Normal service without broad rerouting or suspension",
      interpretation: carrierTotal && disruptedCarriers > 0 ? "Carrier behaviour still contradicts a full physical reopening." : "Carrier behaviour no longer shows broad disruption.",
      sourceName: "Straits.live carrier advisories",
      sourceUrl: "https://straits.live/api",
      observedAt: status.asOf || null,
      cadence: "Carrier advisories reviewed weekly; snapshot refreshed continuously",
    }),
    baseMonitor(story, {
      id: `${story.id}-hormuz-ais`,
      label: "Live AIS pressure",
      question: "Is live vessel behaviour consistent with normal traffic rather than ships holding outside the route?",
      category: "physical_flow",
      directness: "direct",
      state: "mixed",
      stateLabel: "LIVE CONTEXT",
      current: `${status.aisConcurrentInZone ?? "?"} moving in Gulf watch box · ${status.strandedOffshore ?? "?"} holding offshore`,
      previous: null,
      baseline: null,
      interpretation: "AIS presence is a live overlay, not a substitute for PortWatch crossing counts. It is used to check whether vessel behaviour is improving between lagged transit releases.",
      sourceName: "Straits.live AIS overlay",
      sourceUrl: "https://straits.live/",
      observedAt: status.asOf || null,
      cadence: "AIS snapshot refreshed roughly every 30 minutes",
      freshnessNote: "Concurrent AIS counts and IMF daily transits measure different populations and are not divided into each other.",
    }),
  ];

  if (typeof status.brent === "number") {
    monitors.push(baseMonitor(story, {
      id: `${story.id}-hormuz-brent`,
      label: "Brent reaction",
      question: "Is market pricing removing the war premium before physical data confirms it?",
      category: "market",
      directness: "context",
      state: "mixed",
      stateLabel: "MARKET PRICING",
      current: `$${status.brent.toFixed(2)}${typeof status.change24h === "number" ? ` · ${status.change24h >= 0 ? "+" : ""}${status.change24h.toFixed(2)}% 24h` : ""}`,
      interpretation: "Crude can price diplomacy ahead of physical reopening. This monitor is context only and cannot confirm vessel normalisation by itself.",
      sourceName: "Straits.live oil monitor",
      sourceUrl: "https://straits.live/",
      observedAt: status.oilAsOf || status.asOf || null,
      cadence: "Intraday oil feed; market-hours dependent",
    }));
  }

  return monitors;
}

function marketSeriesMonitor(story: Story, series: MarketSeries, directness: MonitorDirectness = "context"): StoryMonitor {
  const currentPoint = series.points.at(-1);
  const priorPoint = series.points.at(-2);
  const current = series.last == null ? "Unavailable" : formatNumber(series.last, Math.abs(series.last) >= 100 ? 2 : 4);
  return baseMonitor(story, {
    id: `${story.id}-market-${series.symbol.replace(/[^a-z0-9]/gi, "").toLowerCase()}`,
    label: series.label,
    question: `Does ${series.label} confirm the Story mechanism?`,
    category: "market",
    directness,
    state: series.last == null ? "unavailable" : "mixed",
    stateLabel: series.last == null ? "UNAVAILABLE" : "PRICE CHECK",
    current: `${current}${formatPct(series.change5d) ? ` · ${formatPct(series.change5d)} 5d` : ""}`,
    previous: priorPoint ? formatNumber(priorPoint.close, Math.abs(priorPoint.close) >= 100 ? 2 : 4) : null,
    delta: formatPct(series.change21d) ? `${formatPct(series.change21d)} over 21 sessions` : null,
    interpretation: "Price is used as confirmation or contradiction, not as proof of the causal mechanism on its own.",
    sourceName: series.sourceName,
    sourceUrl: series.sourceUrl,
    observedAt: isoFromPoint(currentPoint),
    cadence: "Market-history refresh from the Live Desk market layer",
    series: chartPoints(series.points),
  });
}

function breadthMonitor(story: Story, breadth: BreadthSnapshot): StoryMonitor {
  const delta50 = breadth.current.above50 - breadth.weekAgo.above50;
  const isBreadthStory = story.slug === "market-breadth-health" || story.slug === "earnings-market-support";
  const state: MonitorState = isBreadthStory ? (delta50 > 0 ? "confirmed" : delta50 < 0 ? "not_confirmed" : "mixed") : "mixed";
  return baseMonitor(story, {
    id: `${story.id}-breadth-${breadth.id}`,
    label: breadth.label,
    question: "Is participation broadening or narrowing beneath the index?",
    category: "breadth",
    directness: "direct",
    state,
    stateLabel: delta50 > 0 ? "BREADTH IMPROVING" : delta50 < 0 ? "BREADTH NARROWING" : "BREADTH FLAT",
    current: `${breadth.current.above50.toFixed(0)}% above 50d · ${breadth.current.above200.toFixed(0)}% above 200d`,
    previous: `${breadth.weekAgo.above50.toFixed(0)}% above 50d one week ago`,
    delta: `${delta50 >= 0 ? "+" : ""}${delta50.toFixed(0)} pp in 50d breadth vs one week ago`,
    baseline: `${breadth.sampleSize}/${breadth.targetSize} names in current sample`,
    interpretation: delta50 > 0 ? "More names are participating than one week ago." : delta50 < 0 ? "Participation has weakened versus one week ago." : "Breadth has not materially changed versus one week ago.",
    sourceName: breadth.sourceName,
    sourceUrl: "https://www.nasdaq.com/market-activity",
    observedAt: breadth.current.asOf,
    cadence: "Daily market close",
  });
}

function crackMonitor(story: Story, crack: CrackSeries): StoryMonitor {
  const mean21 = average(crack.points, 21);
  const aboveMean = typeof crack.last === "number" && typeof mean21 === "number" ? crack.last >= mean21 : null;
  const state: MonitorState = aboveMean === true ? "confirmed" : aboveMean === false ? "not_confirmed" : "unavailable";
  return baseMonitor(story, {
    id: `${story.id}-crack-${crack.id}`,
    label: crack.label,
    question: "Are refinery margins still elevated enough to keep product tightness alive?",
    category: "market",
    directness: "direct",
    state,
    stateLabel: aboveMean === true ? "ABOVE 21D MEAN" : aboveMean === false ? "BELOW 21D MEAN" : "UNAVAILABLE",
    current: crack.last == null ? "Unavailable" : `$${formatNumber(crack.last, 2)}/bbl proxy${formatPct(crack.change5d) ? ` · ${formatPct(crack.change5d)} 5d` : ""}`,
    baseline: mean21 == null ? null : `$${formatNumber(mean21, 2)}/bbl 21-session mean`,
    delta: formatPct(crack.change21d) ? `${formatPct(crack.change21d)} over 21 sessions` : null,
    interpretation: aboveMean === true ? "The crack proxy is still above its own recent mean, consistent with persistent refined-product tightness." : aboveMean === false ? "The crack proxy has slipped below its recent mean, weakening the product-tightness signal." : "No usable crack history is available.",
    sourceName: crack.sourceName,
    sourceUrl: crack.sourceUrl,
    observedAt: isoFromPoint(crack.points.at(-1)),
    cadence: "EIA daily spot prices",
    freshnessNote: crack.formula,
    series: chartPoints(crack.points),
  });
}

function macroMonitor(story: Story, release: MacroRelease): StoryMonitor {
  const released = Boolean(release.actual) || /released|published|complete/i.test(release.status || "");
  return baseMonitor(story, {
    id: `${story.id}-macro-${release.id}`,
    label: release.release_name,
    question: release.watch_question || `Does ${release.release_name} change the Story?`,
    category: "macro",
    directness: "direct",
    state: released ? "mixed" : "waiting",
    stateLabel: released ? "DIRECT TEST RELEASED" : "AWAITING RELEASE",
    current: released ? `Actual ${release.actual || "n/a"} · consensus ${release.consensus || "n/a"}` : `${release.release_date} · ${release.release_time_label}`,
    previous: release.revised_previous || release.previous ? `Previous ${release.revised_previous || release.previous}` : null,
    baseline: release.consensus ? `Consensus ${release.consensus}` : null,
    interpretation: release.market_interpretation || (released ? "The release is live and should now be reconciled with price and the Story's confirmation conditions." : "This is a direct scheduled test. No conclusion should be forced before the release."),
    sourceName: release.agency,
    sourceUrl: release.source_url,
    observedAt: release.published_at || `${release.release_date}T00:00:00Z`,
    cadence: release.frequency || "Scheduled release",
  });
}

function statementMonitor(story: Story, statement: PublicStatement, directness: MonitorDirectness = "context"): StoryMonitor {
  return baseMonitor(story, {
    id: `${story.id}-statement-${statement.id}`,
    label: `Statement: ${statement.speaker}`,
    question: "Has an official or verified statement changed the operational test?",
    category: "statement",
    directness,
    state: "mixed",
    stateLabel: statement.verification_status.toUpperCase().replaceAll("_", " "),
    current: statement.quote_excerpt,
    interpretation: statement.market_interpretation || "Statement recorded. Physical and market monitors still decide whether the thesis changes.",
    sourceName: statement.channel,
    sourceUrl: statement.source_url,
    observedAt: statement.statement_date,
    cadence: "Event-driven statement monitor",
    freshnessNote: statement.follow_up,
  });
}

function videoMonitor(story: Story, item: ResearchIntakeQueueItem): StoryMonitor {
  const ready = item.transcript_status === "ready";
  return baseMonitor(story, {
    id: `${story.id}-video-${item.id}`,
    label: `YouTube: ${item.publisher}`,
    question: "Has a monitored video introduced evidence that changes the case?",
    category: "video",
    directness: "context",
    state: ready ? "mixed" : "waiting",
    stateLabel: ready ? "TRANSCRIPT READY" : "TRANSCRIPT PENDING",
    current: item.title,
    interpretation: item.divergence_note || item.summary || "Video intake is context until its claims are verified against stronger sources or direct data.",
    sourceName: item.publisher,
    sourceUrl: item.url,
    observedAt: item.published_at,
    cadence: "XWADA video intake schedule",
    freshnessNote: `${item.transcript_word_count || 0} transcript words · ${item.recommended_action}`,
  });
}

function socialMonitor(story: Story, statement: PublicStatement | null): StoryMonitor {
  if (!statement) {
    return baseMonitor(story, {
      id: `${story.id}-social-watch`,
      label: "Verified X / social statement monitor",
      question: "Has a verified primary-source social post changed the case?",
      category: "social",
      directness: "context",
      state: "waiting",
      stateLabel: "NO VERIFIED X SIGNAL",
      current: "No relevant verified X/Twitter-origin statement is stored for this Story.",
      interpretation: "The monitor stays empty rather than substituting unverified social chatter.",
      sourceName: "Alchemy public-statement registry",
      sourceUrl: null,
      observedAt: null,
      cadence: "Event-driven",
    });
  }
  return baseMonitor(story, {
    id: `${story.id}-social-${statement.id}`,
    label: `Verified social: ${statement.speaker}`,
    question: "Has a verified primary-source social post changed the case?",
    category: "social",
    directness: "context",
    state: "mixed",
    stateLabel: statement.verification_status.toUpperCase().replaceAll("_", " "),
    current: statement.quote_excerpt,
    interpretation: statement.market_interpretation || "Social statement captured. Direct statistical or physical confirmation remains separate.",
    sourceName: statement.channel,
    sourceUrl: statement.source_url,
    observedAt: statement.statement_date,
    cadence: "Event-driven",
  });
}

function latestMacroForStory(story: Story, releases: MacroRelease[], rules: StoryRule) {
  const patterns = rules.macroTerms || [];
  const relevant = releases.filter((release) => {
    const name = `${release.release_name} ${release.category} ${release.watch_question}`;
    return patterns.some((pattern) => pattern.test(name)) || intersectsStoryAssets(story, release.affected_assets);
  });
  const now = Date.now();
  relevant.sort((a, b) => {
    const aTime = Date.parse(`${a.release_date}T00:00:00Z`);
    const bTime = Date.parse(`${b.release_date}T00:00:00Z`);
    const aFuture = aTime >= now - 48 * 60 * 60 * 1000;
    const bFuture = bTime >= now - 48 * 60 * 60 * 1000;
    if (aFuture !== bFuture) return aFuture ? -1 : 1;
    return aFuture ? aTime - bTime : bTime - aTime;
  });
  return relevant[0] || null;
}

function latestStatementForStory(story: Story, statements: PublicStatement[]) {
  const keywords = `${story.title} ${story.market_question || ""}`.toLowerCase().split(/\W+/).filter((token) => token.length > 4);
  return [...statements]
    .filter((statement) => intersectsStoryAssets(story, statement.affected_assets) || keywords.some((word) => `${statement.topic} ${statement.market_interpretation || ""}`.toLowerCase().includes(word)))
    .sort((a, b) => Date.parse(b.statement_date) - Date.parse(a.statement_date))[0] || null;
}

function latestSocialForStory(story: Story, statements: PublicStatement[]) {
  return [...statements]
    .filter((statement) => /(^|\W)(x|twitter)(\W|$)/i.test(statement.channel) || /(^|\.)x\.com|twitter\.com/i.test(statement.source_url))
    .filter((statement) => intersectsStoryAssets(story, statement.affected_assets))
    .sort((a, b) => Date.parse(b.statement_date) - Date.parse(a.statement_date))[0] || null;
}

function latestVideoForStory(story: Story, items: ResearchIntakeQueueItem[]) {
  return [...items]
    .filter((item) => item.item_type === "video" && item.affected_story_slugs?.includes(story.slug))
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))[0] || null;
}

function genericAssessment(story: Story, monitors: StoryMonitor[]): StoryQuestionAssessment {
  const direct = monitors.filter((monitor) => monitor.directness === "direct" && monitor.state !== "unavailable");
  const confirmed = direct.filter((monitor) => monitor.state === "confirmed").length;
  const notConfirmed = direct.filter((monitor) => monitor.state === "not_confirmed").length;
  const waiting = direct.filter((monitor) => monitor.state === "waiting").length;
  const updatedAt = direct.map((monitor) => monitor.observedAt).filter((value): value is string => Boolean(value)).sort().at(-1) || null;

  if (!direct.length) {
    return { state: "waiting", label: "DIRECT TEST MISSING", answer: "The case is not ready for a monitor-driven conclusion.", reason: "No current direct statistical or physical monitor is available for the Story's explicit question.", updatedAt };
  }
  if (notConfirmed > 0 && confirmed === 0) {
    return { state: "not_confirmed", label: "NOT CONFIRMED", answer: "The current direct monitors do not confirm the Story's required condition.", reason: `${notConfirmed} direct monitor${notConfirmed === 1 ? "" : "s"} currently run against confirmation.`, updatedAt };
  }
  if (confirmed > 0 && notConfirmed === 0 && waiting === 0) {
    return { state: "confirmed", label: "CONFIRMATION BUILDING", answer: "The direct monitors currently lean toward confirmation.", reason: `${confirmed} direct monitor${confirmed === 1 ? "" : "s"} support the required condition.`, updatedAt };
  }
  return { state: waiting && confirmed === 0 && notConfirmed === 0 ? "waiting" : "mixed", label: waiting && confirmed === 0 && notConfirmed === 0 ? "WAITING FOR TEST" : "MIXED", answer: waiting && confirmed === 0 && notConfirmed === 0 ? "The decisive release or observation has not arrived yet." : "The monitors disagree or remain incomplete.", reason: `${confirmed} confirming · ${notConfirmed} not confirming · ${waiting} waiting.`, updatedAt };
}

function hormuzAssessment(story: Story, status: HormuzStatus | null, monitors: StoryMonitor[]): StoryQuestionAssessment {
  if (!status) return genericAssessment(story, monitors);
  const verdict = status.verdict?.status || status.status;
  const count = status.transits?.count ?? status.dailyTransits?.nTotal;
  const baseline = status.transits?.baseline ?? status.dailyTransits?.preCrisisBaselineMedian;
  const throughput = status.transits?.throughputPct;
  const insurance = status.insurance?.multiple;
  const disrupted = (status.carrierSuspensions || []).filter((item) => !["transiting", "normal"].includes(String(item.status || item.hormuzPosture || "").toLowerCase())).length;
  const updatedAt = status.asOf || monitors.map((monitor) => monitor.observedAt).filter((value): value is string => Boolean(value)).sort().at(-1) || null;

  if (verdict === "open") {
    return { state: "confirmed", label: "PHYSICAL REOPENING CONFIRMED", answer: "Yes. The source's operational verdict has moved to open.", reason: `${count ?? "?"} daily transits versus ${baseline ?? "?"} pre-crisis, ${insurance ?? "?"}× insurance, ${disrupted} disrupted carrier postures.`, updatedAt };
  }
  if (verdict === "closed") {
    return { state: "not_confirmed", label: "PHYSICAL REOPENING NOT CONFIRMED", answer: "No. Diplomatic de-escalation is not yet showing up as normal commercial activity.", reason: `${count ?? "?"} transits/day${typeof throughput === "number" ? ` (${throughput}% of normal)` : ""}, insurance ${insurance ?? "?"}× normal, ${disrupted} tracked carriers still disrupted.`, updatedAt };
  }
  return { state: "mixed", label: "PHYSICAL PICTURE MIXED", answer: "Some activity is visible, but the source does not classify the Strait as normally open.", reason: `${count ?? "?"} transits/day versus ${baseline ?? "?"} pre-crisis; insurance ${insurance ?? "?"}× normal.`, updatedAt };
}

function refiningAssessment(story: Story, monitors: StoryMonitor[]): StoryQuestionAssessment {
  const cracks = monitors.filter((monitor) => monitor.id.includes("-crack-"));
  const crude = monitors.find((monitor) => monitor.id.endsWith("-market-clf"));
  const crackConfirmed = cracks.filter((monitor) => monitor.state === "confirmed").length;
  const crackNotConfirmed = cracks.filter((monitor) => monitor.state === "not_confirmed").length;
  const crudeDown = crude?.delta?.startsWith("-") || /· -/.test(crude?.current || "");
  const updatedAt = monitors.map((monitor) => monitor.observedAt).filter((value): value is string => Boolean(value)).sort().at(-1) || null;

  if (crudeDown && crackConfirmed > 0 && crackNotConfirmed === 0) {
    return { state: "confirmed", label: "DIVERGENCE CONFIRMING", answer: "Yes, the crude-versus-products divergence is currently visible.", reason: `Crude is softer while ${crackConfirmed} tracked crack proxy${crackConfirmed === 1 ? " remains" : " remain"} above its 21-session mean.`, updatedAt };
  }
  if (crackNotConfirmed === cracks.length && cracks.length) {
    return { state: "not_confirmed", label: "PRODUCT STRESS EASING", answer: "The product-tightness confirmation is weakening.", reason: "The tracked crack proxies are below their own 21-session means.", updatedAt };
  }
  return genericAssessment(story, monitors);
}

export async function getStoryMonitorPack(context: StoryMonitorContext, sharedHormuzStatus?: HormuzStatus | null): Promise<StoryMonitorPack> {
  const { story, market, macroReleases, statements, researchIntake } = context;
  const rule = STORY_RULES[story.slug] || {};
  const monitors: StoryMonitor[] = [];
  let hormuzStatus: HormuzStatus | null = sharedHormuzStatus ?? null;

  if (HORMUZ_STORIES.has(story.slug)) {
    if (sharedHormuzStatus === undefined) hormuzStatus = await fetchHormuzStatus();
    monitors.push(...hormuzMonitors(story, hormuzStatus));
  }

  if (story.slug === "refining-crack-spread-stress") {
    market.cracks.forEach((crack) => monitors.push(crackMonitor(story, crack)));
  }

  if (rule.breadthId) {
    const breadth = market.breadth.find((item) => item.id === rule.breadthId);
    if (breadth) monitors.push(breadthMonitor(story, breadth));
  }

  const selectedSymbols = new Set(rule.marketSymbols || []);
  if (!selectedSymbols.size) {
    const expanded = expandedAssets(story.assets || []);
    market.series.forEach((series) => { if (expanded.has(upper(series.symbol))) selectedSymbols.add(series.symbol); });
  }
  for (const symbol of [...selectedSymbols].slice(0, 3)) {
    const series = market.series.find((item) => item.symbol === symbol);
    if (series) monitors.push(marketSeriesMonitor(story, series, story.slug === "market-breadth-health" ? "context" : "context"));
  }

  const macro = latestMacroForStory(story, macroReleases, rule);
  if (macro) monitors.push(macroMonitor(story, macro));

  const statement = latestStatementForStory(story, statements);
  if (statement) monitors.push(statementMonitor(story, statement));

  const video = latestVideoForStory(story, researchIntake);
  if (video) monitors.push(videoMonitor(story, video));

  monitors.push(socialMonitor(story, latestSocialForStory(story, statements)));

  const directMonitorCount = monitors.filter((monitor) => monitor.directness === "direct" && monitor.state !== "unavailable").length;
  const sourceCount = new Set(monitors.map((monitor) => monitor.sourceUrl || monitor.sourceName).filter(Boolean)).size;
  const assessment = story.slug === "oil-physical-disruption"
    ? hormuzAssessment(story, hormuzStatus, monitors)
    : story.slug === "refining-crack-spread-stress"
      ? refiningAssessment(story, monitors)
      : genericAssessment(story, monitors);

  return {
    storyId: story.id,
    storySlug: story.slug,
    marketQuestion: story.market_question,
    assessment,
    monitors,
    directMonitorCount,
    sourceCount,
  };
}

export async function getAllStoryMonitorPacks({
  stories,
  market,
  macroReleases,
  statements,
  researchIntake,
  updates,
}: {
  stories: Story[];
  market: MarketData;
  macroReleases: MacroRelease[];
  statements: PublicStatement[];
  researchIntake: ResearchIntakeQueueItem[];
  updates: Update[];
}) {
  const needsHormuz = stories.some((story) => HORMUZ_STORIES.has(story.slug));
  const hormuzStatus = needsHormuz ? await fetchHormuzStatus() : null;
  return Promise.all(stories.map((story) => getStoryMonitorPack({ story, market, macroReleases, statements, researchIntake, updates }, hormuzStatus)));
}
