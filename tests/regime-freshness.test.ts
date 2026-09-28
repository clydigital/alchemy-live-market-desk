import assert from "node:assert/strict";
import test from "node:test";

import { assessRegimeInterpretationFreshness } from "../lib/regime-freshness.ts";

test("newer System 1 telemetry marks the accepted interpretation as pending refresh", () => {
  const result = assessRegimeInterpretationFreshness({
    telemetryAt: ["2026-09-28T06:01:00.000Z"],
    interpretationAt: ["2026-09-27T22:14:00.000Z"],
  });

  assert.equal(result.status, "new_telemetry");
  assert.equal(result.lagMinutes, 467);
});

test("a hypothesis timestamp at or after telemetry does not create a stale warning", () => {
  const result = assessRegimeInterpretationFreshness({
    telemetryAt: ["2026-09-28T06:01:00.000Z"],
    interpretationAt: ["2026-09-28T06:15:00.000Z"],
  });

  assert.equal(result.status, "timestamp_current");
  assert.equal(result.lagMinutes, 0);
});

test("telemetry without a timestamped System 2 hypothesis is explicit", () => {
  const result = assessRegimeInterpretationFreshness({
    telemetryAt: ["bad-date", "2026-09-28T06:01:00.000Z"],
    interpretationAt: [],
  });

  assert.equal(result.status, "no_interpretation");
  assert.equal(result.telemetryAt, "2026-09-28T06:01:00.000Z");
});

test("Story-led subgroups without deterministic telemetry do not invent a freshness comparison", () => {
  const result = assessRegimeInterpretationFreshness({
    telemetryAt: [],
    interpretationAt: ["2026-09-28T06:15:00.000Z"],
  });

  assert.equal(result.status, "no_telemetry");
  assert.equal(result.interpretationAt, "2026-09-28T06:15:00.000Z");
});
