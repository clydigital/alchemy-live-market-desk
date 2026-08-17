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

export type ResearchDiscoveryDiagnostic = {
  provider: ResearchDiscoveryProvider;
  status: "checked" | "no_new_items" | "blocked" | "disabled";
  discovered: number;
  retained: number;
  note: string;
};

type DiscoveryLead = {
  provider: ResearchDiscoveryProvider;
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string | null;
  score?: number | null;
};

type ProviderAcquisition = {
  provider: ResearchDiscoveryProvider;
  status: "checked" | "no_new_items" | "blocked";
  note: string;
  leads: DiscoveryLead[];
};

type DiscoveryOptions = {
  now?: Date;
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
};

const WINDOW_MS = 36 * 60 * 60 * 1_000;
const MAX_PROVIDER_RESULTS = 6;
const MAX_PROVIDER_RETAINED = 4;
const SOURCE_FETCH_TIMEOUT_MS = 6_000;
const PROVIDER_TIMEOUT_MS = 10_000;
const APIFY_TIMEOUT_MS = 16_000;
const MAX_HTML_CHARS = 350_000;

const PROVIDER_LABELS: Record<ResearchDiscoveryProvider, string> = {
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

export function normaliseDiscoveryUrl(value: string) {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:") throw new Error("Discovery results must use HTTPS URLs.");
  if (parsed.username || parsed.password) throw new Error("Discovery result URLs cannot contain credentials.");
  const hostname = parsed.hostname.toLowerCase();
  if (["localhost", "127.0.0.1", "::1"].includes(hostname)) throw new Error("Local URLs are not valid discovery evidence.");
  for (const key of [...parsed.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i.test(key)) parsed.searchParams.delete(key);
  }
  parsed.hash = "";
  return parsed.toString();
}

function publisherFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").slice(0, 120);
  } catch {
    return "Unknown publisher";
  }
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  const gdelt = trimmed.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/i);
  const timestamp = gdelt
    ? Date.UTC(
        Number(gdelt[1]),
        Number(gdelt[2]) - 1,
        Number(gdelt[3]),
        Number(gdelt[4]),
        Number(gdelt[5]),
        Number(gdelt[6]),
      )
    : Date.parse(trimmed);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function dateInsideWindow(value: string | null | undefined, now: Date) {
  if (!value) return false;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return false;
  return timestamp >= now.getTime() - WINDOW_MS && timestamp <= now.getTime() + 5 * 60_000;
}

function firstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function sourceMetadataFromHtml(html: string) {
  const body = html.slice(0, MAX_HTML_CHARS);
  const metaValue = (names: string[]) => {
    for (const name of names) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const patterns = [
        new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
      ];
      for (const pattern of patterns) {
        const match = body.match(pattern);
        if (match?.[1]) return cleanText(match[1], 4_000);
      }
    }
    return "";
  };

  const jsonLdDate = body.match(/["']datePublished["']\s*:\s*["']([^"']+)["']/i)?.[1] || "";
  const timeDate = body.match(/<time[^>]+datetime=["']([^"']+)["']/i)?.[1] || "";
  const publishedAt = parseDate(
    metaValue(["article:published_time", "og:published_time", "datePublished", "datepublished", "pubdate", "publish-date", "date"])
      || jsonLdDate
      || timeDate,
  );
  const title = metaValue(["og:title", "twitter:title"])
    || cleanText(body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1], 500);
  const description = metaValue(["og:description", "twitter:description", "description"]);
  return { publishedAt, title, description };
}

function discoveryQuery(slot: CanonicalResearchSlot, now: Date) {
  const session = slot === "morning"
    ? "Asia Europe overnight"
    : "US Europe session";
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return `latest market-moving ${session} global macro central banks inflation yields currencies oil energy geopolitics earnings ${date}`;
}

function retryableStatus(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

async function braveSearch(query: string, env: NodeJS.ProcessEnv, fetchImpl: typeof fetch): Promise<ProviderAcquisition> {
  const provider = "brave-search" as const;
  const key = env.BRAVE_SEARCH_API_KEY?.trim() || env.BRAVE_API_KEY?.trim();
  if (!key) return { provider, status: "no_new_items", note: "Brave Search is not configured.", leads: [] };
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
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": key,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
    if (!response.ok) {
      return {
        provider,
        status: "blocked",
        note: `Brave Search returned HTTP ${response.status}${retryableStatus(response.status) ? " (retryable)" : ""}.`,
        leads: [],
      };
    }
    const payload = await response.json().catch(() => null) as {
      web?: { results?: Array<Record<string, unknown>> };
      news?: { results?: Array<Record<string, unknown>> };
    } | null;
    const rows = [
      ...(payload?.news?.results || []),
      ...(payload?.web?.results || []),
    ];
    const leads = rows.flatMap((row): DiscoveryLead[] => {
      const title = firstString(row, ["title"]);
      const rawUrl = firstString(row, ["url"]);
      if (!title || !rawUrl) return [];
      let url: string;
      try { url = normaliseDiscoveryUrl(rawUrl); } catch { return []; }
      return [{
        provider,
        title,
        url,
        snippet: cleanText(firstString(row, ["description", "snippet", "profile"])),
        publishedAt: parseDate(firstString(row, ["page_age", "age", "published_at", "publishedAt"])),
      }];
    });
    return {
      provider,
      status: leads.length ? "checked" : "no_new_items",
      note: leads.length ? `Brave Search returned ${leads.length} lead(s).` : "Brave Search returned no usable HTTPS leads.",
      leads: leads.slice(0, MAX_PROVIDER_RESULTS),
    };
  } catch (error) {
    return { provider, status: "blocked", note: `Brave Search failed: ${error instanceof Error ? error.message.slice(0, 300) : "unknown error"}.`, leads: [] };
  }
}

async function exaSearch(query: string, now: Date, env: NodeJS.ProcessEnv, fetchImpl: typeof fetch): Promise<ProviderAcquisition> {
  const provider = "exa" as const;
  const key = env.EXA_API_KEY?.trim();
  if (!key) return { provider, status: "no_new_items", note: "Exa is not configured.", leads: [] };
  try {
    const response = await fetchImpl("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-api-key": key,
      },
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
    if (!response.ok) return { provider, status: "blocked", note: `Exa returned HTTP ${response.status}.`, leads: [] };
    const payload = await response.json().catch(() => null) as { results?: Array<Record<string, unknown>> } | null;
    const leads = (payload?.results || []).flatMap((row): DiscoveryLead[] => {
      const title = firstString(row, ["title"]);
      const rawUrl = firstString(row, ["url"]);
      if (!title || !rawUrl) return [];
      let url: string;
      try { url = normaliseDiscoveryUrl(rawUrl); } catch { return []; }
      const highlights = Array.isArray(row.highlights) ? row.highlights.filter((value): value is string => typeof value === "string").join(" ") : "";
      return [{
        provider,
        title,
        url,
        snippet: cleanText(highlights || firstString(row, ["text", "summary"])),
        publishedAt: parseDate(firstString(row, ["publishedDate", "published_at", "publishedAt"])),
        score: typeof row.score === "number" ? row.score : null,
      }];
    });
    return { provider, status: leads.length ? "checked" : "no_new_items", note: leads.length ? `Exa returned ${leads.length} lead(s).` : "Exa returned no usable HTTPS leads.", leads };
  } catch (error) {
    return { provider, status: "blocked", note: `Exa failed: ${error instanceof Error ? error.message.slice(0, 300) : "unknown error"}.`, leads: [] };
  }
}

async function tavilySearch(query: string, env: NodeJS.ProcessEnv, fetchImpl: typeof fetch): Promise<ProviderAcquisition> {
  const provider = "tavily" as const;
  const key = env.TAVILY_API_KEY?.trim();
  if (!key) return { provider, status: "no_new_items", note: "Tavily is not configured.", leads: [] };
  try {
    const response = await fetchImpl("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
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
    if (!response.ok) return { provider, status: "blocked", note: `Tavily returned HTTP ${response.status}.`, leads: [] };
    const payload = await response.json().catch(() => null) as { results?: Array<Record<string, unknown>> } | null;
    const leads = (payload?.results || []).flatMap((row): DiscoveryLead[] => {
      const title = firstString(row, ["title"]);
      const rawUrl = firstString(row, ["url"]);
      if (!title || !rawUrl) return [];
      let url: string;
      try { url = normaliseDiscoveryUrl(rawUrl); } catch { return []; }
      return [{
        provider,
        title,
        url,
        snippet: cleanText(firstString(row, ["content", "description"])),
        publishedAt: parseDate(firstString(row, ["published_date", "publishedAt", "date"])),
        score: typeof row.score === "number" ? row.score : null,
      }];
    });
    return { provider, status: leads.length ? "checked" : "no_new_items", note: leads.length ? `Tavily returned ${leads.length} lead(s) using one basic-search credit.` : "Tavily returned no usable HTTPS leads.", leads };
  } catch (error) {
    return { provider, status: "blocked", note: `Tavily failed: ${error instanceof Error ? error.message.slice(0, 300) : "unknown error"}.`, leads: [] };
  }
}

async function gdeltSearch(fetchImpl: typeof fetch): Promise<ProviderAcquisition> {
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
    if (!response.ok) return { provider, status: "blocked", note: `GDELT returned HTTP ${response.status}.`, leads: [] };
    const payload = await response.json().catch(() => null) as { articles?: Array<Record<string, unknown>> } | null;
    const leads = (payload?.articles || []).flatMap((row): DiscoveryLead[] => {
      const title = firstString(row, ["title"]);
      const rawUrl = firstString(row, ["url"]);
      if (!title || !rawUrl) return [];
      let url: string;
      try { url = normaliseDiscoveryUrl(rawUrl); } catch { return []; }
      const context = [
        firstString(row, ["domain"]),
        firstString(row, ["sourcecountry"]),
        firstString(row, ["language"]),
      ].filter(Boolean).join(" · ");
      return [{
        provider,
        title,
        url,
        snippet: context ? `GDELT article index: ${context}.` : "GDELT article index result.",
        publishedAt: parseDate(firstString(row, ["seendate", "publishedAt", "date"])),
      }];
    });
    return { provider, status: leads.length ? "checked" : "no_new_items", note: leads.length ? `GDELT returned ${leads.length} global article lead(s).` : "GDELT returned no usable article leads.", leads };
  } catch (error) {
    return { provider, status: "blocked", note: `GDELT failed: ${error instanceof Error ? error.message.slice(0, 300) : "unknown error"}.`, leads: [] };
  }
}

async function apifySearch(env: NodeJS.ProcessEnv, fetchImpl: typeof fetch): Promise<ProviderAcquisition> {
  const provider = "apify" as const;
  const token = env.APIFY_API_TOKEN?.trim();
  const taskId = env.APIFY_RESEARCH_TASK_ID?.trim();
  if (!token || !taskId) return { provider, status: "no_new_items", note: "Apify specialist research task is not configured.", leads: [] };
  const endpoint = `https://api.apify.com/v2/actor-tasks/${encodeURIComponent(taskId)}/run-sync-get-dataset-items?format=json&clean=1&timeout=12&limit=${MAX_PROVIDER_RESULTS}`;
  try {
    const response = await fetchImpl(endpoint, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(APIFY_TIMEOUT_MS),
    });
    if (!response.ok) return { provider, status: "blocked", note: `Apify task returned HTTP ${response.status}.`, leads: [] };
    const payload = await response.json().catch(() => null);
    const rows = Array.isArray(payload) ? payload.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object")) : [];
    const leads = rows.flatMap((row): DiscoveryLead[] => {
      const title = firstString(row, ["title", "name", "headline"]);
      const rawUrl = firstString(row, ["url", "link", "sourceUrl", "sourceURL"]);
      if (!title || !rawUrl) return [];
      let url: string;
      try { url = normaliseDiscoveryUrl(rawUrl); } catch { return []; }
      return [{
        provider,
        title,
        url,
        snippet: cleanText(firstString(row, ["summary", "description", "text", "content"])),
        publishedAt: parseDate(firstString(row, ["publishedAt", "published_at", "publishedDate", "date", "published_time"])),
      }];
    });
    return { provider, status: leads.length ? "checked" : "no_new_items", note: leads.length ? `Apify specialist task returned ${leads.length} lead(s).` : "Apify task completed without usable HTTPS leads.", leads };
  } catch (error) {
    return { provider, status: "blocked", note: `Apify failed: ${error instanceof Error ? error.message.slice(0, 300) : "unknown error"}.`, leads: [] };
  }
}

