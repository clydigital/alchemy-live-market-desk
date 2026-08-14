import { createHash } from "node:crypto";

import { firecrawlConfigured, scrapePublicUrlWithFirecrawl } from "@/lib/firecrawl";
import {
  type IntakeItemInput,
  type ResearchRunInput,
  type ResearchSourceKey,
  type SourceCheckInput,
} from "@/lib/research-update";
import { type CanonicalResearchSlot } from "@/lib/research-schedule-health";
import { buildScheduledResearchInput } from "@/lib/scheduled-research-input";

type SupportedFallbackSource = Extract<ResearchSourceKey, "zerohedge" | "axios" | "investing-com" | "fxstreet" | "alchemy-market-insights">;

type FallbackSpec = {
  publisher: string;
  urls: string[];
  sourceQuality: number;
  itemType: "news" | "alchemy_article";
};

const WINDOW_MS = 36 * 60 * 60 * 1_000;
const MAX_ITEMS_PER_SOURCE = 12;

const FALLBACK_SOURCES: Record<SupportedFallbackSource, FallbackSpec> = {
  zerohedge: {
    publisher: "ZeroHedge",
    urls: ["https://feeds.feedburner.com/zerohedge/feed"],
    sourceQuality: 64,
    itemType: "news",
  },
  axios: {
    publisher: "Axios",
    urls: ["https://www.axios.com/feeds/feed.rss"],
    sourceQuality: 76,
    itemType: "news",
  },
  "investing-com": {
    publisher: "Investing.com",
    urls: ["https://www.investing.com/rss/news_25.rss"],
    sourceQuality: 70,
    itemType: "news",
  },
  fxstreet: {
    publisher: "FXStreet",
    urls: ["https://www.fxstreet.com/rss", "https://www.fxstreet.com/rss/news"],
    sourceQuality: 72,
    itemType: "news",
  },
  "alchemy-market-insights": {
    publisher: "Alchemy Markets",
    urls: ["https://alchemymarkets.com/education/market-insights/feed/"],
    sourceQuality: 86,
    itemType: "alchemy_article",
  },
};

