import test from "node:test";
import assert from "node:assert/strict";
import { composeMarketNewsEditorial } from "../lib/intelligence/market-news-editorial.ts";
import { projectFrozenMarketNews, projectPublishedHorizon } from "../lib/presenter-published-horizon.ts";

const story = {
  storyId: "story-1", publicationSnapshotId: "snapshot-story-1", thesisVersionId: "thesis-3",
  evidenceRefs: ["ev:story"], rank: 1, headline: "Duration under pressure",
  whatChanged: "Inflation data changed the policy debate.",
  mechanism: [{ id: "edge-1", from: "Higher inflation", relationship: "raises", to: "the expected policy rate",
    evidenceIds: ["ev:mechanism"], evidenceState: "inferred" }],
  alchemyInterpretation: "Higher financing costs make earnings duration more important.",
  marketInterpretation: "The policy rate path remains sensitive to core inflation.",
  contradiction: { strongest: "Long-end rates have not yet confirmed the same pressure." },
  nextTest: { label: "Compare the next inflation release against the market path." },
};
const motion = {
  id: "motion-1", storyId: "story-1", lifecycleState: "PROMOTED", promotionEvidenceRef: "ev:motion",
  whatHappened: "The inflation print exceeded the supplied consensus.",
  headline: "Inflation surprise challenges rate expectations",
  sourceName: "Official release", sourceUrl: "https://example.gov/data",
  occurredAt: "2026-10-14T12:30:00Z", regimeSlug: "us-rates",
};

test("exact promoted Motion and immutable changed Story yield a bounded source-only article", () => {
  const packet = composeMarketNewsEditorial({ stories: [story] as never, motions: [motion] as never });
  assert.equal(packet.contractVersion, "market-news-editorial/v1");
  assert.equal(packet.articles.length, 1);
  const a = packet.articles[0];
  assert.deepEqual(a.motionIds, ["motion-1"]);
  assert.deepEqual(a.motionEvidenceRefs, ["ev:motion"]);
  assert.equal(a.thesisVersionId, "thesis-3");
  assert.equal(a.regimeRelation, "ROUTED_CONTEXT_ONLY");
  assert.equal(a.editorialStatus, "SOURCE_BOUND_DRAFT_NOT_LY_QC_APPROVED");
  assert.ok(a.paragraphs.length >= 4);
  assert.match(a.paragraphs.find((p) => p.role === "mechanism")!.text, /inferred/);
});
test("no Motion / wrong Story / uncorroborated / no Story refs fail closed", () => {
  assert.equal(composeMarketNewsEditorial({ stories: [story] as never, motions: [] }).articles.length, 0);
  assert.equal(composeMarketNewsEditorial({ stories: [story] as never,
    motions: [{ ...motion, storyId: "other" }] as never }).articles.length, 0);
  assert.equal(composeMarketNewsEditorial({ stories: [story] as never,
    motions: [{ ...motion, promotionEvidenceRef: undefined }] as never }).articles.length, 0);
  assert.equal(composeMarketNewsEditorial({ stories: [{...story, evidenceRefs: []}] as never,
    motions: [motion] as never }).articles.length, 0);
});
test("frozen presenter export verifies exact Story manifest, Motion refs and edition provenance", () => {
  const article = composeMarketNewsEditorial({ stories: [story] as never, motions: [motion] as never }).articles[0];
  const payload = {
    presenterDossierContext: {contractVersion:"presenter-dossier-edition-context/1",
      status:"BOUND", dossierId:"11111111-1111-4111-8111-111111111111", dossierAsOf:"2026-10-15T00:00:00Z"},
    canonicalStoryManifest: [{storyId:story.storyId,snapshotId:story.publicationSnapshotId,
      thesisVersionId:story.thesisVersionId}],
    marketMotion: {contractVersion:"market-motion-edition/v1",items:[motion]},
    journey: {contractVersion:"journey-briefing/v1",
      horizon: {today:[],tonight:[],later:[]},
      marketNews: { contractVersion: "market-news-editorial/v1",articles:[article] }},
  };
  assert.equal(projectFrozenMarketNews(payload)?.articles.length, 1);
  const published = projectPublishedHorizon({id:"edition-a", published_at:"2026-10-15T01:00:00Z",payload}, "2026-10-16T01:00:00Z");
  assert.equal(published.status,"AVAILABLE");
  assert.equal(published.editionId,"edition-a");
  assert.equal(published.marketNews?.articles.length,1);
  const wrongMotion = structuredClone(payload);
  wrongMotion.marketMotion.items[0].promotionEvidenceRef = "ev:other";
  assert.equal(projectFrozenMarketNews(wrongMotion)?.articles.length,0);
  const wrongStory = structuredClone(payload);
  wrongStory.canonicalStoryManifest[0].thesisVersionId = "thesis-other";
  assert.equal(projectFrozenMarketNews(wrongStory)?.articles.length,0);
});
