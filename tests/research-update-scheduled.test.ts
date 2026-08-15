import assert from "node:assert/strict";
import test from "node:test";

import {
  type ResearchRunLedgerStartFields,
  writeResearchRunLedgerStart,
} from "../lib/research-run-ledger.ts";

const baseFields: ResearchRunLedgerStartFields = {
  schedule_slot: "morning",
  scheduled_for: "2026-08-15T09:15:00+08:00",
  status: "running",
  accuracy_gate: "ready",
  required_sources_complete: true,
  evidence_gate_passed: true,
  source_checks: [],
  videos_found: 0,
  transcripts_ready: 0,
  news_scanned: 0,
  candidates_kept: 0,
  articles_scanned: 0,
  articles_flagged: 0,
  evidence_added: 0,
  updates_published: 0,
  warnings: [],
  summary: "Scheduled test run.",
  updated_at: "2026-08-15T01:15:00.000Z",
};

test("scheduled publisher preserves original started_at by patching only mutable fields", async () => {
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  const runId = await writeResearchRunLedgerStart({
    rest: async <T>(path: string, init?: RequestInit) => {
      calls.push({ path, init });
      if (path.includes("select=id")) return [{ id: "run-1" }] as T;
      return undefined as T;
    },
    runKey: "cron-v1:morning:2026-08-15",
    isScheduledInternalRequest: true,
    fields: baseFields,
    now: "2026-08-15T01:15:00.000Z",
  });

  assert.equal(runId, "run-1");
  assert.equal(calls.length, 2);
  assert.match(calls[0].path, /research_runs\?run_key=eq\./);
  assert.match(calls[1].path, /research_runs\?id=eq\./);

  const patchBody = JSON.parse(String(calls[1].init?.body));
  assert.equal("started_at" in patchBody, false);
  assert.equal("run_key" in patchBody, false);
  assert.equal(patchBody.status, "running");
  assert.equal(patchBody.scheduled_for, "2026-08-15T09:15:00+08:00");
});

test("scheduled publisher fails closed if the canonical preclaim is missing", async () => {
  await assert.rejects(
    writeResearchRunLedgerStart({
      rest: async <T>() => [] as T,
      runKey: "cron-v1:morning:2026-08-15",
      isScheduledInternalRequest: true,
      fields: baseFields,
    }),
    /Scheduled research run not found by run_key cron-v1:morning:2026-08-15/,
  );
});

test("non-scheduled publisher still creates its row with started_at", async () => {
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  const runId = await writeResearchRunLedgerStart({
    rest: async <T>(path: string, init?: RequestInit) => {
      calls.push({ path, init });
      return [{ id: "run-2" }] as T;
    },
    runKey: "manual:test:2026-08-15",
    isScheduledInternalRequest: false,
    fields: {
      ...baseFields,
      schedule_slot: "evening",
      scheduled_for: "2026-08-15T21:15:00+08:00",
    },
    now: "2026-08-15T13:15:00.000Z",
  });

  assert.equal(runId, "run-2");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, "research_runs?on_conflict=run_key");

  const postBody = JSON.parse(String(calls[0].init?.body));
  assert.equal(postBody.run_key, "manual:test:2026-08-15");
  assert.equal(postBody.started_at, "2026-08-15T13:15:00.000Z");
  assert.equal(postBody.schedule_slot, "evening");
  assert.equal(postBody.scheduled_for, "2026-08-15T21:15:00+08:00");
});
