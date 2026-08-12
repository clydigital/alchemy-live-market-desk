export type AlchemyArticle = {
  id: string;
  title: string;
  url: string;
  category: string;
  publishedAt: string | null;
  author: string;
  image: string | null;
  summary: string;
  bodyText: string;
  tradingViewLinks: string[];
};

const ROOT = "https://alchemymarkets.com";
const MARKET_INSIGHTS_FEED = `${ROOT}/education/market-insights/feed/`;
const CATEGORY_PAGES = [
  `${ROOT}/education/market-insights/`,
  `${ROOT}/education/market-insights/chart-of-the-day/`,
  `${ROOT}/education/market-insights/opening-bell/`,
  `${ROOT}/education/market-insights/weekly-outlook/`,
  `${ROOT}/education/market-insights/quarterly-forecast/`,
];

const fallbackArticles: AlchemyArticle[] = [
  {
    id: "1986-usdjpy-july-2026",
    title: "Will 1986’s Highs Mark the End of a Strong USDJPY?",
    url: `${ROOT}/education/market-insights/chart-of-the-day/1986-usdjpy-july-2026/`,
    category: "Chart of the Day",
    publishedAt: "2026-07-27T00:00:00.000Z",
    author: "Lee Yang",
    image: null,
    summary: "USDJPY was stretched near four-decade highs, but intervention risk, bearish divergence and the rate gap made follow-through the deciding test.",
    bodyText: "USDJPY was stretched near four-decade highs, but intervention risk, bearish divergence and the rate gap made follow-through the deciding test.",
    tradingViewLinks: [],
  },
  {
    id: "the-market-that-isnt-moving",
    title: "The Market That Isn’t Moving",
    url: `${ROOT}/education/market-insights/weekly-outlook/the-market-that-isnt-moving/`,
    category: "Weekly Outlook",
    publishedAt: "2026-07-17T00:00:00.000Z",
    author: "Zorrays Junaid",
    image: null,
    summary: "Low index volatility concealed violent single-stock moves as falling correlation turned the market into a market of stocks.",
    bodyText: "Low index volatility concealed violent single-stock moves as falling correlation turned the market into a market of stocks.",
    tradingViewLinks: [],
  },
  {
    id: "ai-markets-bounce-july-2026",
    title: "AI Markets Bounced Despite War Risk. Can It Hold?",
    url: `${ROOT}/education/market-insights/opening-bell/ai-markets-bounce-july-2026/`,
    category: "Opening Bell",
    publishedAt: "2026-07-09T00:00:00.000Z",
    author: "Lee Yang",
    image: null,
    summary: "AI shares recovered despite war and yield pressure, making relative strength against front-end yields the next confirmation test.",
    bodyText: "AI shares recovered despite war and yield pressure, making relative strength against front-end yields the next confirmation test.",
    tradingViewLinks: [],
  },
  {
    id: "spx-coils-above-a-rising-anchored-vwap",
    title: "SPX Coils Above a Rising Anchored VWAP",
    url: `${ROOT}/education/market-insights/chart-of-the-day/spx-coils-above-a-rising-anchored-vwap/`,
    category: "Chart of the Day",
    publishedAt: "2026-07-09T00:00:00.000Z",
    author: "Zorrays Junaid",
    image: null,
    summary: "The S&P 500 was consolidating above a rising anchored VWAP, with the range structure deciding whether the prior impulse remained intact.",
    bodyText: "The S&P 500 was consolidating above a rising anchored VWAP, with the range structure deciding whether the prior impulse remained intact.",
    tradingViewLinks: [],
  },
  {
    id: "wti-crude-the-premium-leaves-as-fast-as-it-arrived",
    title: "WTI Crude — The Premium Leaves as Fast as It Arrived",
    url: `${ROOT}/education/market-insights/chart-of-the-day/wti-crude-the-premium-leaves-as-fast-as-it-arrived/`,
    category: "Chart of the Day",
    publishedAt: "2026-06-16T00:00:00.000Z",
    author: "Zorrays Junaid",
    image: null,
    summary: "WTI was testing the lower boundary of a corrective structure as geopolitical premium faded faster than the physical picture changed.",
    bodyText: "WTI was testing the lower boundary of a corrective structure as geopolitical premium faded faster than the physical picture changed.",
    tradingViewLinks: [],
  },
  {
    id: "can-wall-street-outrun-dollar-june-2026",
    title: "Can Wall Street Outrun a Stronger Dollar This Week?",
    url: `${ROOT}/education/market-insights/opening-bell/can-wall-street-outrun-dollar-june-2026/`,
    category: "Opening Bell",
    publishedAt: "2026-06-22T00:00:00.000Z",
    author: "Lee Yang",
    image: null,
    summary: "A stronger dollar and higher short-term yields challenged equities, while semiconductors and the unresolved Hormuz story kept the cross-asset picture mixed.",
    bodyText: "A stronger dollar and higher short-term yields challenged equities, while semiconductors and the unresolved Hormuz story kept the cross-asset picture mixed.",
    tradingViewLinks: [],
  },
];

