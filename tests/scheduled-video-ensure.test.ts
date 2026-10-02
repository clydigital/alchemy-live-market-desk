import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ensureScheduledVideoCheckpoint } from "../lib/scheduled-video-ensure.ts";

const eveningNow = new Date("2026-09-01T13:30:00Z");

function intakeResult(runId = "video-run") {
  return {
    runId,
    runKey: "video_late_morning-2026-09-01",
    generatedAt: eveningNow.toISOString(),
    status: "attention" as const,
    summary: {
      channelsChecked: 4,
      channelsFailed: 0,
      uploadsScanned: 4,
      recentVideos: 1,
      transcriptsReady: 0,
      transcriptFailures: 0,
      transcriptsUnavailable: 0,
      cacheHits: 0,
      transcriptsDeferred: 1,
      previouslySeenSkipped: 0,
      livestreamsSkipped: 0,
      shortsSkipped: 0,
    },
    channels: [],
    transcripts: [],
    knownUnavailableVideos: [],
    deferredVideoIds: ["abcdefghijk"],
    skippedPreviouslySeenIds: [],
    skippedLivestreamIds: [],
    skippedShortIds: [],
  };
}

test("reuses every existing terminal creator-video run without starting discovery again", async () => {
  for (const status of ["completed", "blocked", "failed"]) {
    let runs = 0;
    const result = await ensureScheduledVideoCheckpoint("evening", eveningNow, {
      readExisting: async () => ({
        run: { id: `existing-${status}`, status },
        slotRun: { ingestion_status: "complete", transcript_status: status === "completed" ? "complete" : "blocked" },
      }),
      runVideoIntake: async () => {
        runs += 1;
        return intakeResult();
      },
    });

    assert.equal(result.action, "reused");
    assert.equal(result.runId, `existing-${status}`);
    assert.equal(runs, 0);
    assert.match(result.detail, /will not retry transcript work/i);
  }
});

test("does not re-enter an existing running creator-video discovery", async () => {
  let runs = 0;
  const result = await ensureScheduledVideoCheckpoint(
    "morning",
    new Date("2026-09-01T01:30:00Z"),
    {
      readExisting: async () => ({
        run: { id: "running", status: "running" },
        slotRun: { ingestion_status: "running", transcript_status: "pending" },
      }),
      runVideoIntake: async () => {
        runs += 1;
        return intakeResult();
      },
    },
  );

  assert.equal(result.action, "in_progress");
  assert.equal(result.runKey, "video_midnight-2026-09-01");
  assert.equal(runs, 0);
});

test("recovers only a completely missing dedicated discovery checkpoint", async () => {
  const received: Array<Record<string, unknown>> = [];
  const result = await ensureScheduledVideoCheckpoint("evening", eveningNow, {
    readExisting: async () => ({ run: null, slotRun: null }),
    runVideoIntake: async (input) => {
      received.push(input as unknown as Record<string, unknown>);
      return intakeResult("recovered");
    },
  });

  assert.equal(result.action, "started");
  assert.equal(result.runId, "recovered");
  assert.equal(received[0]?.slot, "video_late_morning");
  assert.equal(received[0]?.runKey, "video_late_morning-2026-09-01");
  assert.equal(received[0]?.scheduledFor, "2026-09-01T21:00:00+08:00");
  assert.match(result.detail, /queue-only mode/i);
});

test("returns an auditable failure instead of crashing scheduled research", async () => {
  const result = await ensureScheduledVideoCheckpoint("evening", eveningNow, {
    readExisting: async () => {
      throw new Error("checkpoint store unavailable");
    },
    runVideoIntake: async () => intakeResult(),
  });

  assert.equal(result.action, "failed");
  assert.match(result.detail, /checkpoint store unavailable/);
});

test("research preflight uses queue-only discovery and runs before canonical acquisition", () => {
  const ensure = readFileSync(new URL("../lib/scheduled-video-ensure.ts", import.meta.url), "utf8");
  const wrapper = readFileSync(new URL("../lib/cron-research-acquisition-with-video-handler.ts", import.meta.url), "utf8");
  const morning = readFileSync(new URL("../app/api/cron/research/morning/route.ts", import.meta.url), "utf8");
  const evening = readFileSync(new URL("../app/api/cron/research/evening/route.ts", import.meta.url), "utf8");

  assert.match(ensure, /browserTranscriptConfigured:\s*\(\) => false/);
  assert.doesNotMatch(ensure, /handleTranscriptWorkerRequest|retrieveSupadataVideo|retrieveChromeYouTubeToTranscript/);
  assert.match(wrapper, /scheduledResearchEnabled\(\)/);
  assert.match(wrapper, /acceptsResearchAuthorization/);

  for (const route of [morning, evening]) {
    const preflight = route.indexOf("await prepareScheduledResearchVideoCheckpoint");
    const acquisition = route.indexOf("return handleScheduledResearchAcquisition");
    assert.ok(preflight >= 0 && acquisition > preflight);
  }
});
