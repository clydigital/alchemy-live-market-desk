import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const page = readFileSync(new URL("../app/blue-desk/key-stories/page.tsx", import.meta.url), "utf8");
const feature = readFileSync(new URL("../components/blue-desk/RbnzDecisionFeature.tsx", import.meta.url), "utf8");

test("the RBNZ feature is a readable lead before the verified news and preserves the source-qualified feed", () => {
  assert.match(page, /<RbnzDecisionFeature \/>/);
  assert.ok(page.indexOf("<RbnzDecisionFeature />") < page.indexOf("{topics.length ? liveCatalystSection"));
  assert.match(feature, /id="rbnz-october-2026"/);
  for (const anchor of ["rbnz-analysis", "rbnz-why", "rbnz-market", "rbnz-next", "rbnz-sources"]) {
    assert.match(feature, new RegExp('id="' + anchor + '"'));
  }
  assert.match(page, /getCurrentVerifiedMarketMotion/);
  assert.match(page, /getOriginalPressNews/);
  assert.match(page, /<NewsroomLensExplorer news=\{news\}/);
});

test("expanded RBNZ editorial separates original release, reported market reaction and watch scenarios", () => {
  assert.match(feature, /data-source-grounded-editorial="2026-10-28"/);
  assert.match(feature, /0\.55831/);
  assert.match(feature, /Reuters-reported/);
  assert.match(feature, /4–3/);
  assert.match(feature, /9 December 2026/);
  assert.match(feature, /September annual CPI/);
  assert.match(feature, /href="https:\/\/www\.rbnz\.govt\.nz\/news-and-events\/news\/2026\/10\/ocr-held-at-2-75-percent"/);
  assert.match(feature, /href="https:\/\/www\.abs\.gov\.au\//);
  assert.match(feature, /not a live quote/);
  assert.doesNotMatch(feature, /createSupabaseAdminClient|story_thesis_versions|insert\(/);
});
