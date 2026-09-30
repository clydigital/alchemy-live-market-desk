import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const hybrid = readFileSync(new URL("../app/hybrid-output/page.tsx", import.meta.url), "utf8");
const composer = readFileSync(new URL("../lib/intelligence/dossier-storyline-composer.ts", import.meta.url), "utf8");
const publication = readFileSync(new URL("../lib/hybrid-publication.ts", import.meta.url), "utf8");

test("Hybrid opens with promoted Live Motion before the current canonical composed edition", () => {
  assert.match(hybrid, /marketMotionFromEditionPayload/);
  assert.match(hybrid, /selectMarketMotionEditionContext/);
  assert.doesNotMatch(hybrid, /getCurrentMarketMotion/);
  assert.doesNotMatch(hybrid, /selectPromotedMarketMotion/);
  assert.match(hybrid, /HYBRID OPENING HOOKS/);
  assert.match(hybrid, /linked canonical Story changed/);
  assert.match(hybrid, /same immutable edition as the Presenter/);
  assert.doesNotMatch(hybrid, /selectMarketMotionForOverview/);
  const motionAt = hybrid.indexOf('eyebrow="HYBRID OPENING HOOKS"');
  const presenterAt = hybrid.indexOf('title="Presenter view"');
  assert.ok(motionAt >= 0);
  assert.ok(presenterAt > motionAt);

  assert.match(hybrid, /getHybridPresenterEditionCandidates\(\)/);
  assert.match(hybrid, /buildCanonicalEditionIndex\(/);
  assert.match(hybrid, /presenterEditions/);
  assert.doesNotMatch(hybrid, /getHybridPublicationRecords\(\{ fresh: true \}\)/);
  assert.match(hybrid, /currentEdition\?\.payload\?\.dossier/);
  assert.match(hybrid, /title="Presenter view"/);
  assert.match(hybrid, /What matters now/);
  assert.match(hybrid, /How the pieces connect/);
  assert.match(hybrid, /Why these ideas matter/);
  assert.match(hybrid, /What to watch next/);
});

test("Presenter remains an explanation layer rather than a second research brain", () => {
  assert.match(hybrid, /cannot create a new thesis/);
  assert.match(hybrid, /Hybrid cannot turn them into a new thesis/);
  assert.match(hybrid, /falling back to canonical research records/);
  assert.doesNotMatch(hybrid, /runStructuredStage|modelStage|OpenAI/);

  assert.match(composer, /Do not create new research/);
  assert.match(composer, /WHAT WE KNOW from canonical evidence/);
  assert.match(composer, /WHAT IT MEANS through the accepted causal mechanism/);
  assert.match(composer, /WHY IT MATTERS for the affected markets/);
  assert.match(composer, /WHAT WOULD CHANGE THE VIEW/);
  assert.match(composer, /Do not produce a Story list disguised as an explanation/);
});

test("Research audit remains available below the Presenter", () => {
  const presenterAt = hybrid.indexOf('title="Presenter view"');
  const divergenceAt = hybrid.indexOf('title="Divergence journey"');
  assert.ok(presenterAt >= 0);
  assert.ok(divergenceAt > presenterAt);
});


test("Presenter uses a bounded recent edition window instead of the full replay archive", () => {
  assert.match(publication, /export async function getHybridPresenterEditionCandidates/);
  assert.match(publication, /snapshot_type=eq\.daily_brief/);
  assert.match(publication, /limit=24/);
  assert.doesNotMatch(hybrid, /publicationRecords\.dailyBriefArchive/);
});
