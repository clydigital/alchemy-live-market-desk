import {
  isChromeTranscriptOperatorConfigured,
  retrieveChromeYouTubeToTranscript,
} from "./chrome-transcript-operator.ts";
import { retrieveSupadataVideo } from "./supadata.ts";
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
};

const defaultDependencies: TranscriptWorkerRetrievalDependencies = {
  retrieveSupadata: retrieveSupadataVideo,
  browserConfigured: isChromeTranscriptOperatorConfigured,
  retrieveBrowser: retrieveChromeYouTubeToTranscript,
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
    if (!transcriptWorkerShouldUseBrowserFallback(primary) || !dependencies.browserConfigured()) {
      throw primary;
    }

    try {
      return await dependencies.retrieveBrowser(videoId);
    } catch (browserError) {
      const fallback = normalizeTranscriptApiError(browserError);
      throw new TranscriptApiError(
        `${primary.message} Browser transcript fallback also failed: ${fallback.message}`,
        {
          code: primary.code,
          httpStatus: primary.httpStatus,
          retryable: primary.retryable,
          retryAfterSeconds: primary.retryAfterSeconds,
          providerMessage: [
            primary.providerMessage || primary.message,
            `Browser fallback: ${fallback.code}: ${fallback.message}`,
          ].join(" | ").slice(0, 1_000),
        },
      );
    }
  }
}
