import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { ScheduledVideoIntakeResult } from "../lib/video-intake-service.ts";
import type { VideoResearchSlot } from "../lib/youtube-transcript-persistence.ts";

import {
  ensureScheduledVideoDiscovery,
  hasDurableVideoDiscovery,
  runningVideoDiscoveryIsStale,
  type ScheduledVideoDiscoveryCheckpoint,
} from "../lib/scheduled-video-recovery.ts";

const now = new Date("2026-10-03T01:18:00.000Z");

function checkpoint(overrides: Partial<ScheduledVideoDiscoveryCheckpoint> = {}): ScheduledVideoDiscoveryCheckpoint {
  return {
    runId: "video-run",
    status: "completed",
    sourceChecks: [{ source: "StockedUp", status: "checked" }],
    processLog: [{ stage: "youtube_discovery_complete", status: "complete" }],
    updatedAt: "2026-10-03T01:01:00.000Z",
    ingestionStatus: "complete",
    lastHeartbeatAt: "2026-10-03T01:01:00.000Z",
    ...overrides,
  };
}

function intakeResult(runId = "recovered-run"): ScheduledVideoIntakeResult {
  return {
    runId,
    runKey: "video_midnight-2026-10-03",
    generatedAt: now.toISOString(),
    status: "attention" as const,
    summary: {
      channelsChecked: 4,
      channelsFailed: 0,
      uploadsScanned: 2,
      recentVideos: 2,
      transcriptsReady: 0,
      transcriptFailures: 0,
      transcriptsUnavailable: 0,
      cacheHits: 0,
      transcriptsDeferred: 2,
      previouslySeenSkipped: 0,
      livestreamsSkipped: 0,
      shortsSkipped: 0,
    },
    channels: [],
    transcripts: [],
    knownUnavailableVideos: [],
    deferredVideoIds: ["abcdefghijk", "lmnopqrstuv"],
    skippedPreviouslySeenIds: [],
    skippedLivestreamIds: [],
    skippedShortIds: [],
  };
}

test("durable discovery is reused even when the overall video run is blocked on transcripts", async () => {
  let runs = 0;
  const existing = checkpoint({
    status: "blocked",
    ingestionStatus: "complete",
  });

  assert.equal(hasDurableVideoDiscovery(existing), true);

  const result = await ensureScheduledVideoDiscovery("video_midnight", now, {
    readCheckpoint: async () => existing,
    runDiscovery: async () => {
      runs += 1;
      return intakeResult();
    },
  });

  assert.equal(result.action, "reused");
  assert.equal(result.runId, "video-run");
  assert.equal(runs, 0);
});

test("fresh running discovery is never re-entered", async () => {
  let runs = 0;
  const existing = checkpoint({
    status: "running",
    sourceChecks: [],
    processLog: [{ stage: "youtube_discovery_started", status: "running" }],
    ingestionStatus: "running",
    updatedAt: "2026-10-03T01:12:00.000Z",
    lastHeartbeatAt: "2026-10-03T01:12:00.000Z",
  });

  assert.equal(runningVideoDiscoveryIsStale(existing, now), false);

  const result = await ensureScheduledVideoDiscovery("video_midnight", now, {
    readCheckpoint: async () => existing,
    runDiscovery: async () => {
      runs += 1;
      return intakeResult();
    },
  });

  assert.equal(result.action, "in_progress");
  assert.equal(runs, 0);
});

test("missing discovery checkpoint is recovered through the canonical queue-only slot identity", async () => {
  let received: { slot: VideoResearchSlot; runKey: string; scheduledFor: string } | null = null;
  const result = await ensureScheduledVideoDiscovery("video_midnight", now, {
    readCheckpoint: async () => null,
    runDiscovery: async (input) => {
      received = { slot: input.slot, runKey: input.runKey, scheduledFor: input.scheduledFor };
      return intakeResult();
    },
  });

  assert.equal(result.action, "recovered");
  assert.ok(received);
  assert.equal(received.slot, "video_midnight");
  assert.equal(received.runKey, "video_midnight-2026-10-03");
  assert.equal(received.scheduledFor, "2026-10-03T09:00:00+08:00");
});

test("failed non-durable discovery is recovered exactly through the same canonical run identity", async () => {
  let runs = 0;
  const failed = checkpoint({
    status: "failed",
    sourceChecks: [],
    processLog: [{ stage: "youtube_discovery_started", status: "failed" }],
    ingestionStatus: "failed",
  });

  const result = await ensureScheduledVideoDiscovery("video_midnight", now, {
    readCheckpoint: async () => failed,
    runDiscovery: async (input) => {
      runs += 1;
      assert.equal(input.runKey, "video_midnight-2026-10-03");
      return intakeResult("same-canonical-recovered");
    },
  });

  assert.equal(result.action, "recovered");
  assert.equal(result.runId, "same-canonical-recovered");
  assert.equal(runs, 1);
});

test("stale running discovery is recoverable after the 15 minute heartbeat threshold", async () => {
  let runs = 0;
  const stale = checkpoint({
    status: "running",
    sourceChecks: [],
    processLog: [{ stage: "youtube_discovery_started", status: "running" }],
    ingestionStatus: "running",
    updatedAt: "2026-10-03T01:00:00.000Z",
    lastHeartbeatAt: "2026-10-03T01:00:00.000Z",
  });

  assert.equal(runningVideoDiscoveryIsStale(stale, now), true);

  const result = await ensureScheduledVideoDiscovery("video_midnight", now, {
    readCheckpoint: async () => stale,
    runDiscovery: async () => {
      runs += 1;
      return intakeResult();
    },
  });

  assert.equal(result.action, "recovered");
  assert.equal(runs, 1);
});

test("recovery failure is auditable and does not fall through into research", async () => {
  const result = await ensureScheduledVideoDiscovery("video_midnight", now, {
    readCheckpoint: async () => null,
    runDiscovery: async () => {
      throw new Error("YouTube discovery unavailable");
    },
  });

  assert.equal(result.action, "failed");
  assert.match(result.detail, /YouTube discovery unavailable/);
});

test("watchdog remains discovery-only and transcript retry ownership stays with the transcript worker", () => {
  const recovery = readFileSync(new URL("../lib/scheduled-video-recovery.ts", import.meta.url), "utf8");
  const handler = readFileSync(new URL("../lib/video-intake-recovery-handler.ts", import.meta.url), "utf8");
  const worker = readFileSync(new URL("../lib/transcript-worker-handler.ts", import.meta.url), "utf8");
  const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")) as {
    crons: Array<{ path: string; schedule: string }>;
  };

  assert.match(recovery, /browserTranscriptConfigured:\s*\(\) => false/);
  assert.doesNotMatch(recovery, /retrieveChromeYouTubeToTranscript|claimTranscript|retry\(/);
  assert.doesNotMatch(handler, /transcript-worker|retrieveTranscript/);
  assert.match(worker, /TranscriptWorker|transcript/i);

  assert.equal(
    config.crons.some((cron) => cron.path === "/api/cron/video/midnight-watchdog" && cron.schedule === "18 1 * * *"),
    true,
  );
  assert.equal(
    config.crons.some((cron) => cron.path === "/api/cron/video/late-morning-watchdog" && cron.schedule === "18 13 * * *"),
    true,
  );
  assert.equal(
    config.crons.some((cron) => cron.path === "/api/cron/video/transcript-worker" && cron.schedule === "30 1 * * *"),
    true,
  );
  assert.equal(
    config.crons.some((cron) => cron.path === "/api/cron/video/transcript-worker" && cron.schedule === "30 13 * * *"),
    true,
  );
});
