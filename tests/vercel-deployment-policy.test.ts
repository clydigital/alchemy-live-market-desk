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

test("Vercel owns the canonical Live research clock", () => {
  const crons = config.crons ?? [];
  const schedules = new Map(
    crons.map((entry: { path: string; schedule: string }) => [entry.path, entry.schedule]),
  );
  assert.equal(schedules.get("/api/cron/research/morning"), "30 1 * * *");
  assert.equal(schedules.get("/api/cron/research/morning-intelligence"), "32-58/2 1 * * *");
  assert.equal(schedules.get("/api/cron/research/morning-watchdog"), "35 1 * * *");
  assert.equal(schedules.get("/api/cron/research/evening"), "30 13 * * *");
  assert.equal(schedules.get("/api/cron/research/evening-intelligence"), "32-58/2 13 * * *");
  assert.equal(schedules.get("/api/cron/research/evening-watchdog"), "35 13 * * *");
  assert.equal(
    config.rewrites?.some(
      (entry: { source?: string; destination?: string }) =>
        entry.source === "/api/cron/research/:path*" &&
        entry.destination === "/api/automation-paused",
    ) ?? false,
    false,
  );
});

test("GitHub Actions is the 10:05/22:05 MYT recovery transport", () => {
  for (const schedule of ["5 2 * * *", "5 14 * * *"]) {
    assert.match(liveWorkflow, new RegExp(`cron: ["']${schedule.replaceAll("*", "\\*")}["']`));
  }
  assert.doesNotMatch(liveWorkflow, /cron: ["']30 1 \* \* \*["']/);
  assert.doesNotMatch(liveWorkflow, /cron: ["']30 13 \* \* \*["']/);
  assert.match(liveWorkflow, /RETRY_KEY="github-scheduled"/);
  assert.match(liveWorkflow, /for attempt in \{1\.\.8\}/);
});
