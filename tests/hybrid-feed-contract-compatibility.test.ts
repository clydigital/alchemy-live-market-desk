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

const dossierRouteSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/dossier-v2/route.ts"),
  "utf8",
);

const hybridPublicationSource = fs.readFileSync(
  path.join(process.cwd(), "lib/hybrid-publication.ts"),
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

test("current Dossier V2 is isolated from the heavy Hybrid intelligence feed", () => {
  assert.doesNotMatch(routeSource, /getDossierV2PresentationSelection/);
  assert.doesNotMatch(routeSource, /DossierPresentationSelection/);
  assert.doesNotMatch(routeSource, /dossierPromise|dossierResult|dossierV2:/);

  assert.match(dossierRouteSource, /getDossierV2PresentationSelection/);
  assert.match(dossierRouteSource, /s-maxage=30/);

  // Neither transport may invoke a second model/reasoning path.
  assert.doesNotMatch(routeSource, /executeResearchBrain|runIntelligenceEngine|dossier-storyline-composer/);
  assert.doesNotMatch(dossierRouteSource, /executeResearchBrain|runIntelligenceEngine|dossier-storyline-composer/);
});

test("historical intelligence-feed replay remains free of current-state Dossier V2", () => {
  assert.match(routeSource, /getHybridPublicationFeedRecords\(\{ editionId \}\)/);
  assert.doesNotMatch(routeSource, /dossierV2/);
});


test("canonical feed carries the deterministic Story breakdown and blocks stale framing", () => {
  assert.match(hybridPublicationSource, /storyBreakdown/);
  assert.match(hybridPublicationSource, /needs_reframe/);
  assert.doesNotMatch(hybridPublicationSource, /executeResearchBrain|runIntelligenceEngine/);
});


test("current feed presentation removes already-past events from forward Journey buckets without mutating historical replay", () => {
  assert.match(hybridPublicationSource, /sanitizeCurrentJourneyPayload/);
  assert.match(hybridPublicationSource, /journeyItemIsPast/);
  assert.match(hybridPublicationSource, /isHistoricalReplay\s*\?\s*rawEditionPayload/);
});
