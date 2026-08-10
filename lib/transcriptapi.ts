export const TRANSCRIPT_API_BASE_URL = "https://transcriptapi.com/api/v2";

export type TranscriptErrorCode =
  | "invalid_video_url"
  | "video_not_found"
  | "video_private"
  | "video_deleted"
  | "transcript_missing"
  | "language_unavailable"
  | "provider_auth_error"
  | "provider_payment_required"
  | "provider_rate_limit"
  | "provider_server_error"
  | "network_error"
  | "timeout"
  | "malformed_provider_response"
  | "unknown";

export type TranscriptApiLanguage = {
  code: string;
  name: string;
};

export type TranscriptApiInfo = {
  videoId: string;
  title: string | null;
  channel: string | null;
  authorUrl: string | null;
  thumbnailUrl: string | null;
  availableLanguages: TranscriptApiLanguage[];
  httpStatus: number;
};

export type TranscriptSegment = {
  startSeconds: number;
  durationSeconds: number;
  endSeconds: number;
  text: string;
};

export type TranscriptApiTranscript = {
  videoId: string;
  language: string;
  segments: TranscriptSegment[];
  text: string;
  durationSeconds: number | null;
  metadata: Record<string, unknown>;
  httpStatus: number;
  cacheStatus: string | null;
};

export type TranscriptApiRetrieval = {
  info: TranscriptApiInfo;
  transcript: TranscriptApiTranscript;
};

export type TranscriptApiClientOptions = {
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  timeoutMs?: number;
  maxAttempts?: number;
  baseUrl?: string;
};

type ErrorDetails = {
  code: TranscriptErrorCode;
  httpStatus: number | null;
  retryable: boolean;
  retryAfterSeconds?: number | null;
  providerMessage?: string | null;
};

export class TranscriptApiError extends Error {
  readonly code: TranscriptErrorCode;
  readonly httpStatus: number | null;
  readonly retryable: boolean;
  readonly retryAfterSeconds: number | null;
  readonly providerMessage: string | null;

  constructor(message: string, details: ErrorDetails) {
    super(message);
    this.name = "TranscriptApiError";
    this.code = details.code;
    this.httpStatus = details.httpStatus;
    this.retryable = details.retryable;
    this.retryAfterSeconds = details.retryAfterSeconds ?? null;
    this.providerMessage = details.providerMessage ?? null;
  }
}

type ProviderResponse = {
  response: Response;
  body: Record<string, unknown>;
};

const defaultSleep = (milliseconds: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, milliseconds);
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function videoReferenceValid(value: string) {
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i.test(url.hostname);
  } catch {
    return false;
  }
}

function providerMessage(body: unknown, fallback: string) {
  if (!isRecord(body)) return fallback;
  const direct = [body.message, body.detail, body.error_description].find((value) => typeof value === "string");
  if (typeof direct === "string" && direct.trim()) return direct.trim().slice(0, 1_000);
  if (isRecord(body.detail) && typeof body.detail.message === "string" && body.detail.message.trim()) {
    return body.detail.message.trim().slice(0, 1_000);
  }
  if (typeof body.error === "string" && body.error.trim()) return body.error.trim().slice(0, 1_000);
  if (isRecord(body.error)) {
    const nested = [body.error.message, body.error.detail].find((value) => typeof value === "string");
    if (typeof nested === "string" && nested.trim()) return nested.trim().slice(0, 1_000);
  }
  return fallback;
}

function classifyProviderFailure(status: number, body: unknown, endpoint: "info" | "transcript") {
  const message = providerMessage(body, `TranscriptAPI request failed with HTTP ${status}.`);
  const lower = message.toLowerCase();
  if (status === 400) return { code: "invalid_video_url" as const, retryable: false, message };
  if (status === 401 || status === 403) return { code: "provider_auth_error" as const, retryable: false, message };
  if (status === 402) return { code: "provider_payment_required" as const, retryable: false, message };
  if (status === 408) return { code: "timeout" as const, retryable: true, message };
  if (status === 429) return { code: "provider_rate_limit" as const, retryable: true, message };
  if (status >= 500) return { code: "provider_server_error" as const, retryable: true, message };
  if (status === 404 || status === 422) {
    if (/private|members.only|sign in/.test(lower)) return { code: "video_private" as const, retryable: false, message };
    if (/deleted|removed/.test(lower)) return { code: "video_deleted" as const, retryable: false, message };
    if (/video.+not found|does not exist|invalid video/.test(lower)) return { code: "video_not_found" as const, retryable: false, message };
    if (endpoint === "transcript" && /language|languages|caption track/.test(lower)) {
      return { code: "language_unavailable" as const, retryable: false, message };
    }
    if (status === 422 && /url|video id|video_url/.test(lower)) {
      return { code: "invalid_video_url" as const, retryable: false, message };
    }
    return { code: "transcript_missing" as const, retryable: false, message };
  }
  return { code: "unknown" as const, retryable: false, message };
}

