import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

test("source-listed upcoming decisions lead when recent qualified news is missing",()=>{
 const page=readFileSync(new URL("../app/blue-desk/key-stories/page.tsx",import.meta.url),"utf8");
 assert.match(page,/const liveCatalystSection=/);
 assert.match(page,/const upcomingDecisionSection=/);
 assert.match(page,/topics\.length \? <>\{liveCatalystSection\}\{upcomingDecisionSection\}<\/> : <>/);
 assert.match(page,/\{upcomingDecisionSection\}[\s\S]*?No recent source-verified headline passed the Live News gate/);
 assert.match(page,/buildPresenterCalendar\(macro,earnings,now\)/);
 assert.match(page,/lead\.sourceUrl/);
 assert.doesNotMatch(page,/createSupabaseAdminClient|generateContent\(|insert\(|story_thesis_versions/);
});
