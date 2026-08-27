import assert from "node:assert/strict";
import test from "node:test";

import {
  isSupadataTranscriptChannel,
  selectedSupadataTranscriptChannels,
} from "../lib/supadata-intake-policy.ts";
import {
  runScheduledVideoIntake,
  type ScheduledVideoIntakeDependencies,
} from "../lib/video-intake-service.ts";
import type {
  ReadyTranscriptCache,
  TranscriptDebtInput,
  TranscriptIntakeItem,
  TranscriptPipelineStore,
  TranscriptProvider,
} from "../lib/transcript-pipeline.ts";
import {
  TranscriptApiError,
  type TranscriptApiRetrieval,
} from "../lib/transcriptapi.ts";
import { youtubeDurationSeconds } from "../lib/youtube-reliability.ts";
import type { XwadaChannelKey, XwadaChannelResult, XwadaVideo } from "../lib/youtube-reliability.ts";

function video(channelKey: XwadaChannelKey, videoId: string, options: { isLive?: boolean; isShort?: boolean } = {}): XwadaVideo {
  return {
    channelKey,
    channelName: channelKey,
    channelId: `channel-${channelKey}`,
    videoId,
    title: videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    publishedAt: "2026-08-25T00:00:00.000Z",
    isLive: options.isLive ?? false,
    isShort: options.isShort ?? false,
  };
}

function channel(channelKey: XwadaChannelKey, videos: XwadaVideo[]): XwadaChannelResult {
  return {
    channelKey,
    channelName: channelKey,
    channelId: `channel-${channelKey}`,
    status: "checked",
    scannedCount: videos.length,
    recentCount: videos.length,
    videos,
  };
}

const scheduledRetrieval: TranscriptApiRetrieval = {
  info: {
    videoId: "KHacM8aduWM",
    title: "Nvidia CRUSHED Earnings — Get Ready For Tomorrow",
    channel: "StockedUp",
    authorUrl: null,
    thumbnailUrl: null,
    availableLanguages: [{ code: "en", name: "English" }],
    httpStatus: 200,
  },
  transcript: {
    videoId: "KHacM8aduWM",
    language: "en",
    segments: [{ startSeconds: 0, durationSeconds: 2, endSeconds: 2, text: "Timestamped native caption." }],
    text: "Timestamped native caption.",
    durationSeconds: 2,
    metadata: { retrievalProvider: "supadata", transcriptSource: "native_caption", mode: "native" },
    httpStatus: 200,
    cacheStatus: null,
  },
};

class ScheduledMemoryStore implements TranscriptPipelineStore {
  item: TranscriptIntakeItem = {
    id: "item-stockedup",
    runId: "prior-run",
    videoId: "KHacM8aduWM",
    publisher: "StockedUp",
    title: scheduledRetrieval.info.title || "StockedUp video",
    url: "https://www.youtube.com/watch?v=KHacM8aduWM",
    transcriptStatus: "missing",
    transcriptProvider: null,
    required: true,
    attemptCount: 0,
  };
  cache: ReadyTranscriptCache | null = null;
  savedProvider: TranscriptProvider | null = null;
  failureCode: string | null = null;
  debtRunIds: string[] = [];
  recalculatedRunIds: string[] = [];

  async findReadyTranscript(videoId: string) {
    return this.cache?.transcript.videoId === videoId ? this.cache : null;
  }

  async findVideoItem(videoId: string) {
    return this.item.videoId === videoId ? this.item : null;
  }

  async saveSuccess(
    item: TranscriptIntakeItem,
    retrieval: TranscriptApiRetrieval,
    attemptedAt: string,
    provider: TranscriptProvider,
  ) {
    this.savedProvider = provider;
    this.item = {
      ...item,
      transcriptStatus: "ready",
      transcriptProvider: provider,
      attemptCount: item.attemptCount + 1,
    };
    this.cache = {
      itemId: item.id,
      runId: item.runId,
      retrievedAt: attemptedAt,
      provider,
      transcript: retrieval.transcript,
    };
  }

  async saveFailure(
    item: TranscriptIntakeItem,
    error: TranscriptApiError,
    _attemptedAt: string,
    provider: TranscriptProvider,
  ) {
    this.savedProvider = provider;
    this.failureCode = error.code;
    this.item = {
      ...item,
      transcriptStatus: error.retryable ? "missing" : "unavailable",
      transcriptProvider: provider,
      transcriptRetryable: error.retryable,
      transcriptErrorCode: error.code,
      transcriptErrorMessage: error.message,
      transcriptHttpStatus: error.httpStatus,
      attemptCount: item.attemptCount + 1,
    };
  }

