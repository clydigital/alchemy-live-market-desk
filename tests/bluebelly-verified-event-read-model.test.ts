import test from "node:test";
import assert from "node:assert/strict";
import {projectVerifiedMarketEvents,VERIFIED_EVENT_CONTRACT} from "../lib/bluebelly-verified-event-read-model.ts";
import type {NewsBriefV1} from "../lib/market-brief-news.ts";

const now=new Date("2026-11-06T00:00:00.000Z");
const event=(overrides:Partial<NewsBriefV1>={}):NewsBriefV1=>({
  contractVersion:"news-brief/1",contentType:"NEWS_BRIEF",
  id:"a0b1c2d3-1111-4444-9999-123456789012",
  headline:"Issuer announces a material financing agreement",
  summary:"Original issuer announcement reports a new financing agreement; reaction is not established.",
  sourceName:"Official issuer IR",sourceUrl:"https://investors.example.org/news/announcement",
  sourceKind:"primary",occurredAt:"2026-11-05T15:00:00.000Z",
  observedAt:"2026-11-05T17:00:00.000Z",
  verification:"SOURCE_VERIFIED",
  ...overrides,
});
test("same verified original source is one stable event independent of ingestion record ID",()=>{
  const items=[event(),event({
    id:"a0b1c2d3-2222-4444-9999-123456789012",
    sourceUrl:"https://investors.example.org/news/announcement/?utm_source=news",
  })];
  const result=projectVerifiedMarketEvents(items,now);
  assert.equal(result.contractVersion,VERIFIED_EVENT_CONTRACT);
  assert.equal(result.status,"SOURCE_DATED");
  assert.equal(result.events.length,1);
  assert.match(result.events[0].eventKey,/^event:[0-9a-f]{24}$/);
  assert.equal(result.events[0].freshness,"CURRENT_48H");
  assert.deepEqual(result.events[0].marketReaction,{status:"NOT_VERIFIED",value:null});
  assert.equal(result.events[0].researchInterpretation,null);
  assert.equal(result.events[0].affectedAssets,null);
});
test("historical qualified events are labelled, not passed off as current",()=>{
  const eventTime="2026-11-01T08:00:00.000Z";
  const result=projectVerifiedMarketEvents([event({occurredAt:eventTime,observedAt:"2026-11-02T00:00:00.000Z"})],now,
    {since:"2026-10-31T00:00:00.000Z"});
  assert.equal(result.events.length,1);
  assert.equal(result.events[0].freshness,"OLDER_7D");
  assert.equal(result.events[0].occurredAt,eventTime);
});
test("invalid and future timestamps or nonqualified inputs cannot enter the projection",()=>{
  const attempts:NewsBriefV1[]=[
    event({sourceUrl:"http://investors.example.org/news/announcement"}),
    event({sourceKind:"creator"}),
    event({occurredAt:"2026-11-07T00:00:00Z"}),
    event({observedAt:"2026-11-05T13:00:00Z"}),
    event({occurredAt:"2026-10-28T00:00:00Z",observedAt:"2026-10-28T02:00:00Z"}),
    event({sourceUrl:"https://localhost/issuer"}),
  ];
  assert.equal(projectVerifiedMarketEvents(attempts,now,{since:"2026-10-30T00:00:00Z"}).events.length,0);
});
test("failed source readers are reported as degraded; no events is not a green coverage verdict",()=>{
  const reads={motion:"UNAVAILABLE" as const,originalPress:"READABLE" as const,officialMacro:"UNAVAILABLE" as const};
  const partial=projectVerifiedMarketEvents([],now,{sourceReads:reads});
  assert.equal(partial.status,"DEGRADED");
  assert.equal(partial.count,0);
  const down=projectVerifiedMarketEvents([],now,{sourceReads:{
    motion:"UNAVAILABLE",originalPress:"UNAVAILABLE",officialMacro:"UNAVAILABLE",
  }});
  assert.equal(down.status,"UNAVAILABLE");
  const quiet=projectVerifiedMarketEvents([],now);
  assert.equal(quiet.status,"NO_QUALIFIED_EVENTS");
});
test("cursor cannot show future or older than seven days; limit clamps",()=>{
  assert.throws(()=>projectVerifiedMarketEvents([],now,{since:"2026-10-20T00:00:00Z"}));
  assert.throws(()=>projectVerifiedMarketEvents([],now,{since:"2026-11-07T00:00:00Z"}));
  const items=Array.from({length:25},(_,i)=>event({
    id:"a0b1c2d3-1111-4444-9999-"+String(i).padStart(12,"0"),
    sourceUrl:"https://investors.example.org/news/story-"+i,
  }));
  assert.equal(projectVerifiedMarketEvents(items,now,{limit:99}).events.length,18);
});
