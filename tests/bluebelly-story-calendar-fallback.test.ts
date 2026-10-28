import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {calendarHumanStake} from "../lib/blue-desk-calendar-human-stakes.ts";

test("source-listed upcoming decisions lead when recent qualified news is missing",()=>{
 const page=readFileSync(new URL("../app/blue-desk/key-stories/page.tsx",import.meta.url),"utf8");
 assert.match(page,/const liveCatalystSection=/);
 assert.match(page,/const upcomingDecisionSection=/);
 assert.match(page,/topics\.length \? <>\{liveCatalystSection\}\{upcomingDecisionSection\}/);
 assert.match(page,/\{upcomingDecisionSection\}/);
 assert.match(page,/No recent source-verified headline passed the Live News gate/);
 assert.match(page,/Historical Story research follows below/);
 assert.match(page,/buildPresenterCalendar\(macro,earnings,now\)/);
 assert.match(page,/lead\.sourceUrl/);
 assert.doesNotMatch(page,/createSupabaseAdminClient|generateContent\(|insert\(|story_thesis_versions/);
});

test("upcoming catalyst explanations are conditional and avoid fabricated results",()=>{
  assert.match(calendarHumanStake("FOMC rate decision"),/refinancing homes/);
  assert.match(calendarHumanStake("Alphabet Q3 earnings"),/shareholder's receipt/);
  assert.match(calendarHumanStake("CPI inflation release"),/Households/);
  assert.doesNotMatch(calendarHumanStake("Unknown event"),/reported|rose|fell by [0-9]/i);
  const page=readFileSync(new URL("../app/blue-desk/key-stories/page.tsx",import.meta.url),"utf8");
  assert.match(page,/calendarHumanStake\(event\.title\)/);
});
