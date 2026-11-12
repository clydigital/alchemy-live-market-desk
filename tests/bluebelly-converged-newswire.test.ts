import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyNewsroomTopics, rankConvergedNewswire, type ResearchLead,
} from "../lib/bluebelly-converged-newswire.ts";

const now = new Date("2026-10-28T12:00:00Z");
function make(overrides: Partial<ResearchLead> = {}): ResearchLead {
  return {
    sourceId: "item-1", eventKey: "event-1",
    headline: "Federal Reserve confirms new bond purchase guidance",
    summary: "The central bank published a statement about Treasury purchases.",
    sourceName: "Federal Reserve",
    sourceUrl: "https://www.federalreserve.gov/newsevents/pressreleases/monetary2026.htm",
    source: "official", verification: "ORIGINAL_VERIFIED",
    publishedAt: "2026-10-28T10:00:00Z", observedAt: "2026-10-28T10:10:00Z",
    development: "NEW", materiality: 90, urgency: "FLASH", ...overrides,
  };
}
test("important sourced news first, original provenance and topic hints", () => {
  const low = make({
    sourceId:"minor",eventKey:"minor",headline:"Company earnings preview",
    summary:"Issuer provides an upcoming quarterly results date.",
    materiality:20,urgency:"NORMAL",publishedAt:"2026-10-27T09:00:00Z",
    observedAt:"2026-10-27T09:10:00Z",
  });
  const result = rankConvergedNewswire([low,make()],now);
  assert.equal(result[0].eventKey,"event-1");
  assert.equal(result[0].attention,"BREAKING");
  assert.deepEqual(result[0].topics,["rates-bonds"]);
  assert.deepEqual(result[0].regimeRouteHints,["rates-bonds-funding"]);
  assert.equal(result[0].routing,"ELIGIBLE_FOR_EXISTING_PUBLIC_VERIFICATION_GATE");
  assert.equal(result[0].primary.sourceUrl,make().sourceUrl);
  assert.equal("canonicalState" in result[0],false);
  assert.equal("priceReaction" in result[0],false);
});
test("high-interest X rumour stays owner-only and never counts as fact", () => {
  const x = make({
    sourceId:"x-1",eventKey:"x-1",
    headline:"Rumoured AI takeover financing from private credit",
    summary:"An attributed social post alleges a new financing arrangement; its terms have not been verified.",
    source:"x-post",sourceName:"Named X account",
    sourceUrl:"https://x.com/SomeAccount/status/1234567890123456789",
    verification:"ATTRIBUTED_RUMOUR",materiality:100,urgency:"FLASH",
  });
  const r = rankConvergedNewswire([x],now)[0];
  assert.equal(r.routing,"OWNER_LEAD_ONLY");
  assert.ok(r.topics.includes("ai-technology"));
  assert.ok(r.topics.includes("rates-bonds"));
  assert.equal(r.attention,"BREAKING");
  assert.equal(r.regimeCandidates.length,0);
});
test("creator interpretation may challenge a thesis but cannot prove or mutate it", () => {
  const video = make({
    sourceId:"video-1",eventKey:"video-1",headline:"AI chip financing debate",
    source:"creator-transcript",verification:"CREATOR_INTERPRETATION",
    sourceName:"StockedUp",sourceUrl:"https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    analystRegimeCandidates:[{
      regime:"ai-bubble",effect:"CHALLENGE",
      evidenceRequired:"Quarterly cash flow and financing terms from issuer filing",
    }],
  });
  const r = rankConvergedNewswire([video],now)[0];
  assert.equal(r.routing,"OWNER_LEAD_ONLY");
  assert.equal(r.regimeCandidates[0].effect,"CHALLENGE");
  assert.equal("regimeCurrent" in r,false);
  assert.equal("canonicalEvidenceId" in r,false);
});
test("a material unrelated story stays OTHER, no forced regime link", () => {
  const story = make({
    headline:"Regional earthquake damages homes",
    summary:"Authorities are assessing damage in the affected districts.",
    sourceName:"Public authority",
  });
  const r = rankConvergedNewswire([story],now)[0];
  assert.deepEqual(r.topics,["other"]);
  assert.deepEqual(r.regimeRouteHints,[]);
});
test("only explicit upstream event identity deduplicates; conflicts are retained", () => {
  const disputed = make({
    sourceId:"x-2",eventKey:"event-1",
    source:"x-post",verification:"ATTRIBUTED_RUMOUR",
    sourceName:"Outside claim",
    sourceUrl:"https://x.com/SomeAccount/status/1234567890123456789",
    development:"DENIED_OR_CORRECTED",
  });
  const r = rankConvergedNewswire([make(),disputed],now)[0];
  assert.deepEqual(r.sourceIds.sort(),["item-1","x-2"]);
  assert.equal(r.conflicts,true);
  assert.equal(r.routing,"OWNER_LEAD_ONLY");
  assert.equal(r.originalUrls.length,2);
});
test("future/stale/inverted/unsafe/mislabelled source records are rejected", () => {
  const inputs = [
    make({sourceId:"future",eventKey:"future",publishedAt:"2026-10-29T12:00:00Z",observedAt:"2026-10-29T12:00:00Z"}),
    make({sourceId:"old",eventKey:"old",publishedAt:"2026-10-11T12:00:00Z",observedAt:"2026-10-11T12:00:00Z"}),
    make({sourceId:"clock",eventKey:"clock",observedAt:"2026-10-27T12:00:00Z"}),
    make({sourceId:"url",eventKey:"url",sourceUrl:"http://example.org/story"}),
    make({sourceId:"creator-fact",eventKey:"creator-fact",source:"creator-transcript"}),
    make({sourceId:"valid",eventKey:"valid"}),
  ];
  assert.deepEqual(rankConvergedNewswire(inputs,now).map(v=>v.eventKey),["valid"]);
  assert.equal(rankConvergedNewswire([make()],new Date("invalid")).length,0);
});
test("cross-topic classification is routing only, not causality", () => {
  assert.deepEqual(classifyNewsroomTopics("Oil and AI chip capex influence Treasury yields"),[
    "ai-technology","rates-bonds","energy-geopolitics","equities-corporate",
  ]);
});
