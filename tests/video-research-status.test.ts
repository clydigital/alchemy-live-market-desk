import assert from "node:assert/strict";
import test from "node:test";

import { composeVideoResearchStatus } from "../lib/video-research-status.ts";

test("creator video status distinguishes detection, manual-pending intake and detector failures", () => {
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
    }],
  });

  const stockedUp = status.channels.find((channel) => channel.key === "stockedup");
  const fxEvolution = status.channels.find((channel) => channel.key === "fx-evolution");
  const traderNick = status.channels.find((channel) => channel.key === "tradernick");
  assert.equal(stockedUp?.detector.label, "1 new video detected");
  assert.equal(stockedUp?.transcript.label, "1 transcript awaiting manual intake");
  assert.equal(stockedUp?.videos[0]?.url, "https://www.youtube.com/watch?v=KHacM8aduWM");
  assert.equal(fxEvolution?.detector.label, "No new videos detected");
  assert.equal(traderNick?.detector.label, "Detector failed");
});
