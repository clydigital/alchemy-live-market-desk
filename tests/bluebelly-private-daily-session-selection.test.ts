import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {classifyPrivateDailyIntelligenceSessions}
 from "../lib/bluebelly-private-daily-session-selection.ts";
import type {PrivateDailyIntelligenceEdition}
 from "../lib/bluebelly-private-edition-dedupe.ts";

const edition=(day:string,title:string,created:string):PrivateDailyIntelligenceEdition=>({
 id:"1db58755-f254-4ab9-a6d2-07b4b2245621",
 reportDay:day,title,createdAt:created,htmlSha256:"a".repeat(64),
 reviewStatus:"PRIVATE_DRAFT",delivery:"WORK",
});

test("3 Nov source update of Friday edition cannot displace completed 2 Nov report",()=>{
 const mislabelled=edition("2026-11-03",
  "Daily Intelligence — 30 Oct ET session, 3 Nov source update",
  "2026-11-03T01:35:46.689Z");
 const monday=edition("2026-11-02",
  "Growth is real. The cash and price tests are different. — 2 Nov ET",
  "2026-11-03T00:49:51.077Z");
 // My Desk previously sorted a user-supplied future session day first.
 const result=classifyPrivateDailyIntelligenceSessions(
  [mislabelled,monday],new Date("2026-11-03T16:25:00Z"));
 assert.equal(result.expectedDay,"2026-11-02");
 assert.deepEqual(result.eligible.map(e=>e.title),[monday.title]);
 assert.deepEqual(result.sessionConflicts.map(e=>e.title),[mislabelled.title]);
});

test("mislabelled upload remains excluded even after the labelled session later finishes",()=>{
 const wrong=edition("2026-11-03","30 Oct session with 3 Nov additions",
  "2026-11-03T01:35:46.689Z");
 const result=classifyPrivateDailyIntelligenceSessions(
  [wrong],new Date("2026-11-04T06:00:00Z"));
 assert.equal(result.expectedDay,"2026-11-03");
 assert.equal(result.eligible.length,0);
 assert.deepEqual(result.sessionConflicts,[wrong]);
});

test("a true 3 Nov ET edition becomes eligible only after the close",()=>{
 const correct=edition("2026-11-03","Post-close report for the 3 Nov session",
  "2026-11-03T21:05:00Z");
 const before=classifyPrivateDailyIntelligenceSessions(
  [correct],new Date("2026-11-03T20:45:00Z"));
 assert.equal(before.eligible.length,0);
 const after=classifyPrivateDailyIntelligenceSessions(
  [correct],new Date("2026-11-03T22:00:00Z"));
 assert.deepEqual(after.eligible,[correct]);
});

test("Friday remains valid during weekend and Monday pre-close, but cannot become Tuesday",()=>{
 const friday=edition("2026-10-30","Friday investigation",
  "2026-10-31T09:11:09.333Z");
 for(const asOf of ["2026-11-01T07:30:00Z","2026-11-02T20:45:00Z"]){
  const result=classifyPrivateDailyIntelligenceSessions([friday],new Date(asOf));
  assert.deepEqual(result.eligible,[friday]);
 }
 const wrong=edition("2026-11-02","Monday preview incorrectly assigned to Monday close",
  "2026-11-02T11:00:00Z");
 assert.equal(classifyPrivateDailyIntelligenceSessions(
  [wrong],new Date("2026-11-03T15:00:00Z")).eligible.length,0);
});

test("My Desk and article ideas share one session-qualified index without erasing revisions",()=>{
 const owner=readFileSync(new URL("../lib/bluebelly-owner-daily-intelligence.ts",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../components/blue-desk/OwnerDailyIntelligenceHome.tsx",import.meta.url),"utf8");
 const ideas=readFileSync(new URL("../lib/bluebelly-owner-report-led-ideas.ts",import.meta.url),"utf8");
 assert.match(owner,/classifyPrivateDailyIntelligenceSessions\(unique\.editions,new Date\(\)\)/);
 assert.match(owner,/editions:checked\.eligible/);
 assert.match(owner,/sessionConflicts:checked\.sessionConflicts/);
 assert.match(ideas,/const latest=index\.editions\[0\]/);
 assert.match(ui,/data-my-desk-session-conflicts="preserved-not-current"/);
 assert.match(ui,/cannot replace the latest completed-session Daily Intelligence/);
 assert.match(ui,/api\/owner\/html-editions\?edition=/);
});
