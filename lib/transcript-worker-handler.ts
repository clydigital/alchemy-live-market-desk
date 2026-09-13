import { NextResponse } from "next/server.js";

import { acceptsResearchAuthorization } from "./research-auth.ts";
import { retrieveSupadataVideo } from "./supadata.ts";
import { SupabaseTranscriptWorkerStore } from "./supabase-transcript-worker-store.ts";
import { reviewCreatorTranscript } from "./transcript-research-review.ts";
import { runTranscriptWorker } from "./transcript-worker.ts";

export type TranscriptWorkerHandlerDependencies = {
  authenticate: (request: Request) => boolean;
  run: typeof runTranscriptWorker;
  createStore: () => SupabaseTranscriptWorkerStore;
  extract: typeof retrieveSupadataVideo;
  interpret: typeof reviewCreatorTranscript;
};

const defaultDependencies: TranscriptWorkerHandlerDependencies = {
  authenticate: (request) => acceptsResearchAuthorization(request.headers.get("authorization"), [
    process.env.RESEARCH_UPDATE_TOKEN,
    process.env.CRON_SECRET,
    process.env.VERCEL_ENV === "production" ? null : process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
  ]),
  run: runTranscriptWorker,
  createStore: () => new SupabaseTranscriptWorkerStore(),
  extract: retrieveSupadataVideo,
  interpret: reviewCreatorTranscript,
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
      batchSize: 1,
      leaseSeconds: 300,
      maxAttempts: 6,
      extract: (videoId) => dependencies.extract(videoId, apiKey, { timeoutMs: 12_000 }),
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
    return NextResponse.json({
      engine: "XWADA",
      mode: "leased_transcript_worker",
      generatedAt: new Date().toISOString(),
      ...result,
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