function clean(value: string | undefined | null) {
  return (value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, "–")
    .replace(/&mdash;|&#8212;/gi, "—")
    .replace(/&rsquo;|&#8217;/gi, "’")
    .replace(/&ldquo;|&#8220;/gi, "“")
    .replace(/&rdquo;|&#8221;/gi, "”")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function meta(html: string, key: string) {
  const escaped = escapeRegExp(key);
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return clean(match[1]);
  }
  return "";
}

function categoryFromUrl(url: string) {
  if (url.includes("/chart-of-the-day/")) return "Chart of the Day";
  if (url.includes("/opening-bell/")) return "Opening Bell";
  if (url.includes("/weekly-outlook/")) return "Weekly Outlook";
  if (url.includes("/quarterly-forecast/")) return "Quarterly Forecast";
  return "Market Insight";
}

function slugFromUrl(url: string) {
  return url.split("?")[0].replace(/\/$/, "").split("/").pop() || url;
}

function extractArticleUrls(html: string) {
  const matches = html.matchAll(/href=["']([^"']+)["']/gi);
  const urls: string[] = [];
  for (const match of matches) {
    try {
      const absolute = new URL(match[1], ROOT).toString().split("#")[0];
      const parsed = new URL(absolute);
      if (parsed.hostname !== "alchemymarkets.com") continue;
      if (!/\/education\/market-insights\/(chart-of-the-day|opening-bell|weekly-outlook|quarterly-forecast)\/[^/?#]+\/?$/i.test(parsed.pathname)) continue;
      urls.push(absolute.endsWith("/") ? absolute : `${absolute}/`);
    } catch {
      continue;
    }
  }
  return [...new Set(urls)];
}

function extractTradingViewLinks(html: string) {
  const links: string[] = [];
  for (const match of html.matchAll(/href=["']([^"']*tradingview\.com\/[^"']+)["']/gi)) {
    try {
      links.push(new URL(match[1], ROOT).toString());
    } catch {
      continue;
    }
  }
  return [...new Set(links)];
}

function extractBodyText(html: string) {
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]
    || html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]
    || html;
  const withoutNoise = article
    .replace(/<(script|style|svg|form|nav|footer|aside)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|li|h[1-6]|blockquote|figcaption|section|div)>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, "–")
    .replace(/&mdash;|&#8212;/gi, "—")
    .replace(/&rsquo;|&#8217;/gi, "’")
    .replace(/&ldquo;|&#8220;/gi, "“")
    .replace(/&rdquo;|&#8221;/gi, "”");

  return withoutNoise
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 24)
    .filter((line) => !/^(share|related articles|risk warning|disclaimer|subscribe|written by|table of contents)/i.test(line))
    .slice(0, 220)
    .join("\n")
    .slice(0, 28_000);
}

function extractPublishedAt(html: string) {
  return meta(html, "article:published_time")
    || meta(html, "og:published_time")
    || clean(html.match(/"datePublished"\s*:\s*"([^"]+)"/i)?.[1])
    || clean(html.match(/<time[^>]+datetime=["']([^"']+)["'][^>]*>/i)?.[1])
    || clean(html.match(/data-date=["']([^"']+)["']/i)?.[1])
    || null;
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: { "user-agent": "Alchemy Live Desk article memory" },
    next: { revalidate: 3600 },
  });
  if (!response.ok) throw new Error(`Alchemy fetch failed: ${response.status}`);
  return response.text();
}

function parseArticle(url: string, html: string): AlchemyArticle {
  const title = meta(html, "og:title") || clean(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]) || slugFromUrl(url);
  const summary = meta(html, "description") || meta(html, "og:description") || clean(html.match(/<h1[^>]*>[\s\S]*?<\/h1>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i)?.[1]);
  const image = meta(html, "og:image") || null;
  const publishedAt = extractPublishedAt(html);
  const author = meta(html, "author") || clean(html.match(/"author"\s*:\s*\{[\s\S]{0,280}?"name"\s*:\s*"([^"]+)"/i)?.[1]) || clean(html.match(/Written by:\s*<[^>]+>\s*([^<]+)/i)?.[1]) || "Alchemy Markets";
  const bodyText = extractBodyText(html);
  return {
    id: slugFromUrl(url),
    title: title.replace(/\s*[|–-]\s*Alchemy Markets\s*$/i, ""),
    url,
    category: categoryFromUrl(url),
    publishedAt,
    author: author.replace(/\s+Market Analyst$/i, ""),
    image,
    summary: summary || "Open the original Alchemy Markets article to review its published thesis and chart context.",
    bodyText: bodyText || summary,
    tradingViewLinks: extractTradingViewLinks(html),
  };
}

function rssValue(item: string, tag: string) {
  const escaped = escapeRegExp(tag);
  const value = item.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i"))?.[1] || "";
  return value.replace(/^<!\[CDATA\[/i, "").replace(/\]\]>$/i, "").trim();
}

/**
 * Parses the official Market Insights RSS feed. The scheduler needs a dated,
 * direct source and must never substitute the local article fallback.
 */
export function parseAlchemyMarketInsightsFeed(xml: string, limit = 30): AlchemyArticle[] {
  const articles = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)]
    .flatMap((match) => {
      const item = match[1];
      const url = rssValue(item, "link");
      const publishedAt = rssValue(item, "pubDate");
      if (!url || !publishedAt || !Number.isFinite(Date.parse(publishedAt))) return [];

      const rawContent = rssValue(item, "content:encoded") || rssValue(item, "description");
      const title = clean(rssValue(item, "title"));
      return [{
        id: slugFromUrl(url),
        title: title || slugFromUrl(url),
        url,
        category: categoryFromUrl(url),
        publishedAt: new Date(publishedAt).toISOString(),
        author: clean(rssValue(item, "dc:creator")) || "Alchemy Markets",
        image: null,
        summary: clean(rssValue(item, "description")) || title || "Open the original Alchemy Markets article to review its published thesis and chart context.",
        bodyText: extractBodyText(rawContent) || clean(rawContent),
        tradingViewLinks: extractTradingViewLinks(rawContent),
      } satisfies AlchemyArticle];
    });

  return [...new Map(articles.map((article) => [article.url, article])).values()]
    .sort((a, b) => Date.parse(b.publishedAt || "") - Date.parse(a.publishedAt || ""))
    .slice(0, limit);
}

export type FreshAlchemyArticlesResult = {
  status: "checked" | "blocked";
  articles: AlchemyArticle[];
  note?: string;
};

/**
 * Strict live acquisition for the research scheduler. Unlike getAlchemyArticles,
 * this function never substitutes the local article fallback when the live site
 * cannot be reached or does not yield dated articles.
 */
export async function getFreshAlchemyArticles(limit = 30): Promise<FreshAlchemyArticlesResult> {
  try {
    const fetchLiveText = async (url: string) => {
      const response = await fetch(url, {
        headers: { "user-agent": "Alchemy Live Desk scheduled research" },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`${new URL(url).pathname || "/"} returned HTTP ${response.status}.`);
      return response.text();
    };
    const articles = parseAlchemyMarketInsightsFeed(await fetchLiveText(MARKET_INSIGHTS_FEED), limit);
    if (!articles.length) {
      return { status: "blocked", articles: [], note: "The official Alchemy Market Insights feed returned no dated articles." };
    }
    return {
      status: "checked",
      articles,
      note: "Direct Alchemy Market Insights RSS feed acquired.",
    };
  } catch (error) {
    return {
      status: "blocked",
      articles: [],
      note: error instanceof Error ? `Live Alchemy acquisition failed: ${error.message}` : "Live Alchemy acquisition failed.",
    };
  }
}

export async function getAlchemyArticles(limit = 18): Promise<AlchemyArticle[]> {
  try {
    const pages = await Promise.allSettled(CATEGORY_PAGES.map(fetchText));
    const urls = pages.flatMap((page) => page.status === "fulfilled" ? extractArticleUrls(page.value) : []);
    const unique = [...new Set(urls)].slice(0, 30);
    if (!unique.length) return fallbackArticles;

    const results = await Promise.allSettled(unique.map(async (url) => parseArticle(url, await fetchText(url))));
    const articles = results
      .flatMap((result) => result.status === "fulfilled" ? [result.value] : [])
      .sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime())
      .slice(0, limit);

    return articles.length >= 4 ? articles : [...articles, ...fallbackArticles.filter((fallback) => !articles.some((article) => article.url === fallback.url))].slice(0, limit);
  } catch {
    return fallbackArticles;
  }
}
