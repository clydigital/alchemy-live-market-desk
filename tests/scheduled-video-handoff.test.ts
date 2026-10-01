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

test("desk cron consumes the completed dedicated video checkpoint without re-running transcript acquisition", () => {
  const checks = videoSourceChecksFromDedicatedRun(completeVideoRun, { transcript_status: "complete" });

  assert.deepEqual(checks.map((check) => [check.source, check.status, check.itemCount]), [
    ["stockedup", "checked", 1],
    ["wall-street-truth-bombs", "no_new_items", 0],
    ["fx-evolution", "checked", 2],
    ["tradernick", "checked", 1],
  ]);
});

test("a partial dedicated transcript run stays blocked rather than claiming video coverage", () => {
  const checks = videoSourceChecksFromDedicatedRun(completeVideoRun, { transcript_status: "partial" });

  assert.equal(checks[0].status, "blocked");
  assert.equal(checks[2].status, "blocked");
  assert.equal(checks[3].status, "blocked");
  assert.equal(checks[1].status, "no_new_items");
  assert.match(checks[0].note || "", /transcript lifecycle is not complete/i);
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
