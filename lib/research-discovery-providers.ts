import { createHash } from "node:crypto";

import { type CanonicalResearchSlot } from "@/lib/research-schedule-health";
import { type IntakeItemInput, type ResearchRunInput } from "@/lib/research-update";

export const RESEARCH_DISCOVERY_PROVIDERS = [
  "brave-search",
  "exa",
  "tavily",
  "gdelt",
  "apify",
] as const;

export type ResearchDiscoveryProvider = (typeof RESEARCH_DISCOVERY_PROVIDERS)[number];

type Lead = {
  provider: ResearchDiscoveryProvider;
  title: string;
  url: string;
  snippet: string;
  publishedAt: string | null;
};

type Acquisition = {
  provider: ResearchDiscoveryProvider;
  status: "checked" | "no_new_items" | "blocked";
  note: string;
  leads: Lead[];
};

type DiscoveryOptions = {
  now?: Date;
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
};

const WINDOW_MS = 36 * 60 * 60 * 1_000;
const MAX_PROVIDER_RESULTS = 6;
const MAX_PROVIDER_RETAINED = 4;
const PROVIDER_TIMEOUT_MS = 10_000;
const APIFY_TIMEOUT_MS = 16_000;
const SOURCE_TIMEOUT_MS = 6_000;
const MAX_HTML_CHARS = 350_000;

const LABEL: Record<ResearchDiscoveryProvider, string> = {
  "brave-search": "Brave Search",
  exa: "Exa",
  tavily: "Tavily",
  gdelt: "GDELT",
  apify: "Apify",
};

function cleanText(value: unknown, max = 2_000) {
  if (typeof value !== "string") return "";
  return value
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

function firstString(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function parseDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();
  const gdelt = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/i);
  const timestamp = gdelt
    ? Date.UTC(
        Number(gdelt[1]),
        Number(gdelt[2]) - 1,
        Number(gdelt[3]),
        Number(gdelt[4]),
        Number(gdelt[5]),
        Number(gdelt[6]),
      )
    : Date.parse(raw);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function insideWindow(value: string | null, now: Date) {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    && timestamp >= now.getTime() - WINDOW_MS
    && timestamp <= now.getTime() + 5 * 60_000;
}

export function normaliseDiscoveryUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Discovery evidence must use HTTPS.");
  if (url.username || url.password) throw new Error("Discovery URLs cannot contain credentials.");
  const hostname = url.hostname.toLowerCase();
  if (["localhost", "127.0.0.1", "::1"].includes(hostname)) throw new Error("Local URLs are not evidence.");
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i.test(key)) url.searchParams.delete(key);
  }
  url.hash = "";
  return url.toString();
}

function safeUrl(value: string) {
  try {
    return normaliseDiscoveryUrl(value);
  } catch {
    return null;
  }
}

function publisherFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").slice(0, 120);
  } catch {
    return "Unknown publisher";
  }
}

function queryFor(slot: CanonicalResearchSlot, now: Date) {
  const session = slot === "morning" ? "Asia Europe overnight" : "US Europe session";
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return `latest market-moving ${session} global macro central banks inflation yields currencies oil energy geopolitics earnings ${date}`;
}

function lead(
  provider: ResearchDiscoveryProvider,
  row: Record<string, unknown>,
  titleKeys: string[],
  urlKeys: string[],
  snippetKeys: string[],
  dateKeys: string[],
): Lead | null {
  const title = cleanText(firstString(row, titleKeys), 500);
  const url = safeUrl(firstString(row, urlKeys));
  if (!title || !url) return null;
  return {
    provider,
    title,
    url,
    snippet: cleanText(firstString(row, snippetKeys)),
    publishedAt: parseDate(firstString(row, dateKeys)),
  };
}

