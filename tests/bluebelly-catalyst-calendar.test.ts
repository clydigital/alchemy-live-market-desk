import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { projectBluebellyCatalysts, CALENDAR_GUIDE } from "../lib/bluebelly-catalyst-calendar.ts";
import { normaliseMarketEvent } from "../lib/market-events.ts";
import type { PresenterCalendarEvent } from "../lib/presenter-calendar.ts";

const macro:PresenterCalendarEvent={
  id:"macro:us-fomc",kind:"economic",title:"FOMC policy decision",status:"scheduled",
  localDate:"2026-10-28",scheduledAt:"2026-10-28T18:00:00Z",
  timeLabel:"14:00 ET",timePrecision:"exact",actual:null,consensus:null,previous:null,
  revisedPrevious:null,releasedAt:null,sourceName:"Federal Reserve",sourceUrl:"https://www.federalreserve.gov/",
  sourceRecordRefs:["fed:2026-10-28"],verificationState:"official",affectedAssets:["USD","US02Y","SPX"],
  decidingQuestion:"Does the policy path change?"
};

test("guide retains high impact, UTC, Monday-Sunday, EU and DAX display contract",()=>{
  assert.equal(CALENDAR_GUIDE.timezone,"UTC");
  assert.equal(CALENDAR_GUIDE.weekdays,7);
  assert.equal(CALENDAR_GUIDE.impact,"High");
  assert.equal(CALENDAR_GUIDE.countries.length,8);
  assert.ok(CALENDAR_GUIDE.countries.includes("Germany"));
});

test("a scheduled high impact macro is a real dated tile",()=>{
  const items=projectBluebellyCatalysts([macro],[]);
  assert.equal(items.length,1);
  assert.equal(items[0].lane,"macro");
  assert.equal(items[0].timePrecision,"exact");
  assert.equal(items[0].startAt,"2026-10-28T18:00:00Z");
  assert.equal(items[0].priority,"must_watch");
});

test("all source-confirmed Fed speeches and geopolitical meetings remain separate lanes",()=>{
  const speech=normaliseMarketEvent({
    id:"fed:test",eventType:"central_bank_speech",title:"Reserve Bank president speaks at global banking conference",
    occurrenceKey:"fed-speaks-2026-10-29",startAt:"2026-10-29",timePrecision:"date",
    timeLabel:"Time TBC",sourceName:"Federal Reserve",sourceUrl:"https://www.federalreserve.gov/newsevents/calendar.htm",
    status:"scheduled",verificationState:"official",geography:["United States"],affectedAssets:["USD","US02Y"]});
  const meeting=normaliseMarketEvent({
    id:"peace:test",eventType:"geopolitical_meeting",title:"Official ceasefire negotiations",
    occurrenceKey:"ceasefire-2026-10-31",startAt:"2026-10-31",timePrecision:"date",
    sourceName:"Government",sourceUrl:"https://www.whitehouse.gov/briefings-statements/",
    status:"scheduled",verificationState:"official",geography:["United States"],affectedAssets:["BRENT"]});
  assert.ok(speech&&meeting);
  const items=projectBluebellyCatalysts([],[speech!,meeting!]);
  assert.deepEqual(items.map(item=>item.lane),["fed","diplomacy"]);
  assert.ok(items.every(item=>item.startAt===null));
  assert.ok(items.every(item=>item.priority==="must_watch"));
});

test("an official article is monitoring-only; publication day never becomes invented event day",()=>{
  const [signal]=projectBluebellyCatalysts([],[],[{
    id:"whitehouse-1",title:"Talks on a ceasefire continue",lane:"diplomacy",
    sourceUrl:"https://www.whitehouse.gov/briefings-statements/2026/10/peace/",
    sourceName:"White House",publishedAt:"2026-10-26T14:00:00Z",
  }]);
  assert.equal(signal.signalOnly,true);
  assert.equal(signal.date,null);
  assert.equal(signal.startAt,null);
  assert.equal(signal.timePrecision,"tbc");
  assert.equal(signal.status,"monitoring");
});

test("confirmed call instant is not incorrectly labelled as earnings results release",()=>{
  const call: PresenterCalendarEvent = {
    ...macro, id:"earnings:googl",kind:"earnings",title:"Alphabet earnings",
    affectedAssets:["GOOGL"],scheduledAt:"2026-10-28T20:30:00Z",
    timeLabel:"16:30 ET earnings conference call",
  };
  const [tile]=projectBluebellyCatalysts([call],[]);
  assert.equal(tile.timePrecision,"exact");
  assert.equal(tile.callTimeOnly,true);
  const [dateOnly]=projectBluebellyCatalysts([{...call,id:"earnings:msft",scheduledAt:null,timePrecision:"date",timeLabel:"Results after US close; time TBC"}],[]);
  assert.equal(dateOnly.callTimeOnly,false);
});

test("unrelated low-value macro headlines do not fill the high impact grid",()=>{
  const r=projectBluebellyCatalysts([{...macro,id:"macro:survey",title:"Regional trucking sentiment survey"}],[]);
  assert.equal(r.length,0);
});

test("calendar retains old source disclosures while mounting interactive Catalyst Radar",()=>{
  const source=readFileSync(new URL("../app/blue-desk/calendar/page.tsx",import.meta.url),"utf8");
  assert.match(source,/<CatalystCalendar items=\{catalysts\}/);
  assert.match(source,/getBluebellyCatalystSources/);
  assert.match(source,/Detailed legacy economic and earnings source listings/);
  assert.match(source,/id="earnings-hub"/);
});
