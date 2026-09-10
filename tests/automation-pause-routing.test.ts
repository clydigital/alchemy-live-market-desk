import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const vercelConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8"));

test("all production cron routes are temporarily routed to the pause endpoint", () => {
  assert.ok(Array.isArray(vercelConfig.crons) && vercelConfig.crons.length > 0);
  const rewrite = vercelConfig.rewrites?.find((entry: { source?: string }) => entry.source === "/api/cron/:path*");
  assert.equal(rewrite?.destination, "/api/automation-paused");
});