async function brave(query: string, env: NodeJS.ProcessEnv, fetchImpl: typeof fetch): Promise<Acquisition> {
  const provider = "brave-search" as const;
  const key = env.BRAVE_SEARCH_API_KEY?.trim() || env.BRAVE_API_KEY?.trim();
  if (!key) return { provider, status: "no_new_items", note: "not configured", leads: [] };
  const params = new URLSearchParams({
    q: query,
    count: String(MAX_PROVIDER_RESULTS),
    freshness: "pd",
    search_lang: "en",
    safesearch: "moderate",
    text_decorations: "false",
  });
  try {
    const response = await fetchImpl(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: { Accept: "application/json", "X-Subscription-Token": key },
      cache: "no-store",
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
    if (!response.ok) return { provider, status: "blocked", note: `HTTP ${response.status}`, leads: [] };
    const json = await response.json().catch(() => null) as {
      web?: { results?: Record<string, unknown>[] };
      news?: { results?: Record<string, unknown>[] };
    } | null;
    const rows = [...(json?.news?.results || []), ...(json?.web?.results || [])];
    const leads = rows
      .map((row) => lead(provider, row, ["title"], ["url"], ["description", "snippet"], ["page_age", "age", "published_at", "publishedAt"]))
      .filter((item): item is Lead => item !== null)
      .slice(0, MAX_PROVIDER_RESULTS);
    return { provider, status: leads.length ? "checked" : "no_new_items", note: `${leads.length} lead(s)`, leads };
  } catch (error) {
    return { provider, status: "blocked", note: error instanceof Error ? error.message.slice(0, 240) : "unknown error", leads: [] };
  }
}

async function exa(query: string, now: Date, env: NodeJS.ProcessEnv, fetchImpl: typeof fetch): Promise<Acquisition> {
  const provider = "exa" as const;
  const key = env.EXA_API_KEY?.trim();
  if (!key) return { provider, status: "no_new_items", note: "not configured", leads: [] };
  try {
    const response = await fetchImpl("https://api.exa.ai/search", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", "x-api-key": key },
      cache: "no-store",
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      body: JSON.stringify({
        query,
        type: "auto",
        numResults: MAX_PROVIDER_RESULTS,
        startPublishedDate: new Date(now.getTime() - WINDOW_MS).toISOString(),
        contents: { highlights: { maxCharacters: 800 } },
      }),
    });
    if (!response.ok) return { provider, status: "blocked", note: `HTTP ${response.status}`, leads: [] };
    const json = await response.json().catch(() => null) as { results?: Record<string, unknown>[] } | null;
    const leads = (json?.results || []).flatMap((row): Lead[] => {
      const highlights = Array.isArray(row.highlights)
        ? row.highlights.filter((value): value is string => typeof value === "string").join(" ")
        : "";
      const item = lead(provider, { ...row, __snippet: highlights || firstString(row, ["text", "summary"]) }, ["title"], ["url"], ["__snippet"], ["publishedDate", "published_at", "publishedAt"]);
      return item ? [item] : [];
    }).slice(0, MAX_PROVIDER_RESULTS);
    return { provider, status: leads.length ? "checked" : "no_new_items", note: `${leads.length} lead(s)`, leads };
  } catch (error) {
    return { provider, status: "blocked", note: error instanceof Error ? error.message.slice(0, 240) : "unknown error", leads: [] };
  }
}

async function tavily(query: string, env: NodeJS.ProcessEnv, fetchImpl: typeof fetch): Promise<Acquisition> {
  const provider = "tavily" as const;
  const key = env.TAVILY_API_KEY?.trim();
  if (!key) return { provider, status: "no_new_items", note: "not configured", leads: [] };
  try {
    const response = await fetchImpl("https://api.tavily.com/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      body: JSON.stringify({
        query,
        search_depth: "basic",
        topic: "news",
        time_range: "day",
        max_results: MAX_PROVIDER_RESULTS,
        include_answer: false,
        include_raw_content: false,
      }),
    });
    if (!response.ok) return { provider, status: "blocked", note: `HTTP ${response.status}`, leads: [] };
    const json = await response.json().catch(() => null) as { results?: Record<string, unknown>[] } | null;
    const leads = (json?.results || [])
      .map((row) => lead(provider, row, ["title"], ["url"], ["content", "description"], ["published_date", "publishedAt", "date"]))
      .filter((item): item is Lead => item !== null)
      .slice(0, MAX_PROVIDER_RESULTS);
    return { provider, status: leads.length ? "checked" : "no_new_items", note: `${leads.length} lead(s), basic search`, leads };
  } catch (error) {
    return { provider, status: "blocked", note: error instanceof Error ? error.message.slice(0, 240) : "unknown error", leads: [] };
  }
}

