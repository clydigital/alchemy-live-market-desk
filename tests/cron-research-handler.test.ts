import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildScheduledResearchLogEvent,
  claimRunWithDependencies,
  resolveScheduledResearchIdentity,
} from "../lib/scheduled-research-identity.ts";

const FIXED_NOW = new Date("2026-08-15T01:18:00.000Z");
const FIXED_NOW_ISO = FIXED_NOW.toISOString();

type MemoryRun = {
  id: string;
  run_key: string;
  status: "running" | "completed" | "blocked" | "failed";
  completed_at: string | null;
  updated_at: string;
};

function createClaimHarness(initialRows: MemoryRun[] = []) {
  const rows = new Map(initialRows.map((row) => [row.run_key, { ...row }]));
  let nextId = rows.size + 1;

  return {
    rows,
    claimRun: (slot: "morning" | "evening", runKey: string, scheduledFor: string) => claimRunWithDependencies(slot, runKey, scheduledFor, {
      now: () => FIXED_NOW_ISO,
      readRun: async (key) => {
        const row = rows.get(key);
        return row
          ? {
            id: row.id,
            status: row.status,
            completed_at: row.completed_at,
            updated_at: row.updated_at,
          }
          : null;
      },
      insertRun: async ({ runKey: key, updatedAt }) => {
        await Promise.resolve();
        const existing = rows.get(key);
        if (existing) {
          const error = new Error("duplicate scheduled claim") as Error & { code?: string };
          error.code = "23505";
          throw error;
        }
        const row: MemoryRun = {
          id: `run-${nextId++}`,
          run_key: key,
          status: "running",
          completed_at: null,
          updated_at: updatedAt,
        };
        rows.set(key, row);
        return {
          id: row.id,
          status: row.status,
          completed_at: row.completed_at,
          updated_at: row.updated_at,
        };
      },
    }),
  };
}

function cronRequest(url: string, cronSchedule: string) {
  return new Request(url, {
    headers: {
      authorization: "Bearer not-used-in-test",
      "x-vercel-id": "kul1::cron-test-123",
      "x-vercel-deployment-url": "alchemy-live-market-desk-test.vercel.app",
      "x-vercel-cron-schedule": cronSchedule,
    },
  });
}

test("primary first then watchdog is a no-op on the same canonical morning run", async () => {
  const harness = createClaimHarness();
  const primaryIdentity = resolveScheduledResearchIdentity(
    cronRequest("https://example.com/api/cron/research/morning", "15 1 * * *"),
    "morning",
    FIXED_NOW,
  );
  const watchdogIdentity = resolveScheduledResearchIdentity(
    cronRequest("https://example.com/api/cron/research/morning-watchdog", "20 1 * * *"),
    "morning",
    FIXED_NOW,
  );

  const primary = await harness.claimRun("morning", primaryIdentity.runKey, primaryIdentity.scheduledFor);
  const watchdog = await harness.claimRun("morning", watchdogIdentity.runKey, watchdogIdentity.scheduledFor);

  assert.equal(primaryIdentity.runKey, "cron-v1:morning:2026-08-15");
  assert.equal(watchdogIdentity.runKey, primaryIdentity.runKey);
  assert.equal(watchdogIdentity.scheduledFor, primaryIdentity.scheduledFor);
  assert.equal(primary.state, "claimed");
  assert.equal(watchdog.state, "running");
  assert.equal(harness.rows.size, 1);
});

test("watchdog first then delayed primary is a no-op on the same canonical evening run", async () => {
  const harness = createClaimHarness();
  const now = new Date("2026-08-15T13:18:00.000Z");
  const watchdogIdentity = resolveScheduledResearchIdentity(
    cronRequest("https://example.com/api/cron/research/evening-watchdog", "20 13 * * *"),
    "evening",
    now,
  );
  const primaryIdentity = resolveScheduledResearchIdentity(
    cronRequest("https://example.com/api/cron/research/evening", "15 13 * * *"),
    "evening",
    now,
  );

  const watchdog = await harness.claimRun("evening", watchdogIdentity.runKey, watchdogIdentity.scheduledFor);
  const primary = await harness.claimRun("evening", primaryIdentity.runKey, primaryIdentity.scheduledFor);

  assert.equal(watchdogIdentity.runKey, "cron-v1:evening:2026-08-15");
  assert.equal(primaryIdentity.runKey, watchdogIdentity.runKey);
  assert.equal(primaryIdentity.scheduledFor, watchdogIdentity.scheduledFor);
  assert.equal(watchdog.state, "claimed");
  assert.equal(primary.state, "running");
  assert.equal(harness.rows.size, 1);
});