function clean(value: string | null | undefined) {
  return (value || "")
    .replace(/^<!\[CDATA\[/i, "")
    .replace(/\]\]>$/i, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tagValue(block: string, names: string[]) {
  for (const name of names) {
    const escaped = escapeRegExp(name);
    const match = block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i"));
    if (match?.[1]) return clean(match[1]);
  }
  return "";
}

function rawTagValue(block: string, names: string[]) {
  for (const name of names) {
    const escaped = escapeRegExp(name);
    const match = block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i"));
    if (match?.[1]) return match[1].replace(/^<!\[CDATA\[/i, "").replace(/\]\]>$/i, "").trim();
  }
  return "";
}

function atomLink(block: string) {
  const links = [...block.matchAll(/<link\b([^>]*)>/gi)];
  for (const match of links) {
    const attributes = match[1] || "";
    const rel = attributes.match(/\brel=["']([^"']+)["']/i)?.[1];
    const href = attributes.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (href && (!rel || rel === "alternate")) return clean(href);
  }
  return "";
}

function normaliseUrl(value: string) {
  const parsed = new URL(value);
  for (const key of [...parsed.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$)/i.test(key)) parsed.searchParams.delete(key);
  }
  parsed.hash = "";
  return parsed.toString();
}

function slugFromUrl(url: string) {
  return url.split("?")[0].replace(/\/$/, "").split("/").pop() || url;
}

function categoryFromUrl(url: string) {
  if (url.includes("/chart-of-the-day/")) return "Chart of the Day";
  if (url.includes("/opening-bell/")) return "Opening Bell";
  if (url.includes("/weekly-outlook/")) return "Weekly Outlook";
  if (url.includes("/quarterly-forecast/")) return "Quarterly Forecast";
  return "Market Insight";
}

function parseFeed(raw: string, source: SupportedFallbackSource, now: Date): IntakeItemInput[] {
  if (!/<(rss|feed)\b/i.test(raw)) return [];
  const spec = FALLBACK_SOURCES[source];
  const blocks = [
    ...[...raw.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((match) => ({ body: match[1], atom: false })),
    ...[...raw.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map((match) => ({ body: match[1], atom: true })),
  ];
  const windowStart = now.getTime() - WINDOW_MS;

  const items = blocks.flatMap((block): IntakeItemInput[] => {
    const title = tagValue(block.body, ["title"]);
    const rawUrl = block.atom ? atomLink(block.body) : tagValue(block.body, ["link", "guid"]);
    const published = tagValue(block.body, ["pubDate", "published", "updated", "dc:date", "date"]);
    const rawSummary = rawTagValue(block.body, ["content:encoded", "description", "summary", "content"]);
    const timestamp = Date.parse(published);
    if (!title || !rawUrl || !Number.isFinite(timestamp)) return [];
    if (timestamp < windowStart || timestamp > now.getTime() + 5 * 60_000) return [];

    let url: string;
    try {
      url = normaliseUrl(rawUrl);
    } catch {
      return [];
    }
    if (!url.startsWith("https://")) return [];

    const summary = clean(rawSummary) || title;
    const itemKey = `feed:${source}:${createHash("sha256").update(url).digest("hex").slice(0, 24)}`;
    const publishedAt = new Date(timestamp).toISOString();
    const alchemy = spec.itemType === "alchemy_article";
    return [{
      itemKey,
      itemType: spec.itemType,
      publisher: spec.publisher,
      externalId: alchemy ? slugFromUrl(url) : url,
      title: title.slice(0, 500),
      url,
      publishedAt,
      summary: summary.slice(0, 2_000),
      sourceQuality: spec.sourceQuality,
      relevance: alchemy ? 74 : 68,
      novelty: alchemy ? 70 : 72,
      materiality: alchemy ? 70 : 64,
      recommendedAction: alchemy ? "review_article" : "collect_evidence",
      newsSignal: `Firecrawl fallback recovered the public ${spec.publisher} feed after direct acquisition failed.`,
      divergenceKind: "none",
      evidence: [{
        title: title.slice(0, 500),
        url,
        publisher: spec.publisher,
        publishedAt,
        claim: summary.slice(0, 1_000),
      }],
      reviewReason: alchemy
        ? `Firecrawl recovered the public Alchemy Market Insights feed; original article URL and publisher provenance are preserved. Category: ${categoryFromUrl(url)}.`
        : `Firecrawl recovered the publisher's public feed after direct acquisition failed; the original article URL remains the canonical provenance URL.`,
    }];
  });

  return [...new Map(items.map((item) => [item.url, item])).values()]
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, MAX_ITEMS_PER_SOURCE);
}

function supportedFallbackSource(value: ResearchSourceKey): value is SupportedFallbackSource {
  return Object.prototype.hasOwnProperty.call(FALLBACK_SOURCES, value);
}

async function recoverSource(check: SourceCheckInput, now: Date) {
  if (!supportedFallbackSource(check.source)) return { check, items: [] as IntakeItemInput[] };
  const spec = FALLBACK_SOURCES[check.source];
  const failures: string[] = [];
  for (const url of spec.urls) {
    const scrape = await scrapePublicUrlWithFirecrawl(url);
    if (!scrape.ok) {
      failures.push(`${scrape.code}: ${scrape.detail}`);
      continue;
    }
    const items = parseFeed(scrape.rawHtml, check.source, now);
    if (!items.length) {
      failures.push("Firecrawl returned content but it contained no fresh dated feed items.");
      continue;
    }
    return {
      check: {
        ...check,
        status: "checked" as const,
        itemCount: items.length,
        retryable: undefined,
        note: `Direct acquisition was blocked; Firecrawl fallback recovered ${items.length} item(s) from ${new URL(url).hostname}. Original publisher/article provenance is preserved.`,
      },
      items,
    };
  }
  return {
    check: {
      ...check,
      note: `${check.note || `${spec.publisher} direct acquisition was blocked.`} Firecrawl fallback failed: ${failures.join("; ").slice(0, 500)}`,
    },
    items: [] as IntakeItemInput[],
  };
}

export async function applyFirecrawlResearchFallback(input: ResearchRunInput, now = new Date()): Promise<ResearchRunInput> {
  const blockedSupported = input.sourceChecks.filter((check) => check.status === "blocked" && supportedFallbackSource(check.source));
  if (!blockedSupported.length) return input;

  if (!firecrawlConfigured()) {
    const blockedSet = new Set(blockedSupported.map((check) => check.source));
    return {
      ...input,
      sourceChecks: input.sourceChecks.map((check) => blockedSet.has(check.source)
        ? { ...check, note: `${check.note || "Direct acquisition was blocked."} Firecrawl fallback is not configured.` }
        : check),
    };
  }

  const recovered = await Promise.all(blockedSupported.map((check) => recoverSource(check, now)));
  const recoveredBySource = new Map(recovered.map((entry) => [entry.check.source, entry]));
  const recoveredItems = recovered.flatMap((entry) => entry.items);
  const sourceChecks = input.sourceChecks.map((check) => recoveredBySource.get(check.source)?.check ?? check);
  const mergedItems = [...new Map([...input.items, ...recoveredItems].map((item) => [item.itemKey, item])).values()];
  const stillBlocked = sourceChecks.filter((check) => check.status === "blocked").map((check) => check.source);

  return {
    ...input,
    sourceChecks,
    items: mergedItems,
    summary: stillBlocked.length
      ? `${input.summary || "Autonomous Live-owned research cycle."} Firecrawl fallback ran; unresolved blocked sources: ${stillBlocked.join(", ")}.`
      : `${input.summary || "Autonomous Live-owned research cycle."} Firecrawl fallback recovered all supported blocked public-feed sources.`,
  };
}

export async function buildScheduledResearchInputWithFirecrawl(
  slot: CanonicalResearchSlot,
  options: Parameters<typeof buildScheduledResearchInput>[1] = {},
) {
  const now = options.now ?? new Date();
  const input = await buildScheduledResearchInput(slot, options);
  return applyFirecrawlResearchFallback(input, now);
}
