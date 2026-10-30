import assert from "node:assert/strict";
import test from "node:test";

import { dateOnlyLabel, formatDualDeskTime } from "../lib/blue-desk-time.ts";

test("ET-first and smaller MYT counterpart use the same absolute instant", () => {
  const pair = formatDualDeskTime("2026-10-19T12:30:00Z");
  assert.ok(pair);
  assert.match(pair.et, /08:30 EDT$/);
  assert.match(pair.myt, /20:30 MYT$/);
  assert.equal(pair.etDay, "2026-10-19");
  assert.equal(pair.mytDay, "2026-10-19");
});

test("EST resumes after November daylight-saving change", () => {
  const pair = formatDualDeskTime("2026-11-02T13:30:00Z");
  assert.ok(pair);
  assert.match(pair.et, /08:30 EST$/);
  assert.match(pair.myt, /21:30 MYT$/);
});

test("MYT must show the next day's date, not the ET calendar day", () => {
  const pair = formatDualDeskTime("2026-10-19T18:00:00Z");
  assert.ok(pair);
  assert.equal(pair.etDay, "2026-10-19");
  assert.equal(pair.mytDay, "2026-10-20");
  assert.match(pair.et, /14:00 EDT$/);
  assert.match(pair.myt, /02:00 MYT$/);
});

test("date-only and timezone-unknown strings do not invent ET instants", () => {
  assert.equal(formatDualDeskTime("2026-10-19"), null);
  assert.equal(formatDualDeskTime("2026-10-19T08:30:00"), null);
  assert.equal(formatDualDeskTime("invalid"), null);
  assert.match(dateOnlyLabel("2026-10-19"), /source date only/);
});