test("primary and watchdog races still collapse to exactly one canonical run", async () => {
  const harness = createClaimHarness();
  const { runKey, scheduledFor } = resolveScheduledResearchIdentity(
    cronRequest("https://example.com/api/cron/research/morning", "15 1 * * *"),
    "morning",
    FIXED_NOW,
  );

  const outcomes = await Promise.all([
    harness.claimRun("morning", runKey, scheduledFor),
    harness.claimRun("morning", runKey, scheduledFor),
  ]);
  const states = outcomes.map((outcome) => outcome.state).sort();

  assert.deepEqual(states, ["claimed", "running"]);
  assert.equal(harness.rows.size, 1);
  assert.equal(harness.rows.get(runKey)?.run_key, "cron-v1:morning:2026-08-15");
});

test("terminal scheduled runs remain non-retriable without an explicit retry key", async () => {
  const runKey = "cron-v1:morning:2026-08-15";
  const harness = createClaimHarness([{
    id: "run-terminal",
    run_key: runKey,
    status: "failed",
    completed_at: FIXED_NOW_ISO,
    updated_at: FIXED_NOW_ISO,
  }]);

  const claim = await harness.claimRun("morning", runKey, "2026-08-15T09:15:00+08:00");
  assert.equal(claim.state, "terminal");
  assert.equal(claim.run.id, "run-terminal");
});

test("an explicit audited retry has a separate, traceable run identity", async () => {
  const canonical = resolveScheduledResearchIdentity(
    cronRequest("https://example.com/api/cron/research/morning", "15 1 * * *"),
    "morning",
    FIXED_NOW,
  );
  const retry = resolveScheduledResearchIdentity(
    cronRequest("https://example.com/api/cron/research/morning?retry=intelligence-timeout-20260816", "15 1 * * *"),
    "morning",
    FIXED_NOW,
  );

  assert.equal(canonical.runKey, "cron-v1:morning:2026-08-15");
  assert.equal(retry.runKey, "cron-v1:morning:2026-08-15:retry:intelligence-timeout-20260816");
  assert.notEqual(retry.runKey, canonical.runKey);
  assert.equal(retry.scheduledFor, canonical.scheduledFor);
});

test("structured observability captures safe Vercel metadata without logging secrets", () => {
  const received = buildScheduledResearchLogEvent({
    event: "scheduled_research_received",
    request: cronRequest("https://example.com/api/cron/research/morning", "15 1 * * *"),
    slot: "morning",
    now: FIXED_NOW,
  });
  const claimAttempt = buildScheduledResearchLogEvent({
    event: "scheduled_research_claim_attempt",
    request: cronRequest("https://example.com/api/cron/research/morning", "15 1 * * *"),
    slot: "morning",
    now: FIXED_NOW,
    extra: {
      authStatus: "authorized",
      runKey: "cron-v1:morning:2026-08-15",
      scheduledFor: "2026-08-15T09:15:00+08:00",
    },
  });

  assert.equal(received.cronReceivedAt, FIXED_NOW_ISO);
  assert.equal(received.slot, "morning");
  assert.equal(received.vercelRequestId, "kul1::cron-test-123");
  assert.equal(received.vercelDeploymentUrl, "alchemy-live-market-desk-test.vercel.app");
  assert.equal(received.vercelCronSchedule, "15 1 * * *");
  assert.equal("authorization" in received, false);
  assert.equal(claimAttempt.runKey, "cron-v1:morning:2026-08-15");
  assert.equal(claimAttempt.scheduledFor, "2026-08-15T09:15:00+08:00");
  assert.equal(claimAttempt.authStatus, "authorized");
});

