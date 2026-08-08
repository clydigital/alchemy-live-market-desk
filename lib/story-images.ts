import type { ResearchSource } from "@/lib/data";

export type StoryHeaderImage = {
  imageUrl: string;
  articleUrl: string;
  articleTitle: string;
  publisher: string;
};

const VISUAL_PUBLISHERS = /reuters|associated press|ap news|investing\.com|wall street journal|bloomberg|cnbc|financial times|axios|marketwatch|marketscreener/i;
const NEWS_SOURCE_TYPES = /news|article|analysis|wire|press/i;
const MAX_CANDIDATES_PER_STORY = 4;
const IMAGE_REVALIDATE_SECONDS = 60 * 60 * 6;

const VERIFIED_ARTICLE_IMAGES: Record<string, string> = {
  "https://www.reuters.com/business/sandisk-forecasts-upbeat-quarterly-revenue-ai-driven-demand-2026-08-05/": "https://www.reuters.com/resizer/v2/II5RCCKT4ZMBXA33HRZVFXD5OU.jpg?auth=024f72aaf580c0c1be5f0a1818608868881eaf990ca36ef2df6e200c5d993b92&quality=80&width=1920",
};

function safeHttpUrl(value: string, base?: string) {
  try {
    const url = base ? new URL(value, base) : new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function decodeAttribute(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim();
}

function metaContent(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeAttribute(match[1]);
  }
  return null;
}

function candidateScore(source: ResearchSource) {
  let score = Number.isFinite(source.reliability_score) ? source.reliability_score : 0;
  const descriptor = `${source.publisher} ${source.source_type} ${source.title} ${source.url}`;
  if (VERIFIED_ARTICLE_IMAGES[source.url]) score += 100;
  if (VISUAL_PUBLISHERS.test(descriptor)) score += 42;
  if (NEWS_SOURCE_TYPES.test(source.source_type || "")) score += 18;
  if (/\.pdf(?:$|\?)/i.test(source.url)) score -= 80;
  if (/youtube\.com|youtu\.be|tradingview\.com/i.test(source.url)) score -= 50;

  const published = source.publication_date || source.observation_date;
  if (published) {
    const ageDays = Math.max(0, (Date.now() - new Date(published).getTime()) / 86_400_000);
    score += Math.max(0, 18 - ageDays * 0.35);
  }
  return score;
}

async function parseHeaderImage(source: ResearchSource): Promise<StoryHeaderImage | null> {
  const articleUrl = safeHttpUrl(source.url);
  if (!articleUrl) return null;

  const verifiedImage = VERIFIED_ARTICLE_IMAGES[source.url];
  if (verifiedImage) {
    return {
      imageUrl: verifiedImage,
      articleUrl,
      articleTitle: source.title,
      publisher: source.publisher,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_500);
  try {
    const response = await fetch(articleUrl, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "Mozilla/5.0 (compatible; AlchemyLiveDesk/1.0; +https://alchemymarkets.com)",
      },
      signal: controller.signal,
      next: { revalidate: IMAGE_REVALIDATE_SECONDS },
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) return null;

    const html = await response.text();
    const rawImage =
      metaContent(html, "og:image:secure_url") ||
      metaContent(html, "og:image") ||
      metaContent(html, "twitter:image") ||
      metaContent(html, "twitter:image:src");
    const imageUrl = rawImage ? safeHttpUrl(rawImage, articleUrl) : null;
    if (!imageUrl) return null;

    return {
      imageUrl,
      articleUrl,
      articleTitle: source.title,
      publisher: source.publisher,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getStoryHeaderImages(storyIds: string[], sources: ResearchSource[]) {
  const storySet = new Set(storyIds);
  const grouped = new Map<string, ResearchSource[]>();

  for (const source of sources) {
    if (!source.story_id || !storySet.has(source.story_id) || !safeHttpUrl(source.url)) continue;
    const existing = grouped.get(source.story_id) || [];
    existing.push(source);
    grouped.set(source.story_id, existing);
  }

  const results = await Promise.all(storyIds.map(async (storyId) => {
    const candidates = (grouped.get(storyId) || [])
      .sort((a, b) => candidateScore(b) - candidateScore(a))
      .slice(0, MAX_CANDIDATES_PER_STORY);

    for (const source of candidates) {
      const image = await parseHeaderImage(source);
      if (image) return [storyId, image] as const;
    }
    return [storyId, null] as const;
  }));

  return new Map<string, StoryHeaderImage | null>(results);
}
