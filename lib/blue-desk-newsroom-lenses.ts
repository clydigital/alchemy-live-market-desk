import type { NewsBriefV1 } from "./market-brief-news.ts";
import { NEWS_BRIEF_EVENT_MAX_AGE_MS } from "./market-brief-news.ts";

/**
 * Editorial navigation over the EXISTING source-verified factual NewsBriefV1.
 * A topic match is not an assertion that an asset moved or a Story changed.
 * This never creates an Evidence UUID or a canonical thesis-version decision.
 */
export const NEWSROOM_LENSES = [
  {
    id: "ai-innovations",
    title: "AI Innovations",
    subtitle: "Models, chips, infrastructure and adoption",
    question: "What changed in capability or adoption, and who could earn cash from it?",
    pattern: /\b(?:artificial intelligence|generative ai|ai|llms?|large language models?|open[- ]weights?|kimi|moonshot|deepseek|anthropic|openai|claude|gpu|gpus|semiconductors?|inference|neural networks?|robotics?|hyperscalers?|data\s?cent(?:res?|ers?)|machine learning|coding agents?)\b/i,
  },
  {
    id: "geopolitics-bonds",
    title: "Geopolitics + Bonds",
    subtitle: "Conflict, policy, sovereign debt and financing",
    question: "Which policy or funding assumption changes, and do dated yields or other assets confirm it?",
    pattern: /\b(?:geopolitic(?:al|s)?|treasur(?:y|ies)|sovereign|bond(?:s)?|yield(?:s)?|central banks?|credit spreads?|interest rates?|government debt|refinanc(?:e|ing)|federal reserve|fomc|bank of japan|ecb|eurozone|european union|eu protests?|protests?|ukraine|ukrainian|russia|russian|france|french|iran|hormuz|war|sanctions?|tariffs?|south korea|north korea|korean|china|chinese|beijing|washington)\b/i,
  },
  {
    id: "stocks-trading",
    title: "Stocks / Trading",
    subtitle: "Earnings, price behaviour, breadth and valuation",
    question: "What was priced in, what did investors actually observe, and what is the downside case?",
    pattern: /\b(?:stocks?|equities|equity|shares?|shareholders?|earnings?|revenue|operating margins?|cash flows?|free cash flow|capex|valuations?|guidance|ipos?|financing|dilution|credit ratings?|nasdaq|s&p\s?500|semiconductor stocks|nvidia|microsoft|alphabet|amazon|meta platforms|coreweave|trading|futures?|liquidity|market breadth)\b/i,
  },
] as const;

export type NewsroomLensId = (typeof NEWSROOM_LENSES)[number]["id"];

export type NewsroomItem = Pick<
  NewsBriefV1,
  "id" | "headline" | "summary" | "sourceName" | "sourceUrl" | "occurredAt" | "observedAt"
> & {
  /** A classification, NOT a causal or market verdict. */
  lensIds: NewsroomLensId[];
  evidenceLabel: "SOURCE-VERIFIED REPORT";
};

export type NewsroomGroup = {
  id: NewsroomLensId;
  title: string;
  subtitle: string;
  question: string;
  items: NewsroomItem[];
};

export type NewsroomProjection = {
  asOf: string;
  uniqueEligibleCount: number;
  unclassifiedCount: number;
  groups: NewsroomGroup[];
};

function safeOriginalUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password &&
      url.href.length <= 2048 && (url.pathname !== "/" || Boolean(url.search));
  } catch {
    return false;
  }
}

function admissibleNews(item: NewsBriefV1, time: number): boolean {
  if (item.contractVersion !== "news-brief/1" ||
      item.contentType !== "NEWS_BRIEF" ||
      item.verification !== "SOURCE_VERIFIED") return false;
  if (!item.id?.trim() || !item.headline?.trim() || !item.summary?.trim() ||
      !item.sourceName?.trim() || !safeOriginalUrl(item.sourceUrl)) return false;
  const published = Date.parse(item.occurredAt);
  const observed = Date.parse(item.observedAt);
  return Number.isFinite(published) && Number.isFinite(observed) &&
    published <= observed && observed <= time && published <= time &&
    time - published <= NEWS_BRIEF_EVENT_MAX_AGE_MS;
}

/**
 * Every qualifying report may appear in several topic lenses, but it retains
 * ONE original ID, event time and source. No text is invented or summarised.
 * Unmatched reports stay in the main News feed; do not falsely assign them.
 */
export function projectVerifiedNewsroom(
  items: readonly NewsBriefV1[],
  now: Date,
  perLensLimit = 9,
): NewsroomProjection {
  const time = now.getTime();
  const groups: NewsroomGroup[] = NEWSROOM_LENSES.map(lens => ({
    id: lens.id, title: lens.title, subtitle: lens.subtitle,
    question: lens.question, items: [],
  }));
  if (!Number.isFinite(time)) return {
    asOf: "UNAVAILABLE", uniqueEligibleCount: 0, unclassifiedCount: 0, groups,
  };

  const seen = new Set<string>();
  let eligible = 0;
  let unclassified = 0;
  const max = Number.isInteger(perLensLimit) ? Math.max(0, Math.min(perLensLimit, 18)) : 0;
  for (const item of [...items].sort((a, b) =>
    Date.parse(b.occurredAt) - Date.parse(a.occurredAt))) {
    if (!admissibleNews(item, time) || seen.has(item.id)) continue;
    seen.add(item.id);
    eligible++;
    const text = item.headline + " " + item.summary;
    const lensIds = NEWSROOM_LENSES.filter(lens => lens.pattern.test(text)).map(lens => lens.id);
    if (!lensIds.length) {
      unclassified++;
      continue;
    }
    const projected: NewsroomItem = {
      id: item.id, headline: item.headline, summary: item.summary,
      sourceName: item.sourceName, sourceUrl: item.sourceUrl,
      occurredAt: item.occurredAt, observedAt: item.observedAt,
      lensIds, evidenceLabel: "SOURCE-VERIFIED REPORT",
    };
    for (const group of groups) {
      if (lensIds.includes(group.id) && group.items.length < max) group.items.push(projected);
    }
  }
  return { asOf: now.toISOString(), uniqueEligibleCount: eligible, unclassifiedCount: unclassified, groups };
}
