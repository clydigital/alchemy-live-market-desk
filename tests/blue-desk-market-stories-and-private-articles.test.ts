import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {projectPublicTheses,storyMarketTransmission,orderStoriesByLatestMotion} from "../lib/blue-desk-thesis-ledger.ts";
import {parseDailyArticlePlan,DESK_CHARTS} from "../lib/blue-desk-daily-article-plan.ts";
import {blueDeskHostAccess,blueDeskPresentationTarget} from "../lib/blue-desk-host.ts";

const base={
 id:"261d7726-6503-4603-8570-055177846859",slug:"ai-financing-stress",
 title:"AI Boom Hits the Cost of Capital",thesis:"AI project financing is getting more selective even while demand looks strong.",
 market_question:"Does project debt begin to pressure equity valuations?",
 strongest_support:"Credit spreads for AI-linked projects are wider",
 strongest_contradiction:"Rate moves have several non-AI causes",
 status:"monitor",updated_at:"2026-10-23T12:00:00.000Z",rank:null,
};
test("no rank requirement: every real non-archived Story can supply the historical reading view",()=>{
 const rows=Array.from({length:24},(_,i)=>({...base,
  id:"00000000-0000-4000-8000-"+String(i+1).padStart(12,"0"),
  slug:"story-"+i,status:i<4?"develop":i<11?"publish":"monitor",
  market_question:i<4?null:base.market_question,
  rank:i<5?i+1:null,
 }));
 const visible=projectPublicTheses(rows,new Date("2026-10-26T01:00:00.000Z"),24);
 assert.equal(visible.length,24);
 assert.equal(visible.filter(x=>x.rank===null).length,19);
 assert.equal(visible.filter(x=>x.status==="develop").length,4);
 assert.ok(visible.every(x=>x.question.length>10));
 assert.deepEqual(projectPublicTheses([{...base,status:"archived"}],new Date("2026-10-26")),[]);
 assert.match(storyMarketTransmission(base),/AI orders|AI/);
 assert.match(storyMarketTransmission({...base,slug:"iran-oil-inflation-rates"}),/fuel|shipping/);
});
test("four distinct original private article concepts require identifiable chart checks",()=>{
 const plan={ideas:Array.from({length:4},(_,i)=>({
  title:"How current event "+i+" could reprice a market",
  kind:i%2?"COTD":"OB",
  angle:"Start from a dated source, explain what occurred and why the relevant traders would need to reconsider expected earnings or borrowing.",
  whyItMatters:"Trace the step from the original economic event to cash flow, bond yields or price risk, and label price movements as unknown.",
  whatToVerify:"Check the primary original release, specific event time, matched asset session, market expectation and alternative explanation.",
  chartSymbols:i%2?["TVC:DXY","TVC:US10Y"]:["TVC:UKOIL","TVC:USOIL"],
  chartChecks:["Inspect 4H 20 EMA ±1 SD only after loading the completed source chart."],
 }))};
 const p=parseDailyArticlePlan(plan);
 assert.equal(p?.length,4);
 assert.deepEqual(parseDailyArticlePlan({ideas:[plan.ideas[0]]}),null);
 assert.equal(parseDailyArticlePlan({ideas:[...plan.ideas.slice(0,3),{...plan.ideas[3],chartSymbols:["BAD:TICKER"]}]}),null);
 assert.ok(Object.values(DESK_CHARTS).every(x=>x.link.startsWith("https://")));
});
test("public Bluebelly tells readable multi-paragraph Stories and full-source coverage",()=>{
 const key=readFileSync(new URL("../app/blue-desk/key-stories/page.tsx",import.meta.url),"utf8");
 const daily=readFileSync(new URL("../app/blue-desk/daily-report/page.tsx",import.meta.url),"utf8");
 const home=readFileSync(new URL("../app/blue-desk/page.tsx",import.meta.url),"utf8");
 const reader=readFileSync(new URL("../lib/blue-desk-thesis-ledger-server.ts",import.meta.url),"utf8");
 assert.match(reader,/getPublicThesisLedger\(now=new Date\(\),limit=24\)/);
 assert.doesNotMatch(reader,/not\("rank","is",null\)/);
 assert.match(key,/storyMarketTransmission\(thesis\)/);
 assert.match(key,/data-catalyst-led="verified-only"/);
 assert.match(key,/data-upcoming-decisions="source-calendar"/);
 assert.match(key,/topic\.humanStake/);
 assert.match(key,/lead\.headline/);
 assert.match(key,/lead\.occurredAt/);
 assert.match(key,/selectBlueDeskUpcoming/);
 assert.match(key,/<details className=\{ui\.more\}>/);
 assert.match(key,/Read the reasoning, risks and deciding tests/);
 assert.match(key,/The full recorded thesis/);
 assert.match(home,/data-live-feature-stakes="verified-catalyst"/);
 assert.match(key,/storyIntro/);
 assert.match(key,/storyExplanation/);
 assert.match(daily,/stories\.slice\(8\)/);
 assert.match(daily,/observations\.map/);
 assert.match(daily,/news\.map/);
 assert.match(daily,/topic\.marketMechanism/);
 assert.match(home,/olderStory/);
 assert.doesNotMatch(home,/listPublishedReports/);
});
test("private daily slate is behind login; no public COTD/OB or report download UI",()=>{
 const header=readFileSync(new URL("../components/blue-desk/BlueDeskHeader.tsx",import.meta.url),"utf8");
 const owner=readFileSync(new URL("../app/owner/daily-articles/page.tsx",import.meta.url),"utf8");
 const route=readFileSync(new URL("../app/api/owner/daily-article-plan/route.ts",import.meta.url),"utf8");
 const studio=readFileSync(new URL("../components/blue-desk/DailyArticleStudio.tsx",import.meta.url),"utf8");
 const publicNav=header.match(/const PUBLIC_NAV = \[([\s\S]*?)\] as const;/)?.[1]||"";
 assert.doesNotMatch(publicNav,/COTD|\/reports/);
 assert.match(header,/My Daily Report/);
 assert.match(header,/My Desk/);
  assert.doesNotMatch(header,/\["Writing Desk", "\/owner\/editorial"\]/);
 assert.ok(header.includes('activePath === "/owner/daily-articles"'));
 assert.ok(header.includes('activePath === "/owner/x-wire"'));
 assert.match(owner,/data-private-daily-articles-page="owner-authenticated"/);
 assert.match(route,/client\.auth\.getUser\(\)/);
 assert.match(route,/app_access_allowlist/);
 assert.match(route,/GEMINI_API_KEY/);
 assert.match(route,/parseDailyArticlePlan/);
 assert.match(studio,/daily-article-plan/);
 assert.match(studio,/editorial-generate/);
 assert.match(studio,/chartSymbols/);
 assert.match(studio,/No stories or charts will be invented/);
 for(const host of ["bluebelly-desk.vercel.app","alchemy-live-market-desk.vercel.app"]){
  assert.notEqual(blueDeskHostAccess("/owner/daily-articles",host),"public");
  assert.notEqual(blueDeskHostAccess("/reports",host),"public");
  assert.equal(blueDeskPresentationTarget("/reports",host),null);
 }
});

