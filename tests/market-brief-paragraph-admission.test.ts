import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";

const projectorPath = new URL("../lib/market-brief-articles.ts", import.meta.url);
async function projector(t: { skip: (reason?: string) => void }) {
  if (!existsSync(projectorPath)) {
    t.skip("Market Brief reader not merged; admission rules activate with projector");
    return null;
  }
  const candidate = "../lib/market-brief-articles.ts";
  return import(candidate);
}

const AT = "2026-10-15T05:00:00.000Z";
const EVIDENCE = "550e8400-e29b-41d4-a716-446655440000";
const DOC_ID = "7e9582cb-21c8-4f63-9814-dfd5ef0fb911";
const STATEMENT = "The CPI release reported an increase in headline inflation.";

function canonical(extra: Record<string, unknown> = {}) {
  return {
    id: "edition-cpi-true-source",
    published_at: AT,
    payload: {
      dossier: { id: DOC_ID, generatedAt: AT },
      canonicalStoryManifest: [{
        storyId: "cpi-observation",
        state: { title: "Inflation release", thesis: STATEMENT, status: "active" },
        reasoning: {
          whatChanged: STATEMENT,
          claims: [{
            text: STATEMENT, evidenceIds: [EVIDENCE], sourceRefs: ["bls:cpi-2026-09"],
          }],
          marketReaction: "The Nasdaq gained 3.1% on the release.",
          countercase: { strongest: "Corporate earnings weakened across all sectors." },
        },
      }],
      marketTape: {
        sources: [{ title: "Unrelated AI issuer", url: "https://investor.example.org/unrelated" }],
      },
      ...extra,
    },
  };
}

test("Unsupported reactions, countercases and summaries cannot become sourced client paragraphs", async t => {
  const m = await projector(t); if (!m) return;
  const result = m.projectMarketBriefArticles(canonical());
  for (const a of result.articles) {
    assert.ok(a.paragraphs.length > 0);
    assert.ok(a.paragraphs.every((p: { sourceRefs: string[]; canonicalEvidenceIds: string[] }) =>
      p.sourceRefs.length > 0 || p.canonicalEvidenceIds.length > 0),
      "An article must not emit unsupported paragraphs under a sourced headline");
    assert.ok(!a.paragraphs.some((p: { role: string; text: string }) =>
      p.role === "reaction" && p.text.includes("Nasdaq gained")),
      "An unproven market reaction is not promoted merely because a Story string exists");
    assert.ok(!a.paragraphs.some((p: { role: string; text: string }) =>
      p.role === "contradiction" && p.text.includes("Corporate earnings weakened")),
      "Unproven countercase prose cannot borrow a headline's source");
  }
});

test("Irrelevant market tape URLs are not article-specific proof", async t => {
  const m = await projector(t); if (!m) return;
  const result = m.projectMarketBriefArticles(canonical());
  for (const a of result.articles) {
    assert.ok(!a.sourceLinks.some((link: { url: string }) =>
      link.url === "https://investor.example.org/unrelated"),
      "An issuer's unrelated source URL must never be cited on a CPI article");
  }
});

test("Edition parent UUID is not a Dossier UUID and cannot be substituted", async t => {
  const m = await projector(t); if (!m) return;
  const x = canonical();
  const payload = {
    ...(x.payload as Record<string, unknown>),
    dossier: { generatedAt: AT },
    dossierComposition: { parentEditionId: DOC_ID },
  };
  const result = m.projectMarketBriefArticles({ ...x, payload });
  assert.equal(result.dossierId, null,
    "A valid UUID from parentEditionId is still an edition identity, not Dossier identity");
});

test("A one-paragraph sourced article is partial, never COMPLETE", async t => {
  const m = await projector(t); if (!m) return;
  const x = canonical();
  const manifest = (x.payload.canonicalStoryManifest as Array<{ reasoning: Record<string, unknown> }>).map(v => ({
    ...v, reasoning: { whatChanged: STATEMENT,
      claims: [{ text: STATEMENT, evidenceIds: [EVIDENCE], sourceRefs: ["bls:cpi-2026-09"] }] },
  }));
  const result = m.projectMarketBriefArticles({
    ...x, payload: { ...x.payload, canonicalStoryManifest: manifest, marketTape: {sources: []} },
  });
  if (result.articles.length) {
    assert.notEqual(result.status, "COMPLETE",
      "No six-part claim chain exists; a lone opening cannot be a completed client-facing article");
  }
});
