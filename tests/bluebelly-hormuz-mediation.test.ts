import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const hormuz=readFileSync(new URL("../app/blue-desk/hormuz/page.tsx",import.meta.url),"utf8");
const keyStories=readFileSync(new URL("../app/blue-desk/key-stories/page.tsx",import.meta.url),"utf8");
const feature=readFileSync(new URL("../components/blue-desk/HormuzMediationFeature.tsx",import.meta.url),"utf8");

test("Hormuz mediation is dated editorial above retained physical source monitors",()=>{
 assert.match(hormuz,/data-bluebelly-hormuz="public-source-dated-physical-first"/);
 assert.match(hormuz,/id="mediation"/);
 assert.match(hormuz,/HormuzMediationFeature mode="preview"/);
 assert.match(hormuz,/HormuzCrossings monitor=/);
 assert.match(hormuz,/getHormuzIncidents/);
});
test("Key Story link is a bounded public editorial feature, not canonical thesis mutation",()=>{
 assert.match(keyStories,/feature==="hormuz-mediation-november-2026"/);
 assert.match(keyStories,/data-key-story="hormuz-mediation-source-reviewed"/);
 assert.match(keyStories,/data-feature="hormuz-mediation-november-2026"/);
 assert.doesNotMatch(feature,/createSupabaseAdminClient|insert\(|upsert\(/);
});
test("Mediation distinguishes proposal, incident and acceptance from verified reopening",()=>{
 for(const phrase of [/US ACCEPTANCE NOT CONFIRMED/,/REOPENING NOT VERIFIED/,/responsibility was still under investigation/i,/Al Mayeda/,/2026-11-01/,/reuters\.com/,/mofa\.gov\.qa/])assert.match(feature,phrase);
});
