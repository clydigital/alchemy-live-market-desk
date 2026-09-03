import { createHash } from "node:crypto";

import { firecrawlConfigured, scrapePublicUrlWithFirecrawl } from "@/lib/firecrawl";
import type { CanonicalResearchSlot } from "@/lib/research-schedule-health";
import type { IntakeItemInput, ResearchRunInput } from "@/lib/research-update";

const GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc";
const LOOKBACK_MS = 36 * 60 * 60 * 1_000;
const MAX_QUERY_RESULTS = 8;
const MAX_RETAINED_PER_QUERY = 4;
const PAGE_TIMEOUT_MS = 6_000;
const FIRECRAWL_RECOVERY_LIMIT = 2;

const TARGETS = [
  {
    key: "us-macro",
    query: '(CPI OR PPI OR ISM OR PMI OR payrolls OR JOLTS) AND (US OR "United States")',
    relevance: 88,
    materiality: 88,
    signal: "High-impact US macro release or release reaction",
  },
  {
    key: "japan-yen",
    query: '(yen OR USDJPY OR "foreign exchange") AND (intervention OR BOJ OR "Bank of Japan" OR "Ministry of Finance")',
    relevance: 92,
    materiality: 90,
    signal: "Japan yen, BOJ or FX-intervention development",
  },
] as const;

type Target = (typeof TARGETS)[number];

type GdeltArticle = {
  title?: unknown;
  url?: unknown;
  seendate?: unknown;
  domain?: unknown;
};

type SearchLead = {
  target: Target;
  title: string;
  url: string;
  publishedAt: string;
  publisher: string;
};

type PageRead = {
  summary: string;
  blocked: boolean;
  usedFirecrawl: boolean;
};

function cleanText(value: unknown, max = 2_000) {
  if (typeof value !== "string") return "";
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function safeUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (["localhost", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase())) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function publisher(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").slice(0, 120);
  } catch {
    return "Unknown publisher";
  }
}

function parseGdeltDate(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/i);
  if (!match) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
  }
  return new Date(Date.UTC(
    Number(match[1]), Number(match[2]) - 1, Number(match[3]),
    Number(match[4]), Number(match[5]), Number(match[6]),
  )).toISOString();
}

function withinWindow(value: string, now: Date) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    && timestamp >= now.getTime() - LOOKBACK_MS
    && timestamp <= now.getTime() + 5 * 60_000;
}

function metaContent(html: string, keys: string[]) {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const forward = new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i");
    const reverse = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["']`, "i");
    const found = html.match(forward) || html.match(reverse);
    const value = cleanText(found?.[1], 1_600);
    if (value) return value;
  }
  return "";
}

function pageSummary(html: string) {
  const meta = metaContent(html, ["description", "og:description", "twitter:description"]);
  if (meta.length >= 60) return meta;
  const body = cleanText(html, 2_000);
  return body.length >= 80 ? body : meta;
}

function sourceQuality(url: string) {
  const host = publisher(url);
  if (/reuters\.com$/i.test(host)) return 88;
  if (/bls\.gov$|federalreserve\.gov$|boj\.or\.jp$|mof\.go\.jp$/i.test(host)) return 95;
  if (/tradingeconomics\.com$|wsj\.com$|ft\.com$/i.test(host)) return 80;
  if (/tradingview\.com$|investing\.com$|fxstreet\.com$/i.test(host)) return 74;
  return 68;
}

