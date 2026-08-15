export type FirecrawlScrapeResult =
  | {
    ok: true;
    rawHtml: string;
    sourceUrl: string;
    resolvedUrl: string | null;
    statusCode: number | null;
    warning: string | null;
  }
  | {
    ok: false;
    code: "not_configured" | "invalid_url" | "http_error" | "invalid_response" | "timeout" | "network_error";
    detail: string;
    retryable: boolean;
  };

const FIRECRAWL_SCRAPE_URL = "https://api.firecrawl.dev/v2/scrape";
const DEFAULT_TIMEOUT_MS = 12_000;

export function firecrawlConfigured() {
  return Boolean(process.env.FIRECRAWL_API_KEY?.trim());
}

function publicHttpsUrl(value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return null;
    if (parsed.username || parsed.password) return null;
    if (["localhost", "127.0.0.1", "::1"].includes(parsed.hostname.toLowerCase())) return null;
    return parsed;
  } catch {
    return null;
  }
}

function safeMessage(value: unknown) {
  return typeof value === "string" ? value.slice(0, 500) : "";
}

export async function scrapePublicUrlWithFirecrawl(
  url: string,
  options: {
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<FirecrawlScrapeResult> {
  const key = process.env.FIRECRAWL_API_KEY?.trim();
  if (!key) {
    return { ok: false, code: "not_configured", detail: "FIRECRAWL_API_KEY is not configured.", retryable: false };
  }

  const parsed = publicHttpsUrl(url);
  if (!parsed) {
    return { ok: false, code: "invalid_url", detail: "Firecrawl fallback accepts only public HTTPS URLs without embedded credentials.", retryable: false };
  }

  const timeoutMs = Math.max(2_000, Math.min(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, 20_000));
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(FIRECRAWL_SCRAPE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        url: parsed.toString(),
        formats: ["rawHtml"],
        onlyMainContent: false,
        removeBase64Images: true,
        blockAds: true,
        proxy: "auto",
        storeInCache: true,
        timeout: Math.min(timeoutMs - 500, 15_000),
      }),
    });

    const payload = await response.json().catch(() => null) as {
      success?: boolean;
      error?: unknown;
      data?: {
        rawHtml?: unknown;
        html?: unknown;
        warning?: unknown;
        metadata?: {
          sourceURL?: unknown;
          url?: unknown;
          statusCode?: unknown;
          error?: unknown;
        };
      };
    } | null;

    if (!response.ok || payload?.success === false) {
      const detail = safeMessage(payload?.error)
        || safeMessage(payload?.data?.metadata?.error)
        || `Firecrawl returned HTTP ${response.status}.`;
      return {
        ok: false,
        code: "http_error",
        detail,
        retryable: response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500,
      };
    }

    const rawHtml = typeof payload?.data?.rawHtml === "string"
      ? payload.data.rawHtml
      : typeof payload?.data?.html === "string"
        ? payload.data.html
        : "";
    if (!rawHtml.trim()) {
      return { ok: false, code: "invalid_response", detail: "Firecrawl returned no raw HTML content.", retryable: true };
    }

    const metadata = payload?.data?.metadata;
    return {
      ok: true,
      rawHtml,
      sourceUrl: parsed.toString(),
      resolvedUrl: typeof metadata?.url === "string"
        ? metadata.url
        : typeof metadata?.sourceURL === "string"
          ? metadata.sourceURL
          : null,
      statusCode: typeof metadata?.statusCode === "number" ? metadata.statusCode : null,
      warning: typeof payload?.data?.warning === "string" ? payload.data.warning.slice(0, 500) : null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Firecrawl request failure.";
    const timeout = /abort|timeout/i.test(message);
    return {
      ok: false,
      code: timeout ? "timeout" : "network_error",
      detail: message.slice(0, 500),
      retryable: true,
    };
  }
}
