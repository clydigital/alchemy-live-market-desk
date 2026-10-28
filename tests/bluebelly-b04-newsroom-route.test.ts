import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { blueDeskHostAccess } from "../lib/blue-desk-host.ts";

const stories = readFileSync(new URL("../app/blue-desk/key-stories/page.tsx", import.meta.url), "utf8");
const home = readFileSync(new URL("../app/blue-desk/page.tsx", import.meta.url), "utf8");
const newsroom = readFileSync(new URL("../components/blue-desk/NewsroomLensExplorer.tsx", import.meta.url), "utf8");

test("Public Stories mounts one reused source-qualified Newsroom with the existing verified NewsBrief feed", () => {
  assert.match(stories, /import NewsroomLensExplorer from "@\/components\/blue-desk\/NewsroomLensExplorer"/);
  assert.match(stories, /const motionNews = selectVerifiedNewsBriefs\(raw, now, 18\)/);
  assert.match(stories, /const news = combineQualifiedNews\(motionNews,originalPress,18\)/);
  assert.match(stories, /<NewsroomLensExplorer news=\{news\} asOf=\{now\.toISOString\(\)\} \/>/);
  assert.equal((stories.match(/<NewsroomLensExplorer /g) || []).length, 1);
  assert.doesNotMatch(home, /NewsroomLensExplorer/);
});

test("Newsroom stays source-gated but no longer has a link into collapsed content", () => {
  assert.doesNotMatch(stories, /href="#newsroom-title">Newsroom<\/a>/);
  assert.match(stories, /<details><summary>Research tools, source observations and further reading<\/summary>/);
  assert.match(newsroom, /id="newsroom-title"/);
  assert.ok(stories.indexOf('aria-labelledby="persistent-theses"') < stories.indexOf("<NewsroomLensExplorer "));
  assert.equal(blueDeskHostAccess("/key-stories", "bluebelly-desk.vercel.app"), "public");
  assert.equal(blueDeskHostAccess("/newsroom", "bluebelly-desk.vercel.app"), "public");
  const newPage=readFileSync(new URL("../app/blue-desk/newsroom/page.tsx",import.meta.url),"utf8");
  assert.match(newPage,/getOriginalPressNews/);
  assert.match(newPage,/selectVerifiedNewsBriefs/);
});

test("Lens preserves publisher provenance, explicit empty coverage, and avoids Story writes", () => {
  assert.match(newsroom, /projectVerifiedNewsroom\(news, new Date\(asOf\)\)/);
  assert.match(newsroom, /data-newsroom-empty="no-qualified-topic-updates"/);
  assert.match(newsroom, /item\.sourceUrl/);
  assert.match(newsroom, /aria-pressed=\{selected\.id === lens\.id\}/);
  assert.doesNotMatch(newsroom, /createClient|story_thesis_versions|adjudicat|fetch\(/i);
});