async function searchTarget(target: Target, now: Date, fetchImpl: typeof fetch) {
  const params = new URLSearchParams({
    query: target.query,
    mode: "ArtList",
    maxrecords: String(MAX_QUERY_RESULTS),
    timespan: "36h",
    sort: "DateDesc",
    format: "json",
  });
  try {
    const response = await fetchImpl(`${GDELT_URL}?${params}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return [] as SearchLead[];
    const payload = await response.json().catch(() => null) as { articles?: GdeltArticle[] } | null;
    return (payload?.articles || []).flatMap((article): SearchLead[] => {
      const title = cleanText(article.title, 500);
      const url = safeUrl(article.url);
      const publishedAt = parseGdeltDate(article.seendate);
      if (!title || !url || !publishedAt || !withinWindow(publishedAt, now)) return [];
      return [{ target, title, url, publishedAt, publisher: publisher(url) }];
    });
  } catch {
    return [] as SearchLead[];
  }
}

async function directRead(url: string, fetchImpl: typeof fetch): Promise<PageRead> {
  try {
    const response = await fetchImpl(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (compatible; AlchemyMarketsResearch/1.0)",
      },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
    if (!response.ok) return { summary: "", blocked: true, usedFirecrawl: false };
    const html = await response.text();
    const summary = pageSummary(html);
    return { summary, blocked: summary.length < 60, usedFirecrawl: false };
  } catch {
    return { summary: "", blocked: true, usedFirecrawl: false };
  }
}

async function readPage(
  lead: SearchLead,
  fetchImpl: typeof fetch,
  allowFirecrawl: boolean,
): Promise<PageRead> {
  const direct = await directRead(lead.url, fetchImpl);
  if (!direct.blocked) return direct;
  if (!allowFirecrawl || !firecrawlConfigured()) return direct;

  const recovered = await scrapePublicUrlWithFirecrawl(lead.url, { fetchImpl, timeoutMs: 10_000 });
  if (!recovered.ok) return direct;
  const summary = pageSummary(recovered.rawHtml);
  if (summary.length < 60) return direct;
  return { summary, blocked: false, usedFirecrawl: true };
}

function itemKey(lead: SearchLead) {
  return `high-impact:${createHash("sha256").update(lead.url).digest("hex").slice(0, 28)}`;
}

function asIntake(lead: SearchLead, read: PageRead): IntakeItemInput {
  const usableBody = read.summary.length >= 60;
  const summary = usableBody ? read.summary : lead.title;
  return {
    itemKey: itemKey(lead),
    itemType: "news",
    publisher: lead.publisher,
    title: lead.title,
    url: lead.url,
    publishedAt: lead.publishedAt,
    transcriptStatus: "not_applicable",
    summary,
    affectedStorySlugs: [],
    sourceQuality: sourceQuality(lead.url),
    relevance: lead.target.relevance,
    novelty: 84,
    materiality: lead.target.materiality,
    recommendedAction: usableBody ? "collect_evidence" : "monitor",
    newsSignal: `${lead.target.signal}. Search/index discovery only; the underlying publisher URL is canonical provenance.`,
    divergenceKind: "news_lead",
    divergenceNote: usableBody
      ? `Publisher page read ${read.usedFirecrawl ? "through blocked-page Firecrawl recovery after direct access failed" : "directly"}.`
      : "Publisher body was not accessible; retained as a lead only and must not materially recalibrate a Story without stronger evidence.",
    evidence: usableBody ? [{
      title: lead.title,
      url: lead.url,
      publisher: lead.publisher,
      publishedAt: lead.publishedAt,
      claim: summary,
    }] : [],
    reviewReason: lead.target.signal,
  };
}

export async function applyHighImpactMarketDiscovery(
  input: ResearchRunInput,
  slot: CanonicalResearchSlot,
  options: { now?: Date; fetchImpl?: typeof fetch } = {},
): Promise<ResearchRunInput> {
  const now = options.now ?? new Date();
  const fetchImpl = options.fetchImpl ?? fetch;
  const existingUrls = new Set((input.items || []).map((item) => item.url));
  const retained: IntakeItemInput[] = [];
  let firecrawlBudget = FIRECRAWL_RECOVERY_LIMIT;
  let firecrawlRecovered = 0;

  for (const target of TARGETS) {
    const leads = await searchTarget(target, now, fetchImpl);
    const seen = new Set<string>();
    let targetCount = 0;
    for (const lead of leads) {
      if (targetCount >= MAX_RETAINED_PER_QUERY) break;
      if (existingUrls.has(lead.url) || seen.has(lead.url)) continue;
      seen.add(lead.url);
      const read = await readPage(lead, fetchImpl, firecrawlBudget > 0);
      if (read.usedFirecrawl) {
        firecrawlBudget -= 1;
        firecrawlRecovered += 1;
      }
      const item = asIntake(lead, read);
      retained.push(item);
      existingUrls.add(lead.url);
      targetCount += 1;
    }
  }

  if (!retained.length) return input;
  const suffix = `High-impact ${slot} discovery retained ${retained.length} macro/FX lead(s); ${firecrawlRecovered} required blocked-page Firecrawl recovery after direct access failed.`;
  return {
    ...input,
    items: [...input.items, ...retained],
    summary: input.summary ? `${input.summary} ${suffix}` : suffix,
  };
}
