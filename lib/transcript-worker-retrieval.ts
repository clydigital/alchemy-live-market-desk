import {
  isChromeTranscriptOperatorConfigured,
  retrieveChromeYouTubeToTranscript,
} from "./chrome-transcript-operator.ts";
import { retrieveSupadataVideo } from "./supadata.ts";
import { retrieveTranscriptApiVideo } from "./transcriptapi.ts";
import {
  normalizeTranscriptApiError,
  TranscriptApiError,
  type TranscriptApiRetrieval,
} from "./transcriptapi.ts";

const BROWSER_FALLBACK_CODES = new Set([
  "provider_rate_limit",
  "provider_payment_required",
]);

export type TranscriptWorkerRetrievalDependencies = {
  retrieveSupadata: typeof retrieveSupadataVideo;
  browserConfigured: typeof isChromeTranscriptOperatorConfigured;
  retrieveBrowser: typeof retrieveChromeYouTubeToTranscript;
  transcriptApiConfigured: () => boolean;
  retrieveTranscriptApi: (videoId: string) => Promise<TranscriptApiRetrieval>;
};

const defaultDependencies: TranscriptWorkerRetrievalDependencies = {
  retrieveSupadata: retrieveSupadataVideo,
  browserConfigured: isChromeTranscriptOperatorConfigured,
  retrieveBrowser: retrieveChromeYouTubeToTranscript,
  transcriptApiConfigured: () => Boolean(process.env.TRANSCRIPT_API_KEY?.trim()),
  retrieveTranscriptApi: (videoId) => retrieveTranscriptApiVideo(
    videoId,
    process.env.TRANSCRIPT_API_KEY?.trim() || "",
    { timeoutMs: 12_000, maxAttempts: 1 },
  ),
};

export function transcriptWorkerShouldUseBrowserFallback(error: unknown) {
  const failure = normalizeTranscriptApiError(error);
  return BROWSER_FALLBACK_CODES.has(failure.code);
}

/**
 * Keep one leased transcript job while allowing its extraction transport to
 * fail over. Supadata remains primary. The existing timestamp-preserving
 * Chrome/YouTubeToTranscript operator is used only for provider-capacity
 * failures and only when explicitly configured.
 */
export async function retrieveTranscriptForWorker(
  videoId: string,
  supadataApiKey: string,
  dependencyOverrides: Partial<TranscriptWorkerRetrievalDependencies> = {},
): Promise<TranscriptApiRetrieval> {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };

  try {
    return await dependencies.retrieveSupadata(videoId, supadataApiKey, { timeoutMs: 12_000 });
  } catch (error) {
    const primary = normalizeTranscriptApiError(error);
    if (!transcriptWorkerShouldUseBrowserFallback(primary)) {
      throw primary;
    }

    const fallbackFailures: string[] = [];

    if (dependencies.browserConfigured()) {
      try {
        return await dependencies.retrieveBrowser(videoId);
      } catch (browserError) {
        const browserFailure = normalizeTranscriptApiError(browserError);
        fallbackFailures.push(
          `Browser fallback: ${browserFailure.code}: ${browserFailure.message}`,
        );
      }
    }

    if (dependencies.transcriptApiConfigured()) {
      try {
        return await dependencies.retrieveTranscriptApi(videoId);
      } catch (transcriptApiError) {
        const transcriptApiFailure = normalizeTranscriptApiError(transcriptApiError);
        fallbackFailures.push(
          `TranscriptAPI fallback: ${transcriptApiFailure.code}: ${transcriptApiFailure.message}`,
        );
      }
    }

    if (!fallbackFailures.length) throw primary;

    throw new TranscriptApiError(
      [
        primary.message,
        ...fallbackFailures.map((failure) => `${failure}.`),
      ].join(" "),
      {
        code: primary.code,
        httpStatus: primary.httpStatus,
        retryable: primary.retryable,
        retryAfterSeconds: primary.retryAfterSeconds,
        providerMessage: [
          primary.providerMessage || primary.message,
          ...fallbackFailures,
        ].join(" | ").slice(0, 1_000),
      },
    );
  }
}
