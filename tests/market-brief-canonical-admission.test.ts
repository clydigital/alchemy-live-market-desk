import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

// Guard is defined before the Jules reader is merged. Once the canonical
// market-brief projector lands, these deterministic admission tests become
// mandatory under the existing npm test / GitHub CI gate.
const path = new URL("../lib/market-brief-articles.ts", import.meta.url);
async function projector(t: { skip: (reason?: string) => void }) {
  if (!existsSync(path)) {
    t.skip("Market Brief projector not yet merged; contract gate activates with its PR");
    return null;
  }
  return import("../lib/market-brief-articles.ts");
}

test("Unverified legacy Story text cannot become a client-facing canonical article", async (t) => {
  const m = await projector(t);
  if (!m) return;
  const result = m.projectMarketBriefArticles({
    id: "edition-unverified",
    published_at: "2026-10-15T08:00:00.000Z",
    payload: {
      stories: [{
        id: "story-ai-unknown",
        title: "AI infrastructure spending",
        thesis: "Compute supply may outpace paying demand.",
        confidence: 99,
        status: "confirmed",
        assets: ["NVDA", "MSFT"],
      }],
    },
  });
  assert.deepEqual(result.articles, [], "Without canonical evidence / actual source records, no article may be admitted regardless of Story confidence");
  assert.equal(result.status, "INSUFFICIENT_DATA");
  assert.equal(result.dossierId, null, "Never infer Dossier identity from a Story or edition");
});

test("A real evidence UUID does not authorise invented reactions, mechanisms or source URLs", async (t) => {
  const m = await projector(t);
  if (!m) return;
  const evidenceId = "550e8400-e29b-41d4-a716-446655440000";
  const result = m.projectMarketBriefArticles({
    id: "edition-bounded",
    published_at: "2026-10-15T08:00:00.000Z",
    source_record_refs: ["bls:actual-cpi-release"],
    payload: {
      dossier: {
        contractVersion: "dossier-briefing/v1", // NOT a Dossier UUID
        generatedAt: "2026-10-15T08:00:00.000Z",
        lessons: [{
          storyId: "story-cpi",
          title: "September consumer prices",
          body: ["The September CPI report recorded a 0.6% monthly headline increase."],
          evidenceRefs: [evidenceId],
          confidence: 85,
        }],
      },
    },
  });
  assert.equal(result.dossierId, null, "Dossier contractVersion is not a Dossier UUID");
  for (const article of result.articles) {
    assert.equal(article.dossierId, null);
    assert.equal(article.interpretationStatus, "UNRESOLVED", "Confidence or a generic lifecycle cannot create a System 2 verdict");
    assert.ok(article.sourceLinks.every((source: { url: string }) => source.url !== "https://live.alchemymarkets.com"), "No fabricated canonical source URL");
    const body = article.paragraphs.map((p: { text: string }) => p.text).join(" ");
    assert.doesNotMatch(body, /observed price action .* reflects|recent market pricing demonstrates|institutional positioning trends|key transmission channel is anchored|confirmed if subsequent macroeconomic|key threshold levels or official policy stances reverse/i, "No generic invented market facts or forecast gates");
    assert.ok(!article.paragraphs.some((p: { role: string }) => p.role === "reaction"), "No 'observed reaction' paragraph without a source-grounded reaction field");
    assert.ok(article.paragraphs.length <= 2, "One sourced fact must not become a fabricated 6-paragraph article");
  }
});

test("Never attribute a Story-wide source list to every paragraph as proof of a claim", async (t) => {
  const m = await projector(t);
  if (!m) return;
  const result = m.projectMarketBriefArticles({
    id: "edition-two-unrelated-sources",
    published_at: "2026-10-15T08:00:00Z",
    source_record_refs: ["source:release-cpi", "source:issuer-ai"],
    payload: {
      dossier: {
        id: "a70d8b03-9e6f-4f2f-a6f7-6c44f0af3761",
        lessons: [{
          storyId: "story-one",
          title: "Consumer price index",
          body: ["The published CPI headline is recorded in source:release-cpi."],
          evidenceRefs: ["550e8400-e29b-41d4-a716-446655440000"],
        }],
      },
    },
  });
  for (const article of result.articles) {
    const allParagraphRefs = article.paragraphs.flatMap((p: { sourceRefs: string[] }) => p.sourceRefs);
    assert.ok(!allParagraphRefs.includes("source:issuer-ai"), "An unrelated company/issuer source cannot be cited to support each inflation claim");
  }
});
