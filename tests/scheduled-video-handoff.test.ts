import assert from "node:assert/strict";
import test from "node:test";

import { videoSourceChecksFromDedicatedRun } from "../lib/scheduled-video-handoff.ts";
import { REQUIRED_RESEARCH_SOURCES, validateResearchRun, type ResearchRunInput } from "../lib/research-update.ts";

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

function usableRow(publisher: string) {
  return {
    publisher,
    transcript_status: "ready" as const,
    transcript_job_status: "completed",
    video_review_status: "reviewed",
    status: "accepted",
    transcript_retryable: false,
  };
}

function retryableRow(publisher: string) {
  return {
    publisher,
    transcript_status: "missing" as const,
    transcript_job_status: "retryable",
    video_review_status: null,
    status: "blocked",
    transcript_retryable: true,
  };
}

test("desk cron projects completed transcript coverage per creator", () => {
  const checks = videoSourceChecksFromDedicatedRun(
    completeVideoRun,
    { transcript_status: "complete" },
    [
      usableRow("StockedUp"),
      usableRow("FX Evolution"),
      usableRow("FX Evolution"),
      usableRow("TraderNick"),
    ],
  );

  assert.deepEqual(checks.map((check) => [check.source, check.status, check.itemCount]), [
    ["stockedup", "checked", 1],
    ["wall-street-truth-bombs", "no_new_items", 0],
    ["fx-evolution", "checked", 2],
    ["tradernick", "checked", 1],
  ]);
});

test("one creator's unresolved transcript no longer blocks healthy creators", () => {
  const checks = videoSourceChecksFromDedicatedRun(
    completeVideoRun,
    { transcript_status: "partial" },
    [
      usableRow("StockedUp"),
      usableRow("FX Evolution"),
      retryableRow("FX Evolution"),
      usableRow("TraderNick"),
    ],
  );

  assert.deepEqual(checks.map((check) => [check.source, check.status, check.itemCount]), [
    ["stockedup", "checked", 1],
    ["wall-street-truth-bombs", "no_new_items", 0],
    ["fx-evolution", "blocked", 0],
    ["tradernick", "checked", 1],
  ]);
  assert.equal(checks[2].retryable, true);
  assert.match(checks[2].note || "", /1 creator transcript.*usable; 1 remain unresolved/i);
});

test("run-level transcript state remains a fail-closed fallback when per-creator rows are unavailable", () => {
  const checks = videoSourceChecksFromDedicatedRun(completeVideoRun, { transcript_status: "partial" });

  assert.equal(checks[0].status, "blocked");
  assert.equal(checks[2].status, "blocked");
  assert.equal(checks[3].status, "blocked");
  assert.equal(checks[1].status, "no_new_items");
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


test("partial creator intake meets the canonical research validator without erasing usable transcript context", () => {
  const rows = [
    usableRow("StockedUp"),
    usableRow("FX Evolution"),
    retryableRow("FX Evolution"),
    usableRow("TraderNick"),
  ];
  const creatorChecks = videoSourceChecksFromDedicatedRun(completeVideoRun, { transcript_status: "partial" }, rows);
  const restOfSources = REQUIRED_RESEARCH_SOURCES
    .filter((source) => !creatorChecks.some((check) => check.source === source))
    .map((source) => ({ source, status: "no_new_items" as const, itemCount: 0 }));
  assert.equal(creatorChecks.length + restOfSources.length, 9);
  for (const scheduleSlot of ["morning", "evening"] as const) {
    const scheduledInput: ResearchRunInput = {
      runKey: `cron-v1:${scheduleSlot}:2026-10-10`,
      scheduleSlot,
      scheduledFor: scheduleSlot === "morning" ? "2026-10-10T01:30:00.000Z" : "2026-10-10T13:30:00.000Z",
      sourceChecks: [...creatorChecks, ...restOfSources],
      items: [],
      recalibrations: [],
    };
    const validation = validateResearchRun(scheduledInput);
    assert.deepEqual(validation.errors, [], "partial creator coverage cannot abort the entire scheduled research run");
    assert.equal(creatorChecks.find((check) => check.source === "stockedup")?.status, "checked");
    assert.equal(creatorChecks.find((check) => check.source === "tradernick")?.status, "checked");
    assert.deepEqual(
      creatorChecks.find((check) => check.source === "fx-evolution"),
      {
        source: "fx-evolution",
        status: "blocked",
        itemCount: 0,
        retryable: true,
        note: "1 creator transcript(s) are usable; 1 remain unresolved for this creator.",
      },
      "usable records remain visible as diagnostic counts without being re-admitted as research items",
    );
    const malformed: ResearchRunInput = {
      ...scheduledInput,
      sourceChecks: scheduledInput.sourceChecks.map((check) =>
        check.source === "fx-evolution" ? { ...check, itemCount: 1 } : check,
      ),
    };
    assert.ok(
      validateResearchRun(malformed).errors.includes("fx-evolution cannot report blocked with a positive itemCount."),
      "the original mapper shape provably violates the current canonical validation contract",
    );
  }
});

test("non-retryable unresolved videos stay blocked while no-upload and healthy channels stay independent", () => {
  const noRetry = { ...retryableRow("FX Evolution"), transcript_retryable: false, transcript_job_status: "failed" };
  const checks = videoSourceChecksFromDedicatedRun(
    completeVideoRun, { transcript_status: "partial" },
    [usableRow("StockedUp"), usableRow("FX Evolution"), noRetry, usableRow("TraderNick")],
  );
  const fx = checks.find((check) => check.source === "fx-evolution");
  assert.equal(fx?.status, "blocked");
  assert.equal(fx?.itemCount, 0);
  assert.equal(fx?.retryable, false);
  assert.match(fx?.note || "", /1 creator transcript.*usable; 1 remain unresolved/i);
  assert.equal(checks.find((check) => check.source === "wall-street-truth-bombs")?.status, "no_new_items");
  assert.equal(checks.find((check) => check.source === "stockedup")?.status, "checked");

  const allUnavailable = videoSourceChecksFromDedicatedRun(null, null);
  const blocked: ResearchRunInput = {
    runKey: "cron-v1:morning:2026-10-10",
    scheduleSlot: "morning",
    scheduledFor: "2026-10-10T01:30:00.000Z",
    sourceChecks: [
      ...allUnavailable,
      ...REQUIRED_RESEARCH_SOURCES.filter((source) => !allUnavailable.some((check) => check.source === source))
        .map((source) => ({ source, status: "blocked" as const, itemCount: 0 })),
    ],
    items: [],
    recalibrations: [],
  };
  assert.deepEqual(validateResearchRun(blocked).errors, [], "complete source unavailability is a truthful degraded state, not a shape error");
  assert.equal(validateResearchRun(blocked).sourceCoverageAvailable, false);
});
