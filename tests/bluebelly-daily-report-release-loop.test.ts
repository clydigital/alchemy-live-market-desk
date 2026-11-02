import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {projectDailyReport,type DailyDecisionTopic} from "../lib/bluebelly-daily-report-projection.ts";
import {publicNewsroomEditorials,selectTodayNewsroomItems} from "../lib/bluebelly-public-newsroom-feed.ts";
import {getRecentVerifiedEarningsScorecards} from "../lib/blue-desk-earnings-results.ts";
import {getRecentOfficialMacroResults} from "../lib/blue-desk-official-macro-results.ts";
import {blueDeskHostAccess,retiredLivePublicDestination} from "../lib/blue-desk-host.ts";

const src=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const at=new Date("2026-11-02T19:00:00Z");
function topic(id:string,occurredAt:string,status:"NEW"|"FEATURE"|"UPCOMING"="NEW",assets:string[]=[]):DailyDecisionTopic{
 return {id,title:"Market event: "+id,fact:"A source-qualified dated release with supported facts and figures.",
  why:"Specific measured data still matters",test:"Check the next comparable original release.",
  at:occurredAt,sourceUrl:"https://example.org/releases/"+id,sourceName:"Official source",
  href:"?brief="+id,status,mechanism:"The event could change company cash generation if sustained.",
  assets,priority:8};
}

test("daily report is capped at five independently sourced topics, shows pending events separately",()=>{
 const input=[
  ...Array.from({length:7},(_,i)=>topic("issuer-"+i,"2026-11-02T18:00:00Z","NEW",["TICK"])),
  topic("macro","2026-10-30T12:00:00Z","FEATURE",["US02Y","DXY"]),
  topic("future","2026-11-04T14:00:00Z","UPCOMING"),
 ];
 const result=projectDailyReport(input,at);
 assert.ok(result.stories.length<=5);
 assert.ok(result.stories.some(s=>s.id==="macro"));
 assert.equal(result.stories.filter(t=>t.assets.length===1).length,2);
 assert.equal(result.upcoming.length,1);
 assert.equal(result.freshWithin48h,2);
 assert.equal(result.status,"CURRENT_SOURCES");
 assert.ok(result.stories.every(t=>t.status!=="UPCOMING"));
});

test("recent editorials are not falsely counted as fresh verified releases",()=>{
 const result=projectDailyReport([topic("preview","2026-11-02","FEATURE")],at);
 assert.equal(result.stories.length,1);
 assert.equal(result.freshWithin48h,0);
 assert.equal(result.status,"RECENT_REVIEWED_ONLY");
 const stale=projectDailyReport([topic("old","2026-10-15")],at);
 assert.equal(stale.status,"NO_QUALIFIED_SOURCES");
 assert.equal(projectDailyReport([topic("future","2026-11-05")],at).stories.length,0);
 assert.equal(projectDailyReport([topic("bad","2026-11-02T16:00:00Z"),topic("bad","2026-11-02T16:00:00Z")],at).stories.length,1);
});

test("Newsroom and Today share already-reviewed releases, with source and consensus labels",()=>{
 const today=new Date("2026-11-02T05:30:00Z"),host="bluebelly-desk.vercel.app";
 const editorials=publicNewsroomEditorials([],today,host);
 const ids=editorials.map(x=>x.id);
 const issuer=getRecentVerifiedEarningsScorecards(today,7);
 const macro=getRecentOfficialMacroResults(today);
 assert.ok(issuer.length>0&&macro.length>0);
 for(const item of issuer){
  const match=editorials.find(x=>x.id==="earnings-release:"+item.id);
  assert.ok(match,item.id);
  assert.equal(match?.sourceUrl,item.sourceUrl);
  assert.equal(match?.occurredAt,item.releaseDay);
  assert.equal(match?.readerHref,"/key-stories?brief="+item.id);
  if(item.beatSource==="unavailable")assert.match(match?.verificationLabel||"",/CONSENSUS NOT VERIFIED/);
 }
 for(const item of macro){
  const match=editorials.find(x=>x.id==="macro-release:"+item.id);
  assert.ok(match,item.id);assert.equal(match?.sourceUrl,item.sourceUrl);
  assert.equal(match?.kind,"macro");
 }
 const shared=selectTodayNewsroomItems([],[],editorials,today,5);
 assert.ok(shared.length>0);
 const withExactSource=publicNewsroomEditorials([{contractVersion:"news-brief/1",contentType:"NEWS_BRIEF",
  verification:"SOURCE_VERIFIED",id:"same-press",headline:"Economic release original verified",
  summary:"Original source report with enough text to qualify.",
  sourceName:"US BEA",sourceUrl:macro[0].sourceUrl,sourceKind:"official",
  occurredAt:"2026-11-02T01:00:00Z",observedAt:"2026-11-02T01:01:00Z"}],today,host);
 assert.equal(withExactSource.some(x=>x.id==="macro-release:"+macro[0].id),false);
});

test("public route is real, legacy live human link maps to it, historical editions remain fail closed",()=>{
 const host="bluebelly-desk.vercel.app",live="alchemy-live-market-desk.vercel.app";
 assert.equal(blueDeskHostAccess("/daily-report",host),"public");
 assert.equal(blueDeskHostAccess("/owner/daily-report",host),"private");
 assert.equal(retiredLivePublicDestination("/daily-report",live),"https://bluebelly-desk.vercel.app/daily-report");
 assert.equal(retiredLivePublicDestination("/daily-report",live,"?edition=some-old-id"),null);
 const page=src("app/blue-desk/daily-report/page.tsx");
 const middleware=src("middleware.ts");
 const nav=src("components/blue-desk/BlueDeskHeader.tsx");
 assert.match(page,/projectDailyReport\(decisionTopics\(news,calendar,now\),now,5\)/);
 assert.match(page,/<DailyFiveTopicBrief report=\{dailyReport\}/);
 assert.match(page,/data-daily-report-background="expandable-detailed-research"/);
 assert.match(page,/<DecisionBrief/);
 assert.match(middleware,/pathname === "\/daily-report" \|\| pathname === "\/blue-desk\/daily-report"/);
 assert.doesNotMatch(middleware,/NextResponse\.redirect\("https:\/\/bluebelly-desk\.vercel\.app\/newsroom"/);
 assert.match(nav,/\["Daily Report", "\/daily-report"\]/);
 const component=src("components/blue-desk/DailyFiveTopicBrief.tsx");
 assert.match(component,/data-daily-report-lead="five-source-qualified-topics"/);
 assert.match(component,/data-quick-market-brief="public-source-qualified"/);
 assert.match(component,/A specific price reaction or a “priced in” explanation requires separately matched evidence/);
 assert.match(component,/rolling public, source-led briefing, not a fixed archival edition/);
 assert.doesNotMatch(component,/createSupabaseAdminClient|process\.env|generateContent|notion\.fetch/);
});
