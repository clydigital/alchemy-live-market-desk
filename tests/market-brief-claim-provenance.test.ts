import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

/**
 * Independent acceptance tests for the client-facing Market Brief projector.
 * The tests intentionally activate when Jules's projection file is present.
 * A build passing merely because an evidence-free article was not generated is
 * not sufficient proof that emitted paragraphs have claim-specific provenance.
 */
const path = new URL("../lib/market-brief-articles.ts", import.meta.url);
async function projector(t: { skip: (reason?: string) => void }) {
  if (!existsSync(path)) {
    t.skip("Market Brief projection is not merged; this guard activates once installed");
    return null;
  }
  const candidatePath = "../lib/market-brief-articles.ts";
  return import(candidatePath);
}

const DOSSIER_ID = "7e9582cb-21c8-4f63-9814-dfd5ef0fb911";
const CPI_EVIDENCE = "550e8400-e29b-41d4-a716-446655440000";
const YIELDS_EVIDENCE = "553d83d5-293d-42c9-96d8-e4cf442744e7";
const at = "2026-10-15T05:30:00.000Z";

function publication(
  reasoning: Record<string, unknown>,
  extraState: Record<string, unknown> = {},
  extra: Record<string, unknown> = {},
) {
  return {
    id: "edition-claim-provenance",
    published_at: at,
    source_record_refs: ["source:cpi-release", "source:issuer-ai", "source:yields-tape"],
    payload: {
      dossier: { id: DOSSIER_ID, generatedAt: at },
      canonicalStoryManifest: [{
        storyId: "story-cpi-ai",
        state: {
          title: "US inflation and the Treasury curve",
          thesis: "Headline CPI surprised above forecast.",
          confidence: 97,
          status: "confirmed",
          ...extraState,
        },
        reasoning,
      }],
      ...extra,
    },
  };
}

test("High confidence and accepted prose cannot independently invent SUPPORTED System 2 status", async (t) => {
  const m = await projector(t);
  if (!m) return;
  const out = m.projectMarketBriefArticles(publication({
    acceptedExplanation: "The CPI surprise may affect short-end yields.",
    claims: [{
      text: "Headline CPI surprised above forecast.",
      evidenceIds: [CPI_EVIDENCE],
      sourceRefs: ["source:cpi-release"],
    }],
  }));
  for (const article of out.articles) {
    assert.equal(article.interpretationStatus, "UNRESOLVED",
      "A confidence threshold is not an accepted Dossier adjudication");
  }
});

test("Evidence source tokens resembling Story title or ID are not proof of a claim", async (t) => {
  const m = await projector(t);
  if (!m) return;
  const out = m.projectMarketBriefArticles(publication({
    whatChanged: "Headline CPI surprised above forecast.",
    claims: [{
      text: "Headline CPI surprised above forecast.",
      evidenceIds: [CPI_EVIDENCE],
      sourceRefs: ["source:cpi-release"],
    }],
  }));
  for (const a of out.articles) {
    for (const p of a.paragraphs) {
      assert.ok(!p.sourceRefs.includes("source:issuer-ai"),
        "Lexical 'ai' match to Story slug must never attach unrelated issuer evidence to CPI");
    }
  }
});

test("Claim-specific evidence may not be copied indiscriminately across paragraphs", async (t) => {
  const m = await projector(t);
  if (!m) return;
  const out = m.projectMarketBriefArticles(publication({
    whatChanged: "Headline CPI surprised above forecast.",
    marketReaction: "The observed two-year Treasury yield rose 9 basis points.",
    claims: [
      { text: "Headline CPI surprised above forecast.", evidenceIds: [CPI_EVIDENCE], sourceRefs: ["source:cpi-release"] },
      { text: "The observed two-year Treasury yield rose 9 basis points.", evidenceIds: [YIELDS_EVIDENCE], sourceRefs: ["source:yields-tape"] },
    ],
  }));
  for (const a of out.articles) {
    const opening = a.paragraphs.find((p: { role: string }) => p.role === "opening");
    const reaction = a.paragraphs.find((p: { role: string }) => p.role === "reaction");
    if (opening) {
      assert.ok(!opening.canonicalEvidenceIds.includes(YIELDS_EVIDENCE),
        "A CPI paragraph cannot inherit the unrelated yield-reaction evidence UUID");
    }
    if (reaction) {
      assert.ok(!reaction.canonicalEvidenceIds.includes(CPI_EVIDENCE),
        "A yield-reaction paragraph cannot inherit the unrelated CPI evidence UUID");
    }
  }
});

test("Arbitrary dossier-prefixed strings are not exact canonical Dossier UUID identities", async (t) => {
  const m = await projector(t);
  if (!m) return;
  const out = m.projectMarketBriefArticles({
    ...publication({ claims: [{ text: "CPI headline rose.", evidenceIds: [CPI_EVIDENCE], sourceRefs: ["source:cpi-release"] }] }),
    payload: {
      dossier: { id: "dossier-not-a-canonical-uuid", generatedAt: at },
      stories: [{ id: "story-cpi-ai", title: "CPI headline", thesis: "CPI headline rose.", confidence: 99 }],
    },
  });
  assert.equal(out.dossierId, null, "Only an actual validated Dossier identity can populate dossierId");
});

test("One persisted confirmation condition cannot manufacture an invalidation trigger", async (t) => {
  const m = await projector(t);
  if (!m) return;
  const out = m.projectMarketBriefArticles(publication(
    {
      whatChanged: "Headline CPI surprised above forecast.",
      claims: [{
        text: "Headline CPI surprised above forecast.",
        evidenceIds: [CPI_EVIDENCE],
        sourceRefs: ["source:cpi-release"],
      }],
    },
    { confirmationCondition: "Two consecutive inflation releases confirm the direction" },
  ));
  for (const a of out.articles) {
    assert.doesNotMatch(a.conditionalOutlook, /reversal in underlying catalyst|continued alignment/i,
      "An absent invalidation cannot be back-filled with template market conditions");
  }
});
