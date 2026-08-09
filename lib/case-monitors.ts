import type {
  MacroSeriesObservation,
  MarketSeriesObservation,
  PublicStatement,
  ResearchIntakeQueueItem,
  Story,
} from "@/lib/data";

export type CaseMonitorState = "confirming" | "contradicting" | "unresolved" | "coverage_gap";

export type CaseMonitorMetric = {
  id: string;
  label: string;
  kind: "physical" | "market" | "macro" | "spread" | "statement" | "research" | "coverage_gap";
  state: CaseMonitorState;
  current: string | null;
  previous: string | null;
  delta: string | null;
  asOf: string | null;
  cadence: string;
  sourceName: string;
  sourceUrl: string | null;
  question: string;
  interpretation: string;
  confirmationCondition: string | null;
  invalidationCondition: string | null;
  provenance: string;
};

export type CaseMonitorSignal = {
  id: string;
  kind: "statement" | "x" | "youtube" | "research";
  label: string;
  headline: string;
  detail: string | null;
  asOf: string | null;
  sourceName: string;
  sourceUrl: string | null;
  verification: string | null;
};

export type CaseMonitorBoard = {
  storyId: string;
  storySlug: string;
  question: string;
  state: CaseMonitorState;
  stateLabel: string;
  summary: string;
  updatedAt: string;
  metrics: CaseMonitorMetric[];
  signals: CaseMonitorSignal[];
  gaps: string[];
};

type MonitorData = {
  stories: Story[];
  macroObservations: MacroSeriesObservation[];
  marketObservations: MarketSeriesObservation[];
  statements: PublicStatement[];
  researchIntake: ResearchIntakeQueueItem[];
};

type SeriesSpec = {
  key: string;
  label: string;
  kind: "market" | "macro";
  question: string;
  confirmation: string;
  invalidation: string;
  cadence?: string;
};

type GapSpec = {
  label: string;
  question: string;
  sourceName: string;
  sourceUrl?: string;
  cadence: string;
};

const STRAITS_STATUS_URL = "https://straits.live/status";
const STRAITS_TRANSITS_URL = "https://straits.live/api/v1/transits?history=1&limit=30";
const STRAITS_SITE_URL = "https://straits.live/";

