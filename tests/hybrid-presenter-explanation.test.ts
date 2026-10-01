import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const hybrid = readFileSync(new URL("../app/hybrid-output/page.tsx", import.meta.url), "utf8");
const publication = readFileSync(new URL("../lib/hybrid-publication.ts", import.meta.url), "utf8");

test("Hybrid opens from the full bounded Market Motion stream instead of three Dossier hooks", () => {
  assert.match(hybrid, /marketMotionFromEditionPayload/);
  assert.match(hybrid, /selectMarketMotionEditionContext/);
  assert.match(hybrid, /MARKET_MOTION_DISPLAY_SAFETY_LIMIT/);
  assert.doesNotMatch(hybrid, /limit:\s*3/);
  assert.doesNotMatch(hybrid, /getCurrentMarketMotion/);
  assert.match(hybrid, /MARKET MOTION JOURNEY/);
  assert.match(hybrid, /event → why interesting → market reaction → Story\/Regime bridge → what to investigate or write/);
  assert.match(hybrid, /Primary Motion/);
  assert.match(hybrid, /Secondary Motion/);
  assert.match(hybrid, /journeyMode/);
});

test("Journey exposes an exact Motion investigation path without creating a second Dossier", () => {
  assert.match(hybrid, /marketMotionInvestigationEligibility/);
  assert.match(hybrid, /motionId/);
  assert.match(hybrid, /investigationHref/);
  assert.match(hybrid, /Motion investigation path/);
  assert.match(hybrid, /INVESTIGATION ELIGIBLE/);
  assert.match(hybrid, /Motion → exact linked Story\/Regime → Research Gap investigation when eligible/);
  assert.match(hybrid, /Dossier\/regime state changes only if later canonical evidence changes the accepted interpretation/);
  assert.match(hybrid, /exact immutable Motion snapshot attached to the current canonical edition/);
});

test("Hybrid links to canonical Dossier context instead of mirroring Presenter composition", () => {
  const motionAt = hybrid.indexOf('eyebrow="MARKET MOTION JOURNEY"');
  const dossierAt = hybrid.indexOf('title="Canonical context"');
  assert.ok(motionAt >= 0);
  assert.ok(dossierAt > motionAt);

  assert.match(hybrid, /Canonical Dossier ID/);
  assert.match(hybrid, /href="\/dossier"/);
  assert.match(hybrid, /cannot create an independent regime or thesis/);
  assert.doesNotMatch(hybrid, /title="Presenter view"/);
  assert.doesNotMatch(hybrid, /title="How the pieces connect"/);
  assert.doesNotMatch(hybrid, /title="Why these ideas matter"/);
  assert.doesNotMatch(hybrid, /title="What to watch next"/);
  assert.doesNotMatch(hybrid, /runStructuredStage|modelStage|OpenAI/);
});

test("Research audit remains available below the Motion journey", () => {
  const motionAt = hybrid.indexOf('eyebrow="MARKET MOTION JOURNEY"');
  const divergenceAt = hybrid.indexOf('title="Divergence journey"');
  assert.ok(motionAt >= 0);
  assert.ok(divergenceAt > motionAt);
});

test("Hybrid still uses a bounded recent immutable edition window", () => {
  assert.match(publication, /export async function getHybridPresenterEditionCandidates/);
  assert.match(publication, /snapshot_type=eq\.daily_brief/);
  assert.match(publication, /limit=24/);
  assert.doesNotMatch(hybrid, /publicationRecords\.dailyBriefArchive/);
});
