import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {easternCalendarDay,selectNewsroomHotPicks}
 from "../lib/bluebelly-newsroom-hot-picks.ts";
import type {ArchiveNewsItem} from "../lib/bluebelly-publication-archive.ts";
import type {NewsBriefV1} from "../lib/market-brief-news.ts";

const now=new Date("2026-10-30T18:00:00.000Z");
const archives:ArchiveNewsItem[]=[
 {id:"fed",headline:"The Fed holds policy amid rising inflation",eventType:"POLICY_DECISION",
  eventAt:"2026-10-28T18:00:00Z",eventDay:null,sourceName:"Federal Reserve",
  sourceUrl:"https://example.org/fed",readerHref:"/key-stories?postEvent=fed",
  topics:["RATES_BONDS","ECONOMY"],entityKeys:["FED"],verificationLabel:"REVIEWED PUBLIC READER SNAPSHOT"},
 {id:"boc",headline:"Bank of Canada publishes its rate decision",eventType:"POLICY_DECISION",
  eventAt:"2026-10-28T13:45:00Z",eventDay:null,sourceName:"Bank of Canada",
  sourceUrl:"https://example.org/boc",readerHref:"/key-stories?postEvent=boc",
  topics:["RATES_BONDS","FX"],entityKeys:["BOC"],verificationLabel:"REVIEWED PUBLIC READER SNAPSHOT"},
 {id:"pce",headline:"US September PCE inflation is above target",eventType:"ECONOMIC_RELEASE",
  eventAt:"2026-10-29T12:30:00Z",eventDay:null,sourceName:"BEA",
  sourceUrl:"https://example.org/pce",readerHref:"/key-stories?brief=pce",
  topics:["ECONOMY","RATES_BONDS"],entityKeys:["US-PCE"],verificationLabel:"REVIEWED PUBLIC READER SNAPSHOT"},
 ...["AMZN","SNDK","INTC","000660.KS"].map((ticker,index):ArchiveNewsItem=>({
  id:"issuer-"+index,headline:"Quarterly earnings release for "+ticker,
  eventType:"EARNINGS",eventAt:null,eventDay:index===3?"2026-10-28":"2026-10-29",
  sourceName:"Official issuer",sourceUrl:"https://example.org/issuer-"+index,
  readerHref:"/key-stories?postEvent=issuer-"+index,
  topics:["EQUITIES","AI_TECHNOLOGY"],entityKeys:[ticker],
  verificationLabel:"REVIEWED PUBLIC READER SNAPSHOT",
 })),
];
const wire:NewsBriefV1={
 contractVersion:"news-brief/1",contentType:"NEWS_BRIEF",
 id:"brent",headline:"Oil shipping resumes after supply disruption",summary:"Brent and oil shipping news.",
 sourceName:"Verified press",sourceUrl:"https://example.org/oil",sourceKind:"official",
 occurredAt:"2026-10-30T12:00:00Z",observedAt:"2026-10-30T12:15:00Z",
 verification:"SOURCE_VERIFIED",
};
test("Hot Picks selects 3-5 released source-qualified unique stories across event types",()=>{
 const r=selectNewsroomHotPicks([wire],archives,now);
 assert.equal(r.etDay,"2026-10-30");
 assert.equal(r.keys.length,5);
 assert.equal(new Set(r.keys).size,r.keys.length);
 assert.ok(r.keys.some(k=>k==="archive:pce"));
 assert.ok(r.keys.some(k=>k==="archive:fed"||k==="archive:boc"));
 assert.ok(r.keys.some(k=>k.startsWith("archive:issuer-")));
 assert.ok(r.keys.some(k=>k==="news:brent"));
});
test("hot shortlist recomputes from the day's evidence; no hard-coded featured names",()=>{
 const early=selectNewsroomHotPicks([],archives,now);
 const withNew=selectNewsroomHotPicks([wire],archives,now);
 assert.notDeepEqual(withNew.keys,early.keys);
 assert.equal(withNew.etDay,early.etDay);
});
test("scheduled future wire events and date-only releases on the current UTC date are excluded",()=>{
 const futureWire={...wire,id:"future",sourceUrl:"https://example.org/future",
  occurredAt:"2026-10-31T14:00:00Z",headline:"Upcoming calendar decision not yet released"};
 const datedFuture={...archives[3],id:"not-yet-announced",eventDay:"2026-10-30",sourceUrl:"https://example.org/today"};
 const keys=selectNewsroomHotPicks([futureWire],[datedFuture,...archives],now).keys;
 assert.ok(!keys.includes("news:future"));
 assert.ok(!keys.includes("archive:not-yet-announced"));
});
test("verified original source is preferred to a duplicate wire referencing the same release",()=>{
 const duplicated={...wire,id:"same-as-fed",sourceUrl:"https://example.org/fed"};
 const picks=selectNewsroomHotPicks([duplicated],archives,now);
 assert.ok(!picks.keys.includes("news:same-as-fed"));
});
test("stale and future events never receive Hot Picks placement",()=>{
 const old={...archives[0],id:"old",eventAt:"2026-10-01T18:00:00Z",sourceUrl:"https://example.org/old"};
 const future={...archives[0],id:"future",eventAt:"2026-11-01T18:00:00Z",sourceUrl:"https://example.org/future"};
 const r=selectNewsroomHotPicks([], [old,future],now);
 assert.deepEqual(r.keys,[]);
});
test("no padding with unverified or scheduled events if fewer than 3 actual public events exist",()=>{
 const r=selectNewsroomHotPicks([],[archives[0]],now);
 assert.deepEqual(r.keys,["archive:fed"]);
 assert.ok(r.keys.length<3);
});
test("US Eastern day governs daily pick identity, across local midnight",()=>{
 assert.equal(easternCalendarDay(new Date("2026-10-30T03:59:00Z")),"2026-10-29");
 assert.equal(easternCalendarDay(new Date("2026-10-30T04:01:00Z")),"2026-10-30");
 assert.equal(easternCalendarDay(new Date("invalid")),null);
});
test("Newsroom no longer fetches calendar or mounts the redundant upcoming strip",()=>{
 const src=readFileSync(new URL("../app/blue-desk/newsroom/page.tsx",import.meta.url),"utf8");
 assert.doesNotMatch(src,/NextBankCatalysts|NewsroomBriefableEvents|getEconomicCalendar|getForwardEarningsEvents|buildPresenterCalendar/);
 assert.match(src,/selectNewsroomHotPicks\(news,archiveResult\.items,now,5,editorials\)/);
 const ui=readFileSync(new URL("../components/blue-desk/BluebellyNewsWire.tsx",import.meta.url),"utf8");
 assert.match(ui,/Hot Picks <small>\{hotPicks\.keys\.length\}/);
 assert.match(ui,/styles\.hotSelected:styles\.hotButton/);
 assert.match(ui,/aria-pressed=\{topic==="hot"\}/);
 assert.match(ui,/data-hot-picks-day=\{hotPicks\.etDay\}/);
});
