import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const hormuz=read("app/blue-desk/hormuz/page.tsx");
const keyStories=read("app/blue-desk/key-stories/page.tsx");
const brief=read("components/blue-desk/HormuzSituationBrief.tsx");
const wire=read("lib/bluebelly-hormuz-x-wire-server.ts");

test("Hormuz opens with a quick Iran conflict and diplomacy read, retaining physical monitors",()=>{
 assert.match(hormuz,/data-bluebelly-hormuz="public-source-dated-physical-first"/);
 assert.match(hormuz,/HormuzSituationBrief newsroomHref=/);
 assert.match(hormuz,/reviewed=\{reviewedResearch\} wire=\{wire\}/);
 assert.match(hormuz,/HormuzCrossings monitor=/);
 assert.match(hormuz,/getHormuzIncidents/);
 assert.match(hormuz,/getHormuzWireLeads/);
 assert.match(hormuz,/readBluebellyQualifiedNews/);
 assert.match(hormuz,/news=\{qualifiedNews.news\}/);
 assert.doesNotMatch(hormuz,/HormuzMediationFeature/);
 assert.match(brief,/data-hormuz-situation="source-dated-quick-read"/);
 assert.match(brief,/Negotiations & conflict/);
 assert.match(brief,/What is moving\?/);
 assert.match(brief,/X Wire — emerging claims/);
});
test("Old mediation bookmark redirects to the situation watch, not an old Key Story",()=>{
 assert.match(keyStories,/feature==="hormuz-mediation-november-2026"/);
 assert.match(keyStories,/redirect\(blueDeskPublicHref\("\/blue-desk\/hormuz",host\)\)/);
 assert.doesNotMatch(keyStories,/HormuzMediationFeature/);
 assert.doesNotMatch(read("lib/bluebelly-public-research-library.ts"),/id:"hormuz-mediation"/);
});
test("X Wire is a bounded read-only discovery input, never fact verification or a polling writer",()=>{
 assert.match(wire,/from\("x_wire_posts"\)/);
 assert.match(wire,/eq\("intake_status","discovery"\)/);
 assert.match(wire,/rankXWireMarketCandidates/);
 assert.match(wire,/slice\(0,3\)/);
 assert.doesNotMatch(wire,/getXWireDurable|scanOne|upsert\(|insert\(|update\(/);
 assert.match(brief,/Unverified public posts/);
 assert.match(brief,/Source edition:/);
 assert.match(brief,/Source-verified reporting/);
 assert.match(brief,/newsCoverageDegraded/);
 assert.match(brief,/Vessel crossings are not verified barrels/);
 assert.match(brief,/unavailable/);
});
