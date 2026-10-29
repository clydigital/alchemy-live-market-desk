import test from "node:test";
import assert from "node:assert/strict";
import { selectPublicFeaturedStory, featuredStoryViews } from "../lib/bluebelly-featured-story.ts";

const approved = {
  editionId: "2026-10-29", headline: "A rate decision changes the debate",
  recap: "The central bank published its decision.",
  marketEffects: "Bond yields moved; the timing and source must be checked upstream.",
  outlook: "The next release will test whether repricing persists.",
  nextCatalyst: "The next inflation report", catalystAtEt: "2026-11-12T08:30:00-05:00",
  confirmation: "A sustained move after the next release",
  invalidation: "A reversal after fresh data",
  sourceUrls: ["https://www.federalreserve.gov/newsevents.htm"],
  evidenceStatus: "ORIGINAL_VERIFIED" as const, published: true
};
test("featured card and reader share the same edition and outlook", () => {
  const story = selectPublicFeaturedStory(approved);
  assert.ok(story);
  const views = featuredStoryViews(story!);
  assert.equal(views.card.editionId, views.reader.editionId);
  assert.equal(views.card.whatComesNext, views.reader.outlook);
  assert.equal(views.reader.sections.length, 6);
});
test("reject unverified, unpublished, incomplete and unsafe stories", () => {
  assert.equal(selectPublicFeaturedStory({...approved, published:false}), null);
  assert.equal(selectPublicFeaturedStory({...approved, evidenceStatus:"RESEARCH_LEAD"}), null);
  assert.equal(selectPublicFeaturedStory({...approved, outlook:""}), null);
  assert.equal(selectPublicFeaturedStory({...approved, sourceUrls:["javascript:alert(1)"]}), null);
  assert.equal(selectPublicFeaturedStory({...approved, catalystAtEt:"tomorrow"}), null);
});
test("do not invent a date when next catalyst time is unknown", () => {
  assert.equal(selectPublicFeaturedStory({...approved, catalystAtEt:null})?.catalystAtEt, null);
});
