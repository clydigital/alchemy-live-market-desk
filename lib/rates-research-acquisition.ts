import { createHash } from "node:crypto";
import type { IntakeItemInput, ResearchRunInput } from "./research-update.ts";
import { buildRatesResearchPlan, parseRatesContext, RATES_CONTEXT_PREFIX, type RatesResearchTarget } from "./rates-research-plan.ts";
import { fetchSecCompanySnapshot } from "./providers/sec-edgar.ts";

const PRIMARY = ["sec.gov", "federalreserve.gov", "treasury.gov", "bls.gov", "stlouisfed.org", "nvidia.com", "microsoft.com", "apple.com", "amazon.com", "abc.xyz", "meta.com", "fb.com", "tesla.com", "micron.com", "spacex.com", "amd.com", "broadcom.com", "oracle.com", "strategy.com"];
const REPORTING = ["reuters.com", "apnews.com", "ft.com", "wsj.com", "bloomberg.com", "cnbc.com"];
const belongs = (host: string, domains: string[]) => domains.some((d) => host === d || host.endsWith(`.${d}`));
export function ratesSourceClass(url: string) {
  const host = new URL(url).hostname.toLowerCase();
  if (belongs(host, ["sec.gov"])) return "regulatory_filing";
  if (belongs(host, PRIMARY.slice(1, 5))) return "official_release";
  if (belongs(host, PRIMARY.slice(5))) return "company_primary";
  return "news_report";
}
function sourceUrl(value: unknown): string | null {
  try {
    const url = new URL(String(value));
    if (url.protocol !== "https:" || url.username || url.password || url.port
      || !belongs(url.hostname, [...PRIMARY, ...REPORTING])) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/.test(key)) url.searchParams.delete(key);
    return url.href;
  } catch { return null; }
}
function clean(value: string) {
  return value.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<nav[\s\S]*?<\/nav>|<header[\s\S]*?<\/header>|<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
}
async function boundedText(response: Response, maximum = 750000) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let result = "";
  try {
    while (result.length < maximum) {
      const part = await reader.read();
      if (part.done) break;
      result += decoder.decode(part.value, { stream: true });
    }
  } finally { await reader.cancel().catch(() => {}); }
  return result.slice(0, maximum);
}
type Options = { now?: Date; fetchImpl?: typeof fetch; env?: NodeJS.ProcessEnv; budgetMs?: number };
type Lead = { url: string; title: string };

async function search(target: RatesResearchTarget, env: NodeJS.ProcessEnv, fetchImpl: typeof fetch, signal: AbortSignal): Promise<Lead[]> {
  const key = env.BRAVE_SEARCH_API_KEY || env.BRAVE_API_KEY;
  let response: Response;
  let rows: Record<string, unknown>[] = [];
  if (key) {
    response = await fetchImpl(`https://api.search.brave.com/res/v1/web/search?${new URLSearchParams({ q: target.query, count: "4" })}`, {
      headers: { "X-Subscription-Token": key, Accept: "application/json" }, signal,
    });
    if (!response.ok) return [];
    const body = await response.json(); rows = body.web?.results || [];
  } else if (env.TAVILY_API_KEY) {
    response = await fetchImpl("https://api.tavily.com/search", { method: "POST", signal,
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ api_key: env.TAVILY_API_KEY, query: target.query, max_results: 4, include_answer: false }) });
    if (!response.ok) return [];
    rows = (await response.json()).results || [];
  } else if (env.EXA_API_KEY) {
    response = await fetchImpl("https://api.exa.ai/search", { method: "POST", signal,
      headers: { "Content-Type": "application/json", "x-api-key": env.EXA_API_KEY }, body: JSON.stringify({ query: target.query, numResults: 4, type: "auto" }) });
    if (!response.ok) return [];
    rows = (await response.json()).results || [];
  } else {
    const query = target.depth === "macro"
      ? '("Federal Reserve" OR Treasury OR NFP OR JOLTS OR Bessent) (rates OR yields OR spreads OR payrolls)'
      : `"${(target.instrument || target.subject.split(" ")[0]).replace(/"/g, "")}" (earnings OR debt OR financing OR guidance OR preferred)`;
    response = await fetchImpl(`https://api.gdeltproject.org/api/v2/doc/doc?${new URLSearchParams({ query, mode: "ArtList", format: "json", maxrecords: "4", timespan: "3months", sort: "DateDesc" })}`, { signal });
    if (!response.ok) return [];
    rows = (await response.json()).articles || [];
  }
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 4).flatMap((row) => {
    const url = sourceUrl(row.url);
    return url ? [{ url, title: typeof row.title === "string" ? row.title : target.subject }] : [];
  });
}

