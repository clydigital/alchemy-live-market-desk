import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const daily = readFileSync(new URL("../app/blue-desk/daily-report/page.tsx", import.meta.url), "utf8");
const rundown = readFileSync(new URL("../components/blue-desk/DailyEditorialRundown.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../components/blue-desk/DailyEditorialRundown.module.css", import.meta.url), "utf8");

test("Daily Report shows practical story selection before archived investigations", () => {
  assert.match(daily, /<DailyEditorialRundown asOf=\{now\.toISOString\(\)\} news=\{news\} upcoming=\{upcoming\} \/>/);
  assert.ok(daily.indexOf("<DailyEditorialRundown ") < daily.indexOf('aria-labelledby="featured-ai-warning"'));
  assert.ok(daily.indexOf("<DailyEditorialRundown ") < daily.indexOf('aria-labelledby="daily-story-map"'));
  assert.match(daily, /const news = combineQualifiedNews\(motionNews,originalPress,18\)/);
  assert.match(daily, /const upcoming = selectBlueDeskUpcoming\(calendar, now, 14\)/);
  assert.match(daily, /href="#editorial-rundown"/);
  assert.match(daily, /aria-labelledby="developments"/);
  assert.match(daily, /aria-labelledby="forward"/);
});

test("dated 28 October slate has a verified-source debate, completed decision and upcoming Fed preview", () => {
  assert.match(rundown, /dated === "2026-10-28"/);
  assert.match(rundown, /FOMC 2:00 PM ET — UPCOMING/);
  assert.match(rundown, /SK hynix posted/);
  assert.match(rundown, /RBNZ voted 4–3/);
  assert.match(rundown, /IF WRITING AN ARTICLE/);
  assert.match(rundown, /What to say on air/);
  assert.match(rundown, /Evidence boundary:/);
  assert.match(rundown, /40-SECOND ON-AIR OPENING/);
  assert.match(rundown, /news\.map\(n =>/);
  assert.match(rundown, /upcoming\.map\(e =>/);
  assert.match(rundown, /source-derived-preview/);
  assert.match(rundown, /not an editor-reviewed slate/);
  assert.match(rundown, /No old editorial pick is recycled/);
  assert.doesNotMatch(rundown, /createSupabaseAdminClient|insert\(|story_thesis_versions|fetch\(/);
});

test("rundown has responsive reading order without price widgets or private APIs", () => {
  assert.match(css, /@media\(max-width:670px\)/);
  assert.match(css, /\.leadCard/);
  assert.match(css, /\.fallbackGrid/);
  assert.match(rundown, /rel="noopener noreferrer"/);
  assert.doesNotMatch(rundown, /window\.|localStorage|NEXT_PUBLIC|SUPABASE_SERVICE_ROLE_KEY/);
});
