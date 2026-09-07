import {
  TranscriptApiError,
  type TranscriptApiRetrieval,
  type TranscriptSegment,
} from "./transcriptapi.ts";

const OPERATOR_TIMEOUT_MS = 35_000;
const MAX_TRANSCRIPT_SEGMENTS = 10_000;
const MAX_TRANSCRIPT_TEXT_LENGTH = 1_000_000;

type Environment = Record<string, string | undefined>;

export type ChromeTranscriptOperatorOptions = {
  endpoint?: string;
  token?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  environment?: Environment;
};

export type BrowserChannelDiscoveryRequest = {
  channelKey: string;
  channelName: string;
  handle: string;
  cutoff: Date;
  now?: Date;
};

export type BrowserDiscoveredVideo = {
  videoId: string;
  title: string;
  url: string;
  publishedAt: string;
  isLive: boolean;
  isShort: boolean;
};

export type BrowserChannelDiscovery =
  | {
    status: "ready";
    channelId?: string;
    scannedCount: number;
    videos: BrowserDiscoveredVideo[];
    detail: string;
  }
  | {
    status: "unavailable";
    code: string;
    detail: string;
  };

type OperatorSegment = {
  startSeconds?: unknown;
  durationSeconds?: unknown;
  endSeconds?: unknown;
  text?: unknown;
};

type OperatorTranscriptResponse = {
  status?: unknown;
  code?: unknown;
  message?: unknown;
  retryable?: unknown;
  observedAt?: unknown;
  transcript?: {
    language?: unknown;
    segments?: unknown;
    text?: unknown;
    durationSeconds?: unknown;
    sourceUrl?: unknown;
  };
  video?: {
    title?: unknown;
    channel?: unknown;
    channelUrl?: unknown;
  };
};

type OperatorDiscoveryResponse = {
  status?: unknown;
  code?: unknown;
  message?: unknown;
  channel?: {
    channelId?: unknown;
    scannedCount?: unknown;
    videos?: unknown;
  };
};

type OperatorVideo = {
  videoId?: unknown;
  title?: unknown;
  url?: unknown;
  publishedLabel?: unknown;
  isLive?: unknown;
  isShort?: unknown;
};

function environmentValue(options: ChromeTranscriptOperatorOptions, name: string) {
  return options.environment?.[name] ?? process.env[name];
}

function operatorConfig(options: ChromeTranscriptOperatorOptions) {
  const endpoint = (options.endpoint ?? environmentValue(options, "CHROME_TRANSCRIPT_OPERATOR_URL") ?? "").trim();
  const token = (options.token ?? environmentValue(options, "CHROME_TRANSCRIPT_OPERATOR_TOKEN") ?? "").trim();
  return { endpoint, token };
}

/**
 * The deployment can only call a separately-operated browser worker. It must
 * never assume that a serverless function can control a user's Chrome window.
 */
export function isChromeTranscriptOperatorConfigured(options: ChromeTranscriptOperatorOptions = {}) {
  const { endpoint, token } = operatorConfig(options);
  if (!endpoint || !token) return false;
  try {
    const url = new URL(endpoint);
    const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "::1";
    return url.protocol === "https:" || loopback && url.protocol === "http:";
  } catch {
    return false;
  }
}

function validVideoId(videoId: string) {
  return /^[A-Za-z0-9_-]{11}$/.test(videoId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function responseMessage(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 1_000) : fallback;
}

function operatorError(
  message: string,
  options: { code?: ConstructorParameters<typeof TranscriptApiError>[1]["code"]; httpStatus?: number | null; retryable?: boolean } = {},
) {
  return new TranscriptApiError(message, {
    code: options.code ?? "provider_server_error",
    httpStatus: options.httpStatus ?? null,
    retryable: options.retryable ?? true,
  });
}

function safeEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "::1";
    if (url.protocol !== "https:" && !(loopback && url.protocol === "http:")) return null;
    return url;
  } catch {
    return null;
  }
}

