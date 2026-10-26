import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {officialEarningsEvents, getForwardEarningsEvents}
  from "../lib/forward-earnings-sources.ts";
import {buildPresenterCalendar} from "../lib/presenter-calendar.ts";
import {selectBlueDeskEarningsWeek} from "../lib/blue-desk-calendar.ts";

const now=new Date("2026-10-27T03:00:00Z"); // 26 Oct 11pm Eastern
const rows=()=>officialEarningsEvents(now);
const byTicker=(ticker:string)=>rows().find(e=>e.affectedAssets.includes(ticker));

test("late-October priority company earnings are issuer-announced, not invented release hours",()=>{
 const msft=byTicker("MSFT");
 const google=byTicker("GOOGL");
 const amazon=byTicker("AMZN");
 assert.equal(msft?.startAt,"2026-10-28");
 assert.equal(msft?.timePrecision,"date");
 assert.equal(msft?.verificationState,"official");
 assert.match(msft?.sourceUrl||"",/microsoft\.com\/en-us\/investor/);
 assert.equal(google?.startAt,"2026-10-28T16:30:00-04:00");
 assert.equal(google?.timePrecision,"exact");
 assert.match(google?.timeLabel||"",/conference call/i);
 assert.equal(amazon?.startAt,"2026-10-29T17:00:00-04:00");
 assert.match(amazon?.sourceUrl||"",/aboutamazon\.com/);
 for(const e of [msft,google,amazon]){
  assert.ok(e?.decisiveVariable.includes("capex")||e?.decisiveVariable.includes("spending"),
    "each event needs actual financial/financing analysis");
  assert.match(e?.expectedStage||"",/time|minute/i);
 }
});

test("the US Monday-Sunday earnings week highlights MSFT GOOGL AMZN without invented time",()=>{
 const earnings={events:rows(),coverage:"official_only" as const,warning:null};
 const calendar=buildPresenterCalendar([],earnings,now);
 const week=selectBlueDeskEarningsWeek(calendar,now);
 const tickers=week.flatMap(e=>e.affectedAssets);
 assert.ok(["MSFT","GOOGL","AMZN"].every(t=>tickers.includes(t)));
 const msft=week.find(e=>e.affectedAssets.includes("MSFT"))!;
 assert.equal(msft.scheduledAt,null,"Microsoft issuer date stays date-only");
 assert.equal(msft.localDate,"2026-10-28");
 assert.equal(msft.timePrecision,"date");
 const google=week.find(e=>e.affectedAssets.includes("GOOGL"))!;
 assert.ok(google.scheduledAt?.endsWith("Z"));
 assert.equal(google.verificationState,"official");
 const amazon=week.find(e=>e.affectedAssets.includes("AMZN"))!;
 assert.equal(amazon.verificationState,"official");
 assert.deepEqual(selectBlueDeskEarningsWeek(calendar,new Date("2026-11-03T14:00:00Z")),[]);
});

test("provider fallback stays licence-gated; date-only events expire cleanly",async()=>{
 let fetches=0;
 const source=await getForwardEarningsEvents({now,fetchImpl:(async()=>{fetches++;throw Error("must not call unlicensed scraper")}) as typeof fetch});
 assert.equal(fetches,0);
 assert.equal(source.coverage,"official_only");
 assert.equal(source.events.filter(e=>["MSFT","GOOGL","AMZN"].some(t=>e.affectedAssets.includes(t))).length,3);
 assert.equal(officialEarningsEvents(new Date("2026-10-30T04:00:00Z")).some(e=>e.affectedAssets.includes("AMZN")),false);
});

test("Weekly view lives in existing Calendar and does not spawn newsroom pages",()=>{
 const calendar=readFileSync(new URL("../app/blue-desk/calendar/page.tsx",import.meta.url),"utf8");
 assert.match(calendar,/selectBlueDeskEarningsWeek\(calendar, now\)/);
 assert.match(calendar,/data-earnings-window=\{group\.id\}/);
 assert.match(calendar,/This US earnings week/);
 assert.match(calendar,/A conference-call/);
 assert.match(calendar,/EARNINGS HUB/);
 assert.doesNotMatch(calendar,/earningswhispers\.com\/api/);
});
