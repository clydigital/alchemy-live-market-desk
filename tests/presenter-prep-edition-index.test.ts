import assert from "node:assert/strict";
import test from "node:test";
import { buildCanonicalEditionIndex, selectCanonicalEdition, type EditionSnapshot } from "../lib/edition-replay.ts";
import { buildPresenterPrepEditionIndex } from "../lib/presenter-prep-edition-index.ts";

function brief(id: string, time: string, slot: string, supersedes: string | null = null, scheduledFor = time): EditionSnapshot {
  return {
    id, published_at: time, research_run_id: "run-" + id,
    supersedes_snapshot_id: supersedes, snapshot_type: "daily_brief",
    payload: { scheduleSlot: slot, scheduledFor },
  };
}

test("Presenter-only index can replay distinct morning/evening/manual editions without changing Journey", () => {
  const morning = brief("morning", "2026-10-11T02:45:00Z", "morning", null, "2026-10-11T01:30:00Z");
  const evening = brief("evening", "2026-10-11T14:40:00Z", "evening", "morning", "2026-10-11T13:30:00Z");
  const manual = brief("manual", "2026-10-11T16:20:00Z", "manual", "evening", "2026-10-11T16:04:00Z");
  const frozen = [morning, evening, manual];
  const prep = buildPresenterPrepEditionIndex(frozen);
  assert.deepEqual(prep.map((item) => item.snapshotId), ["manual", "evening", "morning"]);
  assert.equal(selectCanonicalEdition(prep, "evening").status, "historical");
  assert.equal(prep[0]?.supersedesSnapshotId, "evening");
  assert.equal(buildCanonicalEditionIndex(frozen).length, 1, "Journey's existing behaviour remains unchanged");
  assert.equal(frozen[2]?.supersedes_snapshot_id, "evening", "source rows were not mutated");
});

test("Presenter index excludes same-slot retries, including separate run IDs", () => {
  const before = brief("before", "2026-10-11T13:40:00Z", "evening", null, "2026-10-11T13:30:00Z");
  const retry = brief("retry", "2026-10-11T14:45:00Z", "evening", "before", "2026-10-11T13:31:00Z");
  const followingDay = brief("following-day", "2026-10-12T14:45:00Z", "evening", "retry", "2026-10-12T13:30:00Z");
  assert.deepEqual(buildPresenterPrepEditionIndex([before, retry, followingDay]).map((item) => item.snapshotId),
    ["following-day", "retry"]);
});

test("manual publication clocks distinguish otherwise same-day, same-slot broadcasts", () => {
  const a = brief("a", "2026-10-11T04:00:00Z", "manual", null, "2026-10-11T03:39:00Z");
  const b = brief("b", "2026-10-11T16:20:00Z", "manual", "a", "2026-10-11T16:04:00Z");
  assert.deepEqual(buildPresenterPrepEditionIndex([a, b]).map((item) => item.snapshotId), ["b", "a"]);
});

test("missing publication clock retains conservative superseded-retry behaviour", () => {
  const a = { ...brief("a", "2026-10-11T03:00:00Z", "morning"), payload: {} };
  const b = { ...brief("b", "2026-10-11T03:10:00Z", "morning", "a"), payload: {} };
  assert.deepEqual(buildPresenterPrepEditionIndex([a, b]).map((item) => item.snapshotId), ["b"]);
});