async function gdelt(fetchImpl: typeof fetch): Promise<Acquisition> {
  const provider = "gdelt" as const;
  const params = new URLSearchParams({
    query: '(oil OR inflation OR "central bank" OR sanctions OR tariffs OR earnings OR yen OR dollar)',
    mode: "ArtList",
    maxrecords: String(MAX_PROVIDER_RESULTS),
    timespan: "36h",
    sort: "DateDesc",
    format: "json",
  });
  try {
    const response = await fetchImpl(`https://api.gdeltproject.org/api/v2/doc/doc?${params}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
    if (!response.ok) return { provider, status: "blocked", note: `HTTP ${response.status}`, leads: [] };
    const json = await response.json().catch(() => null) as { articles?: Record<string, unknown>[] } | null;
    const leads = (json?.articles || []).flatMap((row): Lead[] => {
      const context = [firstString(row, ["domain"]), firstString(row, ["sourcecountry"]), firstString(row, ["language"])].filter(Boolean).join(" · ");
      const item = lead(provider, { ...row, __snippet: context ? `GDELT article index: ${context}.` : "GDELT article index result." }, ["title"], ["url"], ["__snippet"], ["seendate", "publishedAt", "date"]);
      return item ? [item] : [];
    }).slice(0, MAX_PROVIDER_RESULTS);
    return { provider, status: leads.length ? "checked" : "no_new_items", note: `${leads.length} lead(s)`, leads };
  } catch (error) {
    return { provider, status: "blocked", note: error instanceof Error ? error.message.slice(0, 240) : "unknown error", leads: [] };
  }
}

async function apify(env: NodeJS.ProcessEnv, fetchImpl: typeof fetch): Promise<Acquisition> {
  const provider = "apify" as const;
  const token = env.APIFY_API_TOKEN?.trim();
  const taskId = env.APIFY_RESEARCH_TASK_ID?.trim();
  if (!token || !taskId) return { provider, status: "no_new_items", note: "specialist task not configured", leads: [] };
  try {
    const response = await fetchImpl(
      `https://api.apify.com/v2/actor-tasks/${encodeURIComponent(taskId)}/run-sync-get-dataset-items?format=json&clean=1&timeout=12&limit=${MAX_PROVIDER_RESULTS}`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(APIFY_TIMEOUT_MS),
      },
    );
    if (!response.ok) return { provider, status: "blocked", note: `HTTP ${response.status}`, leads: [] };
    const json = await response.json().catch(() => null);
    const rows = Array.isArray(json)
      ? json.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
      : [];
    const leads = rows
      .map((row) => lead(provider, row, ["title", "name", "headline"], ["url", "link", "sourceUrl", "sourceURL"], ["summary", "description", "text", "content"], ["publishedAt", "published_at", "publishedDate", "date", "published_time"]))
      .filter((item): item is Lead => item !== null)
      .slice(0, MAX_PROVIDER_RESULTS);
    return { provider, status: leads.length ? "checked" : "no_new_items", note: `${leads.length} specialist lead(s)`, leads };
  } catch (error) {
    return { provider, status: "blocked", note: error instanceof Error ? error.message.slice(0, 240) : "unknown error", leads: [] };
  }
}

function metadataFromHtml(html: string) {
  const body = html.slice(0, MAX_HTML_CHARS);
  const meta = (names: string[]) => {
    for (const name of names) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const patterns = [
        new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
      ];
      for (const pattern of patterns) {
        const value = pattern.exec(body)?.[1];
        if (value) return cleanText(value, 4_000);
      }
    }
    return "";
  };
  const jsonLdDate = body.match(/["']datePublished["']\s*:\s*["']([^"']+)["']/i)?.[1] || "";
  const timeDate = body.match(/<time[^>]+datetime=["']([^"']+)["']/i)?.[1] || "";
  return {
    publishedAt: parseDate(meta(["article:published_time", "og:published_time", "datePublished", "pubdate", "publish-date", "date"]) || jsonLdDate || timeDate),
    title: meta(["og:title", "twitter:title"]) || cleanText(body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1], 500),
    description: meta(["og:description", "twitter:description", "description"]),
  };
}

async function hydrateLead(item: Lead, now: Date, fetchImpl: typeof fetch): Promise<IntakeItemInput | null> {
  let publishedAt = item.publishedAt;
  let title = item.title;
  let summary = item.snippet;
  let hydrated = false;

  // Search APIs are discovery mechanisms, not publication authorities.
  // Read the underlying publisher page when temporal/summary provenance is weak.
  if (!insideWindow(publishedAt, now) || !summary) {
    try {
      const response = await fetchImpl(item.url, {
        headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "Alchemy Live Desk research discovery" },
        cache: "no-store",
        redirect: "follow",
        signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS),
      });
      if (response.ok && (response.headers.get("content-type") || "").toLowerCase().includes("text/html")) {
        const metadata = metadataFromHtml(await response.text());
        publishedAt = metadata.publishedAt || publishedAt;
        title = metadata.title || title;
        summary = metadata.description || summary;
        hydrated = true;
      }
    } catch {
      // If recency cannot be established, the lead is discarded below.
    }
  }

  if (!insideWindow(publishedAt, now) || !title || !summary || !publishedAt) return null;
  const providerLabel = LABEL[item.provider];
  const publisher = publisherFromUrl(item.url);
  const quality = item.provider === "exa" || item.provider === "tavily" ? 68 : item.provider === "gdelt" ? 66 : 64;
  return {
    itemKey: `discovery:${createHash("sha256").update(item.url).digest("hex").slice(0, 24)}`,
    itemType: "news",
    publisher,
    externalId: item.url,
    title,
    url: item.url,
    publishedAt,
    summary,
    sourceQuality: quality,
    relevance: 72,
    novelty: item.provider === "exa" ? 80 : 74,
    materiality: 68,
    recommendedAction: "collect_evidence",
    newsSignal: `Discovered via ${providerLabel}; the underlying publisher URL remains canonical evidence provenance.`,
    divergenceKind: "none",
    evidence: [{ title, url: item.url, publisher, publishedAt, claim: summary.slice(0, 1_000) }],
    reviewReason: `${providerLabel} is a discovery mechanism, not independent corroboration. Cross-provider duplicates count once. ${hydrated ? "Publication metadata was verified from the underlying page." : "The result carried a recent publication timestamp; the underlying URL remains the evidence source."}`,
  };
}

