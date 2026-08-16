import { createHash } from "node:crypto";

import { getFreshAlchemyArticles } from "@/lib/alchemy";
import { type CanonicalResearchSlot } from "@/lib/research-schedule-health";
import { scheduledForMalaysiaSlot, scheduledRunKey } from "@/lib/scheduled-research-identity";
import {
  type IntakeItemInput,
  type ResearchRunInput,
  type ResearchSourceKey,
  type SourceCheckInput,
} from "@/lib/research-update";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { scheduledVideoRunIdentity, scheduledVideoSlotForDesk } from "@/lib/scheduled-video-identity";
import {
  blockedVideoSourceChecks,
  videoSourceChecksFromDedicatedRun,
  type DedicatedVideoRun,
  type DedicatedVideoSlotRun,
} from "@/lib/scheduled-video-handoff";

const SOURCE_WINDOW_MS = 36 * 60 * 60 * 1_000;
const MAX_FEED_ITEMS_PER_SOURCE = 12;

type DirectFeedSource = {
  source: Extract<ResearchSourceKey, "zerohedge" | "axios" | "investing-com" | "fxstreet">;
  publisher: string;
  urls: string[];
  sourceQuality: number;
};

type FeedEntry = {
  title: string;
  url: string;
  publishedAt: string;
  summary: string;
};

type FeedAcquisition = {
  check: SourceCheckInput;
  items: IntakeItemInput[];
};

const DIRECT_FEEDS: DirectFeedSource[] = [
  {
    source: "zerohedge",
    publisher: "ZeroHedge",
    urls: ["https://feeds.feedburner.com/zerohedge/feed"],
    sourceQuality: 64,
  },
  {
    source: "axios",
    publisher: "Axios",
    urls: ["https://www.axios.com/feeds/feed.rss"],
    sourceQuality: 76,
  },
  {
    source: "investing-com",
    publisher: "Investing.com",
    urls: ["https://www.investing.com/rss/news_25.rss"],
    sourceQuality: 70,
  },
  {
    source: "fxstreet",
    publisher: "FXStreet",
    // The root official feed and the news alias carry the same direct FXStreet
    // coverage, but can be served by different CDN paths.
    urls: ["https://www.fxstreet.com/rss", "https://www.fxstreet.com/rss/news"],
    sourceQuality: 72,
  },
];

function stripMarkup(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
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
    const match = block.match(new RegExp(`<${escapeRegExp(name)}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapeRegExp(name)}>`, "i"));
    if (match?.[1]) return stripMarkup(match[1]);
  }
  return "";
}