  async upsertDebt(item: TranscriptIntakeItem, _debt: TranscriptDebtInput) {
    this.debtRunIds.push(item.runId);
  }

  async resolveDebt() {}

  async recalculateRunState(runId: string) {
    this.recalculatedRunIds.push(runId);
  }
}

function scheduledHarness(options: {
  store?: ScheduledMemoryStore;
  retrieve?: ScheduledVideoIntakeDependencies["retrieveTranscript"];
  ensureError?: Error;
  finalizeError?: Error;
} = {}) {
  const store = options.store ?? new ScheduledMemoryStore();
  const stages: Array<{ stage: string; status: string; detail?: Record<string, unknown> }> = [];
  const finalized: Array<Parameters<ScheduledVideoIntakeDependencies["finalizeRun"]>[0]> = [];
  const failed: Array<Parameters<ScheduledVideoIntakeDependencies["failRun"]>[0]> = [];
  let discoveryPersisted = 0;
  let providerCalls = 0;

  const dependencies: Partial<ScheduledVideoIntakeDependencies> = {
    createRun: async () => ({ id: "active-video-run", client: {} as never }),
    recordStage: async (input) => {
      stages.push({ stage: input.stage, status: input.status, detail: input.detail });
    },
    persistDiscovery: async () => {
      discoveryPersisted += 1;
    },
    ensureItem: async (input) => {
      if (options.ensureError) throw options.ensureError;
      store.item = { ...store.item, runId: input.runId };
      return store.item;
    },
    finalizeRun: async (input) => {
      finalized.push(input);
      if (options.finalizeError) throw options.finalizeError;
    },
    failRun: async (input) => {
      failed.push(input);
    },
    discoverChannels: async () => [channel("stockedup", [video("stockedup", "KHacM8aduWM")])],
    createStore: () => store,
    retrieveTranscript: async (...args) => {
      providerCalls += 1;
      return options.retrieve ? options.retrieve(...args) : scheduledRetrieval;
    },
  };

  return {
    store,
    stages,
    finalized,
    failed,
    dependencies,
    discoveryPersisted: () => discoveryPersisted,
    providerCalls: () => providerCalls,
  };
}

test("only selected creators' long-form non-live videos enter the Supadata provider work list", () => {
  const channels = [
    channel("fx-evolution", [
      video("fx-evolution", "fx-upload"),
      video("fx-evolution", "fx-live", { isLive: true }),
      video("fx-evolution", "fx-short", { isShort: true }),
    ]),
    channel("stockedup", [
      video("stockedup", "stock-upload"),
      video("stockedup", "stock-live", { isLive: true }),
      video("stockedup", "stock-short", { isShort: true }),
    ]),
    channel("kevin-gerrity", [video("kevin-gerrity", "kevin-upload")]),
    channel("clearvalue-tax", [
      video("clearvalue-tax", "clear-upload"),
      video("clearvalue-tax", "clear-live", { isLive: true }),
      video("clearvalue-tax", "clear-short", { isShort: true }),
    ]),
    channel("tradernick", [video("tradernick", "nick-upload")]),
  ];

  const workList = selectedSupadataTranscriptChannels(channels);
  assert.deepEqual(workList.map((entry) => entry.channelKey), [
    "stockedup",
    "kevin-gerrity",
    "clearvalue-tax",
    "fx-evolution",
  ]);
  assert.deepEqual(workList.flatMap((entry) => entry.videos.map((entryVideo) => entryVideo.videoId)), [
    "stock-upload",
    "kevin-upload",
    "clear-upload",
    "fx-upload",
  ]);
  assert.equal(isSupadataTranscriptChannel("stockedup"), true);
  assert.equal(isSupadataTranscriptChannel("kevin-gerrity"), true);
  assert.equal(isSupadataTranscriptChannel("clearvalue-tax"), true);
  assert.equal(isSupadataTranscriptChannel("fx-evolution"), true);
  assert.equal(isSupadataTranscriptChannel("tradernick"), false);
});