async function materialise(acquisition: Acquisition, now: Date, fetchImpl: typeof fetch): Promise<IntakeItemInput[]> {
  if (acquisition.status !== "checked") return [];
  const unique = [...new Map(acquisition.leads.map((item) => [item.url, item])).values()].slice(0, MAX_PROVIDER_RESULTS);
  const hydrated = await Promise.all(unique.map((item) => hydrateLead(item, now, fetchImpl)));
  return hydrated.filter((item): item is IntakeItemInput => item !== null).slice(0, MAX_PROVIDER_RETAINED);
}

function providerEnabled(provider: ResearchDiscoveryProvider, env: NodeJS.ProcessEnv) {
  const flag = env[`RESEARCH_${provider.replace(/-/g, "_").toUpperCase()}_ENABLED`];
  if (flag === "false") return false;
  if (provider === "gdelt") return true;
  if (provider === "brave-search") return Boolean(env.BRAVE_SEARCH_API_KEY?.trim() || env.BRAVE_API_KEY?.trim());
  if (provider === "exa") return Boolean(env.EXA_API_KEY?.trim());
  if (provider === "tavily") return Boolean(env.TAVILY_API_KEY?.trim());
  return Boolean(env.APIFY_API_TOKEN?.trim() && env.APIFY_RESEARCH_TASK_ID?.trim());
}

export function enabledResearchDiscoveryProviders(env: NodeJS.ProcessEnv = process.env) {
  return RESEARCH_DISCOVERY_PROVIDERS.filter((provider) => providerEnabled(provider, env));
}

export async function applyResearchDiscoveryProviders(
  input: ResearchRunInput,
  slot: CanonicalResearchSlot,
  options: DiscoveryOptions = {},
): Promise<ResearchRunInput> {
  const now = options.now ?? new Date();
  const fetchImpl = options.fetchImpl ?? fetch;
  const env = options.env ?? process.env;
  const enabled = enabledResearchDiscoveryProviders(env);
  if (!enabled.length) return input;

  const query = queryFor(slot, now);
  const acquisitions = await Promise.all(enabled.map((provider) => {
    if (provider === "brave-search") return brave(query, env, fetchImpl);
    if (provider === "exa") return exa(query, now, env, fetchImpl);
    if (provider === "tavily") return tavily(query, env, fetchImpl);
    if (provider === "gdelt") return gdelt(fetchImpl);
    return apify(env, fetchImpl);
  }));
  const materialised = await Promise.all(acquisitions.map((item) => materialise(item, now, fetchImpl)));

  const seen = new Set<string>();
  for (const item of input.items) seen.add(safeUrl(item.url) || item.url);

  const retained: IntakeItemInput[] = [];
  const diagnostics: string[] = [];
  for (let index = 0; index < acquisitions.length; index += 1) {
    const acquisition = acquisitions[index];
    let kept = 0;
    for (const item of materialised[index]) {
      const key = safeUrl(item.url) || item.url;
      if (seen.has(key)) continue;
      seen.add(key);
      retained.push(item);
      kept += 1;
    }
    const status = acquisition.status === "blocked" ? "blocked" : kept ? "checked" : "no_new_items";
    diagnostics.push(`${acquisition.provider}:${status} discovered=${acquisition.leads.length} retained=${kept} (${acquisition.note})`);
  }

  const baseSummary = input.summary?.trim() || "Autonomous Live-owned research cycle.";
  return {
    ...input,
    items: [...input.items, ...retained],
    summary: `${baseSummary} Discovery enrichment: ${diagnostics.join(" | ")}. Search/scraping providers are lead generators only; underlying publisher URLs remain canonical provenance and cross-provider duplicates count once.`.slice(0, 6_000),
  };
}
