import test from "node:test";
import assert from "node:assert/strict";

import { ensureScheduledVideoCheckpoint } from "../lib/scheduled-video-ensure.ts";

const now = new Date("2026-09-01T13:15:00Z");

function intakeResult(runId = "video-run") {
  return {
    runId,
    runKey: "video_late_morning-2026-09-01",
    generatedAt: now.toISOString(),
    status: "healthy" as const,
    summary: {
      totalChannels: 0,
      healthyChannels: 0,
      attentionChannels: 0,
      videosDetected: 0,
      transcriptsReady: 0,
      transcriptFailures: 0,
      transcriptsUnavailable: 0,
      cacheHits: 0,
      transcriptsDeferred: 0,
      livestreamsSkipped: 0,
      shortsSkipped: 0,
    },
    channels: [],
    transcripts: [],
    knownUnavailableVideos: [],
    deferredVideoIds: [],
    skippedLivestreamIds: [],
    skippedShortIds: [],
  };
}

test("reuses a completed matching creator-video checkpoint without provider work", async () => {
  let runs = 0;
  const result = await ensureScheduledVideoCheckpoint("evening", now, {
    readExisting: async () => ({
      run: { id: "existing", status: "completed" },
      slotRun: { transcript_status: "complete" },
    }),
    runVideoIntake: async () => {
      runs += 1;
      return intakeResult();
    },
  });

  assert.equal(result.action, "reused");
  assert.equal(result.runId, "existing");
  assert.equal(result.runKey, "video_late_morning-2026-09-01");
  assert.equal(runs, 0);
});

test("does not re-enter a creator-video checkpoint that is already running", async () => {
  let runs = 0;
  const result = await ensureScheduledVideoCheckpoint("morning", new Date("2026-09-01T01:15:00Z"), {
    readExisting: async () => ({
      run: { id: "running", status: "running" },
      slotRun: { transcript_status: "pending" },
    }),
    runVideoIntake: async () => {
      runs += 1;
      return intakeResult();
    },
  });

  assert.equal(result.action, "in_progress");
  assert.equal(result.runKey, "video_midnight-2026-09-01");
  assert.equal(runs, 0);
});

test("starts the bounded dedicated video intake when the checkpoint is missing", async () => {
  let received: Record<string, unknown> | null = null;
  const result = await ensureScheduledVideoCheckpoint("evening", now, {
    readExisting: async () => ({ run: null, slotRun: null }),
    runVideoIntake: async (input) => {
      received = input as unknown as Record<string, unknown>;
      return intakeResult("recovered");
    },
  });

  assert.equal(result.action, "started");
  assert.equal(result.runId, "recovered");
  assert.equal(received?.slot, "video_late_morning");
  assert.equal(received?.runKey, "video_late_morning-2026-09-01");
  assert.equal(received?.scheduledFor, "2026-09-01T21:00:00+08:00");
});

test("returns an auditable failure instead of crashing the research wrapper", async () => {
  const result = await ensureScheduledVideoCheckpoint("evening", now, {
    readExisting: async () => { throw new Error("checkpoint store unavailable"); },
    runVideoIntake: async () => intakeResult(),
  });

  assert.equal(result.action, "failed");
  assert.match(result.detail, /checkpoint store unavailable/);
});
