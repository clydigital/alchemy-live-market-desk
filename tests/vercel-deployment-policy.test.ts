import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = JSON.parse(
  readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
);

test("Vercel auto-deploys only main and explicit preview branches", () => {
  assert.equal(config.git?.deploymentEnabled?.["*"], false);
  assert.equal(config.git?.deploymentEnabled?.main, true);
  assert.equal(config.git?.deploymentEnabled?.["preview-*"], true);
});

test("paused research automation has no scheduled Vercel cron invocations", () => {
  const cronPaths = (config.crons ?? []).map((entry: { path?: string }) => entry.path);
  assert.deepEqual(cronPaths, [
    "/api/cron/video/midnight",
    "/api/cron/video/transcript-worker",
    "/api/cron/video/late-morning",
  ]);
  assert.ok(cronPaths.every((path: string) => !path.startsWith("/api/cron/research/")));
  assert.equal(
    config.rewrites?.some(
      (entry: { source?: string; destination?: string }) =>
        entry.source === "/api/cron/research/:path*" &&
        entry.destination === "/api/automation-paused",
    ),
    true,
  );
});
