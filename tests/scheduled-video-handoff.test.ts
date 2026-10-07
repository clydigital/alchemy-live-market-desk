import assert from "node:assert/strict";
import test from "node:test";

import { videoSourceChecksFromDedicatedRun } from "../lib/scheduled-video-handoff.ts";
import { REQUIRED_RESEARCH_SOURCES } from "../lib/research-update.ts";

const completeVideoRun = {
  id: "video-run-1",
  status: "completed" as const,
  warnings: [],
  source_checks: [
    { source: "StockedUp", status: "checked", itemCount: 1 },
    { source: "Wall Street Truthbombs", status: "no_recent_videos", itemCount: 0 },
    { source: "FX Evolution", status: "checked", itemCount: 2 },
    { source: "TraderNick", status: "checked", itemCount: 1 },
  ],
};

function usableRow(publisher: string) {
  return {
    publisher,
    transcript_status: "ready" as const,
    transcript_job_status: "completed",
    video_review_status: "reviewed",
    status: "accepted",
    transcript_retryable: false,
  };
}

function retryableRow(publisher: string) {
  return {
    publisher,
    transcript_status: "missing" as const,
    transcript_job_status: "retryable",
    video_review_status: null,
    status: "blocked",
    transcript_retryable: true,
  };
}

test("desk cron projects completed transcript coverage per creator", () => {
  const checks = videoSourceChecksFromDedicatedRun(
    completeVideoRun,
    { transcript_status: "complete" },
    [
      usableRow("StockedUp"),
      usableRow("FX Evolution"),
      usableRow("FX Evolution"),
      usableRow("TraderNick"),
    ],
  );

  assert.deepEqual(checks.map((check) => [check.source, check.status, check.itemCount]), [
    ["stockedup", "checked", 1],
    ["wall-street-truth-bombs", "no_new_items", 0],
    ["fx-evolution", "checked", 2],
    ["tradernick", "checked", 1],
  ]);
});

test("one creator's unresolved transcript no longer blocks healthy creators", () => {
  const checks = videoSourceChecksFromDedicatedRun(
    completeVideoRun,
    { transcript_status: "partial" },
    [
      usableRow("StockedUp"),
      usableRow("FX Evolution"),
      retryableRow("FX Evolution"),
      usableRow("TraderNick"),
    ],
  );

  assert.deepEqual(checks.map((check) => [check.source, check.status, check.itemCount]), [
    ["stockedup", "checked", 1],
    ["wall-street-truth-bombs", "no_new_items", 0],
    ["fx-evolution", "blocked", 1],
    ["tradernick", "checked", 1],
  ]);
  assert.equal(checks[2].retryable, true);
  assert.match(checks[2].note || "", /1 creator transcript.*usable; 1 remain unresolved/i);
});

test("run-level transcript state remains a fail-closed fallback when per-creator rows are unavailable", () => {
  const checks = videoSourceChecksFromDedicatedRun(completeVideoRun, { transcript_status: "partial" });

  assert.equal(checks[0].status, "blocked");
  assert.equal(checks[2].status, "blocked");
  assert.equal(checks[3].status, "blocked");
  assert.equal(checks[1].status, "no_new_items");
});

test("missing dedicated video work remains explicit blocked research debt", () => {
  const checks = videoSourceChecksFromDedicatedRun(null, null);

  assert.equal(checks.length, 4);
  assert.ok(checks.every((check) => check.status === "blocked" && check.itemCount === 0));
});

test("scheduled research uses only the fixed creator universe", () => {
  const creatorSources = REQUIRED_RESEARCH_SOURCES.filter((source) =>
    ["stockedup", "wall-street-truth-bombs", "fx-evolution", "tradernick", "traders-reality"].includes(source),
  );
  assert.deepEqual(creatorSources, [
    "stockedup",
    "wall-street-truth-bombs",
    "fx-evolution",
    "tradernick",
  ]);
  assert.equal((REQUIRED_RESEARCH_SOURCES as readonly string[]).includes("traders-reality"), false);
});
