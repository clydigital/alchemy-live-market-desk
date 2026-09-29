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

test("Vercel keeps research crons paused while GitHub Actions owns Live scheduling", () => {
  const cronPaths = (config.crons ?? []).map((entry: { path?: string }) => entry.path);
  assert.deepEqual(cronPaths, [
    "/api/cron/video/midnight",
    "/api/cron/video/transcript-worker",
    "/api/cron/video/late-morning",
  ]);
  assert.ok(cronPaths.every((path: string) => !path.startsWith("/api/cron/research/")));
  assert.equal(cronPaths.includes("/api/cron/live-research"), false);
  assert.equal(
    config.rewrites?.some(
      (entry: { source?: string; destination?: string }) =>
        entry.source === "/api/cron/research/:path*" &&
        entry.destination === "/api/automation-paused",
    ),
    true,
  );
});

test("GitHub Actions retains the 09:30/09:45 and 21:30/21:45 MYT Live schedule", () => {
  for (const schedule of [
    "30 1 * * *",
    "45 1 * * *",
    "30 13 * * *",
    "45 13 * * *",
  ]) {
    assert.match(liveWorkflow, new RegExp(`cron: ["']${schedule.replaceAll("*", "\\*")}["']`));
  }
  assert.match(liveWorkflow, /for attempt in \{1\.\.8\}/);
});
