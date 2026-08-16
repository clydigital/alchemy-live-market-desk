import assert from "node:assert/strict";
import test from "node:test";

import { videoSourceChecksFromDedicatedRun } from "../lib/scheduled-video-handoff.ts";

const completeVideoRun = {
  id: "video-run-1",
  status: "completed" as const,
  warnings: [],
  source_checks: [
    { source: "StockedUp", status: "checked", itemCount: 1 },
    { source: "Wall Street Truthbombs", status: "no_recent_videos", itemCount: 0 },
    { source: "Traders Reality", status: "checked", itemCount: 2 },
  ],
};

test("desk cron consumes the completed dedicated video checkpoint without re-running transcript acquisition", () => {
  const checks = videoSourceChecksFromDedicatedRun(completeVideoRun, { transcript_status: "complete" });

  assert.deepEqual(checks.map((check) => [check.source, check.status, check.itemCount]), [
    ["stockedup", "checked", 1],
    ["wall-street-truth-bombs", "no_new_items", 0],
    ["traders-reality", "checked", 2],
  ]);
});

test("a partial dedicated transcript run stays blocked rather than claiming video coverage", () => {
  const checks = videoSourceChecksFromDedicatedRun(completeVideoRun, { transcript_status: "partial" });

  assert.equal(checks[0].status, "blocked");
  assert.equal(checks[2].status, "blocked");
  assert.equal(checks[1].status, "no_new_items");
  assert.match(checks[0].note || "", /transcript lifecycle is not complete/i);
});

test("missing dedicated video work remains explicit blocked research debt", () => {
  const checks = videoSourceChecksFromDedicatedRun(null, null);

  assert.equal(checks.length, 3);
  assert.ok(checks.every((check) => check.status === "blocked" && check.itemCount === 0));
});
