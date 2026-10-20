import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { readerParagraphSources, readerVerifiedReaction } from "../lib/blue-desk-reader-evidence.ts";
import type { MarketBriefParagraphV1 } from "../lib/market-brief-articles.ts";
import type { EditorialArticle } from "../lib/market-brief-editorial.ts";

type Claim = EditorialArticle["editorial"]["evidenceClaims"][number];
const id1 = "e41e3ff2-65a4-4429-866f-08b6648ebabd";
const id2 = "cf1ecffd-b6f1-4431-bd34-a54657251b9e";
const claims: Claim[] = [
  { evidenceId: id1, claimText: "TSMC reported Q3 issuer results.",
    evidenceClass: "company_primary", sourceName: "TSMC",
    sourceUrl: "https://pr.tsmc.com/english/news/3346", availableAt: "2026-10-15T00:00:00Z" },
  { evidenceId: id2, claimText: "CoreWeave reported capital expenditure.",
    evidenceClass: "company_primary", sourceName: "CoreWeave",
    sourceUrl: "https://investors.coreweave.com/news/news-details/2026/quarterly-results",
    availableAt: "2026-08-11T00:00:00Z" },
];
const paragraph = (role: MarketBriefParagraphV1["role"], evidenceScope: "claim" | "lesson",
  refs: string[]): MarketBriefParagraphV1 => ({
  role, evidenceScope, text: "Source-grounded example", canonicalEvidenceIds: refs, sourceRefs: [],
});

test("only IDs attached to an explicit upstream claim link original primary records", () => {
  assert.deepEqual(readerParagraphSources(paragraph("opening", "claim", [id1]), claims).map(x => x.evidenceId), [id1]);
  assert.deepEqual(readerParagraphSources(paragraph("mechanism", "claim", [id2.toUpperCase()]), claims).map(x => x.evidenceId), [id2]);
  assert.deepEqual(readerParagraphSources(paragraph("mechanism", "lesson", [id1, id2]), claims), [],
    "A pooled Dossier source packet is never a citation for an individual sentence");
  assert.deepEqual(readerParagraphSources(paragraph("opening", "claim", ["ffffffff-ffff-ffff-ffff-ffffffffffff"]), claims), []);
  assert.equal(readerParagraphSources(paragraph("opening", "claim", [id1, id1]), claims).length, 1);
});

test("unverified price-response text is not admitted as a factual market reaction", () => {
  assert.equal(readerVerifiedReaction([paragraph("reaction", "lesson", [id1])], claims), false);
  assert.equal(readerVerifiedReaction([paragraph("reaction", "claim", [id2])], []), false);
  assert.equal(readerVerifiedReaction([paragraph("mechanism", "claim", [id2])], claims), false);
  assert.equal(readerVerifiedReaction([paragraph("reaction", "claim", [id1])], claims), true);
});

test("public Deep Dive links exact-source paragraphs and explicitly names missing price-response evidence", () => {
  const view = readFileSync(new URL("../app/blue-desk/stories/[articleId]/page.tsx", import.meta.url), "utf8");
  assert.match(view, /readerParagraphSources\(paragraph, article\.editorial\.evidenceClaims\)/);
  assert.match(view, /p\.role !== "reaction"/);
  assert.match(view, /!verifiedReaction/);
  assert.match(view, /No independently source-linked price, yield or futures reaction is available/);
  assert.match(view, /article\.editorial\.causalLinks\.length/);
  assert.match(view, /getHybridExactDailyBriefEdition\(edition\)/);
});
