import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { blueDeskHostAccess, blueDeskPresentationTarget } from "../lib/blue-desk-host.ts";
import { editorialGuidingQuestions } from "../lib/editorial-question-guide.ts";

const BLUEBELLY = "bluebelly-desk.vercel.app";
const LIVE = "alchemy-live-market-desk.vercel.app";
const PREVIEW = "alchemy-live-market-desk-preview-test.vercel.app";

test("Daily Report is a public reader only on the two canonical hosts", () => {
  for (const host of [BLUEBELLY, LIVE]) {
    assert.equal(blueDeskHostAccess("/daily-report", host), "public");
    assert.equal(blueDeskHostAccess("/blue-desk/daily-report", host), "public");
    assert.equal(blueDeskPresentationTarget("/daily-report", host), "/blue-desk/daily-report");
  }
  assert.equal(blueDeskPresentationTarget("/daily-report", PREVIEW), null);
  // Preview is privately protected and cannot inherit public route host rewrite.
  assert.equal(blueDeskHostAccess("/daily-report", PREVIEW), "private");
  for (const path of ["/api/owner/editorial-generate", "/api/owner/editorial-publish",
    "/api/cron/research/morning", "/owner/publications", "/hybrid-output/prepare"]) {
    assert.notEqual(blueDeskHostAccess(path, BLUEBELLY), "public", path);
  }
  for (const path of ["/reports", "/editorial-lab", "/markets", "/key-stories"]) {
    assert.equal(blueDeskHostAccess(path, BLUEBELLY), "public", path);
  }
});

test("COTD and OB guide questions cover mechanisms, opposing views and next data", () => {
  const cotd = editorialGuidingQuestions("COTD");
  const ob = editorialGuidingQuestions("OB");
  assert.equal(cotd[0].id, "chart");
  assert.equal(ob[0].id, "catalyst");
  for (const guide of [cotd, ob]) {
    assert.deepEqual(new Set(guide.map(row => row.id)).size, guide.length);
    for (const id of ["expectation", "reaction", "mechanics", "cross-assets",
      "alternatives", "future", "watch"]) {
      assert.ok(guide.some(row => row.id === id), id);
    }
    assert.ok(guide.every(row => row.question.length > 10 && row.evidenceCheck.length > 30));
  }
});

test("Daily Report reads verified news independently of historic Dossier Story admission", () => {
  const text = readFileSync(new URL("../app/blue-desk/daily-report/page.tsx", import.meta.url), "utf8");
  assert.match(text, /getCurrentVerifiedMarketMotion/);
  assert.match(text, /selectVerifiedNewsBriefs/);
  assert.match(text, /getForwardEarningsEvents/);
  assert.match(text, /getEconomicCalendar/);
  assert.match(text, /projectFrozenTrackedStories/);
  assert.match(text, /No current ET-day edition confirmed/);
  assert.match(text, /not a newly generated/);
  assert.doesNotMatch(text, /createSupabaseAdminClient|generateContent\(|story_thesis_versions|insert\(/);
});

test("Calendar embeds an earnings hub with source-status distinction", () => {
  const text = readFileSync(new URL("../app/blue-desk/calendar/page.tsx", import.meta.url), "utf8");
  assert.match(text, /id="earnings-hub"/);
  assert.match(text, /ISSUER-ANNOUNCED/);
  assert.match(text, /PROVIDER-REPORTED/);
  assert.match(text, /verificationState/);
  assert.match(text, /getForwardEarningsEvents/);
  assert.match(text, /decidingQuestion/);
});

test("Writing Brain uses guiding questions and forward calendar without a new model path", () => {
  const text = readFileSync(new URL("../components/blue-desk/EditorialWorkbench.tsx", import.meta.url), "utf8");
  assert.match(text, /editorialGuidingQuestions\(draft\.kind\)/);
  assert.match(text, /forwardCatalysts/);
  assert.match(text, /earnings-hub/);
  assert.match(text, /runGeneration\("draft"\)/);
  assert.doesNotMatch(text, /story_thesis_versions|createSupabaseAdminClient/);
});
