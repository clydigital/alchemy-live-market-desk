import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const vercelConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8"));
const middlewareSource = fs.readFileSync(path.join(process.cwd(), "middleware.ts"), "utf8");
const routingSource = fs.readFileSync(path.join(process.cwd(), "lib", "research-automation-routing.ts"), "utf8");
const systemHealthSource = fs.readFileSync(path.join(process.cwd(), "lib", "system-health.ts"), "utf8");

test("Vercel owns the exact research clock while GitHub remains the later fallback", () => {
  assert.ok(Array.isArray(vercelConfig.crons) && vercelConfig.crons.length > 0);

  const researchRewrite = vercelConfig.rewrites?.find(
    (entry: { source?: string }) => entry.source === "/api/cron/research/:path*",
  );
  assert.equal(researchRewrite, undefined);

  const schedules = new Map(
    vercelConfig.crons.map((entry: { path: string; schedule: string }) => [entry.path, entry.schedule]),
  );
  assert.equal(schedules.get("/api/cron/research/morning"), "30 1 * * *");
  assert.equal(schedules.get("/api/cron/research/evening"), "30 13 * * *");
  assert.equal(schedules.get("/api/cron/research/morning-watchdog"), "35 1 * * *");
  assert.equal(schedules.get("/api/cron/research/evening-watchdog"), "35 13 * * *");
  assert.equal(schedules.get("/api/cron/research/morning-intelligence"), "32-58/2 1 * * *");
  assert.equal(schedules.get("/api/cron/research/evening-intelligence"), "32-58/2 13 * * *");

  assert.equal(schedules.get("/api/cron/video/midnight"), "0 1 * * *");
  assert.equal(schedules.get("/api/cron/video/late-morning"), "0 13 * * *");

  // The defensive middleware guard remains in code but is disabled by the
  // audited routing constant. This makes rollback one constant/config change.
  assert.match(middlewareSource, /PRODUCTION_RESEARCH_AUTOMATION_PAUSED/);
  assert.match(routingSource, /PRODUCTION_RESEARCH_AUTOMATION_PAUSED = false/);
  assert.match(routingSource, /VERCEL_CRON_RESEARCH_AUTOMATION_ENABLED = true/);
  assert.match(routingSource, /GITHUB_ACTIONS_RESEARCH_AUTOMATION_ENABLED = true/);

  assert.match(systemHealthSource, /vercel_primary_github_fallback/);
  assert.match(systemHealthSource, /10:05 Asia\/Kuala_Lumpur/);
  assert.match(systemHealthSource, /22:05 Asia\/Kuala_Lumpur/);
});
