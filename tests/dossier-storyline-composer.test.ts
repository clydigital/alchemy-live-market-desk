import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("Dossier causal composer is bounded to one to three canonical storylines", () => {
  const composer = source("../lib/intelligence/dossier-storyline-composer.ts");

  assert.match(composer, /MAX_COMPOSER_CANDIDATES = 8/);
  assert.match(composer, /MAX_STORYLINES = 3/);
  assert.match(composer, /rawStorylines\.slice\(0, MAX_STORYLINES\)/);
  assert.match(composer, /Do not force unrelated Stories together/);
  assert.match(composer, /lessonOrder should put the explanation in teaching order/);
});

test("composer never upgrades unsupported cross-Story causality", () => {
  const composer = source("../lib/intelligence/dossier-storyline-composer.ts");

  assert.match(composer, /allowedEvidence = new Set\(supportingStoryIds\.flatMap/);
  assert.match(composer, /evidenceRefs = strings\(link\.evidenceRefs\)\.filter\(\(id\) => allowedEvidence\.has\(id\)\)/);
  assert.match(composer, /status = "inferred"/);
  assert.match(composer, /no exact pre-existing canonical causal edge supports the stronger label/);
  assert.match(composer, /Legacy Stories without itemised evidence IDs may support inferred cross-Story links/);
});

test("legacy immutable Story state remains usable without fabricated confidence or evidence", () => {
  const composer = source("../lib/intelligence/dossier-storyline-composer.ts");

  assert.match(composer, /const confidence = number\(state\.confidence\)/);
  assert.match(composer, /if \(confidence === null \|\| !title\) return null/);
  assert.match(composer, /publicationSnapshotId: candidate\.snapshotId/);
  assert.match(composer, /thesisVersionId: candidate\.thesisVersionId/);
  assert.match(composer, /evidenceRefs: \[\.\.\.candidate\.evidenceRefs\]/);
  assert.match(composer, /confidence: candidate\.confidence/);
  assert.doesNotMatch(composer, /confidence:\s*50/);
});

test("material current changes cannot disappear behind stronger persistent Stories", () => {
  const composer = source("../lib/intelligence/dossier-storyline-composer.ts");

  assert.match(composer, /ranked\.filter\(\(item\) => item\.candidate\.isCurrentChange/);
  assert.match(composer, /if \(!selected\[index\]\.candidate\.isCurrentChange\)/);
  assert.match(composer, /const currentChanges = candidates\.filter\(\(candidate\) => candidate\.isCurrentChange\)/);
  assert.match(composer, /\.\.\.currentChanges/);
});

test("edition composition supersedes rather than mutates the immutable base edition", () => {
  const edition = source("../lib/intelligence/canonical-journey-edition.ts");

  assert.match(edition, /composeCanonicalDossierEditionForResearchRun/);
  assert.match(edition, /const base = currentDailyBrief\(rows\)/);
  assert.match(edition, /supersedes_snapshot_id: base\.id/);
  assert.match(edition, /snapshot_type: "daily_brief"/);
  assert.match(edition, /parentEditionId: base\.id/);
  assert.doesNotMatch(edition, /method:\s*"PATCH"[\s\S]{0,500}dossierComposition/);
});

test("scheduled continuation gives Dossier composition its own model invocation", () => {
  const handler = source("../lib/cron-research-intelligence-handler.ts");

  assert.match(handler, /runWithIntelligenceInvocation\(\{ oneModelStage: true \}/);
  assert.match(handler, /persistCanonicalJourneyEditionForResearchRun/);
  assert.match(handler, /shouldDeferStageClaim\("dossier_storyline_composer"\)/);
  assert.match(handler, /continuation: "COMPOSE_DOSSIER"/);
  assert.match(handler, /nextStage: "dossier_storyline_composer"/);
  assert.match(handler, /RETRY_DOSSIER_COMPOSER/);
  assert.match(handler, /The canonical base edition is safe/);
});
