import assert from "node:assert/strict";
import test from "node:test";

import { deriveMacroReleaseLifecycle } from "../lib/macro-release-lifecycle.ts";

const now = new Date("2026-08-11T12:00:00.000Z");

test("old release with no ingestion attempt is ingestion_pending, never age-only stale_error", () => {
  const lifecycle = deriveMacroReleaseLifecycle({
    release_date: "2026-08-01T12:30:00.000Z",
    status: "upcoming",
    actual: null,
    last_ingestion_attempt_at: null,
  }, now);

  assert.equal(lifecycle.status, "ingestion_pending");
  assert.equal(lifecycle.ingestionGap, true);
  assert.match(lifecycle.ingestionGapReason || "", /no official Actual ingestion attempt/i);
});

test("attempted ingestion inside retry state remains released_pending_ingestion", () => {
  const lifecycle = deriveMacroReleaseLifecycle({
    release_date: "2026-08-01T12:30:00.000Z",
    status: "ingestion_pending",
    actual: null,
    last_ingestion_attempt_at: "2026-08-11T11:30:00.000Z",
    ingestion_attempt_status: "failed_retryable",
    ingestion_retry_exhausted: false,
  }, now);

  assert.equal(lifecycle.status, "released_pending_ingestion");
  assert.equal(lifecycle.ingestionGap, true);
});

test("a verified failed attempt becomes stale_error only when retry policy is exhausted", () => {
  const lifecycle = deriveMacroReleaseLifecycle({
    release_date: "2026-08-10T12:30:00.000Z",
    status: "released_pending_ingestion",
    actual: null,
    last_ingestion_attempt_at: "2026-08-11T10:00:00.000Z",
    ingestion_attempt_status: "failed",
    ingestion_retry_exhausted: true,
  }, now);

  assert.equal(lifecycle.status, "stale_error");
  assert.match(lifecycle.ingestionGapReason || "", /retry policy is exhausted/i);
});

test("an official Actual completes the release and preserves revision state", () => {
  assert.equal(deriveMacroReleaseLifecycle({
    release_date: "2026-08-10T12:30:00.000Z",
    status: "upcoming",
    actual: "123k payrolls",
  }, now).status, "completed");

  assert.equal(deriveMacroReleaseLifecycle({
    release_date: "2026-08-10T12:30:00.000Z",
    status: "revision_detected",
    actual: "125k payrolls",
  }, now).status, "revision_detected");
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