function retryAfterSeconds(response: Response) {
  const value = response.headers.get("Retry-After");
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return null;
  return Math.max(0, Math.ceil((date - Date.now()) / 1_000));
}

function asTranscriptApiError(error: unknown, fallbackCode: TranscriptErrorCode = "unknown") {
  if (error instanceof TranscriptApiError) return error;
  if (error instanceof Error && error.name === "AbortError") {
    return new TranscriptApiError("TranscriptAPI request timed out.", {
      code: "timeout",
      httpStatus: null,
      retryable: true,
    });
  }
  return new TranscriptApiError(
    error instanceof Error ? error.message : "Unknown TranscriptAPI request failure.",
    { code: fallbackCode, httpStatus: null, retryable: fallbackCode === "network_error" },
  );
}

async function requestJson(
  endpoint: "info" | "transcript",
  params: URLSearchParams,
  apiKey: string,
  options: TranscriptApiClientOptions,
): Promise<ProviderResponse> {
  if (!apiKey.trim()) {
    throw new TranscriptApiError("TranscriptAPI credential is not configured.", {
      code: "provider_auth_error",
      httpStatus: null,
      retryable: false,
    });
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const attempts = Math.max(1, Math.min(3, options.maxAttempts ?? 3));
  const timeoutMs = Math.max(1, options.timeoutMs ?? 30_000);
  const baseUrl = (options.baseUrl ?? TRANSCRIPT_API_BASE_URL).replace(/\/$/, "");

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${baseUrl}/youtube/${endpoint}?${params.toString()}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        cache: "no-store",
        signal: controller.signal,
      });
      const raw = await response.text();
      let parsed: unknown = {};
      if (raw.trim()) {
        try {
          parsed = JSON.parse(raw);
        } catch {
          if (response.ok) {
            throw new TranscriptApiError("TranscriptAPI returned malformed JSON.", {
              code: "malformed_provider_response",
              httpStatus: response.status,
              retryable: false,
            });
          }
          parsed = { message: raw.slice(0, 1_000) };
        }
      }
      if (!response.ok) {
        const classified = classifyProviderFailure(response.status, parsed, endpoint);
        const retryAfter = retryAfterSeconds(response);
        const error = new TranscriptApiError(classified.message, {
          code: classified.code,
          httpStatus: response.status,
          retryable: classified.retryable,
          retryAfterSeconds: retryAfter,
          providerMessage: classified.message,
        });
        if (classified.retryable && attempt < attempts) {
          const delay = retryAfter == null ? 1_000 * (2 ** (attempt - 1)) : retryAfter * 1_000;
          await sleep(Math.min(delay, 30_000));
          continue;
        }
        throw error;
      }
      if (!isRecord(parsed)) {
        throw new TranscriptApiError("TranscriptAPI returned an unexpected JSON payload.", {
          code: "malformed_provider_response",
          httpStatus: response.status,
          retryable: false,
        });
      }
      return { response, body: parsed };
    } catch (error) {
      const normalized = error instanceof TranscriptApiError
        ? error
        : asTranscriptApiError(error, error instanceof Error && error.name === "AbortError" ? "timeout" : "network_error");
      if (normalized.retryable && attempt < attempts) {
        await sleep(1_000 * (2 ** (attempt - 1)));
        continue;
      }
      throw normalized;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new TranscriptApiError("TranscriptAPI request exhausted its retry budget.", {
    code: "unknown",
    httpStatus: null,
    retryable: false,
  });
}

