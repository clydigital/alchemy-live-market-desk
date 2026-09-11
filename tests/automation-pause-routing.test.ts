import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const vercelConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8"));
const middlewareSource = fs.readFileSync(path.join(process.cwd(), "middleware.ts"), "utf8");

test("production research crons remain paused while video discovery crons stay schedulable", () => {
  assert.ok(Array.isArray(vercelConfig.crons) && vercelConfig.crons.length > 0);

  const researchRewrite = vercelConfig.rewrites?.find(
    (entry: { source?: string }) => entry.source === "/api/cron/research/:path*",
  );
  assert.equal(researchRewrite?.destination, "/api/automation-paused");

  const blanketRewrite = vercelConfig.rewrites?.find(
    (entry: { source?: string }) => entry.source === "/api/cron/:path*",
  );
  assert.equal(blanketRewrite, undefined);

  const paths = new Set(vercelConfig.crons.map((entry: { path: string }) => entry.path));
  assert.equal(paths.has("/api/cron/video/midnight"), true);
  assert.equal(paths.has("/api/cron/video/late-morning"), true);

  assert.match(middlewareSource, /pathname\.startsWith\("\/api\/cron\/research\/"\)/);
  assert.doesNotMatch(middlewareSource, /pathname\.startsWith\("\/api\/cron\/"\)\)/);
});
