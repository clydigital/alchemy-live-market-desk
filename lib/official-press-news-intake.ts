/**
 * Small original-source feed pass for the existing scheduled research run.
 * Only a directly read, recent official press-release page can become intake.
 * Official publication verifies the cited announcement, NOT a market reaction.
 * No separate job, public API, Story path or database is introduced.
 */
import { createHash } from "node:crypto";
import type { ResearchRunInput, IntakeItemInput } from "./research-update.ts";
import { normaliseDirectFeedText } from "./direct-news-evidence-triage.ts";

export const OFFICIAL_PRESS_FEEDS = [
  {
    name: "Federal Reserve monetary-policy press releases",
    feed: "https://www.federalreserve.gov/feeds/press_monetary.xml",
    host: "www.federalreserve.gov",
    path: /^\/newsevents\/pressreleases\/[a-z0-9/-]+\.htm$/i,
    publisher: "Federal Reserve Board",
  },
  {
    name: "SEC press releases",
    feed: "https://www.sec.gov/news/pressreleases.rss",
    host: "www.sec.gov",
    path: /^\/(?:newsroom\/press-releases|news\/press-release)\/[a-z0-9/-]+$/i,
    publisher: "U.S. Securities and Exchange Commission",
  },
  {
    // Official NVIDIA Investor Relations RSS points to the NVIDIA newsroom.
    // Company events are not market-reaction evidence by themselves.
    name: "NVIDIA company press releases",
    feed: "https://nvidianews.nvidia.com/cats/press_release.xml",
    host: "nvidianews.nvidia.com",
    path: /^\/news\/[a-z0-9-]+\/?$/i,
    publisher: "NVIDIA Newsroom",
  },
] as const;

const WINDOW_MS = 36 * 60 * 60_000;
const FETCH_TIMEOUT_MS = 6500;
const MAX_PER_FEED = 3;
type Feed = typeof OFFICIAL_PRESS_FEEDS[number];
/** Pure RSS/Atom parser: no Next aliases or runtime network imports. */
export function parseOfficialPressFeed(xml: string) {
  if (!/<(?:rss|feed)\b/i.test(xml)) throw new Error("Official press source did not provide an RSS or Atom feed.");
  const blocks = [
    ...[...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(match => ({ xml: match[1], atom: false })),
    ...[...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map(match => ({ xml: match[1], atom: true })),
  ];
  const tag = (body: string, names: string[]) => {
    for (const name of names) {
      const pattern = new RegExp("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/" + name + ">", "i");
      const text = pattern.exec(body)?.[1];
      if (text) return normaliseDirectFeedText(text);
    }
    return "";
  };
  return blocks.flatMap(({ xml: body, atom }) => {
    const title = tag(body, ["title"]);
    const rawUrl = atom
      ? [...body.matchAll(/<link\b([^>]*)\/?>/gi)].map(link =>
          link[1].match(/\bhref=["']([^"']+)["']/i)?.[1] || "").find(Boolean) || ""
      : tag(body, ["link", "guid"]);
    const time = tag(body, ["pubDate", "published", "updated", "dc:date", "date"]);
    const parsed = Date.parse(time);
    if (!title || !rawUrl || !Number.isFinite(parsed)) return [];
    return [{
      title: title.slice(0, 500),
      url: normaliseDirectFeedText(rawUrl),
      publishedAt: new Date(parsed).toISOString(),
    }];
  });
}


function fixedUrl(value: string, feed: Feed) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password ||
      url.hostname.toLowerCase() !== feed.host || !feed.path.test(url.pathname)) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^(?:utm_.+|fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
    return url.toString();
  } catch {
    return null;
  }
}

function recent(iso: string, now: Date) {
  const at = Date.parse(iso);
  return Number.isFinite(at) && at <= now.getTime() + 5 * 60_000
    && now.getTime() - at <= WINDOW_MS;
}

/** Claim-shaped titles are necessary; meetings and general website updates are not. */
export function materiallyActionableOfficialHeadline(feed: Feed, headline: string) {
  if (feed.host === "www.federalreserve.gov") return /\b(?:federal reserve|fomc|federal open market|monetary policy|federal funds|discount rate|balance sheet|policy rate)\b/i.test(headline)
    && /\b(?:announces?|issues?|releases?|statement|decision|raises?|cuts?|maintains?|approves?|updates?|votes?)\b/i.test(headline);
  if (feed.host === "nvidianews.nvidia.com") return /\b(?:announces?|reports?|expands?|signs?|secures?|raises?|lowers?|revises?|commits?|introduces?|acquires?|partners?|launches?)\b/i.test(headline)
    && /\b(?:earnings|revenue|profits?|margin|guidance|capital expenditure|capex|investment|contract|partnership|data.center|ai factor(?:y|ies)|infrastructure|capacity|supply|semiconductor|gpu|hbm)\b/i.test(headline);
  return /\b(?:approves?|adopts?|proposes?|finaliz(?:e|es)|rescind(?:s)?|amends?|authoriz(?:e|es)|issues?)\b/i.test(headline)
    && /\b(?:trading|market structure|treasury|securities|exchange|settlement|clearing|exchange.traded|etfs?|derivatives?|disclosure|registered funds?|broker.dealers?)\b/i.test(headline);
}

