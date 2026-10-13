import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("What’s New URL region focus stays read-only and preserves existing query params", () => {
  const ui = readFileSync(new URL("../components/live-desk/WhatsNewWorkspace.tsx", import.meta.url), "utf8");
  assert.match(ui, /marketRegionFromQuery\(new URLSearchParams\(window\.location\.search\)\.get\("region"\)\)/);
  assert.match(ui, /window\.addEventListener\("popstate", syncFromLocation\)/);
  assert.match(ui, /const url = new URL\(window\.location\.href\)/);
  assert.match(ui, /if \(next === "All"\) url\.searchParams\.delete\("region"\)/);
  assert.match(ui, /else url\.searchParams\.set\("region", next\)/);
  assert.match(ui, /window\.history\.replaceState\(window\.history\.state, "", url\.toString\(\)\)/);
  assert.match(ui, /matchesMarketRegion/);
  assert.doesNotMatch(ui, /persistMarketMotion|story_thesis_versions|updateDossier|createSupabaseAdminClient/);
});
