export type FxStreetFeedEntry = {
  title: string;
  url: string;
  publishedAt: string;
  summary: string;
};

const FXSTREET_ORIGIN = "https://www.fxstreet.com";

function cleanText(value: string) {
  return value
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

function timestampFromNewsUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url, FXSTREET_ORIGIN);
  } catch {
    return null;
  }
  if (parsed.hostname !== "www.fxstreet.com" && parsed.hostname !== "fxstreet.com") return null;
  if (!parsed.pathname.startsWith("/news/")) return null;

  const match = parsed.pathname.match(/-(\d{12})\/?$/);
  if (!match) return null;
  const raw = match[1];
  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(4, 6));
  const day = Number(raw.slice(6, 8));
  const hour = Number(raw.slice(8, 10));
  const minute = Number(raw.slice(10, 12));
  const timestamp = Date.UTC(year, month - 1, day, hour, minute);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
    || date.getUTCHours() !== hour
    || date.getUTCMinutes() !== minute
  ) return null;
  return date.toISOString();
}

/**
 * FXStreet's current official news-feed surface is an HTML index rather than
 * RSS. Its canonical article slugs end in YYYYMMDDHHMM, which supplies the
 * publication minute without inventing a timestamp. The original article URL
 * remains the evidence provenance URL.
 */
export function parseFxStreetNewsFeedPage(html: string): FxStreetFeedEntry[] {
  if (!/News Feed/i.test(html)) return [];

  const entries = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .flatMap((match): FxStreetFeedEntry[] => {
      const href = match[1] || "";
      const title = cleanText(match[2] || "");
      if (!title) return [];

      let url: string;
      try {
        const parsed = new URL(href, FXSTREET_ORIGIN);
        if (parsed.hostname !== "www.fxstreet.com" && parsed.hostname !== "fxstreet.com") return [];
        if (!parsed.pathname.startsWith("/news/")) return [];
        parsed.hash = "";
        url = parsed.toString();
      } catch {
        return [];
      }

      const publishedAt = timestampFromNewsUrl(url);
      if (!publishedAt) return [];
      return [{ title: title.slice(0, 500), url, publishedAt, summary: title.slice(0, 2_000) }];
    });

  return [...new Map(entries.map((entry) => [entry.url, entry])).values()]
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}