test("YouTube ISO durations support the conservative three-minute Shorts guard", () => {
  assert.equal(youtubeDurationSeconds("PT59S"), 59);
  assert.equal(youtubeDurationSeconds("PT3M"), 180);
  assert.equal(youtubeDurationSeconds("PT3M1S"), 181);
  assert.equal(youtubeDurationSeconds("PT15M39S"), 939);
  assert.equal(youtubeDurationSeconds("not-a-duration"), null);
});

function recoveryHarness(options: {
  noStaleRows?: boolean;
  queryError?: string;
  runReadError?: string;
  runUpdateFailures?: number;
  slotUpdateFailures?: number;
} = {}) {
  const run = {
    process_log: [{ stage: "create_run", status: "complete" }] as Array<Record<string, unknown>>,
    warnings: [] as string[],
    status: "running",
  };
  let slotStatus = "running";
  let runUpdateFailures = options.runUpdateFailures ?? 0;
  let slotUpdateFailures = options.slotUpdateFailures ?? 0;
  const updates: Array<{ table: string; payload: Record<string, unknown> }> = [];

  const client = {
    from: (table: string) => ({
      select: () => table === "research_slot_runs"
        ? {
            eq: () => ({
              eq: () => ({
                lt: async () => ({
                  data: options.noStaleRows || slotStatus !== "running"
                    ? []
                    : [{
                        research_run_id: "stale-run-1",
                        slot_key: "video_midnight",
                        last_heartbeat_at: "2026-08-27T00:00:00.000Z",
                      }],
                  error: options.queryError ? { message: options.queryError } : null,
                }),
              }),
            }),
          }
        : {
            eq: () => ({
              maybeSingle: async () => ({
                data: options.runReadError ? null : run,
                error: options.runReadError ? { message: options.runReadError } : null,
              }),
            }),
          },
      update: (payload: Record<string, unknown>) => ({
        eq: async () => {
          updates.push({ table, payload });
          if (table === "research_runs" && runUpdateFailures > 0) {
            runUpdateFailures -= 1;
            return { error: { message: "run update failed" } };
          }
          if (table === "research_slot_runs" && slotUpdateFailures > 0) {
            slotUpdateFailures -= 1;
            return { error: { message: "slot update failed" } };
          }
          if (table === "research_runs") Object.assign(run, payload);
          if (table === "research_slot_runs" && typeof payload.status === "string") slotStatus = payload.status;
          return { error: null };
        },
      }),
    }),
  } as unknown as Parameters<typeof import("../lib/youtube-transcript-persistence.ts").recoverStaleVideoRuns>[0]["client"];

  return { client, run, updates, slotStatus: () => slotStatus };
}

test("recoverStaleVideoRuns returns zero when no stale rows exist", async () => {
  const { recoverStaleVideoRuns } = await import("../lib/youtube-transcript-persistence.ts");
  const harness = recoveryHarness({ noStaleRows: true });
  const result = await recoverStaleVideoRuns({ slot: "video_midnight", client: harness.client });
  assert.deepEqual(result, { recoveredCount: 0 });
  assert.equal(harness.updates.length, 0);
});

test("recoverStaleVideoRuns surfaces stale-query and run-read failures", async () => {
  const { recoverStaleVideoRuns } = await import("../lib/youtube-transcript-persistence.ts");
  await assert.rejects(
    recoverStaleVideoRuns({ slot: "video_midnight", client: recoveryHarness({ queryError: "query unavailable" }).client }),
    /Could not query stale video slot runs: query unavailable/,
  );
  await assert.rejects(
    recoverStaleVideoRuns({ slot: "video_midnight", client: recoveryHarness({ runReadError: "run unavailable" }).client }),
    /Could not read stale video research run stale-run-1: run unavailable/,
  );
});

test("recoverStaleVideoRuns surfaces the research-run update failure before touching the slot", async () => {
  const { recoverStaleVideoRuns } = await import("../lib/youtube-transcript-persistence.ts");
  const harness = recoveryHarness({ runUpdateFailures: 1 });
  await assert.rejects(
    recoverStaleVideoRuns({ slot: "video_midnight", client: harness.client }),
    /Could not mark stale video research run stale-run-1 failed: run update failed/,
  );
  assert.deepEqual(harness.updates.map((entry) => entry.table), ["research_runs"]);
});