const seriesSpecs: Record<string, SeriesSpec[]> = {
  "refining-crack-spread-stress": [
    { key: "uso", label: "Crude proxy · USO", kind: "market", question: "Is crude still falling while physical/product stress remains elevated?", confirmation: "Crude stays soft while product and physical-flow monitors remain stressed.", invalidation: "Crude and product stress normalise together.", cadence: "Daily market close" },
  ],
  "fed-rate-repricing": [
    { key: "us2y", label: "US 2Y yield", kind: "market", question: "Is the front end validating a softer Fed path?", confirmation: "The 2Y yield remains below its pre-payroll level into CPI.", invalidation: "The 2Y yield reverses sharply higher as hike pricing rebuilds.", cadence: "Daily market close" },
    { key: "uup", label: "USD proxy · UUP", kind: "market", question: "Is the dollar confirming renewed policy restriction?", confirmation: "USD stays soft while front-end yields remain lower.", invalidation: "USD and front-end yields turn higher together.", cadence: "Daily market close" },
    { key: "nfp", label: "Nonfarm payroll change", kind: "macro", question: "Is labour soft enough to constrain another hike?", confirmation: "Payroll growth remains weak or negative after revisions.", invalidation: "Employment rebounds materially without a renewed inflation impulse.", cadence: "Monthly release" },
    { key: "cpi_core", label: "Core CPI", kind: "macro", question: "Does inflation stay hot enough to override labour weakness?", confirmation: "Core inflation continues to cool or undershoots expectations.", invalidation: "A materially hot CPI rebuilds September hike odds.", cadence: "Monthly release" },
  ],
  "oil-physical-disruption": [
    { key: "uso", label: "Crude proxy · USO", kind: "market", question: "Is the market still removing war premium before physical reopening is verified?", confirmation: "Crude falls while Strait activity remains below normal.", invalidation: "Crude reprices higher as physical disruption worsens.", cadence: "Daily market close" },
  ],
  "productivity-labor-share": [
    { key: "nfp", label: "Nonfarm payroll change", kind: "macro", question: "Is labour income participation weakening while productivity remains firm?", confirmation: "Employment growth stays weak and real-income data deteriorates.", invalidation: "Employment and real earnings rebound without an inflation shock.", cadence: "Monthly release" },
    { key: "cpi_all", label: "Headline CPI", kind: "macro", question: "Are household real incomes being helped or hurt by inflation?", confirmation: "Inflation cools but labour income remains weak.", invalidation: "Real income improves alongside stronger labour demand.", cadence: "Monthly release" },
  ],
  "ai-capex-cash-conversion": [
    { key: "qqq", label: "Nasdaq-100 proxy · QQQ", kind: "market", question: "Does AI equity pressure persist after the discount-rate shock eases?", confirmation: "AI-heavy equities weaken despite stable or lower yields.", invalidation: "AI-heavy equities sustain gains as yields fall and demand remains firm.", cadence: "Daily market close" },
    { key: "us10y", label: "US 10Y yield", kind: "market", question: "Is valuation pressure coming mainly from the discount rate?", confirmation: "Yields fall but AI equities still fail to recover.", invalidation: "Falling yields are followed by durable AI-equity recovery.", cadence: "Daily market close" },
  ],
  "earnings-market-support": [
    { key: "spy", label: "S&P 500 proxy · SPY", kind: "market", question: "Are strong results translating into broad index support?", confirmation: "The index holds gains as positive earnings reactions broaden.", invalidation: "Good results are sold while rates and volatility rise.", cadence: "Daily market close" },
    { key: "qqq", label: "Nasdaq-100 proxy · QQQ", kind: "market", question: "Is earnings support concentrated in duration-heavy megacaps?", confirmation: "QQQ and broader participation improve together.", invalidation: "QQQ holds while broader participation deteriorates.", cadence: "Daily market close" },
  ],
  "yen-carry-unwind": [
    { key: "usdjpy", label: "USDJPY", kind: "market", question: "Is the yen retaining strength after intervention and policy pressure?", confirmation: "USDJPY makes lower highs while other yen crosses also weaken.", invalidation: "USDJPY and other yen crosses recover above long-term trend bands.", cadence: "Daily market close" },
    { key: "us2y", label: "US 2Y yield", kind: "market", question: "Is US front-end compression reducing the carry advantage?", confirmation: "The US 2Y yield falls while JPY remains firm.", invalidation: "The US 2Y yield rises and yen weakness resumes.", cadence: "Daily market close" },
    { key: "us10y", label: "US 10Y yield", kind: "market", question: "Is broader US rate pressure rebuilding carry demand?", confirmation: "US yields soften alongside broader yen strength.", invalidation: "US yields rise and carry crosses recover together.", cadence: "Daily market close" },
  ],
  "fed-long-end-stress": [
    { key: "us10y", label: "US 10Y yield", kind: "market", question: "Is the long end staying restrictive despite softer growth data?", confirmation: "Long yields remain elevated while growth data softens.", invalidation: "Long yields fall decisively as energy and inflation expectations cool.", cadence: "Daily market close" },
    { key: "us2y", label: "US 2Y yield", kind: "market", question: "Is stress coming from Fed repricing or the long end?", confirmation: "The long end stays firm while the 2Y softens.", invalidation: "Both front and long yields decline together.", cadence: "Daily market close" },
    { key: "tlt", label: "Long Treasury proxy · TLT", kind: "market", question: "Are long-duration bonds confirming persistent term-premium stress?", confirmation: "TLT stays weak as long yields remain elevated.", invalidation: "TLT recovers as long yields reverse lower.", cadence: "Daily market close" },
  ],
  "china-ai-pressure": [
    { key: "qqq", label: "Nasdaq-100 proxy · QQQ", kind: "market", question: "Is cheaper Chinese AI translating into pressure on Western AI valuations?", confirmation: "Western AI equities lag while Chinese model cost/usage signals improve.", invalidation: "Western AI demand and pricing remain firm despite cheaper models.", cadence: "Daily market close" },
  ],
  "mag7-guidance-dispersion": [
    { key: "qqq", label: "Nasdaq-100 proxy · QQQ", kind: "market", question: "Is the market rewarding guidance quality faster than capital burden rises?", confirmation: "Positive guidance revisions produce durable post-earnings gains.", invalidation: "Higher capex is repeatedly sold despite headline beats.", cadence: "Daily market close" },
  ],
  "market-breadth-health": [
    { key: "spy", label: "S&P 500 proxy · SPY", kind: "market", question: "Is headline index strength holding?", confirmation: "SPY strength is accompanied by improving breadth measures.", invalidation: "SPY makes highs while breadth weakens.", cadence: "Daily market close" },
    { key: "qqq", label: "Nasdaq-100 proxy · QQQ", kind: "market", question: "Is leadership becoming more concentrated in large technology?", confirmation: "QQQ strength is matched by equal-weight and breadth improvement.", invalidation: "QQQ outperforms while breadth deteriorates.", cadence: "Daily market close" },
  ],
};