/** Publisher body and publisher date are mandatory. Search snippets are never evidence. */
export async function readRatesEvidence(lead: Lead, target: RatesResearchTarget, now: Date, fetchImpl: typeof fetch, signal: AbortSignal): Promise<IntakeItemInput | null> {
  let url = sourceUrl(lead.url);
  if (!url) return null;
  let response: Response | undefined;
  for (let hop = 0; hop < 4; hop++) {
    response = await fetchImpl(url, { signal, redirect: "manual", cache: "no-store", headers: { Accept: "text/html", "User-Agent": "AlchemyMarketsResearch/1.0" } });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      url = location ? sourceUrl(new URL(location, url).href) : null;
      if (!url) return null;
    } else break;
  }
  if (!response?.ok || !url || !/text\/html|application\/xhtml/i.test(response.headers.get("content-type") || "")) return null;
  const html = await boundedText(response);
  const dateText = html.match(/<meta[^>]+(?:property|name)=["'](?:article:published_time|date|datePublished)["'][^>]+content=["']([^"']+)/i)?.[1]
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:article:published_time|date|datePublished)["']/i)?.[1]
    || html.match(/"datePublished"\s*:\s*"([^"]+)"/i)?.[1]
    || html.match(/<time[^>]+datetime=["']([^"']+)/i)?.[1];
  const time = Date.parse(dateText || "");
  const maxAge = target.depth === "macro" || target.depth === "mstr_light" ? 10 : 460;
  if (!Number.isFinite(time) || time > now.getTime() || now.getTime() - time > maxAge * 86400000) return null;
  const article = html.match(/<(?:article|main)\b[^>]*>([\s\S]*?)<\/(?:article|main)>/i)?.[1] || html;
  const paragraphs = article.split(/<\/(?:p|div|li|tr|h[1-6])>/i).map(clean).filter((p) => p.length >= 60 && p.length < 8000);
  const relevant = paragraphs.filter((p) => /\b(debt|cash|maturit\w*|interest|yield|spread|rate|revenue|guidance|earnings|demand|capex|capital|valuation|multiple|dividend|preferred|convertible|payroll|JOLTS|Fed|Bessent)\b/i.test(p));
  const excerpt = relevant.slice(0, 8).join("\n").slice(0, 6500);
  if (excerpt.length < 160 || /access denied|verify you are human|enable javascript to continue/i.test(excerpt)) return null;
  const title = clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || lead.title).slice(0, 400);
  // Search relevance is not sufficient: the actual document must identify the subject.
  const subjectTokens = target.subject.split(/\s+/).filter((v) => v.length > 2 && !["Inc", "Unresolved", "reference", "Macro", "catalyst", "backdrop", "rates"].includes(v));
  const document = `${title} ${excerpt}`.toLowerCase();
  if (target.depth === "macro" && !/\b(federal reserve|fed|treasury|yield|spreads?|policy rate|payrolls?|jolts|bessent|fomc)\b/i.test(document)) return null;
  if (target.depth !== "macro" && !subjectTokens.some((token) => document.includes(token.toLowerCase()))) return null;
  if (target.instrument && !new RegExp(`\\b${target.instrument}\\b`).test(`${title} ${excerpt}`)) return null;
  const publishedAt = new Date(time).toISOString();
  const publisher = new URL(url).hostname;
  const sourceClass = ratesSourceClass(url);
  const claim = `${target.subject}. Dated supporting context published ${publishedAt}; retrieved ${now.toISOString()}. Latest available status is unverified unless this document establishes it.\n${excerpt}`;
  return {
    itemKey: `${RATES_CONTEXT_PREFIX}${createHash("sha256").update(`${url}|${target.key}|${target.triggerItemKeys.sort().join("|")}`).digest("hex").slice(0, 28)}`,
    itemType: "news", publisher, title, url, publishedAt, summary: claim,
    sourceQuality: sourceClass === "news_report" ? 80 : 95, relevance: 80, novelty: 0, materiality: 70,
    recommendedAction: "collect_evidence", transcriptStatus: "not_applicable",
    divergenceNote: RATES_CONTEXT_PREFIX + JSON.stringify({ triggerItemKeys: target.triggerItemKeys, assets: target.assets, depth: target.depth, instrument: target.instrument, retrievedAt: now.toISOString() }),
    evidence: [{ title, url, publisher, publishedAt, claim }],
    reviewReason: "Supporting context only. Preserve reporting periods, units, unknowns and exact security identity. Does not establish a new catalyst or independent corroboration of the same publisher.",
  };
}

/** One bounded best-effort attempt on every relevant validated intake, including manual transcripts. */
export async function acquireRatesResearch(input: ResearchRunInput, options: Options = {}) {
  const now = options.now || new Date();
  const env = options.env || process.env;
  const plan = buildRatesResearchPlan(input.items, now);
  if (!plan.length) return { input, diagnostics: [] as string[] };
  if ((options.budgetMs ?? 24000) <= 0) return { input, diagnostics: plan.map((target) => `${target.key}: no remaining acquisition budget; evidence unknown; base publication continues`) };
  const fetchImpl = options.fetchImpl || fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.budgetMs ?? 24000);
  const additions: IntakeItemInput[] = [];
  const diagnostics: string[] = [];
  let next = 0;
  try {
    await Promise.all(Array.from({ length: Math.min(4, plan.length) }, async () => {
      while (next < plan.length) {
        const target = plan[next++];
        if (controller.signal.aborted) { diagnostics.push(`${target.key}: budget exhausted; evidence unknown`); continue; }
        try {
          const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(7000)]);
          // Reuse the SEC adapter before web discovery. Never infer SpaceX's filing identity.
          const cik: Record<string, string> = { NVDA: "1045810", MSFT: "789019", AAPL: "320193", AMZN: "1018724", GOOGL: "1652044", META: "1326801", TSLA: "1318605", MU: "723125", AMD: "2488", AVGO: "1730168", ORCL: "1341439", MSTR: "1050446" };
          let primaryCount = 0;
          if (target.assets[0] && cik[target.assets[0]] && target.depth !== "instrument" && env.SEC_USER_AGENT) {
            const snapshot = await fetchSecCompanySnapshot(cik[target.assets[0]], env.SEC_USER_AGENT,
              (url, init) => fetchImpl(url, { ...init, signal }));
            const observations = Object.values(snapshot.metrics).flatMap((metric) => metric ? [metric.latest] : [])
              .filter((v) => Date.parse(v.filed) <= now.getTime() && Date.parse(v.periodEnd) <= now.getTime()
                && now.getTime() - Date.parse(v.periodEnd) <= 460 * 86400000);
            if (snapshot.state === "ready" && observations.length) {
              const publishedAt = observations.map((v) => v.filed).sort().at(-1)!;
              const claim = `${target.subject}. SEC XBRL observations; each line retains its own period and filing date. Do not combine mismatched periods, assume cash is unrestricted, or infer missing debt is zero.\n`
                + observations.map((v) => `${v.concept}: ${v.value} ${v.unit}; period ${v.periodStart || "instant"} to ${v.periodEnd}; filed ${v.filed}; form ${v.form}; accession ${v.accessionNumber}.`).join("\n");
              additions.push({ itemKey: `${RATES_CONTEXT_PREFIX}${createHash("sha256").update(`${snapshot.companyFactsUrl}|${target.triggerItemKeys.join("|")}`).digest("hex").slice(0, 28)}`,
                itemType: "news", publisher: snapshot.sourceName, title: `${target.subject} SEC financial context`, url: snapshot.companyFactsUrl,
                publishedAt: new Date(publishedAt).toISOString(), summary: claim, sourceQuality: 95, relevance: 80, novelty: 0, materiality: 70,
                recommendedAction: "collect_evidence", divergenceNote: RATES_CONTEXT_PREFIX + JSON.stringify({ triggerItemKeys: target.triggerItemKeys, assets: target.assets, depth: target.depth, retrievedAt: now.toISOString() }),
                evidence: [{ title: `${target.subject} SEC XBRL`, publisher: snapshot.sourceName, url: snapshot.companyFactsUrl, publishedAt: new Date(publishedAt).toISOString(), claim }],
              });
              primaryCount++;
            }
          }
          const leads = await search(target, env, fetchImpl, AbortSignal.any([controller.signal, AbortSignal.timeout(7000)]));
          const result = await Promise.all(leads.slice(0, 2).map((lead) => readRatesEvidence(lead, target, now, fetchImpl, AbortSignal.any([controller.signal, AbortSignal.timeout(5000)])).catch(() => null)));
          const usable = result.filter((v): v is IntakeItemInput => Boolean(v));
          additions.push(...usable);
          diagnostics.push(`${target.key}: attempted; ${usable.length + primaryCount} dated publisher document(s); missing fields remain unknown`);
        } catch { diagnostics.push(`${target.key}: attempted; retrieval unavailable; evidence unknown`); }
      }
    }));
  } finally { clearTimeout(timer); }
  // One publisher document is one source even if several targets discover it.
  const documents = new Map<string, IntakeItemInput>();
  for (const addition of additions.sort((a, b) => a.itemKey.localeCompare(b.itemKey))) {
    const prior = documents.get(addition.url);
    if (!prior) { documents.set(addition.url, addition); continue; }
    const left = parseRatesContext(prior.divergenceNote)!;
    const right = parseRatesContext(addition.divergenceNote)!;
    prior.divergenceNote = RATES_CONTEXT_PREFIX + JSON.stringify({ ...left,
      triggerItemKeys: [...new Set([...left.triggerItemKeys, ...right.triggerItemKeys])],
      assets: [...new Set([...left.assets, ...right.assets])],
    });
  }
  const existing = new Set(input.items.map((v) => v.itemKey));
  const retained = [...documents.values()].filter((v) => !existing.has(v.itemKey));
  return { input: { ...input, items: [...input.items, ...retained] }, diagnostics };
}