test("recoverStaleVideoRuns retries a partial recovery without duplicate log or warning state", async () => {
  const { recoverStaleVideoRuns } = await import("../lib/youtube-transcript-persistence.ts");
  const harness = recoveryHarness({ slotUpdateFailures: 1 });
  const now = new Date("2026-08-27T01:00:00.000Z");

  await assert.rejects(
    recoverStaleVideoRuns({ slot: "video_midnight", client: harness.client, now }),
    /Could not mark stale video slot run stale-run-1 failed: slot update failed/,
  );
  const recovered = await recoverStaleVideoRuns({ slot: "video_midnight", client: harness.client, now });
  const replay = await recoverStaleVideoRuns({ slot: "video_midnight", client: harness.client, now });

  assert.deepEqual(recovered, { recoveredCount: 1 });
  assert.deepEqual(replay, { recoveredCount: 0 });
  assert.equal(harness.slotStatus(), "failed");
  assert.equal(harness.run.process_log.filter((entry) => entry.stage === "stale_run_recovery").length, 1);
  assert.equal(harness.run.warnings.filter((warning) => warning.includes("Stale video run abandoned")).length, 1);
});

test("scheduled StockedUp intake reaches Supadata, persists timestamps, and replays from cache", async () => {
  const harness = scheduledHarness();
  const input = {
    slot: "video_midnight" as const,
    runKey: "video_midnight-2026-08-27",
    scheduledFor: "2026-08-27T00:40:00+08:00",
    now: new Date("2026-08-27T00:40:00+08:00"),
  };

  const first = await runScheduledVideoIntake(input, harness.dependencies);
  const secondStageStart = harness.stages.length;
  const replay = await runScheduledVideoIntake(input, harness.dependencies);
  const replayStages = harness.stages.slice(secondStageStart);

  assert.equal(first.status, "healthy");
  assert.equal(first.transcripts[0]?.status, "ready");
  assert.equal(first.transcripts[0]?.provider, "supadata");
  assert.equal(first.transcripts[0]?.cacheHit, false);
  assert.equal(harness.store.item.transcriptStatus, "ready");
  assert.equal(harness.store.item.transcriptProvider, "supadata");
  assert.equal(harness.store.item.attemptCount, 1);
  assert.deepEqual(harness.store.cache?.transcript.segments, scheduledRetrieval.transcript.segments);
  assert.equal(harness.providerCalls(), 1);
  assert.ok(harness.stages.some((entry) => entry.stage === "supadata_request_started" && entry.status === "complete"));
  assert.ok(harness.stages.some((entry) => entry.stage === "supadata_response_received" && entry.status === "complete"));
  assert.equal(harness.discoveryPersisted(), 2);
  assert.equal(harness.finalized.length, 2);

  assert.equal(replay.transcripts[0]?.status, "ready");
  assert.equal(replay.transcripts[0]?.cacheHit, true);
  assert.equal(replay.summary.cacheHits, 1);
  assert.equal(harness.providerCalls(), 1, "a replayed ready transcript must not spend another provider request");
  assert.ok(!replayStages.some((entry) => entry.stage.startsWith("supadata_")));
  assert.ok(replayStages.some((entry) => entry.stage === "transcript_state_updated" && entry.detail?.cacheHit === true));
  assert.ok(harness.store.recalculatedRunIds.every((runId) => runId === "active-video-run"));
});

test("scheduled Supadata failure persists exact provider debt and finalizes discovery independently", async () => {
  const harness = scheduledHarness({
    retrieve: async () => {
      throw new TranscriptApiError("Supadata rate limit", {
        code: "provider_rate_limit",
        httpStatus: 429,
        retryable: true,
        retryAfterSeconds: 120,
      });
    },
  });

  const result = await runScheduledVideoIntake({
    slot: "video_midnight",
    runKey: "video_midnight-2026-08-27",
    scheduledFor: "2026-08-27T00:40:00+08:00",
    now: new Date("2026-08-27T00:40:00+08:00"),
  }, harness.dependencies);

  assert.equal(result.status, "attention");
  assert.equal(result.transcripts[0]?.status, "failed");
  if (result.transcripts[0]?.status !== "failed") assert.fail("Expected a failed Supadata transcript result");
  assert.equal(result.transcripts[0].provider, "supadata");
  assert.equal(result.transcripts[0].errorCode, "provider_rate_limit");
  assert.equal(result.transcripts[0].httpStatus, 429);
  assert.equal(result.transcripts[0].retryable, true);
  assert.equal(harness.store.item.transcriptProvider, "supadata");
  assert.equal(harness.store.item.transcriptErrorCode, "provider_rate_limit");
  assert.equal(harness.store.item.transcriptHttpStatus, 429);
  assert.equal(harness.store.item.attemptCount, 1);
  assert.deepEqual(harness.store.debtRunIds, ["active-video-run"]);
  assert.equal(harness.discoveryPersisted(), 1);
  assert.equal(harness.finalized.length, 1);
  assert.equal(harness.failed.length, 0);
  const responseStage = harness.stages.find((entry) => entry.stage === "supadata_response_received");
  assert.equal(responseStage?.status, "failed");
  assert.equal(responseStage?.detail?.errorCode, "provider_rate_limit");
  assert.equal(responseStage?.detail?.httpStatus, 429);
});

