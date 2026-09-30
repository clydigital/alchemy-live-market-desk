import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = JSON.parse(
  readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
);
const liveWorkflow = readFileSync(
  new URL("../.github/workflows/run-live-research.yml", import.meta.url),
  "utf8",
);

test("Vercel auto-deploys only main", () => {
  assert.equal(config.git?.deploymentEnabled?.["*"], false);
  assert.equal(config.git?.deploymentEnabled?.main, true);
  assert.equal(config.git?.deploymentEnabled?.["preview-*"], undefined);
  assert.match(config.ignoreCommand || "", /VERCEL_GIT_COMMIT_REF/);
  assert.doesNotMatch(config.ignoreCommand || "", /\^preview-/);
});

test("Vercel owns exact Live slots and durable continuation cadence", () => {
  const crons = config.crons ?? [];
  const has = (path: string, schedule: string) =>
    crons.some((entry: { path?: string; schedule?: string }) => entry.path === path && entry.schedule === schedule);

  assert.equal(has("/api/cron/research/morning", "30 1 * * *"), true);
  assert.equal(has("/api/cron/research/morning-watchdog", "35 1 * * *"), true);
  assert.equal(has("/api/cron/research/evening", "30 13 * * *"), true);
  assert.equal(has("/api/cron/research/evening-watchdog", "35 13 * * *"), true);

  for (const schedule of ["40 1 * * *","45 1 * * *","50 1 * * *","55 1 * * *","0 2 * * *","5 2 * * *","10 2 * * *","15 2 * * *"]) {
    assert.equal(has("/api/cron/research/morning-intelligence", schedule), true);
  }
  for (const schedule of ["40 13 * * *","45 13 * * *","50 13 * * *","55 13 * * *","0 14 * * *","5 14 * * *","10 14 * * *","15 14 * * *"]) {
    assert.equal(has("/api/cron/research/evening-intelligence", schedule), true);
  }

  assert.equal(
    config.rewrites?.some((entry: { source?: string }) => entry.source === "/api/cron/research/:path*") ?? false,
    false,
  );
});

test("GitHub Actions is a delayed fallback for the same canonical slots", () => {
  for (const schedule of [
    "30 2 * * *",
    "45 2 * * *",
    "30 14 * * *",
    "45 14 * * *",
  ]) {
    assert.match(liveWorkflow, new RegExp(`cron: ["']${schedule.replaceAll("*", "\\*")}["']`));
  }
  assert.match(liveWorkflow, /RETRY_KEY="github-scheduled"/);
  assert.match(liveWorkflow, /for attempt in \{1\.\.8\}/);
});
