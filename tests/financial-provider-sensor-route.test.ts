import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const route = readFileSync("app/api/admin/sensors/financial-providers/route.ts", "utf8");

test("financial provider pilot is protected and read only", () => {
  assert.match(route, /acceptsResearchAuthorization/);
  assert.match(route, /process\.env\.CRON_SECRET/);
  assert.match(route, /process\.env\.RESEARCH_API_KEY/);
  assert.match(route, /status: 401/);
  assert.match(route, /canonicalEvidenceWritten: false/);
  assert.match(route, /Cache-Control": "no-store"/);
  assert.doesNotMatch(route, /supabase|INSERT INTO|upsert\(/i);
});

test("financial pilot limits data to measured Treasury series and bounded FMP calendar", () => {
  assert.match(route, /readFredSeries\("DGS10", \{ limit: 3 \}\)/);
  assert.match(route, /readFredSeries\("T10YIE", \{ limit: 3 \}\)/);
  assert.match(route, /endpoint: "earnings-calendar"/);
  assert.match(route, /7 \* 86400000/);
});
