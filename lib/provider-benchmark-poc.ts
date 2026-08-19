import "server-only";

export type BenchmarkProvider = "brave" | "exa" | "tavily" | "gdelt" | "apify";

type ResultRow = {
  title: string;
  url: string;
  snippet: string;
  publishedAt: string | null;
};

type QueryRun = {
  provider: BenchmarkProvider;
  queryId: string;
  configured: boolean;
  status: "ok" | "not_configured" | "error";
  httpStatus: number | null;
  latencyMs: number;
  results: ResultRow[];
  note: string;
};

export const PROVIDER_BENCHMARK_QUERIES = [
  {
    id: "oil-hormuz",
    query: "Iran Hormuz shipping oil transits Brent refining diesel crack spreads August 2026",
  },
  {
    id: "fed-inflation",
    query: "US inflation CPI PPI Federal Reserve two-year yield rate expectations August 2026",
  },
  {
    id: "long-end",
    query: "US Treasury 30-year yield term premium auction inflation credibility August 2026",
  },
  {
    id: "yen-carry",
    query: "Japan yen intervention USDJPY BOJ carry trade FIMA August 2026",
  },
  {
    id: "ai-equities",
    query: "AI capex financing Nvidia hyperscaler cash flow earnings S&P 500 breadth semiconductors August 2026",
  },
] as const;

const MAX_RESULTS = 5;
const TIMEOUT_MS = 12_000;
const WINDOW_MS = 72 * 60 * 60 * 1_000;

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "into", "this", "that", "august", "2026", "us", "japan",
]);

const SYNDICATION_DOMAINS = new Set([
  "finance.yahoo.com", "yahoo.com", "msn.com", "news.google.com", "marketscreener.com", "investing.com",
]);

function cleanText(value: unknown, max = 1200) {
  return typeof value === "string" ? value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function parseDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();
  const gdelt = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/i);
  const ts = gdelt
    ? Date.UTC(Number(gdelt[1]), Number(gdelt[2]) - 1, Number(gdelt[3]), Number(gdelt[4]), Number(gdelt[5]), Number(gdelt[6]))
    : Date.parse(raw);
  return Number.isFinite(ts) ? new Date(ts).toISOString() : null;
}

function safeUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function domainOf(value: string) {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; }
}

function row(input: { title?: unknown; url?: unknown; snippet?: unknown; date?: unknown }): ResultRow | null {
  const title = cleanText(input.title, 400);
  const url = safeUrl(input.url);
  if (!title || !url) return null;
  return { title, url, snippet: cleanText(input.snippet), publishedAt: parseDate(input.date) };
}

async function fetchJson(url: string, init?: RequestInit) {
  const started = Date.now();
  try {
    const response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    const json = await response.json().catch(() => null);
    return { response, json, latencyMs: Date.now() - started, error: null as string | null };
  } catch (error) {
    return { response: null, json: null, latencyMs: Date.now() - started, error: error instanceof Error ? error.message : String(error) };
  }
}

async function brave(queryId: string, query: string, env: NodeJS.ProcessEnv): Promise<QueryRun> {
  const key = env.BRAVE_SEARCH_API_KEY?.trim() || env.BRAVE_API_KEY?.trim();
  if (!key) return { provider: "brave", queryId, configured: false, status: "not_configured", httpStatus: null, latencyMs: 0, results: [], note: "BRAVE_SEARCH_API_KEY/BRAVE_API_KEY absent" };
  const params = new URLSearchParams({ q: query, count: String(MAX_RESULTS), freshness: "pw", search_lang: "en", safesearch: "moderate", text_decorations: "false" });
  const out = await fetchJson(`https://api.search.brave.com/res/v1/web/search?${params}`, { headers: { Accept: "application/json", "X-Subscription-Token": key } });
  if (!out.response?.ok) return { provider: "brave", queryId, configured: true, status: "error", httpStatus: out.response?.status ?? null, latencyMs: out.latencyMs, results: [], note: out.error || `HTTP ${out.response?.status}` };
  const payload = out.json as { web?: { results?: Record<string, unknown>[] }; news?: { results?: Record<string, unknown>[] } } | null;
  const items = [...(payload?.news?.results || []), ...(payload?.web?.results || [])].map((r) => row({ title: r.title, url: r.url, snippet: r.description ?? r.snippet, date: r.page_age ?? r.age ?? r.published_at ?? r.publishedAt })).filter((r): r is ResultRow => Boolean(r)).slice(0, MAX_RESULTS);
  return { provider: "brave", queryId, configured: true, status: "ok", httpStatus: out.response.status, latencyMs: out.latencyMs, results: items, note: `${items.length} result(s)` };
}

