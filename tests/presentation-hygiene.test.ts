import assert from "node:assert/strict";
import test from "node:test";

import { presentationAge, readerFacingText } from "../lib/presentation-hygiene.ts";

test("maintenance codes are not reader-facing copy", () => {
  assert.equal(readerFacingText("material_evidence_recalibration"), null);
  assert.equal(readerFacingText("story_created"), null);
  assert.equal(readerFacingText("Treasury yields repriced sharply higher."), "Treasury yields repriced sharply higher.");
});

test("What’s New marks old records as historical context without hiding them", () => {
  const result = presentationAge("2026-08-12T12:00:00Z", new Date("2026-09-29T00:00:00Z"));
  assert.equal(result.ageState, "historical");
  assert.equal(result.ageLabel, "47d ago");
  assert.equal(result.ageDays, 47);
});

test("recent records remain current", () => {
  const result = presentationAge("2026-09-27T12:00:00Z", new Date("2026-09-29T00:00:00Z"));
  assert.equal(result.ageState, "current");
  assert.equal(result.ageLabel, null);
});
