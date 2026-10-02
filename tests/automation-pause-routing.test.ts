import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const vercelConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8"));
const middlewareSource = fs.readFileSync(path.join(process.cwd(), "middleware.ts"), "utf8");
const routingSource = fs.readFileSync(path.join(process.cwd(), "lib", "research-automation-routing.ts"), "utf8");
const systemHealthSource = fs.readFileSync(path.join(process.cwd(), "lib", "system-health.ts"), "utf8");

test("production research crons are active while video discovery remains separate", () => {
  const crons = Array.isArray(vercelConfig.crons) ? vercelConfig.crons : [];
  const paths = new Set(crons.map((entry: { path: string }) => entry.path));

  assert.equal(
    vercelConfig.rewrites?.some((entry: { source?: string }) => entry.source === "/api/cron/research/:path*") ?? false,
    false,
  );
  assert.equal(paths.has("/api/cron/research/morning"), true);
  assert.equal(paths.has("/api/cron/research/morning-watchdog"), true);
  assert.equal(paths.has("/api/cron/research/morning-intelligence"), true);
  assert.equal(paths.has("/api/cron/research/evening"), true);
  assert.equal(paths.has("/api/cron/research/evening-watchdog"), true);
  assert.equal(paths.has("/api/cron/research/evening-intelligence"), true);
  assert.equal(paths.has("/api/cron/video/midnight"), true);
  assert.equal(paths.has("/api/cron/video/midnight-watchdog"), true);
  assert.equal(paths.has("/api/cron/video/late-morning"), true);
  assert.equal(paths.has("/api/cron/video/late-morning-watchdog"), true);

  assert.match(middlewareSource, /PRODUCTION_RESEARCH_AUTOMATION_PAUSED/);
  assert.match(routingSource, /PRODUCTION_RESEARCH_AUTOMATION_PAUSED = false/);
  assert.match(systemHealthSource, /vercel_primary_github_fallback/);
});