async function exa(queryId: string, query: string, env: NodeJS.ProcessEnv): Promise<QueryRun> {
  const key = env.EXA_API_KEY?.trim();
  if (!key) return { provider: "exa", queryId, configured: false, status: "not_configured", httpStatus: null, latencyMs: 0, results: [], note: "EXA_API_KEY absent" };
  const out = await fetchJson("https://api.exa.ai/search", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", "x-api-key": key }, body: JSON.stringify({ query, type: "auto", numResults: MAX_RESULTS, startPublishedDate: new Date(Date.now() - WINDOW_MS).toISOString(), contents: { highlights: { maxCharacters: 600 } } }) });
  if (!out.response?.ok) return { provider: "exa", queryId, configured: true, status: "error", httpStatus: out.response?.status ?? null, latencyMs: out.latencyMs, results: [], note: out.error || `HTTP ${out.response?.status}` };
  const payload = out.json as { results?: Record<string, unknown>[] } | null;
  const items = (payload?.results || []).map((r) => row({ title: r.title, url: r.url, snippet: Array.isArray(r.highlights) ? r.highlights.join(" ") : (r.text ?? r.summary), date: r.publishedDate ?? r.published_at ?? r.publishedAt })).filter((r): r is ResultRow => Boolean(r)).slice(0, MAX_RESULTS);
  return { provider: "exa", queryId, configured: true, status: "ok", httpStatus: out.response.status, latencyMs: out.latencyMs, results: items, note: `${items.length} result(s)` };
}

async function tavily(queryId: string, query: string, env: NodeJS.ProcessEnv): Promise<QueryRun> {
  const key = env.TAVILY_API_KEY?.trim();
  if (!key) return { provider: "tavily", queryId, configured: false, status: "not_configured", httpStatus: null, latencyMs: 0, results: [], note: "TAVILY_API_KEY absent" };
  const out = await fetchJson("https://api.tavily.com/search", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ query, search_depth: "basic", topic: "news", time_range: "week", max_results: MAX_RESULTS, include_answer: false, include_raw_content: false }) });
  if (!out.response?.ok) return { provider: "tavily", queryId, configured: true, status: "error", httpStatus: out.response?.status ?? null, latencyMs: out.latencyMs, results: [], note: out.error || `HTTP ${out.response?.status}` };
  const payload = out.json as { results?: Record<string, unknown>[] } | null;
  const items = (payload?.results || []).map((r) => row({ title: r.title, url: r.url, snippet: r.content ?? r.description, date: r.published_date ?? r.publishedAt ?? r.date })).filter((r): r is ResultRow => Boolean(r)).slice(0, MAX_RESULTS);
  return { provider: "tavily", queryId, configured: true, status: "ok", httpStatus: out.response.status, latencyMs: out.latencyMs, results: items, note: `${items.length} result(s)` };
}

async function gdelt(queryId: string, query: string): Promise<QueryRun> {
  const terms = query.replace(/\bAugust\s+2026\b/gi, "").trim().split(/\s+/).slice(0, 12).join(" OR ");
  const params = new URLSearchParams({ query: `(${terms})`, mode: "ArtList", maxrecords: String(MAX_RESULTS), timespan: "72h", sort: "DateDesc", format: "json" });
  const out = await fetchJson(`https://api.gdeltproject.org/api/v2/doc/doc?${params}`, { headers: { Accept: "application/json" } });
  if (!out.response?.ok) return { provider: "gdelt", queryId, configured: true, status: "error", httpStatus: out.response?.status ?? null, latencyMs: out.latencyMs, results: [], note: out.error || `HTTP ${out.response?.status}` };
  const payload = out.json as { articles?: Record<string, unknown>[] } | null;
  const items = (payload?.articles || []).map((r) => row({ title: r.title, url: r.url, snippet: [r.domain, r.sourcecountry, r.language].filter(Boolean).join(" · "), date: r.seendate ?? r.date })).filter((r): r is ResultRow => Boolean(r)).slice(0, MAX_RESULTS);
  return { provider: "gdelt", queryId, configured: true, status: "ok", httpStatus: out.response.status, latencyMs: out.latencyMs, results: items, note: `${items.length} result(s)` };
}