test("Key Stories uses latest exact Motion event chronology ahead of Story rank",()=>{
 const date=new Date("2026-10-26T08:00:00.000Z");
 const ids=["00000000-0000-4000-8000-000000000001","00000000-0000-4000-8000-000000000002","00000000-0000-4000-8000-000000000003"];
 const rows=ids.map((id,i)=>({...base,id,slug:"story-"+i,rank:i+1,
  updated_at:["2026-10-25T10:00:00Z","2026-10-24T10:00:00Z","2026-10-26T05:00:00Z"][i]}));
 const projected=projectPublicTheses(rows,date,3);
 assert.deepEqual(projected.map(s=>s.id),[ids[2],ids[0],ids[1]]);
 const sorted=orderStoriesByLatestMotion(projected,[
  {primary_story_id:ids[0],occurred_at:"2026-10-25T23:00:00Z",verification_state:"LEAD"},
  {primary_story_id:ids[1],occurred_at:"2026-10-26T06:00:00Z",verification_state:"PARTIAL"},
  {primary_story_id:ids[1],occurred_at:"2026-10-20T06:00:00Z",verification_state:"VERIFIED"},
  {primary_story_id:ids[0],occurred_at:"2026-10-27T06:00:00Z",verification_state:"LEAD"},
  {primary_story_id:"00000000-0000-4000-8000-000000000099",occurred_at:"2026-10-26T07:00:00Z",verification_state:"LEAD"},
 ],date);
 assert.deepEqual(sorted.map(s=>s.id),[ids[1],ids[0],ids[2]]);
 assert.equal(sorted[0].latestMotionVerification,"PARTIAL");
 assert.equal(sorted[1].latestMotionVerification,"LEAD");
 assert.equal(sorted[2].latestMotionAt,null);
 const keyPage=readFileSync(new URL("../app/blue-desk/key-stories/page.tsx",import.meta.url),"utf8");
 assert.match(keyPage,/orderStoriesByLatestMotion/);
 assert.match(keyPage,/getStoryMotionRecency/);
 assert.match(keyPage,/UNVERIFIED RESEARCH LEAD/);
});