async function operatorRequest(
  body: Record<string, unknown>,
  options: ChromeTranscriptOperatorOptions,
): Promise<{ response: Response; body: unknown }> {
  const { endpoint, token } = operatorConfig(options);
  const operatorUrl = safeEndpoint(endpoint);
  if (!operatorUrl || !token) {
    throw operatorError("Chrome transcript operator is not configured.", {
      code: "provider_server_error",
      retryable: true,
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1, options.timeoutMs ?? OPERATOR_TIMEOUT_MS));
  try {
    const response = await (options.fetchImpl ?? fetch)(operatorUrl.toString(), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
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
          throw operatorError("Chrome transcript operator returned malformed JSON.", {
            code: "malformed_provider_response",
            httpStatus: response.status,
            retryable: false,
          });
        }
        parsed = { message: raw.slice(0, 1_000) };
      }
    }
    if (!response.ok) {
      const message = isRecord(parsed) ? responseMessage(parsed.message, `Chrome transcript operator returned HTTP ${response.status}.`) : `Chrome transcript operator returned HTTP ${response.status}.`;
      throw operatorError(message, {
        code: response.status === 401 || response.status === 403 ? "provider_auth_error" : "provider_server_error",
        httpStatus: response.status,
        retryable: response.status !== 401 && response.status !== 403 && response.status !== 400,
      });
    }
    return { response, body: parsed };
  } catch (error) {
    if (error instanceof TranscriptApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw operatorError("Chrome transcript operator request timed out.", { code: "timeout", retryable: true });
    }
    throw operatorError(error instanceof Error ? error.message : "Chrome transcript operator request failed.", {
      code: "network_error",
      retryable: true,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function failureFromOperator(body: OperatorTranscriptResponse, httpStatus: number) {
  const code = typeof body.code === "string" ? body.code : "provider_server_error";
  const allowedCodes = new Set<ConstructorParameters<typeof TranscriptApiError>[1]["code"]>([
    "video_not_found",
    "video_private",
    "video_deleted",
    "transcript_missing",
    "language_unavailable",
    "provider_auth_error",
    "provider_rate_limit",
    "provider_server_error",
    "browser_operator_unavailable",
    "browser_verification_required",
    "network_error",
    "timeout",
    "malformed_provider_response",
    "unknown",
  ]);
  return operatorError(responseMessage(body.message, "Chrome transcript operator could not retrieve a transcript."), {
    code: allowedCodes.has(code as ConstructorParameters<typeof TranscriptApiError>[1]["code"])
      ? code as ConstructorParameters<typeof TranscriptApiError>[1]["code"]
      : "provider_server_error",
    httpStatus,
    retryable: typeof body.retryable === "boolean" ? body.retryable : true,
  });
}

function normaliseSegments(value: unknown): TranscriptSegment[] {
  if (!Array.isArray(value) || !value.length || value.length > MAX_TRANSCRIPT_SEGMENTS) {
    throw operatorError("Chrome transcript operator response has no usable timestamped segments.", {
      code: "malformed_provider_response",
      retryable: false,
    });
  }
  const segments: TranscriptSegment[] = [];
  for (const item of value as OperatorSegment[]) {
    if (!isRecord(item)) {
      throw operatorError("Chrome transcript operator returned a malformed transcript segment.", {
        code: "malformed_provider_response",
        retryable: false,
      });
    }
    const startSeconds = Number(item.startSeconds);
    const endSeconds = Number(item.endSeconds);
    const durationSeconds = Number(item.durationSeconds);
    const text = typeof item.text === "string" ? item.text.trim() : "";
    if (!text || !Number.isFinite(startSeconds) || startSeconds < 0 || !Number.isFinite(endSeconds) || endSeconds < startSeconds
      || !Number.isFinite(durationSeconds) || durationSeconds < 0) {
      throw operatorError("Chrome transcript operator returned a segment without valid timestamps.", {
        code: "malformed_provider_response",
        retryable: false,
      });
    }
    segments.push({ startSeconds, endSeconds, durationSeconds, text });
  }
  return segments;
}

export async function retrieveChromeYouTubeToTranscript(
  videoId: string,
  options: ChromeTranscriptOperatorOptions = {},
): Promise<TranscriptApiRetrieval> {
  if (!validVideoId(videoId)) {
    throw operatorError("The YouTube video ID is invalid.", { code: "invalid_video_url", retryable: false });
  }
  const { response, body: rawBody } = await operatorRequest({
    operation: "transcript",
    videoId,
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
  }, options);
  if (!isRecord(rawBody)) {
    throw operatorError("Chrome transcript operator returned an unexpected response.", {
      code: "malformed_provider_response",
      httpStatus: response.status,
      retryable: false,
    });
  }
  const body = rawBody as OperatorTranscriptResponse;
  if (body.status !== "ready") throw failureFromOperator(body, response.status);
  if (!isRecord(body.transcript)) {
    throw operatorError("Chrome transcript operator response is missing transcript data.", {
      code: "malformed_provider_response",
      httpStatus: response.status,
      retryable: false,
    });
  }

  const segments = normaliseSegments(body.transcript.segments);
  const text = typeof body.transcript.text === "string" && body.transcript.text.trim()
    ? body.transcript.text.trim()
    : segments.map((segment) => segment.text).join(" ");
  if (!text || text.length > MAX_TRANSCRIPT_TEXT_LENGTH) {
    throw operatorError("Chrome transcript operator returned no usable transcript text.", {
      code: text.length > MAX_TRANSCRIPT_TEXT_LENGTH ? "malformed_provider_response" : "transcript_missing",
      httpStatus: response.status,
      retryable: false,
    });
  }
  const duration = Number(body.transcript.durationSeconds);
  const title = isRecord(body.video) ? responseMessage(body.video.title, "") || null : null;
  const channel = isRecord(body.video) ? responseMessage(body.video.channel, "") || null : null;
  const channelUrl = isRecord(body.video) ? responseMessage(body.video.channelUrl, "") || null : null;
  const language = responseMessage(body.transcript.language, "unknown");

  return {
    info: {
      videoId,
      title,
      channel,
      authorUrl: channelUrl,
      thumbnailUrl: null,
      availableLanguages: [{ code: language, name: language }],
      httpStatus: response.status,
    },
    transcript: {
      videoId,
      language,
      segments,
      text,
      durationSeconds: Number.isFinite(duration) && duration >= 0
        ? Math.ceil(duration)
        : Math.ceil(Math.max(...segments.map((segment) => segment.endSeconds))),
      metadata: {
        retrievalProvider: "chrome_operator",
        transcriptSource: "youtubetotranscript.com",
        browserVerifiedYouTubePage: true,
        observedAt: typeof body.observedAt === "string" ? body.observedAt : null,
        sourceUrl: typeof body.transcript.sourceUrl === "string" ? body.transcript.sourceUrl : null,
      },
      httpStatus: response.status,
      cacheStatus: null,
    },
  };
}

function relativePublishedAt(label: string, now: Date) {
  const exact = Date.parse(label);
  if (Number.isFinite(exact)) return new Date(exact).toISOString();
  const match = /^(\d+)\s+(second|minute|hour|day)s?\s+ago$/i.exec(label.trim());
  if (!match) return null;
  const quantity = Number(match[1]);
  const unit = match[2].toLowerCase();
  const milliseconds = unit === "second" ? quantity * 1_000
    : unit === "minute" ? quantity * 60_000
      : unit === "hour" ? quantity * 3_600_000
        : quantity * 86_400_000;
  return new Date(now.getTime() - milliseconds).toISOString();
}

export async function discoverYouTubeChannelWithChrome(
  input: BrowserChannelDiscoveryRequest,
  options: ChromeTranscriptOperatorOptions = {},
): Promise<BrowserChannelDiscovery> {
  const { response, body: rawBody } = await operatorRequest({
    operation: "discover",
    channel: {
      channelKey: input.channelKey,
      channelName: input.channelName,
      handle: input.handle,
    },
  }, options);
  if (!isRecord(rawBody)) {
    return { status: "unavailable", code: "malformed_provider_response", detail: "Chrome discovery operator returned an unexpected response." };
  }
  const body = rawBody as OperatorDiscoveryResponse;
  if (body.status !== "ready" || !isRecord(body.channel)) {
    return {
      status: "unavailable",
      code: typeof body.code === "string" ? body.code : "provider_server_error",
      detail: responseMessage(body.message, "Chrome discovery operator could not access the YouTube channel page."),
    };
  }
  const now = input.now ?? new Date();
  const operatorVideos = Array.isArray(body.channel.videos) ? body.channel.videos as OperatorVideo[] : [];
  const videos = operatorVideos.flatMap((value): BrowserDiscoveredVideo[] => {
    if (!isRecord(value)) return [];
    const videoId = typeof value.videoId === "string" && validVideoId(value.videoId) ? value.videoId : "";
    const title = responseMessage(value.title, "");
    const url = responseMessage(value.url, "");
    const publishedAt = typeof value.publishedLabel === "string" ? relativePublishedAt(value.publishedLabel, now) : null;
    if (!videoId || !title || !url || !publishedAt || Date.parse(publishedAt) < input.cutoff.getTime()) return [];
    return [{
      videoId,
      title,
      url,
      publishedAt,
      isLive: value.isLive === true,
      isShort: value.isShort === true,
    }];
  });
  return {
    status: "ready",
    channelId: typeof body.channel.channelId === "string" ? body.channel.channelId : undefined,
    scannedCount: Number.isInteger(body.channel.scannedCount) && Number(body.channel.scannedCount) >= 0
      ? Number(body.channel.scannedCount)
      : operatorVideos.length,
    videos,
    detail: "YouTube Data API discovery failed, so Chrome checked the public channel videos page. Relative publication times are operational estimates and remain marked as browser-derived provenance.",
  };
}
