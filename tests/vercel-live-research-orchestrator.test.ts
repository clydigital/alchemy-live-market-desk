import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  LIVE_RESEARCH_CRON_SCHEDULES,
  resolveLiveResearchCronDecision,
} from "../lib/vercel-live-research-orchestrator.ts";

test("bounded Vercel Live schedules route only the intended morning window", () => {
  assert.deepEqual(
    resolveLiveResearchCronDecision(
      LIVE_RESEARCH_CRON_SCHEDULES.morningAcquisition,
      new Date("2026-09-29T01:31:00Z"),
    ),
    { action: "run", slot: "morning", stage: "acquisition" },
  );
  assert.deepEqual(
    resolveLiveResearchCronDecision(
      LIVE_RESEARCH_CRON_SCHEDULES.morningContinuation,
      new Date("2026-09-29T01:35:00Z"),
    ),
    { action: "run", slot: "morning", stage: "intelligence" },
  );
  assert.equal(
    resolveLiveResearchCronDecision(
      LIVE_RESEARCH_CRON_SCHEDULES.morningContinuation,
      new Date("2026-09-29T01:20:00Z"),
    ).action,
    "skip",
  );
  assert.equal(
    resolveLiveResearchCronDecision(
      LIVE_RESEARCH_CRON_SCHEDULES.morningContinuation,
      new Date("2026-09-29T02:20:00Z"),
    ).action,
    "skip",
  );
});

test("bounded Vercel Live schedules route only the intended evening window", () => {
  assert.deepEqual(
    resolveLiveResearchCronDecision(
      LIVE_RESEARCH_CRON_SCHEDULES.eveningAcquisition,
      new Date("2026-09-29T13:30:00Z"),
    ),
    { action: "run", slot: "evening", stage: "acquisition" },
  );
  assert.deepEqual(
    resolveLiveResearchCronDecision(
      LIVE_RESEARCH_CRON_SCHEDULES.eveningContinuation,
      new Date("2026-09-29T14:15:00Z"),
    ),
    { action: "run", slot: "evening", stage: "intelligence" },
  );
  assert.equal(
    resolveLiveResearchCronDecision(
      LIVE_RESEARCH_CRON_SCHEDULES.eveningAcquisition,
      new Date("2026-09-29T14:00:00Z"),
    ).action,
    "skip",
  );
});

test("the production route reuses canonical acquisition and intelligence handlers", () => {
  const source = readFileSync(
    new URL("../app/api/cron/live-research/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /handleScheduledResearchAcquisition/);
  assert.match(source, /handleScheduledResearchIntelligence/);
  assert.match(source, /x-vercel-cron-schedule/);
  assert.doesNotMatch(source, /runIntelligenceEngine|executeResearchBrain/);
});

test("vercel.json keeps legacy research crons paused and adds only four bounded Live entries", () => {
  const config = JSON.parse(
    readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
  ) as { rewrites?: Array<{ source: string; destination: string }>; crons?: Array<{ path: string; schedule: string }> };

  assert.ok(config.rewrites?.some(
    (item) => item.source === "/api/cron/research/:path*" && item.destination === "/api/automation-paused",
  ));

  const live = (config.crons ?? []).filter((item) => item.path === "/api/cron/live-research");
  assert.deepEqual(live.map((item) => item.schedule), [
    LIVE_RESEARCH_CRON_SCHEDULES.morningAcquisition,
    LIVE_RESEARCH_CRON_SCHEDULES.morningContinuation,
    LIVE_RESEARCH_CRON_SCHEDULES.eveningAcquisition,
    LIVE_RESEARCH_CRON_SCHEDULES.eveningContinuation,
  ]);
});
