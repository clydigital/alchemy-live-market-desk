import assert from "node:assert/strict";
import test from "node:test";

import {
  isSupadataTranscriptChannel,
  selectedSupadataTranscriptChannels,
} from "../lib/supadata-intake-policy.ts";
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

test("video intake run helper creates initial stage log and slot run", async () => {
  const mockUpdates: Array<{ table: string; payload: unknown }> = [];
  const mockClient = {
    from: (table: string) => ({
      upsert: (payload: unknown) => {
        mockUpdates.push({ table, payload });
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
  assert.equal(mockUpdates.length, 2);
  const runPayload = mockUpdates[0].payload as { process_log: Array<{ stage: string }> };
  assert.equal(runPayload.process_log[0].stage, "create_run");
  assert.equal(runPayload.process_log[1].stage, "youtube_discovery_started");
});

test("persistDiscoveryResult updates source_checks and discovery stages independently", async () => {
  const mockUpdates: Array<{ table: string; payload: unknown }> = [];
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
        mockUpdates.push({ table, payload });
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

  assert.equal(mockUpdates.length, 2);
  const runUpdate = mockUpdates[0].payload as { source_checks: unknown[]; videos_found: number; process_log: Array<{ stage: string }> };
  assert.equal(runUpdate.videos_found, 1);
  assert.equal(runUpdate.source_checks.length, 1);
  assert.ok(runUpdate.process_log.some((entry) => entry.stage === "youtube_discovery_complete"));
});

test("failVideoIntakeRun transitions run to terminal failed state on error", async () => {
  const mockUpdates: Array<{ table: string; payload: unknown }> = [];
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
        mockUpdates.push({ table, payload });
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

  assert.equal(mockUpdates.length, 2);
  const runUpdate = mockUpdates[0].payload as { status: string; summary: string };
  assert.equal(runUpdate.status, "failed");
  assert.match(runUpdate.summary, /Execution failed at stage 'supadata_request_started': Provider timeout/);

  const slotUpdate = mockUpdates[1].payload as { status: string; health_state: string };
  assert.equal(slotUpdate.status, "failed");
  assert.equal(slotUpdate.health_state, "failed");
});
