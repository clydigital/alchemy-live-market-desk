import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {getRecentVerifiedEarningsScorecards} from "../lib/blue-desk-earnings-results.ts";

test("reported SK hynix and TSMC results are date-qualified and do not appear ahead of release",()=>{
 const mid=getRecentVerifiedEarningsScorecards(new Date("2026-10-20T16:00:00Z"));
 assert.deepEqual(mid.map(x=>x.id),["tsmc-2026q3"]);
 const now=getRecentVerifiedEarningsScorecards(new Date("2026-10-28T13:00:00Z"));
 assert.deepEqual(now.map(x=>x.id),["sk-hynix-2026q3","tsmc-2026q3"]);
 assert.deepEqual(getRecentVerifiedEarningsScorecards(new Date("2026-12-02T11:00:00Z")),[]);
});

test("beat/miss comparison never relabels company guidance as analyst consensus",()=>{
 const rows=getRecentVerifiedEarningsScorecards(new Date("2026-10-28T13:00:00Z"));
 const hynix=rows.find(x=>x.id==="sk-hynix-2026q3")!;
 assert.equal(hynix.beatSource,"unavailable");
 assert.match(hynix.beatMiss,/No verified comparable pre-release analyst consensus/);
 assert.equal(hynix.preliminary,true);
 const tsmc=rows.find(x=>x.id==="tsmc-2026q3")!;
 assert.equal(tsmc.beatSource,"company_guidance");
 assert.match(tsmc.beatMiss,/COMPANY GUIDANCE/);
 assert.match(tsmc.beatMiss,/not analyst-consensus beats/);
});

test("real revenue and operating results are distinct from missing CFO, FCF and actual cash capex",()=>{
 const rows=getRecentVerifiedEarningsScorecards(new Date("2026-10-28T13:00:00Z"));
 for(const r of rows){
  assert.match(r.sourceUrl,/^https:\/\//);
  assert.match(r.fiscalPeriod,/Q3 2026/);
  assert.equal(r.metrics.length,4);
  assert.deepEqual(r.metrics.map(x=>x.name),[
   "Revenue","Operating profit / margin","Free cash flow","Capital expenditure",
  ]);
  assert.equal(r.metrics[0].state,"measured");
  assert.equal(r.metrics[1].state,"measured");
  assert.equal(r.metrics[2].state,"not_verified");
  assert.equal(r.metrics[2].value,null);
  assert.equal(r.metrics[3].state,"not_verified");
  assert.equal(r.metrics[3].value,null);
  assert.match(r.metrics[3].note||"",/not established|not verified/i);
  assert.ok(r.conclusion.length>90);
 }
 const hynix=rows[0];
 assert.equal(hynix.metrics[0].value,"₩104.62tn");
 assert.match(hynix.metrics[0].comparison??"",/328% YoY/);
 assert.match(hynix.metrics[1].comparison??"",/632% YoY/);
});

test("new released earnings panel is in visible Calendar, outside collapsed legacy details",()=>{
 const source=readFileSync(new URL("../app/blue-desk/calendar/page.tsx",import.meta.url),"utf8");
 const open=source.indexOf("<details style=");
 const scoreboard=source.indexOf("<RecentEarningsScorecards records=");
 assert.ok(scoreboard>0 && scoreboard<open);
 assert.match(source,/getRecentVerifiedEarningsScorecards\(now\)/);
 const component=readFileSync(new URL("../components/blue-desk/RecentEarningsScorecards.tsx",import.meta.url),"utf8");
 assert.match(component,/data-bluebelly-released-earnings="issuer-source-verified"/);
 assert.match(component,/Not yet verified/);
 assert.match(component,/source-reviewed results/);
});
