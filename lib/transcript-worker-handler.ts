import { NextResponse } from "next/server.js";

import { persistMarketMotionFromCreatorReviews } from "./market-motion-ingestion.ts";
import { acceptsResearchAuthorization } from "./research-auth.ts";
import { retrieveTranscriptForWorker } from "./transcript-worker-retrieval.ts";
import { SupabaseTranscriptWorkerStore } from "./supabase-transcript-worker-store.ts";
import { reviewCreatorTranscript } from "./transcript-research-review.ts";
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_CLAIM_HEADROOM_MS,
  DEFAULT_SOFT_DEADLINE_MS,
  MAX_CONCURRENCY,
  runTranscriptWorker,
} from "./transcript-worker.ts";

export type TranscriptWorkerHandlerDependencies = {
  authenticate: (request: Request) => boolean;
  run: typeof runTranscriptWorker;
  createStore: () => SupabaseTranscriptWorkerStore;
  extract: typeof retrieveTranscriptForWorker;
  interpret: typeof reviewCreatorTranscript;
  refreshMarketMotion: typeof persistMarketMotionFromCreatorReviews;
};

const defaultDependencies: TranscriptWorkerHandlerDependencies = {
  authenticate: (request) => acceptsResearchAuthorization(request.headers.get("authorization"), [
    process.env.RESEARCH_UPDATE_TOKEN,
    process.env.CRON_SECRET,
    process.env.VERCEL_ENV === "production" ? null : process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
  ]),
  run: runTranscriptWorker,
  createStore: () => new SupabaseTranscriptWorkerStore(),
  extract: retrieveTranscriptForWorker,
  interpret: reviewCreatorTranscript,
  refreshMarketMotion: persistMarketMotionFromCreatorReviews,
};

export async function handleTranscriptWorkerRequest(
  request: Request,
  overrides: Partial<TranscriptWorkerHandlerDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };
  if (!dependencies.authenticate(request)) {
    return NextResponse.json({ error: "Unauthorized transcript worker request." }, { status: 401 });
  }
  const apiKey = process.env.SUPADATA_API_KEY?.trim() || "";
  try {
    const result = await dependencies.run({
      store: dependencies.createStore(),
      batchSize: DEFAULT_BATCH_SIZE,
      maxConcurrency: MAX_CONCURRENCY,
      softDeadlineMs: DEFAULT_SOFT_DEADLINE_MS,
      claimHeadroomMs: DEFAULT_CLAIM_HEADROOM_MS,
      leaseSeconds: 300,
      maxAttempts: 6,
      extract: (videoId) => dependencies.extract(videoId, apiKey),
      interpret: (job) => dependencies.interpret({
        video: {
          id: job.id,
          publisher: job.publisher,
          title: job.title,
          url: job.url,
          publishedAt: job.publishedAt,
          transcriptText: job.transcriptText || "",
        },
      }),
    });
    const hasFailure = result.outcomes.some((outcome) => ["retryable", "failed", "lease_lost"].includes(outcome.status));
    const completedItemIds = result.outcomes
      .filter((outcome) => outcome.status === "completed")
      .map((outcome) => outcome.itemId);
    let marketMotion = null;
    let marketMotionWarning: string | null = null;
    if (completedItemIds.length) {
      try {
        marketMotion = await dependencies.refreshMarketMotion({ intakeItemIds: completedItemIds });
      } catch (error) {
        // Creator Motion refresh is enrichment. A failure must not turn a successfully
        // persisted transcript into a failed transcript-worker job.
        marketMotionWarning = error instanceof Error ? error.message : "Creator Market Motion refresh failed.";
      }
    }
    return NextResponse.json({
      engine: "XWADA",
      mode: "leased_transcript_worker",
      generatedAt: new Date().toISOString(),
      ...result,
      marketMotion,
      marketMotionWarning,
    }, {
      status: hasFailure ? 207 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json({
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown transcript worker failure.",
    }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