async function hydrateLead(lead: DiscoveryLead, now: Date, fetchImpl: typeof fetch) {
  let publishedAt = parseDate(lead.publishedAt || "");
  let title = cleanText(lead.title, 500);
  let summary = cleanText(lead.snippet, 2_000);
  let hydrated = false;

  // Search APIs are discovery mechanisms, not publication authorities. When a
  // lead does not carry a trustworthy timestamp, read the underlying source
  // directly and only retain it if publication metadata can be established.
  if (!dateInsideWindow(publishedAt, now) || !summary) {
    try {
      const response = await fetchImpl(lead.url, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "Alchemy Live Desk research discovery",
        },
        cache: "no-store",
        redirect: "follow",
        signal: AbortSignal.timeout(SOURCE_FETCH_TIMEOUT_MS),
      });
      if (response.ok && (response.headers.get("content-type") || "").toLowerCase().includes("text/html")) {
        const metadata = sourceMetadataFromHtml(await response.text());
        publishedAt = metadata.publishedAt || publishedAt;
        title = metadata.title || title;
        summary = metadata.description || summary;
        hydrated = true;
      }
    } catch {
      // A discovery lead without verifiable temporal provenance is dropped below.
    }
  }

  if (!dateInsideWindow(publishedAt, now) || !title || !summary) return null;

  const providerLabel = PROVIDER_LABELS[lead.provider];
  const publisher = publisherFromUrl(lead.url);
  const itemKey = `discovery:${createHash("sha256").update(lead.url).digest("hex").slice(0, 24)}`;
  const quality = lead.provider === "exa" || lead.provider === "tavily" ? 68 : lead.provider === "gdelt" ? 66 : 64;
  return {
    itemKey,
    itemType: "news" as const,
    publisher,
    externalId: lead.url,
    title,
    url: lead.url,
    publishedAt: publishedAt!,
    summary,
    sourceQuality: quality,
    relevance: 72,
    novelty: lead.provider === "exa" ? 80 : 74,
    materiality: 68,
    recommendedAction: "collect_evidence" as const,
    newsSignal: `Discovered via ${providerLabel}; the underlying publisher URL remains canonical evidence provenance.`,
    divergenceKind: "none" as const,
    evidence: [{
      title,
      url: lead.url,
      publisher,
      publishedAt: publishedAt!,
      claim: summary.slice(0, 1_000),
    }],
    reviewReason: `${providerLabel} is a discovery mechanism, not independent corroboration. Cross-provider duplicates count once. ${hydrated ? "Publication metadata was verified from the underlying page." : "The provider supplied a recent publication timestamp; the underlying URL remains the evidence source."}`,
  } satisfies IntakeItemInput;
}