const gapSpecs: Record<string, GapSpec[]> = {
  "refining-crack-spread-stress": [
    { label: "Diesel crack spread", question: "Are distillate margins normalising with crude?", sourceName: "EIA / futures-derived crack series", cadence: "Daily / weekly" },
    { label: "Gasoline crack spread", question: "Are gasoline margins normalising with crude?", sourceName: "EIA / futures-derived crack series", cadence: "Daily / weekly" },
    { label: "Refinery runs + product inventories", question: "Is physical product supply recovering?", sourceName: "EIA Weekly Petroleum Status Report", sourceUrl: "https://www.eia.gov/petroleum/supply/weekly/", cadence: "Weekly" },
  ],
  "fed-rate-repricing": [
    { label: "September Fed probability", question: "Has hike probability rebuilt above the Story's invalidation threshold?", sourceName: "CME FedWatch / fed-funds futures", cadence: "Intraday" },
  ],
  "productivity-labor-share": [
    { label: "Productivity + unit labour costs", question: "Are margins improving because output rises faster than labour cost?", sourceName: "U.S. Bureau of Labor Statistics", sourceUrl: "https://www.bls.gov/productivity/", cadence: "Quarterly" },
    { label: "Real earnings + retail sales", question: "Are households actually losing spending power?", sourceName: "BLS / U.S. Census Bureau", cadence: "Monthly" },
  ],
  "ai-capex-cash-conversion": [
    { label: "AI capex vs free cash flow", question: "Which firms are converting AI investment into cash and guidance?", sourceName: "Company filings and earnings calls", cadence: "Earnings cycle" },
  ],
  "earnings-market-support": [
    { label: "Equal-weight breadth · RSP", question: "Are gains broadening beyond megacaps?", sourceName: "Market data", cadence: "Daily" },
    { label: "% above 50D / 200D", question: "Are more stocks confirming the index move?", sourceName: "Breadth market data", cadence: "Daily" },
  ],
  "yen-carry-unwind": [
    { label: "AUDJPY + GBPJPY breadth", question: "Is yen strength broad enough to represent a carry unwind?", sourceName: "FX market data", cadence: "Intraday / daily" },
    { label: "Japan securities flows", question: "Is repatriation visible in official portfolio-flow data?", sourceName: "Japan Ministry of Finance", sourceUrl: "https://www.mof.go.jp/english/policy/international_policy/reference/itn_transactions_in_securities/", cadence: "Weekly" },
  ],
  "fed-long-end-stress": [
    { label: "US 30Y yield", question: "Is the long end itself making new highs?", sourceName: "Treasury / market data", cadence: "Daily" },
    { label: "Breakevens + credit spreads", question: "Is long-end pressure inflation/term-premium stress rather than clean growth?", sourceName: "FRED / market data", cadence: "Daily" },
  ],
  "china-ai-pressure": [
    { label: "Model cost + usage", question: "Are cheaper Chinese models gaining real usage?", sourceName: "Official model releases / OpenRouter / Hugging Face", cadence: "Daily / release-driven" },
    { label: "China domestic accelerator demand", question: "Is lower model cost expanding domestic compute demand?", sourceName: "Company filings / industry data", cadence: "Earnings / monthly" },
  ],
  "mag7-guidance-dispersion": [
    { label: "Guidance / capex / FCF dispersion", question: "Which megacaps improve guidance faster than capital burden rises?", sourceName: "Company filings and earnings calls", cadence: "Earnings cycle" },
  ],
  "market-breadth-health": [
    { label: "Equal-weight S&P · RSP", question: "Is equal-weight participation confirming SPX?", sourceName: "Market data", cadence: "Daily" },
    { label: "% above 50D / 200D", question: "Are more stocks joining the move?", sourceName: "Breadth market data", cadence: "Daily" },
    { label: "Advance-decline breadth", question: "Is daily participation improving or thinning?", sourceName: "Exchange breadth data", cadence: "Daily" },
  ],
};

