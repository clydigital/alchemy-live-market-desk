/**
 * Bluebelly converged Newsroom — PRIVATE triage/read-projection contract.
 *
 * This is a pure presentation/research candidate normaliser, not a new
 * intake, evidence admission, Story writer or regime-version engine.
 * Callers must enforce owner-only access before passing unverified leads.
 */
export const NEWSROOM_TOPICS = [
  "ai-technology", "rates-bonds", "energy-geopolitics", "equities-corporate", "other",
] as const;

export type NewsroomTopic = typeof NEWSROOM_TOPICS[number];
export type LeadSource = "official" | "reliable-reporting" | "x-post" | "creator-transcript" | "market-data";
export type LeadVerification =
  | "ORIGINAL_VERIFIED"
  | "CORROBORATED_REPORT"
  | "ATTRIBUTED_RUMOUR"
  | "CREATOR_INTERPRETATION"
  | "UNKNOWN";
export type LeadDevelopment = "NEW" | "PROGRESSING" | "DENIED_OR_CORRECTED" | "UNCHANGED";
export type RegimeWatch = "ai-bubble" | "rates-bonds-funding" | "energy-inflation" | "cross-asset-risk";
export type RegimeEffectCandidate = "SUPPORT" | "CHALLENGE" | "NEUTRAL" | "TO_VERIFY";

export type ResearchLead = {
  /** Stable original candidate identity — preserve source record and URL. */
  sourceId: string;
  /** Same eventKey only when a genuine upstream identity/reconciliation exists. */
  eventKey: string;
  headline: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  source: LeadSource;
  verification: LeadVerification;
  publishedAt: string;
  observedAt: string;
  development: LeadDevelopment;
  /** Editorial ATTENTION signal, not a confidence/probability/truth score. */
  materiality: number;
  urgency: "FLASH" | "HIGH" | "NORMAL";
  /** Optional dated/source-linked verification question, never an invented test. */
  nextCheck?: string;
  /** Optional human-reviewed regime hypothesis: never authorises mutation. */
  analystRegimeCandidates?: readonly {
    regime: RegimeWatch;
    effect: RegimeEffectCandidate;
    evidenceRequired: string;
  }[];
};

export type RankedEvent = {
  eventKey: string;
  primary: ResearchLead;
  /** All corroborating/conflicting ORIGINAL leads remain linked. */
  sourceIds: string[];
  originalUrls: string[];
  topics: NewsroomTopic[];
  /** Topic-based potential connections, NOT an assessed change in regime. */
  regimeRouteHints: RegimeWatch[];
  regimeCandidates: NonNullable<ResearchLead["analystRegimeCandidates"]>;
  attention: "BREAKING" | "HIGH" | "WATCH" | "ARCHIVE";
  attentionScore: number;
  freshness: "NEW" | "RECENT" | "OLDER";
  /** Public feed must use its EXISTING NewsBriefV1 admission independently. */
  routing: "OWNER_LEAD_ONLY" | "ELIGIBLE_FOR_EXISTING_PUBLIC_VERIFICATION_GATE";
  conflicts: boolean;
};

const TOPIC_PATTERNS: readonly { id: Exclude<NewsroomTopic, "other">; pattern: RegExp }[] = [
  { id: "ai-technology", pattern: /\b(?:ai|artificial intelligence|llms?|semiconductors?|chip(?:s|making)?|gpu|nvidia|openai|anthropic|hyperscalers?|datacent(?:re|er)s?|robotics?|inference|memory|hbm|model(?:s)?|cuda)\b/i },
  { id: "rates-bonds", pattern: /\b(?:fed|fomc|federal reserve|treasur(?:y|ies)|bond(?:s)?|yield(?:s)?|2y|5y|10y|20y|30y|central bank|boj|ecb|boe|interest rate(?:s)?|repo|credit|private credit|financ(?:ing|e)|term premium|refinanc(?:ing|e)|debt auction|sovereign|tpi|jgb)\b/i },
  { id: "energy-geopolitics", pattern: /\b(?:oil|brent|wti|crude|gas|lng|diesel|refin(?:ery|eries)|opec|hormuz|freight|shipping|iran|russia|war|sanction(?:s)?|tariff(?:s)?|geopolitic(?:al|s)?|ceasefire|inflation shock)\b/i },
  { id: "equities-corporate", pattern: /\b(?:stock(?:s)?|equities|equity|shares?|earnings?|revenue|margin(?:s)?|cash flow|capex|fcf|ipo|merger|takeover|dilution|valuation|etf|nasdaq|s&p|spx|shareholders?|financial results)\b/i },
];

const ROUTE_HINTS: Readonly<Record<Exclude<NewsroomTopic, "other">, readonly RegimeWatch[]>> = {
  "ai-technology": ["ai-bubble"],
  "rates-bonds": ["rates-bonds-funding"],
  "energy-geopolitics": ["energy-inflation"],
  "equities-corporate": ["cross-asset-risk"],
};

function validUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      url.href.length <= 2048 && (url.pathname !== "/" || Boolean(url.search));
  } catch { return false; }
}

