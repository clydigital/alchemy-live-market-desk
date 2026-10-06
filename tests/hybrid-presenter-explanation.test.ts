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

test("Journey keeps Motion as discovery context while Research Gap starts from the Dossier", () => {
  assert.doesNotMatch(hybrid, /marketMotionInvestigationEligibility/);
  assert.match(hybrid, /motionId/);
  assert.doesNotMatch(hybrid, /investigationHref/);
  assert.match(hybrid, /Motion context path/);
  assert.match(hybrid, /DISCOVERY CONTEXT/);
  assert.match(hybrid, /Motion → canonical Dossier System 2 → Dossier research\/investigation output → Research Gap lifecycle/);
  assert.match(hybrid, /Raw Motion does not create Research Gap work directly/);
  assert.match(hybrid, /Dossier\/regime state changes only if later canonical evidence changes the accepted interpretation/);
  assert.match(hybrid, /exact immutable Motion snapshot attached to the current canonical edition/);
});

test("Hybrid makes upcoming catalysts a primary layer after Motion and before Dossier context", () => {
  const motionAt = hybrid.indexOf('eyebrow="MARKET MOTION JOURNEY"');
  const upcomingAt = hybrid.indexOf('title="Upcoming news & catalysts"');
  const dossierAt = hybrid.indexOf('title="Canonical context"');

  assert.ok(motionAt >= 0);
  assert.ok(upcomingAt > motionAt);
  assert.ok(dossierAt > upcomingAt);
  assert.match(hybrid, /current immutable Journey edition/);
  assert.match(hybrid, /upcoming\.economicCalendar/);
  assert.match(hybrid, /upcoming\.earnings/);
  assert.match(hybrid, /upcoming\.geopoliticalClock/);
  assert.match(hybrid, /label: "Upcoming catalysts"/);
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

test("Presenter divergence audit remains available below the Motion journey", () => {
  const motionAt = hybrid.indexOf('eyebrow="MARKET MOTION JOURNEY"');
  const divergenceAt = hybrid.indexOf('title="Presenter Divergence Lab"');
  assert.ok(motionAt >= 0);
  assert.ok(divergenceAt > motionAt);
});

test("Hybrid still uses a bounded recent immutable edition window", () => {
  assert.match(publication, /export async function getHybridPresenterEditionCandidates/);
  assert.match(publication, /snapshot_type=eq\.daily_brief/);
  assert.match(publication, /limit=24/);
  assert.doesNotMatch(hybrid, /publicationRecords\.dailyBriefArchive/);
});
