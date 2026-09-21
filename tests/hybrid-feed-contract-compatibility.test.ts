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

test("Hybrid feed exposes the exact shared Dossier V2 selection under canonical state", () => {
  assert.match(routeSource, /getDossierV2PresentationSelection/);
  assert.match(routeSource, /dossierPromise = editionId/);
  assert.match(routeSource, /Dossier V2 presentation/);
  assert.match(routeSource, /dossierV2: dossierResult\.value/);

  // Feed assembly must not invoke a second model/reasoning path for Hybrid.
  assert.doesNotMatch(routeSource, /executeResearchBrain|runIntelligenceEngine|dossier-storyline-composer/);
});

test("explicit immutable edition replay does not receive the current-state Dossier V2", () => {
  assert.match(routeSource, /editionId[\s\S]*Promise\.resolve\(\{ value: replayDossierSelection/);
  assert.match(routeSource, /Dossier V2 is current-state research and is not attached to explicit immutable Journey edition replay/);
});