function validLead(lead: ResearchLead, nowMs: number): boolean {
  const published = Date.parse(lead.publishedAt);
  const observed = Date.parse(lead.observedAt);
  return Boolean(lead.sourceId.trim() && lead.eventKey.trim() && lead.headline.trim() &&
    lead.summary.trim() && lead.sourceName.trim() && validUrl(lead.sourceUrl)) &&
    Number.isFinite(published) && Number.isFinite(observed) &&
    published <= observed && observed <= nowMs && published <= nowMs &&
    nowMs - published <= 7 * 86_400_000 &&
    Number.isFinite(lead.materiality) && lead.materiality >= 0 && lead.materiality <= 100 &&
    // An X/creator source CANNOT certify the original fact, even if upstream mislabels it.
    !(lead.verification === "ORIGINAL_VERIFIED" &&
      (lead.source === "x-post" || lead.source === "creator-transcript"));
}

export function classifyNewsroomTopics(text: string): NewsroomTopic[] {
  const topics = TOPIC_PATTERNS.filter(t => t.pattern.test(text)).map(t => t.id);
  return topics.length ? topics : ["other"];
}

function scoreAttention(lead: ResearchLead, nowMs: number): number {
  const freshnessHours = Math.max(0, (nowMs - Date.parse(lead.publishedAt)) / 3_600_000);
  const freshness = freshnessHours <= 3 ? 15 : freshnessHours <= 24 ? 10 : freshnessHours <= 48 ? 5 : 0;
  const urgent = lead.urgency === "FLASH" ? 20 : lead.urgency === "HIGH" ? 12 : 0;
  const sourceQuality = lead.verification === "ORIGINAL_VERIFIED" ? 10 :
    lead.verification === "CORROBORATED_REPORT" ? 7 :
    lead.verification === "ATTRIBUTED_RUMOUR" || lead.verification === "CREATOR_INTERPRETATION" ? 2 : 0;
  const novelty = lead.development === "NEW" ? 5 : lead.development === "PROGRESSING" ? 3 : 0;
  const correction = lead.development === "DENIED_OR_CORRECTED" ? 8 : 0;
  return Math.min(100, Math.round(lead.materiality * 0.5 + freshness + urgent + sourceQuality + novelty + correction));
}

/**
 * One item per externally reconciled event identity, sorted by ATTENTION.
 * Rumours can rank highly in OWNER triage but NEVER bypass NewsBriefV1.
 */
export function rankConvergedNewswire(
  inputs: readonly ResearchLead[], now: Date, max = 40,
): RankedEvent[] {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) return [];
  const grouped = new Map<string, ResearchLead[]>();
  const seen = new Set<string>();
  for (const lead of inputs) {
    if (!validLead(lead, nowMs) || seen.has(lead.sourceId)) continue;
    seen.add(lead.sourceId);
    const sources = grouped.get(lead.eventKey) || [];
    sources.push(lead);
    grouped.set(lead.eventKey, sources);
  }
  return [...grouped.entries()].map(([eventKey, sources]) => {
    sources.sort((a, b) => scoreAttention(b, nowMs) - scoreAttention(a, nowMs) || a.sourceId.localeCompare(b.sourceId));
    const primary = sources[0];
    const allTopics = new Set<NewsroomTopic>(sources.flatMap(s => classifyNewsroomTopics(s.headline + " " + s.summary)));
    if (allTopics.size > 1) allTopics.delete("other");
    const topics = NEWSROOM_TOPICS.filter(t => allTopics.has(t));
    const regimeRouteHints = [...new Set(topics.flatMap(t => t === "other" ? [] : ROUTE_HINTS[t]))];
    const regimeCandidates = sources.flatMap(s => s.analystRegimeCandidates || []);
    const score = scoreAttention(primary, nowMs);
    const hoursOld = Math.max(0, (nowMs - Date.parse(primary.publishedAt)) / 3_600_000);
    const attention = score >= 75 ? "BREAKING" : score >= 57 ? "HIGH" : score >= 30 ? "WATCH" : "ARCHIVE";
    const routing = sources.every(s => s.verification === "ORIGINAL_VERIFIED") &&
      (primary.source === "official" || primary.source === "market-data") ?
      "ELIGIBLE_FOR_EXISTING_PUBLIC_VERIFICATION_GATE" : "OWNER_LEAD_ONLY";
    return {
      eventKey, primary, sourceIds: sources.map(s => s.sourceId),
      originalUrls: [...new Set(sources.map(s => s.sourceUrl))],
      topics, regimeRouteHints, regimeCandidates,
      attention, attentionScore: score,
      freshness: hoursOld <= 3 ? "NEW" : hoursOld <= 24 ? "RECENT" : "OLDER",
      routing,
      conflicts: new Set(sources.map(s => s.verification)).size > 1 ||
        sources.some(s => s.development === "DENIED_OR_CORRECTED"),
    } satisfies RankedEvent;
  }).sort((a, b) => b.attentionScore - a.attentionScore ||
    Date.parse(b.primary.publishedAt) - Date.parse(a.primary.publishedAt) ||
    a.eventKey.localeCompare(b.eventKey))
    .slice(0, Number.isInteger(max) ? Math.max(0, Math.min(max, 100)) : 0);
}
