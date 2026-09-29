import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = JSON.parse(
  readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
);

test("Vercel auto-deploys only main", () => {
  assert.equal(config.git?.deploymentEnabled?.["*"], false);
  assert.equal(config.git?.deploymentEnabled?.main, true);
  assert.equal(config.git?.deploymentEnabled?.["preview-*"], undefined);
  assert.match(config.ignoreCommand || "", /VERCEL_GIT_COMMIT_REF/);
  assert.doesNotMatch(config.ignoreCommand || "", /\^preview-/);
});

test("legacy research automation stays paused while the bounded Live orchestrator is scheduled", () => {
  const cronPaths = (config.crons ?? []).map((entry: { path?: string }) => entry.path);
  assert.deepEqual(cronPaths, [
    "/api/cron/video/midnight",
    "/api/cron/video/transcript-worker",
    "/api/cron/video/late-morning",
    "/api/cron/live-research",
    "/api/cron/live-research",
    "/api/cron/live-research",
    "/api/cron/live-research",
  ]);
  assert.ok(cronPaths.every((path: string) => !path.startsWith("/api/cron/research/")));
  assert.equal(cronPaths.filter((path: string) => path === "/api/cron/live-research").length, 4);
  assert.equal(
    config.rewrites?.some(
      (entry: { source?: string; destination?: string }) =>
        entry.source === "/api/cron/research/:path*" &&
        entry.destination === "/api/automation-paused",
    ),
    true,
  );
});
