import {
  TranscriptApiError,
  type TranscriptApiRetrieval,
  type TranscriptSegment,
} from "./transcriptapi.ts";

export const SUPADATA_BASE_URL = "https://api.supadata.ai/v1";

export type SupadataClientOptions = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  baseUrl?: string;
};

type SupadataSegment = {
  text?: unknown;
  offset?: unknown;
  duration?: unknown;
  lang?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function messageFromBody(body: unknown, fallback: string) {
  if (!isRecord(body)) return fallback;
  const direct = [body.message, body.detail, body.error].find((value) => typeof value === "string");
  if (typeof direct === "string" && direct.trim()) return direct.trim().slice(0, 1_000);
  if (isRecord(body.error) && typeof body.error.message === "string" && body.error.message.trim()) {
    return body.error.message.trim().slice(0, 1_000);
  }
  return fallback;
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

function classifyFailure(status: number, body: unknown) {
  const message = messageFromBody(body, `Supadata request failed with HTTP ${status}.`);
  const lower = message.toLowerCase();
  if (status === 206) return { code: "transcript_missing" as const, retryable: false, message };
  if (status === 400) return { code: "invalid_video_url" as const, retryable: false, message };
  if (status === 401 || status === 403) return { code: "provider_auth_error" as const, retryable: false, message };
  if (status === 404) {
    if (/video.+not found|does not exist|invalid video/.test(lower)) {
      return { code: "video_not_found" as const, retryable: false, message };
    }
    return { code: "transcript_missing" as const, retryable: false, message };
  }
  if (status === 408) return { code: "timeout" as const, retryable: true, message };
  if (status === 429) return { code: "provider_rate_limit" as const, retryable: true, message };
  if (status >= 500) return { code: "provider_server_error" as const, retryable: true, message };
  return { code: "unknown" as const, retryable: false, message };
}

function billableRequests(response: Response) {
  const value = Number(response.headers.get("x-billable-requests"));
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export async function retrieveSupadataVideo(
  videoId: string,
  apiKey: string,
  options: SupadataClientOptions = {},
): Promise<TranscriptApiRetrieval> {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    throw new TranscriptApiError("The YouTube video ID is invalid.", {
      code: "invalid_video_url",
      httpStatus: null,
      retryable: false,
    });
  }
  if (!apiKey.trim()) {
    throw new TranscriptApiError("Supadata credential is not configured.", {
      code: "provider_auth_error",
      httpStatus: null,
      retryable: false,
    });
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = Math.max(1, options.timeoutMs ?? 8_000);
  const baseUrl = (options.baseUrl ?? SUPADATA_BASE_URL).replace(/\/$/, "");
  const params = new URLSearchParams({
    url: `https://www.youtube.com/watch?v=${videoId}`,
    lang: "en",
    text: "false",
    mode: "native",
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${baseUrl}/transcript?${params.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "x-api-key": apiKey,
      },
      cache: "no-store",
      signal: controller.signal,
    });
    const raw = await response.text();
    let body: unknown = {};
    if (raw.trim()) {
      try {
        body = JSON.parse(raw);
      } catch {
        if (response.ok) {
          throw new TranscriptApiError("Supadata returned malformed JSON.", {
            code: "malformed_provider_response",
            httpStatus: response.status,
            retryable: false,
          });
        }
        body = { message: raw.slice(0, 1_000) };
      }
    }

    if (response.status === 202) {
      throw new TranscriptApiError(
        "Supadata returned an asynchronous job for a mode=native request; no generated transcript was requested or accepted.",
        {
          code: "provider_server_error",
          httpStatus: response.status,
          retryable: true,
        },
      );
    }

    if (!response.ok) {
      const classified = classifyFailure(response.status, body);
      throw new TranscriptApiError(classified.message, {
        code: classified.code,
        httpStatus: response.status,
        retryable: classified.retryable,
        retryAfterSeconds: retryAfterSeconds(response),
        providerMessage: classified.message,
      });
    }

    if (!isRecord(body) || !Array.isArray(body.content)) {
      throw new TranscriptApiError("Supadata transcript response is missing timestamped content.", {
        code: "malformed_provider_response",
        httpStatus: response.status,
        retryable: false,
      });
    }

    const segments: TranscriptSegment[] = [];
    for (const value of body.content as SupadataSegment[]) {
      if (!isRecord(value)) {
        throw new TranscriptApiError("Supadata returned a malformed transcript segment.", {
          code: "malformed_provider_response",
          httpStatus: response.status,
          retryable: false,
        });
      }
      const text = typeof value.text === "string" ? value.text.trim() : "";
      if (!text) continue;
      const offsetMs = Number(value.offset);
      const durationMs = Number(value.duration);
      if (!Number.isFinite(offsetMs) || offsetMs < 0 || !Number.isFinite(durationMs) || durationMs < 0) {
        throw new TranscriptApiError("Supadata returned a transcript segment without valid millisecond timestamps.", {
          code: "malformed_provider_response",
          httpStatus: response.status,
          retryable: false,
        });
      }
      const startSeconds = offsetMs / 1_000;
      const durationSeconds = durationMs / 1_000;
      segments.push({
        startSeconds,
        durationSeconds,
        endSeconds: startSeconds + durationSeconds,
        text,
      });
    }

    if (!segments.length) {
      throw new TranscriptApiError("Supadata returned no native caption text.", {
        code: "transcript_missing",
        httpStatus: response.status,
        retryable: false,
      });
    }

    const language = typeof body.lang === "string" && body.lang.trim() ? body.lang : "unknown";
    const availableLanguages = Array.isArray(body.availableLangs)
      ? body.availableLangs.filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
      : [];
    const durationSeconds = Math.max(...segments.map((segment) => segment.endSeconds));

    return {
      info: {
        videoId,
        title: null,
        channel: null,
        authorUrl: null,
        thumbnailUrl: null,
        availableLanguages: availableLanguages.map((code) => ({ code, name: code })),
        httpStatus: response.status,
      },
      transcript: {
        videoId,
        language,
        segments,
        text: segments.map((segment) => segment.text).join(" "),
        durationSeconds: Number.isFinite(durationSeconds) ? Math.ceil(durationSeconds) : null,
        metadata: {
          retrievalProvider: "supadata",
          transcriptSource: "native_caption",
          mode: "native",
          billableRequests: billableRequests(response),
          availableLangs: availableLanguages,
        },
        httpStatus: response.status,
        cacheStatus: null,
      },
    };
  } catch (error) {
    if (error instanceof TranscriptApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new TranscriptApiError("Supadata request timed out.", {
        code: "timeout",
        httpStatus: null,
        retryable: true,
      });
    }
    throw new TranscriptApiError(error instanceof Error ? error.message : "Unknown Supadata request failure.", {
      code: "network_error",
      httpStatus: null,
      retryable: true,
    });
  } finally {
    clearTimeout(timeout);
  }
}