function atomLink(block: string) {
  const links = [...block.matchAll(/<link\b([^>]*)>/gi)];
  for (const match of links) {
    const attributes = match[1] || "";
    const rel = attributes.match(/\brel=["']([^"']+)["']/i)?.[1];
    const href = attributes.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (href && (!rel || rel === "alternate")) return stripMarkup(href);
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

function parseFeed(xml: string): FeedEntry[] {
  if (!/<(rss|feed)\b/i.test(xml)) throw new Error("The response was not an RSS or Atom feed.");
  const blocks = [
    ...[...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((match) => ({ body: match[1], atom: false })),
    ...[...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map((match) => ({ body: match[1], atom: true })),
  ];
  return blocks.flatMap((block): FeedEntry[] => {
    const title = tagValue(block.body, ["title"]);
    const rawUrl = block.atom ? atomLink(block.body) : tagValue(block.body, ["link", "guid"]);
    const date = tagValue(block.body, ["pubDate", "published", "updated", "dc:date", "date"]);
    const summary = tagValue(block.body, ["description", "summary", "content:encoded", "content"]);
    if (!title || !rawUrl || !date) return [];
    let url: string;
    const timestamp = Date.parse(date);
    try {
      url = normaliseUrl(rawUrl);
    } catch {
      return [];
    }
    if (!Number.isFinite(timestamp) || !url.startsWith("https://")) return [];
    return [{
      title: title.slice(0, 500),
      url,
      publishedAt: new Date(timestamp).toISOString(),
      summary: (summary || title).slice(0, 2_000),
    }];
  });
}

function itemKey(source: string, url: string) {
  return `feed:${source}:${createHash("sha256").update(url).digest("hex").slice(0, 24)}`;
}

function feedItem(source: DirectFeedSource, entry: FeedEntry): IntakeItemInput {
  const summary = entry.summary || entry.title;
  return {
    itemKey: itemKey(source.source, entry.url),
    itemType: "news",
    publisher: source.publisher,
    externalId: entry.url,
    title: entry.title,
    url: entry.url,
    publishedAt: entry.publishedAt,
    summary,
    sourceQuality: source.sourceQuality,
    relevance: 68,
    novelty: 72,
    materiality: 64,
    recommendedAction: "collect_evidence",
    newsSignal: `Direct ${source.publisher} feed acquisition.`,
    divergenceKind: "none",
    evidence: [{
      title: entry.title,
      url: entry.url,
      publisher: source.publisher,
      publishedAt: entry.publishedAt,
      claim: summary.slice(0, 1_000),
    }],
    reviewReason: "Automatically acquired from the publisher's direct feed; the canonical runtime must verify and contextualise the claim.",
  };
}

async function acquireDirectFeed(source: DirectFeedSource, windowStart: number, now: number): Promise<FeedAcquisition> {
  const failures: string[] = [];
  for (const url of source.urls) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9",
          "User-Agent": "Alchemy Live Desk scheduled research",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const entries = parseFeed(await response.text());
      const fresh = entries
        .filter((entry) => {
          const publishedAt = Date.parse(entry.publishedAt);
          return publishedAt >= windowStart && publishedAt <= now + 5 * 60_000;
        })
        .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
      const unique = [...new Map(fresh.map((entry) => [entry.url, entry])).values()].slice(0, MAX_FEED_ITEMS_PER_SOURCE);
      if (!unique.length) {
        return {
          check: {
            source: source.source,
            status: "no_new_items",
            itemCount: 0,
            note: `Direct feed acquired from ${new URL(url).hostname}; no dated entries were inside the 36-hour intake window.`,
          },
          items: [],
        };
      }
      return {
        check: {
          source: source.source,
          status: "checked",
          itemCount: unique.length,
          note: `Direct feed acquired from ${new URL(url).hostname}.`,
        },
        items: unique.map((entry) => feedItem(source, entry)),
      };
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "Unknown acquisition failure.");
    }
  }
  return {
    check: {
      source: source.source,
      status: "blocked",
      itemCount: 0,
      note: `Direct ${source.publisher} feed acquisition failed: ${failures.join("; ").slice(0, 500)}`,
    },
    items: [],
  };
}

async function loadDedicatedVideoSourceChecks(slot: CanonicalResearchSlot, now: Date) {
  const videoSlot = scheduledVideoSlotForDesk(slot);
  const { scheduledFor } = scheduledVideoRunIdentity(videoSlot, now);
  try {
    const client = createSupabaseAdminClient();
    const { data: videoRun, error: videoError } = await client
      .from("research_runs")
      .select("id,status,source_checks,warnings")
      .eq("schedule_slot", videoSlot)
      .eq("scheduled_for", scheduledFor)
      .maybeSingle<DedicatedVideoRun>();
    if (videoError) throw new Error(videoError.message);
    if (!videoRun) return videoSourceChecksFromDedicatedRun(null, null);
    const { data: slotRun, error: slotError } = await client
      .from("research_slot_runs")
      .select("transcript_status")
      .eq("research_run_id", videoRun.id)
      .maybeSingle<DedicatedVideoSlotRun>();
    if (slotError) throw new Error(slotError.message);
    return videoSourceChecksFromDedicatedRun(videoRun, slotRun);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown persistence failure";
    return blockedVideoSourceChecks(`Could not read the dedicated video-intake checkpoint: ${detail.slice(0, 400)}.`);
  }
}

async function acquireAlchemy(windowStart: number, now: number): Promise<FeedAcquisition> {
  const result = await getFreshAlchemyArticles(30);
  if (result.status === "blocked") {
    return {
      check: { source: "alchemy-market-insights", status: "blocked", itemCount: 0, note: result.note || "Live Alchemy acquisition failed." },
      items: [],
    };
  }
  const articles = result.articles
    .filter((article) => article.publishedAt && Date.parse(article.publishedAt) >= windowStart && Date.parse(article.publishedAt) <= now + 5 * 60_000)
    .slice(0, 30);
  if (!articles.length) {
    return {
      check: {
        source: "alchemy-market-insights",
        status: "no_new_items",
        itemCount: 0,
        note: result.note || "Live Alchemy pages were scanned; no dated articles were inside the 36-hour intake window.",
      },
      items: [],
    };
  }
  return {
    check: {
      source: "alchemy-market-insights",
      status: "checked",
      itemCount: articles.length,
      note: result.note || "Live Alchemy Market Insights pages were acquired directly.",
    },
    items: articles.map((article, index): IntakeItemInput => ({
      itemKey: `alchemy:${article.id}`,
      itemType: "alchemy_article",
      publisher: "Alchemy Markets",
      externalId: article.id,
      title: article.title,
      url: article.url,
      publishedAt: article.publishedAt!,
      articlePosition: index + 1,
      summary: article.summary || article.bodyText || article.title,
      sourceQuality: 86,
      relevance: 74,
      novelty: 70,
      materiality: 70,
      recommendedAction: "review_article",
      newsSignal: `Live Alchemy Market Insights ${article.category} acquisition.`,
      divergenceKind: "none",
      evidence: [{
        title: article.title,
        url: article.url,
        publisher: "Alchemy Markets",
        publishedAt: article.publishedAt!,
        claim: (article.summary || article.bodyText || article.title).slice(0, 1_000),
      }],
      reviewReason: "Direct Alchemy article intake; preserve the published source before canonical interpretation.",
    })),
  };
}

/**
 * Builds the complete, auditable input for Live's existing research publisher.
 * It performs acquisition only; canonical Story reasoning remains exclusively
 * in the publisher's runIntelligenceEngine call.
 */
export async function buildScheduledResearchInput(
  slot: CanonicalResearchSlot,
  options: { now?: Date; runKey?: string } = {},
): Promise<ResearchRunInput> {
  const now = options.now ?? new Date();
  const scheduledFor = scheduledForMalaysiaSlot(slot, now);
  const windowEnd = now.getTime();
  const windowStart = windowEnd - SOURCE_WINDOW_MS;
  const [videoChecks, zerohedge, axios, investing, fxstreet, alchemy] = await Promise.all([
    loadDedicatedVideoSourceChecks(slot, now),
    acquireDirectFeed(DIRECT_FEEDS[0], windowStart, windowEnd),
    acquireDirectFeed(DIRECT_FEEDS[1], windowStart, windowEnd),
    acquireDirectFeed(DIRECT_FEEDS[2], windowStart, windowEnd),
    acquireDirectFeed(DIRECT_FEEDS[3], windowStart, windowEnd),
    acquireAlchemy(windowStart, windowEnd),
  ]);
  const sourceChecks: SourceCheckInput[] = [
    ...videoChecks,
    zerohedge.check,
    axios.check,
    investing.check,
    fxstreet.check,
    alchemy.check,
  ];
  const items = [
    ...zerohedge.items,
    ...axios.items,
    ...investing.items,
    ...fxstreet.items,
    ...alchemy.items,
  ];
  const blocked = sourceChecks.filter((check) => check.status === "blocked").map((check) => check.source);
  return {
    runKey: options.runKey || scheduledRunKey(slot, now),
    scheduleSlot: slot,
    scheduledFor,
    sourceChecks,
    items,
    recalibrations: [],
    summary: blocked.length
      ? `Autonomous Live-owned research cycle is blocked by required source coverage: ${blocked.join(", ")}.`
      : "Autonomous Live-owned research cycle. Video evidence remains in its dedicated canonical intake record and is not reassigned to the desk run.",
    dryRun: false,
  };
}
