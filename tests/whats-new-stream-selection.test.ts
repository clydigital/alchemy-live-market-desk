import assert from "node:assert/strict";
import test from "node:test";
import { selectRecentWithStoryReserve } from "../lib/whats-new-stream-selection.ts";

const at = (hour: number) => new Date(Date.UTC(2026, 9, 15, 0, hour, 0)).toISOString();

test("recent immutable CPI Story event survives high-volume recent Motion leads", () => {
  const motions = Array.from({ length: 100 }, (_, i) => ({
    id: "motion-" + i, stream: "Motion", timestamp: at(15) + "-" + i,
  }));
  // All Story records are older than many Motions. Oldest historical CPI still
  // sits within the eight most recent Stories, so it must remain reachable.
  const stories = Array.from({ length: 10 }, (_, i) => ({
    id: "story-" + i, stream: "Story", timestamp: at(4 - i),
  }));
  const selected = selectRecentWithStoryReserve([...motions, ...stories], 60, 8);
  assert.equal(selected.length, 60);
  assert.equal(selected.filter((item) => item.stream === "Story").length, 8);
  assert.equal(selected.filter((item) => item.stream === "Motion").length, 52);
  assert.ok(selected.some((item) => item.id === "story-3"));
  assert.equal(new Set(selected.map((item) => item.id)).size, 60);
});

test("selection remains capped, chronological and motion-first when Story volume is low", () => {
  const all = [
    { id: "s", stream: "Story", timestamp: at(1) },
    { id: "m1", stream: "Motion", timestamp: at(3) },
    { id: "m2", stream: "Motion", timestamp: at(2) },
  ];
  assert.deepEqual(selectRecentWithStoryReserve(all, 3, 8).map((x) => x.id), ["m1", "m2", "s"]);
  assert.deepEqual(selectRecentWithStoryReserve(all, 2, 0).map((x) => x.id), ["m1", "m2"]);
  assert.deepEqual(selectRecentWithStoryReserve(all, 0, 8), []);
});
