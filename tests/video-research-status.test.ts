import assert from "node:assert/strict";
import test from "node:test";

import { LEGACY_TRANSCRIPT_PLACEHOLDER } from "../lib/transcript-job-state.ts";
import { composeVideoResearchStatus } from "../lib/video-research-status.ts";

test("creator video status distinguishes detection, claimable intake and detector failures", () => {
  const status = composeVideoResearchStatus({
    now: new Date("2026-09-07T03:00:00.000Z"),
    run: {
      id: "video-run",
      status: "completed",
      started_at: "2026-09-07T01:00:00.000Z",
      completed_at: "2026-09-07T01:02:00.000Z",
      updated_at: "2026-09-07T01:02:00.000Z",
      source_checks: [
        { source: "StockedUp", status: "checked", itemCount: 1 },
        { source: "FX Evolution", status: "no_recent_videos", itemCount: 0 },
        { source: "TraderNick", status: "youtube_quota_error", itemCount: 0 },
      ],
    },
    videos: [{
      publisher: "StockedUp",
      title: "September market update",
      url: "https://www.youtube.com/watch?v=KHacM8aduWM",
      published_at: "2026-09-07T00:30:00.000Z",
      transcript_status: "missing",
      transcript_provider: null,
      transcript_error_code: null,
      transcript_attempt_count: 0,
      status: "blocked",
      summary: LEGACY_TRANSCRIPT_PLACEHOLDER,
      video_review_status: null,
      external_id: "KHacM8aduWM",
      transcript_job_status: "blocked",
      transcript_lease_expires_at: null,
      transcript_next_attempt_at: null,
    }],
  });

  const stockedUp = status.channels.find((channel) => channel.key === "stockedup");
  const fxEvolution = status.channels.find((channel) => channel.key === "fx-evolution");
  const traderNick = status.channels.find((channel) => channel.key === "tradernick");
  assert.equal(stockedUp?.detector.label, "1 new video detected");
  assert.equal(stockedUp?.transcript.label, "1 claimable transcript job");
  assert.equal(stockedUp?.videos[0]?.jobStatus, "pending");
  assert.equal(stockedUp?.videos[0]?.url, "https://www.youtube.com/watch?v=KHacM8aduWM");
  assert.equal(fxEvolution?.detector.label, "No new videos detected");
  assert.equal(traderNick?.detector.label, "Detector failed");
});

test("an explicitly blocked job is not reported as pending", () => {
  const status = composeVideoResearchStatus({
    now: new Date("2026-09-14T00:00:00.000Z"),
    run: null,
    videos: [{
      publisher: "StockedUp",
      title: "Unavailable transcript",
      url: "https://www.youtube.com/watch?v=GYne0nYFiqk",
      published_at: "2026-09-10T22:00:17.000Z",
      transcript_status: "unavailable",
      transcript_provider: "supadata",
      transcript_error_code: "transcript_missing",
      transcript_attempt_count: 1,
      status: "blocked",
      summary: LEGACY_TRANSCRIPT_PLACEHOLDER,
      video_review_status: "unavailable",
      external_id: "GYne0nYFiqk",
      transcript_job_status: "blocked",
      transcript_lease_expires_at: null,
      transcript_next_attempt_at: null,
    }],
  });

  assert.equal(status.summary.transcriptsPending, 0);
  assert.equal(status.summary.transcriptsBlocked, 1);
  assert.equal(status.channels.find((channel) => channel.key === "stockedup")?.transcript.state, "blocked");
});

test("the ten retained production placeholders become claimable through application semantics", () => {
  const retained = [
    ["GYne0nYFiqk", "StockedUp"],
    ["tLNn2TcraYg", "Wall Street Truthbombs"],
    ["DoHrjs14ESA", "Traders Reality"],
    ["D_kovjESYsc", "Kevin Gerrity"],
    ["Em56VP75r2Q", "ClearValue Tax"],
    ["rZx1mJD_7_s", "StockedUp"],
    ["YqOCOMPvivY", "Wall Street Truthbombs"],
    ["wbMNXDKyhQc", "Traders Reality"],
    ["EfYOPbZ4_98", "Kevin Gerrity"],
    ["-I-ZPysTU1E", "ClearValue Tax"],
  ] as const;
  const status = composeVideoResearchStatus({
    now: new Date("2026-09-14T00:00:00.000Z"),
    run: null,
    videos: retained.map(([videoId, publisher], index) => ({
      publisher,
      title: `Retained video ${index + 1}`,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      published_at: new Date(Date.UTC(2026, 8, 10, 22, 0, index)).toISOString(),
      transcript_status: "missing" as const,
      transcript_provider: null,
      transcript_error_code: null,
      transcript_attempt_count: 0,
      status: "blocked",
      summary: LEGACY_TRANSCRIPT_PLACEHOLDER,
      video_review_status: null,
      external_id: videoId,
      transcript_job_status: "blocked" as const,
      transcript_lease_expires_at: null,
      transcript_next_attempt_at: null,
    })),
  });

  assert.equal(status.summary.transcriptsPending, 10);
  assert.equal(status.summary.transcriptsBlocked, 0);
  assert.equal(status.summary.transcriptsRunning, 0);
  assert.equal(status.summary.transcriptsCompleted, 0);
});