test("scheduled acquisition and intelligence routes are separate durable phases", () => {
  const morningPrimary = readFileSync(new URL("../app/api/cron/research/morning/route.ts", import.meta.url), "utf8");
  const morningWatchdog = readFileSync(new URL("../app/api/cron/research/morning-watchdog/route.ts", import.meta.url), "utf8");
  const eveningPrimary = readFileSync(new URL("../app/api/cron/research/evening/route.ts", import.meta.url), "utf8");
  const eveningWatchdog = readFileSync(new URL("../app/api/cron/research/evening-watchdog/route.ts", import.meta.url), "utf8");
  const morningIntelligence = readFileSync(new URL("../app/api/cron/research/morning-intelligence/route.ts", import.meta.url), "utf8");
  const morningIntelligenceWatchdog = readFileSync(new URL("../app/api/cron/research/morning-intelligence-watchdog/route.ts", import.meta.url), "utf8");
  const eveningIntelligence = readFileSync(new URL("../app/api/cron/research/evening-intelligence/route.ts", import.meta.url), "utf8");
  const eveningIntelligenceWatchdog = readFileSync(new URL("../app/api/cron/research/evening-intelligence-watchdog/route.ts", import.meta.url), "utf8");
  const midnightVideo = readFileSync(new URL("../app/api/cron/video/midnight/route.ts", import.meta.url), "utf8");
  const lateMorningVideo = readFileSync(new URL("../app/api/cron/video/late-morning/route.ts", import.meta.url), "utf8");
  const acquisitionWrapper = readFileSync(new URL("../lib/cron-research-acquisition-handler.ts", import.meta.url), "utf8");
  const continuationHandler = readFileSync(new URL("../lib/cron-research-intelligence-handler.ts", import.meta.url), "utf8");
  const publisher = readFileSync(new URL("../app/api/research-update/route.ts", import.meta.url), "utf8");
  const vercelConfig = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")) as {
    crons: Array<{ path: string; schedule: string }>;
  };

  assert.match(morningPrimary, /handleScheduledResearchAcquisition\(request, "morning"\)/);
  assert.match(morningWatchdog, /handleScheduledResearchAcquisition\(request, "morning"\)/);
  assert.match(eveningPrimary, /handleScheduledResearchAcquisition\(request, "evening"\)/);
  assert.match(eveningWatchdog, /handleScheduledResearchAcquisition\(request, "evening"\)/);
  assert.match(morningIntelligence, /handleScheduledResearchIntelligence\(request, "morning"\)/);
  assert.match(morningIntelligenceWatchdog, /handleScheduledResearchIntelligence\(request, "morning"\)/);
  assert.match(eveningIntelligence, /handleScheduledResearchIntelligence\(request, "evening"\)/);
  assert.match(eveningIntelligenceWatchdog, /handleScheduledResearchIntelligence\(request, "evening"\)/);
  assert.match(midnightVideo, /handleVideoIntakeRequest\(request, "video_midnight"\)/);
  assert.match(lateMorningVideo, /handleVideoIntakeRequest\(request, "video_late_morning"\)/);
  assert.match(acquisitionWrapper, /x-alchemy-defer-intelligence/);
  assert.match(publisher, /deferScheduledIntelligence/);
  assert.match(publisher, /status: "intelligence_pending"/);
  assert.match(continuationHandler, /runWithIntelligenceInvocation\(\{ oneModelStage: true \}/);
  assert.match(continuationHandler, /stageMaxAttempts:\s*1/);
  assert.doesNotMatch(continuationHandler, /scheduledExecutionStartedAtMs:/);
  assert.match(continuationHandler, /persistCanonicalEditionForResearchRun/);

  const schedules = vercelConfig.crons
    .map((cron) => `${cron.path} ${cron.schedule}`)
    .sort();
  assert.deepEqual(schedules, [
    "/api/cron/research/evening 15 13 * * *",
    "/api/cron/research/evening-intelligence 25 13 * * *",
    "/api/cron/research/evening-intelligence-watchdog 33 13 * * *",
    "/api/cron/research/evening-watchdog 20 13 * * *",
    "/api/cron/research/morning 15 1 * * *",
    "/api/cron/research/morning-intelligence 25 1 * * *",
    "/api/cron/research/morning-intelligence-watchdog 33 1 * * *",
    "/api/cron/research/morning-watchdog 20 1 * * *",
    "/api/cron/video/late-morning 30 3 * * *",
    "/api/cron/video/midnight 40 16 * * *",
  ]);
});