async function materialiseAcquisition(acquisition: ProviderAcquisition, now: Date, fetchImpl: typeof fetch) {
  if (acquisition.status !== "checked" || !acquisition.leads.length) return [] as IntakeItemInput[];
  const uniqueLeads = [...new Map(acquisition.leads.map((lead) => [lead.url, lead])).values()].slice(0, MAX_PROVIDER_RESULTS);
  const hydrated = await Promise.all(uniqueLeads.map((lead) => hydrateLead(lead, now, fetchImpl)));
  return hydrated.filter((item): item is IntakeItemInput => Boolean(item)).slice(0, MAX_PROVIDER_RETAINED);
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

  const query = discoveryQuery(slot, now);
  const calls = enabled.map((provider) => {
    if (provider === "brave-search") return braveSearch(query, env, fetchImpl);
    if (provider === "exa") return exaSearch(query, now, env, fetchImpl);
    if (provider === "tavily") return tavilySearch(query, env, fetchImpl);
    if (provider === "gdelt") return gdeltSearch(fetchImpl);
    return apifySearch(env, fetchImpl);
  });
  const acquisitions = await Promise.all(calls);
  const materialised = await Promise.all(acquisitions.map((entry) => materialiseAcquisition(entry, now, fetchImpl)));

  const seen = new Set<string>();
  for (const item of input.items) {
    try { seen.add(normaliseDiscoveryUrl(item.url)); } catch { seen.add(item.url); }
  }

  const retained: IntakeItemInput[] = [];
  const diagnostics: ResearchDiscoveryDiagnostic[] = [];
  for (let index = 0; index < acquisitions.length; index += 1) {
    const acquisition = acquisitions[index];
    let retainedForProvider = 0;
    for (const item of materialised[index]) {
      let key: string;
      try { key = normaliseDiscoveryUrl(item.url); } catch { key = item.url; }
      if (seen.has(key)) continue;
      seen.add(key);
      retained.push(item);
      retainedForProvider += 1;
    }
    const discovered = acquisition.leads.length;
    const status = acquisition.status === "blocked"
      ? "blocked"
      : retainedForProvider > 0
        ? "checked"
        : "no_new_items";
    const duplicateNote = acquisition.status === "checked" && retainedForProvider === 0 && discovered > 0
      ? " Leads were stale, undated, unhydratable, or duplicates of evidence already collected by a higher-priority path."
      : "";
    diagnostics.push({
      provider: acquisition.provider,
      status,
      discovered,
      retained: retainedForProvider,
      note: `${acquisition.note}${duplicateNote}`.slice(0, 600),
    });
  }

  const diagnosticsText = diagnostics
    .map((entry) => `${entry.provider}:${entry.status} discovered=${entry.discovered} retained=${entry.retained} (${entry.note})`)
    .join(" | ");
  const baseSummary = input.summary?.trim() || "Autonomous Live-owned research cycle.";

  return {
    ...input,
    items: [...input.items, ...retained],
    summary: `${baseSummary} Discovery enrichment: ${diagnosticsText}. Search/scraping providers are lead generators only; underlying publisher URLs remain canonical provenance and cross-provider duplicates count once.`.slice(0, 6_000),
  };
}