async function apify(env: NodeJS.ProcessEnv): Promise<QueryRun> {
  const token = env.APIFY_API_TOKEN?.trim();
  const taskId = env.APIFY_RESEARCH_TASK_ID?.trim();
  if (!token || !taskId) return { provider: "apify", queryId: "specialist-task", configured: false, status: "not_configured", httpStatus: null, latencyMs: 0, results: [], note: "APIFY_API_TOKEN/APIFY_RESEARCH_TASK_ID absent" };
  const out = await fetchJson(`https://api.apify.com/v2/actor-tasks/${encodeURIComponent(taskId)}/run-sync-get-dataset-items?format=json&clean=1&timeout=12&limit=${MAX_RESULTS}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  if (!out.response?.ok) return { provider: "apify", queryId: "specialist-task", configured: true, status: "error", httpStatus: out.response?.status ?? null, latencyMs: out.latencyMs, results: [], note: out.error || `HTTP ${out.response?.status}` };
  const payload = Array.isArray(out.json) ? out.json.filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === "object") : [];
  const items = payload.map((r) => row({ title: r.title ?? r.name ?? r.headline, url: r.url ?? r.link ?? r.sourceUrl ?? r.sourceURL, snippet: r.summary ?? r.description ?? r.text ?? r.content, date: r.publishedAt ?? r.published_at ?? r.publishedDate ?? r.date })).filter((r): r is ResultRow => Boolean(r)).slice(0, MAX_RESULTS);
  return { provider: "apify", queryId: "specialist-task", configured: true, status: "ok", httpStatus: out.response.status, latencyMs: out.latencyMs, results: items, note: `${items.length} result(s)` };
}

function queryTokens(queryId: string) {
  const q = PROVIDER_BENCHMARK_QUERIES.find((item) => item.id === queryId)?.query || "";
  return new Set(q.toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length >= 3 && !STOPWORDS.has(x)));
}

function relevance(run: QueryRun) {
  const terms = queryTokens(run.queryId);
  if (!terms.size || !run.results.length) return 0;
  const perResult = run.results.map((item) => {
    const text = `${item.title} ${item.snippet}`.toLowerCase();
    let hits = 0;
    for (const term of terms) if (text.includes(term)) hits += 1;
    return Math.min(1, hits / Math.min(4, terms.size));
  });
  return perResult.reduce((a, b) => a + b, 0) / perResult.length;
}

export function summariseProviderRuns(runs: QueryRun[], now = new Date()) {
  const providers: BenchmarkProvider[] = ["brave", "exa", "tavily", "gdelt", "apify"];
  const allUrlOwners = new Map<string, Set<BenchmarkProvider>>();
  for (const run of runs) for (const item of run.results) {
    const set = allUrlOwners.get(item.url) || new Set<BenchmarkProvider>();
    set.add(run.provider); allUrlOwners.set(item.url, set);
  }
  return providers.map((provider) => {
    const subset = runs.filter((run) => run.provider === provider);
    const configured = subset.some((run) => run.configured);
    const ok = subset.filter((run) => run.status === "ok");
    const results = ok.flatMap((run) => run.results);
    const domains = new Set(results.map((r) => domainOf(r.url)).filter(Boolean));
    const dated = results.filter((r) => r.publishedAt);
    const fresh = dated.filter((r) => Math.abs(now.getTime() - Date.parse(r.publishedAt!)) <= WINDOW_MS);
    const syndicated = results.filter((r) => SYNDICATION_DOMAINS.has(domainOf(r.url)));
    const crossProviderDupes = results.filter((r) => (allUrlOwners.get(r.url)?.size || 0) > 1);
    const relRuns = ok.filter((run) => run.queryId !== "specialist-task");
    return {
      provider,
      configured,
      successfulQueries: ok.length,
      attemptedQueries: subset.length,
      errorQueries: subset.filter((run) => run.status === "error").length,
      resultCount: results.length,
      avgLatencyMs: ok.length ? Math.round(ok.reduce((sum, run) => sum + run.latencyMs, 0) / ok.length) : null,
      dateCoverage: results.length ? dated.length / results.length : 0,
      freshCoverageAmongDated: dated.length ? fresh.length / dated.length : 0,
      domainDiversity: results.length ? domains.size / results.length : 0,
      syndicationRiskRatio: results.length ? syndicated.length / results.length : 0,
      crossProviderDuplicateRatio: results.length ? crossProviderDupes.length / results.length : 0,
      relevanceScore: relRuns.length ? relRuns.reduce((sum, run) => sum + relevance(run), 0) / relRuns.length : null,
    };
  });
}

export async function runProviderBenchmark(env: NodeJS.ProcessEnv = process.env) {
  const startedAt = new Date();
  const queryRuns: QueryRun[] = [];
  for (const item of PROVIDER_BENCHMARK_QUERIES) {
    const batch = await Promise.all([
      brave(item.id, item.query, env),
      exa(item.id, item.query, env),
      tavily(item.id, item.query, env),
      gdelt(item.id, item.query),
    ]);
    queryRuns.push(...batch);
  }
  queryRuns.push(await apify(env));
  return {
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    queryCount: PROVIDER_BENCHMARK_QUERIES.length,
    providers: summariseProviderRuns(queryRuns, startedAt),
    runs: queryRuns,
    secretValuesReturned: false,
    persistence: "none",
    reasoning: "none",
  };
}