export async function fetchTranscriptApiInfo(
  videoReference: string,
  apiKey: string,
  options: TranscriptApiClientOptions = {},
): Promise<TranscriptApiInfo> {
  if (!videoReferenceValid(videoReference)) {
    throw new TranscriptApiError("The YouTube video reference is invalid.", {
      code: "invalid_video_url",
      httpStatus: null,
      retryable: false,
    });
  }
  const params = new URLSearchParams({ video_url: videoReference });
  const { response, body } = await requestJson("info", params, apiKey, options);
  const videoId = typeof body.video_id === "string" ? body.video_id : null;
  const metadata = isRecord(body.metadata) ? body.metadata : {};
  if (!videoId) {
    throw new TranscriptApiError("TranscriptAPI info response did not contain a video ID.", {
      code: "malformed_provider_response",
      httpStatus: response.status,
      retryable: false,
    });
  }
  const languages = Array.isArray(body.available_languages)
    ? body.available_languages.flatMap((value): TranscriptApiLanguage[] => {
      if (!isRecord(value) || typeof value.code !== "string") return [];
      return [{ code: value.code, name: typeof value.name === "string" ? value.name : value.code }];
    })
    : [];
  return {
    videoId,
    title: typeof metadata.title === "string" ? metadata.title : null,
    channel: typeof metadata.author_name === "string" ? metadata.author_name : null,
    authorUrl: typeof metadata.author_url === "string" ? metadata.author_url : null,
    thumbnailUrl: typeof metadata.thumbnail_url === "string" ? metadata.thumbnail_url : null,
    availableLanguages: languages,
    httpStatus: response.status,
  };
}

export function transcriptLanguagePriority(languages: TranscriptApiLanguage[]) {
  const available = [...new Set(languages.map((language) => language.code).filter(Boolean))];
  const preferred = ["en", "asr-en"].filter((code) => available.includes(code));
  return [...preferred, ...available.filter((code) => !preferred.includes(code))].slice(0, 10);
}

export async function fetchTranscriptApiTranscript(
  videoReference: string,
  apiKey: string,
  languages: string[] = [],
  options: TranscriptApiClientOptions = {},
): Promise<TranscriptApiTranscript> {
  if (!videoReferenceValid(videoReference)) {
    throw new TranscriptApiError("The YouTube video reference is invalid.", {
      code: "invalid_video_url",
      httpStatus: null,
      retryable: false,
    });
  }
  const params = new URLSearchParams({
    video_url: videoReference,
    format: "json",
    include_timestamp: "true",
    send_metadata: "true",
  });
  if (languages.length) params.set("language", [...new Set(languages)].slice(0, 10).join(","));
  const { response, body } = await requestJson("transcript", params, apiKey, options);
  const videoId = typeof body.video_id === "string" ? body.video_id : null;
  const language = typeof body.language === "string" ? body.language : null;
  if (!videoId || !language || !Array.isArray(body.transcript)) {
    throw new TranscriptApiError("TranscriptAPI transcript response is missing required fields.", {
      code: "malformed_provider_response",
      httpStatus: response.status,
      retryable: false,
    });
  }
  const segments: TranscriptSegment[] = [];
  for (const value of body.transcript) {
    if (!isRecord(value)) {
      throw new TranscriptApiError("TranscriptAPI returned a malformed transcript segment.", {
        code: "malformed_provider_response",
        httpStatus: response.status,
        retryable: false,
      });
    }
    const text = typeof value.text === "string" ? value.text.trim() : "";
    const start = Number(value.start);
    const duration = Number(value.duration);
    if (!text) continue;
    if (!Number.isFinite(start) || start < 0 || !Number.isFinite(duration) || duration < 0) {
      throw new TranscriptApiError("TranscriptAPI returned a transcript segment without valid timestamps.", {
        code: "malformed_provider_response",
        httpStatus: response.status,
        retryable: false,
      });
    }
    segments.push({
      startSeconds: start,
      durationSeconds: duration,
      endSeconds: start + duration,
      text,
    });
  }
  if (!segments.length) {
    throw new TranscriptApiError("TranscriptAPI returned an empty transcript.", {
      code: "transcript_missing",
      httpStatus: response.status,
      retryable: false,
    });
  }
  const duration = Number(body.length_seconds);
  return {
    videoId,
    language,
    segments,
    text: segments.map((segment) => segment.text).join(" "),
    durationSeconds: Number.isFinite(duration) && duration >= 0 ? Math.round(duration) : null,
    metadata: isRecord(body.metadata) ? body.metadata : {},
    httpStatus: response.status,
    cacheStatus: response.headers.get("X-Cache-Status"),
  };
}

export async function retrieveTranscriptApiVideo(
  videoReference: string,
  apiKey: string,
  options: TranscriptApiClientOptions = {},
): Promise<TranscriptApiRetrieval> {
  const info = await fetchTranscriptApiInfo(videoReference, apiKey, options);
  const transcript = await fetchTranscriptApiTranscript(
    videoReference,
    apiKey,
    transcriptLanguagePriority(info.availableLanguages),
    options,
  );
  return { info, transcript };
}

export function normalizeTranscriptApiError(error: unknown) {
  return asTranscriptApiError(error);
}

