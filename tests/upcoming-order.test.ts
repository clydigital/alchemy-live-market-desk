import assert from "node:assert/strict";
import test from "node:test";

import { sortUpcomingByTime } from "../lib/intelligence/upcoming-order.ts";

test("sortUpcomingByTime promotes the nearest scheduled catalyst", () => {
  const items = sortUpcomingByTime([
    { time: "2026-10-28", event: "FOMC" },
    { time: "2026-10-06", event: "Bowman speech" },
    { time: "2026-10-08", event: "Waller speech" },
  ]);

  assert.deepEqual(items.map((item) => item.event), [
    "Bowman speech",
    "Waller speech",
    "FOMC",
  ]);
});

test("sortUpcomingByTime keeps undated/TBC items behind dated events", () => {
  const items = sortUpcomingByTime([
    { time: "Time TBC", event: "TBC event" },
    { time: null, event: "Undated event" },
    { time: "2026-10-07", event: "Dated event" },
  ]);

  assert.equal(items[0].event, "Dated event");
  assert.deepEqual(new Set(items.slice(1).map((item) => item.event)), new Set(["TBC event", "Undated event"]));
});

test("sortUpcomingByTime does not mutate the immutable edition snapshot array", () => {
  const items = [
    { time: "2026-10-28", event: "Later" },
    { time: "2026-10-06", event: "Sooner" },
  ];
  const original = [...items];

  const sorted = sortUpcomingByTime(items);

  assert.notEqual(sorted, items);
  assert.deepEqual(items, original);
  assert.equal(sorted[0].event, "Sooner");
});