function materialTitleFound(html: string, title: string) {
  const header = [
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "",
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "",
  ].join(" ").replace(/<[^>]+>/g, " ").toLowerCase();
  const words = [...new Set(title.toLowerCase().match(/[a-z]{5,}/g) || [])];
  return words.length >= 3 && words.filter(word => header.includes(word)).length >= Math.min(3, words.length);
}

type Result = { state: "checked" | "blocked" | "no_new_items"; checked: number; items: IntakeItemInput[] };

async function loadOfficialFeed(feed: Feed, now: Date, fetchImpl: typeof fetch): Promise<Result> {
  try {
    const resp = await fetchImpl(feed.feed, {
      cache: "no-store",
      headers: { Accept: "application/rss+xml,application/atom+xml,text/xml,application/xml", "User-Agent": "Alchemy Live Desk official-source reader" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!resp.ok) return { state: "blocked", checked: 0, items: [] };
    const xml = (await resp.text()).slice(0, 250_000);
    const candidates = parseOfficialPressFeed(xml).flatMap(item => {
      const url = fixedUrl(item.url, feed);
      return url && recent(item.publishedAt, now) &&
        materiallyActionableOfficialHeadline(feed, item.title)
        ? [{ ...item, url }] : [];
    }).slice(0, MAX_PER_FEED);
    const results = await Promise.all(candidates.map(async entry => {
      try {
        const response = await fetchImpl(entry.url, {
          cache: "no-store",
          redirect: "follow",
          headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "Alchemy Live Desk official-source reader" },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!response.ok ||
          !(response.headers.get("content-type") || "").toLowerCase().includes("text/html")) return null;
        if (response.url && !fixedUrl(response.url, feed)) return null;
        const html = (await response.text()).slice(0, 150_000);
        if (!materialTitleFound(html, entry.title)) return null;
        const title = entry.title.slice(0, 500);
        return {
          itemKey: "official-press:" + createHash("sha256").update(entry.url).digest("hex").slice(0, 24),
          itemType: "news" as const,
          publisher: feed.publisher,
          title,
          url: entry.url,
          publishedAt: entry.publishedAt,
          summary: title,
          sourceQuality: 95,
          relevance: 84,
          materiality: 80,
          novelty: 76,
          recommendedAction: "collect_evidence" as const,
          newsSignal: "Original issuer/regulator announcement. A related price move or market impact has not been established.",
          evidence: [{
            title, url: entry.url, publisher: feed.publisher,
            publishedAt: entry.publishedAt, claim: title,
          }],
          reviewReason: "Original official RSS publication clock and directly linked same-host press-release HTML checked. Headline describes the announcement only, not its financial effect.",
        };
      } catch {
        return null;
      }
    }));
    const items = results.filter((item): item is NonNullable<typeof item> => item !== null);
    return { state: items.length ? "checked" : "no_new_items", checked: candidates.length, items };
  } catch {
    return { state: "blocked", checked: 0, items: [] };
  }
}

export async function applyOfficialPressNewsIntake(
  input: ResearchRunInput,
  opts: { now?: Date; fetchImpl?: typeof fetch } = {},
): Promise<ResearchRunInput> {
  const now = opts.now ?? new Date();
  const fetchImpl = opts.fetchImpl ?? fetch;
  const results = await Promise.all(OFFICIAL_PRESS_FEEDS.map(feed => loadOfficialFeed(feed, now, fetchImpl)));
  const existing = new Set(input.items.map(item => item.url));
  const appended: IntakeItemInput[] = [];
  for (const result of results) for (const item of result.items) {
    if (!existing.has(item.url) && input.items.length + appended.length < 250) {
      existing.add(item.url);
      appended.push(item);
    }
  }
  const status = results.map((result, i) =>
    OFFICIAL_PRESS_FEEDS[i].name + ":" + result.state + ",linked=" + result.checked
    + ",read=" + result.items.length).join(" | ");
  return {
    ...input,
    items: [...input.items, ...appended],
    summary: ((input.summary || "") + " Original-source press coverage: " + status
      + ". First-party announcements are factual discovery only; market causality is not established.").slice(0, 6000),
  };
}