test("scheduled intake reads a legacy TranscriptAPI cache without false Supadata provenance or spend", async () => {
  const store = new ScheduledMemoryStore();
  store.item = { ...store.item, transcriptStatus: "ready", transcriptProvider: "transcriptapi", attemptCount: 3 };
  store.cache = {
    itemId: store.item.id,
    runId: "prior-transcriptapi-run",
    retrievedAt: "2026-08-26T00:00:00.000Z",
    provider: "transcriptapi",
    transcript: scheduledRetrieval.transcript,
  };
  const harness = scheduledHarness({ store });

  const result = await runScheduledVideoIntake({
    slot: "video_midnight",
    runKey: "video_midnight-2026-08-27",
    scheduledFor: "2026-08-27T00:40:00+08:00",
    now: new Date("2026-08-27T00:40:00+08:00"),
  }, harness.dependencies);

  assert.equal(result.transcripts[0]?.status, "ready");
  assert.equal(result.transcripts[0]?.provider, "transcriptapi");
  assert.equal(result.transcripts[0]?.cacheHit, true);
  assert.equal(harness.providerCalls(), 0);
  assert.equal(harness.store.savedProvider, null);
  assert.ok(!harness.stages.some((entry) => entry.stage.startsWith("supadata_")));
  assert.deepEqual(harness.store.recalculatedRunIds, ["active-video-run"]);
});

test("a pre-provider scheduled failure preserves discovery and terminalizes the active stage", async () => {
  const harness = scheduledHarness({ ensureError: new Error("canonical item query failed") });

  await assert.rejects(
    runScheduledVideoIntake({
      slot: "video_midnight",
      runKey: "video_midnight-2026-08-27",
      scheduledFor: "2026-08-27T00:40:00+08:00",
      now: new Date("2026-08-27T00:40:00+08:00"),
    }, harness.dependencies),
    /canonical item query failed/,
  );

  assert.equal(harness.discoveryPersisted(), 1);
  assert.equal(harness.providerCalls(), 0);
  assert.equal(harness.finalized.length, 0);
  assert.equal(harness.failed.length, 1);
  assert.equal(harness.failed[0]?.stage, "video_item_persisted");
});

test("a source-check finalization error is attributed to the finalization stage", async () => {
  const harness = scheduledHarness({ finalizeError: new Error("slot finalization failed") });

  await assert.rejects(
    runScheduledVideoIntake({
      slot: "video_midnight",
      runKey: "video_midnight-2026-08-27",
      scheduledFor: "2026-08-27T00:40:00+08:00",
      now: new Date("2026-08-27T00:40:00+08:00"),
    }, harness.dependencies),
    /slot finalization failed/,
  );

  assert.equal(harness.finalized.length, 1);
  assert.equal(harness.failed.length, 1);
  assert.equal(harness.failed[0]?.stage, "source_checks_finalized");
});

test("createVideoIntakeRun creates initial stage log and slot run", async () => {
  const updates: Array<{ table: string; payload: unknown }> = [];
  const mockClient = {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            lt: () => ({ data: [], error: null }),
          }),
        }),
      }),
      upsert: (payload: unknown) => {
        updates.push({ table, payload });
        return {
          select: () => ({
            single: async () => ({ data: { id: "test-run-id" }, error: null }),
          }),
        };
      },
    }),
  } as unknown as Parameters<typeof import("../lib/youtube-transcript-persistence.ts").createVideoIntakeRun>[0]["client"];

  const { createVideoIntakeRun } = await import("../lib/youtube-transcript-persistence.ts");
  const result = await createVideoIntakeRun({
    slot: "video_midnight",
    runKey: "run_test_key",
    scheduledFor: "2026-08-27T00:00:00.000Z",
    client: mockClient,
  });

  assert.equal(result.id, "test-run-id");
  assert.equal(updates.length, 2);
  const runPayload = updates[0].payload as { process_log: Array<{ stage: string }> };
  assert.equal(runPayload.process_log[0].stage, "create_run");
  assert.equal(runPayload.process_log[1].stage, "youtube_discovery_started");
});

