import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const routeSource = fs.readFileSync(
  path.join(process.cwd(), "lib/intelligence/publication-feed-route.ts"),
  "utf8",
);

const dataSource = fs.readFileSync(
  path.join(process.cwd(), "lib/intelligence/publication-feed-data.ts"),
  "utf8",
);

test("Hybrid research receives only explicitly persisted divergence rows", () => {
  assert.match(routeSource, /const persistedDivergences = data\.monitorResearchIntake/);
  assert.match(routeSource, /\.filter\(\(item\) => Boolean\(item\.divergence_note\)\)/);
  assert.match(routeSource, /divergences: persistedDivergences/);

  // The reader projection must carry the exact fields Hybrid uses to associate
  // a persisted divergence with a canonical Story.
  assert.match(dataSource, /affected_story_slugs/);
  assert.match(dataSource, /divergence_note/);
});

test("feed route does not infer divergence by comparing stats and news signals", () => {
  assert.doesNotMatch(routeSource, /stats_signal\s*[!=]==?\s*.*news_signal|news_signal\s*[!=]==?\s*.*stats_signal/);
});