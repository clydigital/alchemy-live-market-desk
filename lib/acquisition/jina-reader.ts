export type JinaReaderErrorCode =
  | "http_error"
  | "timeout"
  | "network_error"
  | "empty_response";

export type JinaReaderResult = {
  ok: boolean;
  sourceUrl: string;
  readerUrl: string;
  status: number | null;
  statusText: string | null;
  usedAuthentication: boolean;
  text: string;
  errorCode: JinaReaderErrorCode | null;
  errorDetail: string | null;
};

export type JinaReaderOptions = {
  sourceUrl: string;
  apiKey?: string | null;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_ERROR_DETAIL = 600;

export function buildJinaReaderUrl(sourceUrl: string) {
  const parsed = new URL(sourceUrl);
  if (parsed.protocol !== "https:") {
    throw new Error("Jina Reader sources must use HTTPS.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Jina Reader source URLs cannot contain credentials.");
  }
  return `https://r.jina.ai/${parsed.toString()}`;
}

function isTimeout(error: unknown) {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

function cleanErrorDetail(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_ERROR_DETAIL) || null;
}

export async function fetchJinaReader(options: JinaReaderOptions): Promise<JinaReaderResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiKey = options.apiKey?.trim() || "";
  const readerUrl = buildJinaReaderUrl(options.sourceUrl);
  const timeoutMs = Math.max(1_000, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const headers = new Headers({
    Accept: "text/plain, text/markdown;q=0.9, */*;q=0.1",
    "X-Return-Format": "markdown",
  });

  if (apiKey) headers.set("Authorization", `Bearer ${apiKey}`);

  try {
    const response = await fetchImpl(readerUrl, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const errorDetail = cleanErrorDetail(await response.text().catch(() => ""));
      return {
        ok: false,
        sourceUrl: options.sourceUrl,
        readerUrl,
        status: response.status,
        statusText: response.statusText,
        usedAuthentication: Boolean(apiKey),
        text: "",
        errorCode: "http_error",
        errorDetail,
      };
    }

    const text = await response.text();
    if (!text.trim()) {
      return {
        ok: false,
        sourceUrl: options.sourceUrl,
        readerUrl,
        status: response.status,
        statusText: response.statusText,
        usedAuthentication: Boolean(apiKey),
        text: "",
        errorCode: "empty_response",
        errorDetail: "Jina Reader returned an empty response body.",
      };
    }

    return {
      ok: true,
      sourceUrl: options.sourceUrl,
      readerUrl,
      status: response.status,
      statusText: response.statusText,
      usedAuthentication: Boolean(apiKey),
      text,
      errorCode: null,
      errorDetail: null,
    };
  } catch (error) {
    return {
      ok: false,
      sourceUrl: options.sourceUrl,
      readerUrl,
      status: null,
      statusText: null,
      usedAuthentication: Boolean(apiKey),
      text: "",
      errorCode: isTimeout(error) ? "timeout" : "network_error",
      errorDetail: error instanceof Error ? cleanErrorDetail(error.message) : "Unknown Jina Reader transport failure.",
    };
  }
}