test("ensureVideoIntakeItem assigns an existing canonical video to the active run", async () => {
  const updates: Array<Record<string, unknown>> = [];
  const existing = {
    id: "canonical-item",
    run_id: "historic-run",
    external_id: "KHacM8aduWM",
    publisher: "StockedUp",
    title: "Old title",
    url: "https://www.youtube.com/watch?v=KHacM8aduWM",
    transcript_status: "missing" as const,
    transcript_attempt_count: 0,
  };
  const mockClient = {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: existing, error: null }) }),
      }),
      update: (payload: Record<string, unknown>) => ({
        eq: async () => {
          updates.push(payload);
          return { error: null };
        },
      }),
    }),
  } as unknown as Parameters<typeof import("../lib/youtube-transcript-persistence.ts").ensureVideoIntakeItem>[0]["client"];
  const { ensureVideoIntakeItem } = await import("../lib/youtube-transcript-persistence.ts");

  const item = await ensureVideoIntakeItem({
    runId: "active-video-run",
    channelKey: "stockedup",
    video: video("stockedup", "KHacM8aduWM"),
    client: mockClient,
  });

  assert.equal(updates.length, 1);
  assert.equal(updates[0]?.run_id, "active-video-run");
  assert.equal(item.runId, "active-video-run");
  assert.equal(item.transcriptStatus, "missing");
});

test("persistDiscoveryResult updates source_checks and discovery stages independently", async () => {
  const updates: Array<{ table: string; payload: unknown }> = [];
  const mockClient = {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { process_log: [{ stage: "create_run", status: "complete" }], warnings: [] },
            error: null,
          }),
        }),
      }),
      update: (payload: unknown) => {
        updates.push({ table, payload });
        return {
          eq: () => Promise.resolve({ error: null }),
        };
      },
    }),
  } as unknown as Parameters<typeof import("../lib/youtube-transcript-persistence.ts").persistDiscoveryResult>[0]["client"];

  const { persistDiscoveryResult } = await import("../lib/youtube-transcript-persistence.ts");
  await persistDiscoveryResult({
    runId: "test-run-id",
    slot: "video_midnight",
    channelChecks: [{ source: "StockedUp", status: "checked", itemCount: 1 }],
    discoveryFailures: [],
    videosDetected: 1,
    client: mockClient,
  });

  assert.equal(updates.length, 2);
  const runUpdate = updates[0].payload as { source_checks: unknown[]; videos_found: number; process_log: Array<{ stage: string }> };
  assert.equal(runUpdate.videos_found, 1);
  assert.equal(runUpdate.source_checks.length, 1);
  assert.ok(runUpdate.process_log.some((entry) => entry.stage === "youtube_discovery_complete"));
});

test("failVideoIntakeRun transitions run to terminal failed state on error", async () => {
  const updates: Array<{ table: string; payload: unknown }> = [];
  const mockClient = {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { process_log: [{ stage: "create_run", status: "complete" }], warnings: [] },
            error: null,
          }),
        }),
      }),
      update: (payload: unknown) => {
        updates.push({ table, payload });
        return {
          eq: () => Promise.resolve({ error: null }),
        };
      },
    }),
  } as unknown as Parameters<typeof import("../lib/youtube-transcript-persistence.ts").failVideoIntakeRun>[0]["client"];

  const { failVideoIntakeRun } = await import("../lib/youtube-transcript-persistence.ts");
  await failVideoIntakeRun({
    runId: "test-run-id",
    slot: "video_midnight",
    stage: "supadata_request_started",
    error: new Error("Provider timeout"),
    client: mockClient,
  });

  assert.equal(updates.length, 2);
  const runUpdate = updates[0].payload as { status: string; summary: string };
  assert.equal(runUpdate.status, "failed");
  assert.match(runUpdate.summary, /Execution failed at stage 'supadata_request_started': Provider timeout/);

  const slotUpdate = updates[1].payload as { status: string; health_state: string };
  assert.equal(slotUpdate.status, "failed");
  assert.equal(slotUpdate.health_state, "failed");
});