function safeDate(value: string | null | undefined) {
  const time = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(time) ? time : 0;
}

function signed(value: number, digits = 2) {
  const rounded = value.toFixed(digits);
  return value > 0 ? `+${rounded}` : rounded;
}

function marketValue(item: MarketSeriesObservation) {
  const suffix = item.series_key === "us2y" || item.series_key === "us10y" ? "%" : "";
  return `${item.close.toLocaleString("en-GB", { maximumFractionDigits: 3 })}${suffix}`;
}

function macroValue(item: MacroSeriesObservation) {
  if (item.yoy_change != null) return `${signed(item.yoy_change)}% YoY`;
  if (item.mom_change != null) return `${signed(item.mom_change)}% MoM`;
  const unit = item.unit ? ` ${item.unit}` : "";
  return `${item.value.toLocaleString("en-GB", { maximumFractionDigits: 3 })}${unit}`;
}

function latestMarket(series: MarketSeriesObservation[], key: string) {
  return series.filter((item) => item.series_key === key).sort((a, b) => safeDate(b.observation_date) - safeDate(a.observation_date));
}

function latestMacro(series: MacroSeriesObservation[], key: string) {
  return series.filter((item) => item.series_key === key).sort((a, b) => safeDate(b.observation_date) - safeDate(a.observation_date));
}

function metricFromSeries(spec: SeriesSpec, data: MonitorData): CaseMonitorMetric {
  const rows = spec.kind === "market" ? latestMarket(data.marketObservations, spec.key) : latestMacro(data.macroObservations, spec.key);
  const latest = rows[0];
  const previous = rows[1];
  if (!latest) {
    return {
      id: `gap-series-${spec.key}`,
      label: spec.label,
      kind: "coverage_gap",
      state: "coverage_gap",
      current: null,
      previous: null,
      delta: null,
      asOf: null,
      cadence: spec.cadence || "As available",
      sourceName: spec.kind === "market" ? "Alchemy market series" : "Alchemy macro series",
      sourceUrl: null,
      question: spec.question,
      interpretation: "The deciding series is defined but is not currently populated in the canonical data store.",
      confirmationCondition: spec.confirmation,
      invalidationCondition: spec.invalidation,
      provenance: "Canonical Live Desk coverage gap",
    };
  }
  const current = spec.kind === "market" ? marketValue(latest as MarketSeriesObservation) : macroValue(latest as MacroSeriesObservation);
  const prior = previous ? (spec.kind === "market" ? marketValue(previous as MarketSeriesObservation) : macroValue(previous as MacroSeriesObservation)) : null;
  let delta: string | null = null;
  if (previous) {
    const now = spec.kind === "market" ? (latest as MarketSeriesObservation).close : (latest as MacroSeriesObservation).value;
    const then = spec.kind === "market" ? (previous as MarketSeriesObservation).close : (previous as MacroSeriesObservation).value;
    delta = Number.isFinite(now - then) ? signed(now - then, spec.kind === "market" ? 3 : 2) : null;
  }
  return {
    id: `series-${spec.key}`,
    label: spec.label,
    kind: spec.kind,
    state: "unresolved",
    current,
    previous: prior,
    delta,
    asOf: latest.observation_date,
    cadence: spec.cadence || latest.frequency || "As available",
    sourceName: spec.kind === "market" ? (latest as MarketSeriesObservation).provider : (latest as MacroSeriesObservation).agency,
    sourceUrl: latest.source_url || null,
    question: spec.question,
    interpretation: previous ? `Current ${current}; previous ${prior}. This reading is evidence for the question, not a standalone verdict.` : `Current ${current}. A prior canonical observation is not available for comparison.`,
    confirmationCondition: spec.confirmation,
    invalidationCondition: spec.invalidation,
    provenance: "Canonical Live Desk series",
  };
}

