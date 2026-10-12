import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/hybrid-output/prepare/page.tsx", import.meta.url), "utf8");

test("source focus labels have ID witnesses rather than using first visible item", () => {
  assert.match(page, /const focusedStoryId =/);
  assert.match(page, /const focusedMotionId =/);
  assert.match(page, /focusedMotionId === motion\.motionId \? "FOCUSED MOTION/);
  assert.match(page, /focusedStoryId === story\.storyId \? "FOCUSED STORY/);
  assert.doesNotMatch(page, /projection\.focus\.story && !projection\.focus\.motion && index === 0/);
});

test("exact frozen Event focus remains explicit, with relational blockers explained", () => {
  assert.match(page, /projection\.focus\.event === event\.eventId \? "FOCUSED EVENT/);
  assert.match(page, /FOCUS_RELATIONSHIP_MISMATCH: /);
  assert.match(page, /FOCUS_RELATIONSHIP_UNVERIFIED: /);
});

test("read-only source and locally isolated presenter blocks remain separate", () => {
  assert.match(page, /projection\.journeyHref!/);
  assert.match(page, /projection\.pinned\.dossierId/);
  assert.match(page, /<PresenterPrepSession|title="Preparation workspace"/);
  assert.doesNotMatch(page, /persistMarketMotion|executeDossierStoryCanonicalMutation/);
});

test("explicit blank or whitespace source deep-link values cannot be interpreted as no parameter", () => {
  assert.match(page, /if \(!\(key in query\)\) return null/);
  assert.match(page, /value\.trim\(\) \? value : "__invalid_empty_parameter__"/);
});

test("frozen legacy titles are labelled separately from canonical reasoning", () => {
  assert.match(page, /story\.sourceKind === "FROZEN_STORY_STATE"/);
  assert.match(page, /FROZEN STORY STATE · REASONING UNAVAILABLE/);
  assert.match(page, /Legacy Story-state titles do not imply an accepted Dossier interpretation/);
});

test("historical and blocked navigation links use readable dark-panel styling", () => {
  assert.match(page, /<Link className=\{styles\.link\} href="\/hybrid-output">Open existing Hybrid Journey<\/Link>/);
  assert.match(page, /<Link className=\{styles\.link\} href=\{projection\.journeyHref!\}>Open this edition in Hybrid Journey/);
});

test("Prep selects editions using a presenter-only index, not Journey's shared index", () => {
  assert.match(page, /buildPresenterPrepEditionIndex\(editions, desk\.researchRuns\)/);
  assert.doesNotMatch(page, /buildCanonicalEditionIndex\(editions, desk\.researchRuns\)/);
});
