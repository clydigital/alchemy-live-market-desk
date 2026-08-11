import assert from "node:assert/strict";
import test from "node:test";

import { deriveMacroReleaseLifecycle } from "../lib/macro-release-lifecycle.ts";

const now = new Date("2026-08-11T12:00:00.000Z");

test("a past release with no Actual becomes an explicit ingestion gap", () => {
  const lifecycle = deriveMacroReleaseLifecycle({
    release_date: "2026-08-10T12:30:00.000Z",
    status: "upcoming",
    actual: null,
  }, now);

  assert.equal(lifecycle.status, "stale_error");
  assert.equal(lifecycle.ingestionGap, true);
  assert.match(lifecycle.ingestionGapReason || "", /Actual remains unavailable/i);
});

test("the short post-release grace window remains visible and non-final", () => {
  const lifecycle = deriveMacroReleaseLifecycle({
    release_date: "2026-08-11T10:00:00.000Z",
    status: "pre_release",
    actual: null,
  }, now);

  assert.equal(lifecycle.status, "released_pending_ingestion");
  assert.equal(lifecycle.ingestionGap, true);
});

test("an official Actual completes the release without interpreting its direction", () => {
  const lifecycle = deriveMacroReleaseLifecycle({
    release_date: "2026-08-10T12:30:00.000Z",
    status: "upcoming",
    actual: "123k payrolls",
  }, now);

  assert.equal(lifecycle.status, "completed");
  assert.equal(lifecycle.ingestionGap, false);
});

test("future releases move through scheduled and pre-release states", () => {
  assert.equal(deriveMacroReleaseLifecycle({
    release_date: "2026-08-13T12:30:00.000Z",
    status: "upcoming",
    actual: null,
  }, now).status, "scheduled");

  assert.equal(deriveMacroReleaseLifecycle({
    release_date: "2026-08-12T10:00:00.000Z",
    status: "upcoming",
    actual: null,
  }, now).status, "pre_release");
});
