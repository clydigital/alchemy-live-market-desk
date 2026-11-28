import {
  isChromeTranscriptOperatorConfigured,
  retrieveChromeYouTubeToTranscript,
} from "./chrome-transcript-operator.ts";
import { retrieveSupadataVideo } from "./supadata.ts";
import {
  attachProviderFailureReceipt,
  normalizeTranscriptApiError,
  type ProviderHealthReceipt,
  retrieveTranscriptApiVideo,
  TranscriptApiError,
  type TranscriptApiRetrieval,
} from "./transcriptapi.ts";

const BROWSER_FALLBACK_CODES = new Set([
  "provider_rate_limit",
  "provider_payment_required",
  "provider_auth_error",
  "timeout",
  "network_error",
  "provider_server_error",
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
 * Chrome/YouTubeToTranscript operator is used only for provider-capacity, credential
 * and transport failures and only when explicitly configured. Content-level failures stay closed.
 */
export async function retrieveTranscriptForWorker(
  videoId: string,
  supadataApiKey: string,
  dependencyOverrides: Partial<TranscriptWorkerRetrievalDependencies> = {},
): Promise<TranscriptApiRetrieval> {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };

  const attempts: { provider: string; outcome: "success" | "failed" | "skipped"; cause: string | null; timestamp: string }[] = [];
  const record = (provider: string, outcome: "success" | "failed" | "skipped", cause: string | null = null) => {
    attempts.push({ provider, outcome, cause, timestamp: new Date().toISOString() });
  };
  const finish = (state: "healthy" | "recovered" | "failed", nextRetry: string | null = null) => {
    const receipt: ProviderHealthReceipt = { kind: "provider_health_receipt_v1", capability: "timestamped_public_video_transcript", provider: "supadata", timestamp: new Date().toISOString(), state, cause: attempts.find(a => a.outcome === "failed")?.cause ?? null, fallbackAttempted: attempts.slice(1).some(a => a.outcome !== "skipped"), attempts: [...attempts], residualCoverage: state === "failed" ? "no_transcript" : "transcript_retrieved_not_yet_persisted", nextRetry, retryOwner: "leased_transcript_worker" };
    console.info(JSON.stringify(receipt));
    return receipt;
  };
  const withReceipt = (result: TranscriptApiRetrieval, state: "healthy" | "recovered"): TranscriptApiRetrieval => ({
    ...result, transcript: { ...result.transcript, metadata: { ...result.transcript.metadata, providerHealthReceipt: finish(state) } },
  });
  try {
    const result = await dependencies.retrieveSupadata(videoId, supadataApiKey, { timeoutMs: 12_000 });
    record("supadata", "success");
    return withReceipt(result, "healthy");
  } catch (error) {
    const primary = normalizeTranscriptApiError(error);
    record("supadata", "failed", !supadataApiKey.trim() && primary.code === "provider_auth_error" ? "credential_not_visible_at_runtime" : primary.code);
    if (!transcriptWorkerShouldUseBrowserFallback(primary)) {
      throw attachProviderFailureReceipt(primary, finish("failed"));
    }

    const fallbackFailures: string[] = [];

    if (dependencies.browserConfigured()) {
      try {
        const result = await dependencies.retrieveBrowser(videoId);
        record("chrome_operator", "success");
        return withReceipt(result, "recovered");
      } catch (browserError) {
        const browserFailure = normalizeTranscriptApiError(browserError);
        record("chrome_operator", "failed", browserFailure.code);
        fallbackFailures.push(
          `Browser fallback: ${browserFailure.code}: ${browserFailure.message}`,
        );
      }
    } else record("chrome_operator", "skipped", "not_configured");

    if (dependencies.transcriptApiConfigured()) {
      try {
        const result = await dependencies.retrieveTranscriptApi(videoId);
        record("transcriptapi", "success");
        return withReceipt(result, "recovered");
      } catch (transcriptApiError) {
        const transcriptApiFailure = normalizeTranscriptApiError(transcriptApiError);
        record("transcriptapi", "failed", transcriptApiFailure.code);
        fallbackFailures.push(
          `TranscriptAPI fallback: ${transcriptApiFailure.code}: ${transcriptApiFailure.message}`,
        );
      }
    } else record("transcriptapi", "skipped", "not_configured");

    const receipt = finish("failed", primary.retryable ? new Date(Date.now() + Math.max(60, primary.retryAfterSeconds ?? 1800) * 1000).toISOString() : null);
    if (!fallbackFailures.length) throw attachProviderFailureReceipt(primary, receipt);

    throw attachProviderFailureReceipt(new TranscriptApiError(
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
    ), receipt);
  }
}