function metricFromGap(spec: GapSpec, storySlug: string): CaseMonitorMetric {
  return {
    id: `gap-${storySlug}-${spec.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    label: spec.label,
    kind: "coverage_gap",
    state: "coverage_gap",
    current: null,
    previous: null,
    delta: null,
    asOf: null,
    cadence: spec.cadence,
    sourceName: spec.sourceName,
    sourceUrl: spec.sourceUrl || null,
    question: spec.question,
    interpretation: "Required monitor identified. The canonical Desk does not yet have a structured reading for it, so the case remains explicitly incomplete rather than substituting an unrelated proxy.",
    confirmationCondition: null,
    invalidationCondition: null,
    provenance: "Canonical Live Desk coverage gap",
  };
}

function latestStatement(story: Story, statements: PublicStatement[]) {
  const assets = new Set(story.assets || []);
  return statements
    .filter((item) => item.affected_assets?.some((asset) => assets.has(asset)))
    .sort((a, b) => safeDate(b.statement_date) - safeDate(a.statement_date))[0] || null;
}

function latestResearch(story: Story, intake: ResearchIntakeQueueItem[], itemType?: ResearchIntakeQueueItem["item_type"]) {
  return intake
    .filter((item) => item.affected_story_slugs?.includes(story.slug) && ["accepted", "published"].includes(item.status) && (!itemType || item.item_type === itemType))
    .sort((a, b) => safeDate(b.published_at) - safeDate(a.published_at))[0] || null;
}

function sourceSignals(story: Story, data: MonitorData): CaseMonitorSignal[] {
  const result: CaseMonitorSignal[] = [];
  const statement = latestStatement(story, data.statements);
  if (statement) {
    const channel = String(statement.channel || "").toLowerCase();
    result.push({
      id: `statement-${statement.id}`,
      kind: channel.includes("twitter") || channel.includes(" x ") || channel.startsWith("x/") ? "x" : "statement",
      label: "Latest verified statement",
      headline: `${statement.speaker} · ${statement.topic}`,
      detail: statement.quote_excerpt,
      asOf: statement.statement_date,
      sourceName: statement.channel,
      sourceUrl: statement.source_url,
      verification: statement.verification_status,
    });
  }
  const video = latestResearch(story, data.researchIntake, "video");
  result.push(video ? {
    id: `video-${video.id}`,
    kind: "youtube",
    label: "YouTube monitor",
    headline: video.title,
    detail: video.stats_signal || video.news_signal || video.summary || null,
    asOf: video.published_at,
    sourceName: video.publisher,
    sourceUrl: video.url,
    verification: video.transcript_status || null,
  } : {
    id: `video-gap-${story.slug}`,
    kind: "youtube",
    label: "YouTube monitor",
    headline: "No verified relevant video in the current intake window",
    detail: "The research intake remains configured to surface relevant transcript-backed videos when they appear.",
    asOf: null,
    sourceName: "Alchemy research intake",
    sourceUrl: null,
    verification: "configured",
  });
  const research = latestResearch(story, data.researchIntake);
  if (research) result.push({
    id: `research-${research.id}`,
    kind: "research",
    label: "Latest research signal",
    headline: research.title,
    detail: research.divergence_note || research.stats_signal || research.news_signal || research.summary || null,
    asOf: research.published_at,
    sourceName: research.publisher,
    sourceUrl: research.url,
    verification: research.status,
  });
  return result;
}

async function fetchJson(url: string, timeout = 6500): Promise<unknown> {
  try {
    const response = await fetch(url, { headers: { accept: "application/json" }, next: { revalidate: 300 }, signal: AbortSignal.timeout(timeout) });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function numberAt(input: unknown, keys: string[]): number | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function stringAt(input: unknown, keys: string[]): string | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function findObject(root: unknown, candidateKeys: string[]): Record<string, unknown> | null {
  if (!root || typeof root !== "object") return null;
  const record = root as Record<string, unknown>;
  for (const key of candidateKeys) {
    const value = record[key];
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  }
  return record;
}

function extractTransitRows(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) return payload.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  for (const key of ["history", "data", "transits", "daily", "rows", "results"]) {
    if (Array.isArray(record[key])) return (record[key] as unknown[]).filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
  }
  return [];
}

async function hormuzMetrics(): Promise<{ metrics: CaseMonitorMetric[]; state: CaseMonitorState; label: string; summary: string; updatedAt: string | null }> {
  const [statusPayload, transitPayload] = await Promise.all([fetchJson(STRAITS_STATUS_URL), fetchJson(STRAITS_TRANSITS_URL)]);
  const status = findObject(statusPayload, ["status", "hormuz", "summary", "data"]);
  const rows = extractTransitRows(transitPayload).sort((a, b) => safeDate(stringAt(b, ["date", "day", "observation_date", "as_of"])) - safeDate(stringAt(a, ["date", "day", "observation_date", "as_of"])));
  const latestRow = rows[0] || null;
  const priorRow = rows[1] || null;

  const daily = numberAt(latestRow, ["transits", "count", "daily_transits", "vessels", "total"])
    ?? numberAt(status, ["daily_transits", "transits_today", "transit_count", "transits"]);
  const priorDaily = numberAt(priorRow, ["transits", "count", "daily_transits", "vessels", "total"]);
  const rolling = numberAt(status, ["seven_day_average", "sevenDayAverage", "rolling_7d", "avg_7d", "transit_7d_avg"])
    ?? numberAt(latestRow, ["seven_day_average", "sevenDayAverage", "rolling_7d", "avg_7d", "transit_7d_avg"]);
  const baseline = numberAt(status, ["pre_crisis_baseline", "baseline", "normal_daily", "normal_transits"])
    ?? numberAt(latestRow, ["pre_crisis_baseline", "baseline", "normal_daily", "normal_transits"])
    ?? 73;
  const threshold = numberAt(status, ["reopening_threshold", "threshold", "normalisation_threshold"])
    ?? numberAt(latestRow, ["reopening_threshold", "threshold", "normalisation_threshold"])
    ?? 60;
  const insurance = numberAt(status, ["insurance_multiple", "war_risk_multiple", "insurance"]);
  const ais = numberAt(status, ["ais_vessels", "ais_presence", "vessels_present", "live_vessels"]);
  const dark = numberAt(status, ["dark_vessels", "ais_gaps", "dark_count"]);
  const updatedAt = stringAt(status, ["updated_at", "as_of", "timestamp", "generated_at"]) || stringAt(latestRow, ["date", "day", "observation_date", "as_of"]);
  const metrics: CaseMonitorMetric[] = [];

  metrics.push({
    id: "hormuz-transits",
    label: "Strait of Hormuz · daily transits",
    kind: "physical",
    state: daily == null ? "coverage_gap" : daily >= threshold ? "confirming" : "unresolved",
    current: daily == null ? null : `${daily.toLocaleString("en-GB")} vessels/day`,
    previous: priorDaily == null ? null : `${priorDaily.toLocaleString("en-GB")} vessels/day`,
    delta: daily != null && priorDaily != null ? signed(daily - priorDaily, 0) : null,
    asOf: updatedAt,
    cadence: "IMF PortWatch weekly publication; API refreshes when source updates",
    sourceName: "Straits.live / IMF PortWatch",
    sourceUrl: STRAITS_TRANSITS_URL,
    question: "Has commercial traffic actually resumed towards normal?",
    interpretation: daily == null ? "Transit data could not be read from the upstream API on this refresh." : `Latest transit count is ${daily} versus an approximate pre-crisis normal near ${baseline}/day.`,
    confirmationCondition: `Repeated commercial transits with the 7-day average at or above ${threshold}/day.`,
    invalidationCondition: "Traffic falls again or remains far below normal despite diplomatic headlines.",
    provenance: "External physical-flow API; upstream IMF PortWatch methodology",
  });

  metrics.push({
    id: "hormuz-7d",
    label: "Strait of Hormuz · 7D transit average",
    kind: "physical",
    state: rolling == null ? "coverage_gap" : rolling >= threshold ? "confirming" : rolling >= 20 ? "unresolved" : "contradicting",
    current: rolling == null ? null : `${rolling.toFixed(1)} vessels/day`,
    previous: null,
    delta: null,
    asOf: updatedAt,
    cadence: "Rolling with source updates",
    sourceName: "Straits.live / IMF PortWatch",
    sourceUrl: STRAITS_TRANSITS_URL,
    question: "Is reopening durable rather than a one-day transit?",
    interpretation: rolling == null ? "The API did not expose a readable 7-day average on this refresh." : `${rolling.toFixed(1)}/day versus the ${threshold}/day normalisation threshold and ~${baseline}/day pre-crisis baseline.`,
    confirmationCondition: `7-day average ≥ ${threshold}/day with repeated commercial traffic.`,
    invalidationCondition: "7-day average remains materially below the normalisation threshold.",
    provenance: "External physical-flow API; derived rolling statistic",
  });

  metrics.push({
    id: "hormuz-insurance",
    label: "Hormuz war-risk insurance",
    kind: "physical",
    state: insurance == null ? "coverage_gap" : insurance <= 3 ? "confirming" : "unresolved",
    current: insurance == null ? null : `${insurance.toFixed(1)}× normal`,
    previous: null,
    delta: null,
    asOf: updatedAt,
    cadence: "Source-driven",
    sourceName: "Straits.live insurance monitor",
    sourceUrl: STRAITS_SITE_URL,
    question: "Are commercial shipping conditions normalising enough for carriers to return?",
    interpretation: insurance == null ? "A readable insurance multiple was not returned on this refresh." : `War-risk insurance is approximately ${insurance.toFixed(1)}× normal.`,
    confirmationCondition: "War-risk insurance compresses materially alongside sustained transit recovery.",
    invalidationCondition: "Insurance remains extremely elevated or rises again.",
    provenance: "External derived indicator; upstream insurance sources retain their own terms",
  });

  metrics.push({
    id: "hormuz-ais",
    label: "Hormuz AIS presence / dark vessels",
    kind: "physical",
    state: ais == null && dark == null ? "coverage_gap" : "unresolved",
    current: ais != null || dark != null ? `${ais != null ? `${ais} AIS-visible` : "AIS n/a"}${dark != null ? ` · ${dark} dark/gap` : ""}` : null,
    previous: null,
    delta: null,
    asOf: updatedAt,
    cadence: "High frequency / source-driven",
    sourceName: "Straits.live AIS monitor",
    sourceUrl: STRAITS_SITE_URL,
    question: "Are visible movements consistent with a genuine reopening, and are AIS gaps still distorting the picture?",
    interpretation: ais == null && dark == null ? "AIS detail was not readable from the bundled status response on this refresh." : "AIS presence is supporting context only; dark-vessel counts prevent treating visible AIS traffic as complete coverage.",
    confirmationCondition: "Visible commercial presence broadens while dark/gap activity normalises and transit counts recover.",
    invalidationCondition: "AIS gaps rise or visible activity remains inconsistent with official transit recovery.",
    provenance: "External AIS-derived indicator; not a complete census of vessel movements",
  });

  const hasFlow = rolling != null || daily != null;
  const normal = rolling != null ? rolling >= threshold : daily != null ? daily >= threshold : false;
  const veryLow = rolling != null ? rolling < 20 : daily != null ? daily < 20 : false;
  if (!hasFlow) return { metrics, state: "coverage_gap", label: "PHYSICAL FLOW DATA UNAVAILABLE", summary: "The Hormuz monitor is configured, but the upstream physical-flow API did not return a usable transit reading on this refresh.", updatedAt };
  if (normal) return { metrics, state: "confirming", label: "PHYSICAL REOPENING CONFIRMED", summary: `Commercial traffic has reached the monitor's normalisation threshold of ${threshold}/day. Insurance, carrier behaviour and incident frequency still need to agree before the case is treated as fully normalised.`, updatedAt };
  if (veryLow) return { metrics, state: "contradicting", label: "NORMALITY NOT CONFIRMED", summary: `Physical traffic remains far below the normalisation threshold of ${threshold}/day. Diplomatic progress is therefore not yet equivalent to a verified commercial reopening.`, updatedAt };
  return { metrics, state: "unresolved", label: "REOPENING PARTIAL · NOT YET NORMAL", summary: `Traffic has improved but remains below the ${threshold}/day normalisation threshold. Repeated transits and lower commercial-risk costs are still required.`, updatedAt };
}

function storySpecificSummary(story: Story, metrics: CaseMonitorMetric[], hormuz?: Awaited<ReturnType<typeof hormuzMetrics>>) {
  const missing = metrics.filter((item) => item.state === "coverage_gap").length;
  switch (story.slug) {
    case "refining-crack-spread-stress":
      return hormuz ? `${hormuz.summary} The refining thesis still needs the crack-spread, refinery-run and product-inventory legs before it can be settled.` : "Crude, product margins and physical reopening must be evaluated together; no single oil-price move settles the case.";
    case "oil-physical-disruption":
      return hormuz?.summary || "The case remains a physical-flow question first: repeated commercial transits, insurance and incident frequency should confirm any diplomatic headline.";
    case "fed-rate-repricing":
      return "The labour leg can weaken the hike case, but CPI and front-end yield repricing remain the deciding confirmation. A headline update alone should not change the Story.";
    case "productivity-labor-share":
      return "Productivity is only bullish if household income and demand hold. Employment, real earnings and retail demand need to be read alongside productivity and labour costs.";
    case "ai-capex-cash-conversion":
      return "Rates explain part of the valuation move, but earnings calls and cash conversion must show whether the fundamental return threshold is actually improving.";
    case "earnings-market-support":
      return "Headline index strength is insufficient. The case needs equal-weight participation, breadth and post-earnings reaction quality.";
    case "yen-carry-unwind":
      return "USDJPY is only one leg. A durable carry unwind needs rate-spread compression, broader yen-cross weakness, official follow-through and repatriation evidence.";
    case "fed-long-end-stress":
      return "The monitor must separate front-end Fed repricing from long-end term-premium or inflation stress. The 30Y, breakevens and credit remain important missing confirmation legs.";
    case "china-ai-pressure":
      return "Western equity pressure does not prove China is compressing AI returns. Model cost, real usage, enterprise adoption and compute demand must move together.";
    case "mag7-guidance-dispersion":
      return "The question is cross-company dispersion, not QQQ direction. Guidance revisions must be compared with capex and free-cash-flow burden company by company.";
    case "market-breadth-health":
      return missing ? "The canonical store does not yet contain the deciding equal-weight and breadth series, so the Desk should explicitly mark this case incomplete rather than infer breadth from SPY or QQQ." : "Breadth must confirm the index move across equal-weight and participation measures.";
    default:
      return "The current monitors are selected to answer the Story question. A Story should only change when the monitored evidence moves the confirmation or invalidation conditions.";
  }
}

export async function buildCaseMonitorBoards(data: MonitorData): Promise<CaseMonitorBoard[]> {
  const generatedAt = new Date().toISOString();
  const needsHormuz = data.stories.some((story) => ["refining-crack-spread-stress", "oil-physical-disruption"].includes(story.slug));
  const hormuz = needsHormuz ? await hormuzMetrics() : null;

  return data.stories.map((story) => {
    const metrics = (seriesSpecs[story.slug] || []).map((spec) => metricFromSeries(spec, data));
    if (hormuz && ["refining-crack-spread-stress", "oil-physical-disruption"].includes(story.slug)) metrics.unshift(...hormuz.metrics);
    metrics.push(...(gapSpecs[story.slug] || []).map((spec) => metricFromGap(spec, story.slug)));
    const gaps = metrics.filter((item) => item.state === "coverage_gap").map((item) => item.label);
    let state: CaseMonitorState = "unresolved";
    let stateLabel = "QUESTION STILL OPEN";
    if (story.slug === "oil-physical-disruption" && hormuz) {
      state = hormuz.state;
      stateLabel = hormuz.label;
    } else if (story.slug === "refining-crack-spread-stress" && hormuz) {
      state = hormuz.state === "confirming" ? "unresolved" : hormuz.state;
      stateLabel = hormuz.state === "confirming" ? "HORMUZ IMPROVING · PRODUCT TEST STILL OPEN" : hormuz.label;
    } else if (story.slug === "market-breadth-health" && gaps.length) {
      state = "coverage_gap";
      stateLabel = "BREADTH CONFIRMATION MISSING";
    }
    return {
      storyId: story.id,
      storySlug: story.slug,
      question: story.market_question || story.title,
      state,
      stateLabel,
      summary: storySpecificSummary(story, metrics, hormuz || undefined),
      updatedAt: hormuz?.updatedAt || generatedAt,
      metrics,
      signals: sourceSignals(story, data),
      gaps,
    };
  });
}

export function caseMonitorForStory(boards: CaseMonitorBoard[], storySlug: string) {
  return boards.find((board) => board.storySlug === storySlug) || null;
}
