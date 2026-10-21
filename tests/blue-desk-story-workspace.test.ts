import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { blueDeskStorySections } from "../lib/blue-desk-story-sections.ts";

test("Story navigation exposes only sections populated by exact frozen evidence", () => {
  const ids = blueDeskStorySections({
    originalObservations: 2, causalLinks: 1, narrativeBlocks: 4,
    missingVerifiedReaction: false, watchAvailable: true,
  }).map(item => item.id);
  assert.deepEqual(ids, [
    "story-overview", "story-observations", "story-mechanisms",
    "story-analysis", "story-watch", "story-evidence",
  ]);
  assert.equal(new Set(ids).size, ids.length);
});

test("quiet or depleted evidence still supplies status, missing reaction, and no invented tabs", () => {
  const items = blueDeskStorySections({
    originalObservations: 0, causalLinks: 0, narrativeBlocks: 0,
    missingVerifiedReaction: true, watchAvailable: false,
  });
  assert.deepEqual(items.map(section => section.id),
    ["story-overview", "story-reaction-gap", "story-evidence"]);
  assert.ok(items.every(section => section.label && section.id.startsWith("story-")));
});

test("V6 Story workspace binds every visible jump to an anchored, provenance-aware section", () => {
  const view = readFileSync(new URL("../app/blue-desk/stories/[articleId]/page.tsx", import.meta.url), "utf8");
  const ids = [
    "story-overview", "story-observations", "story-mechanisms",
    "story-analysis", "story-reaction-gap", "story-watch", "story-evidence",
  ];
  for (const id of ids) {
    assert.ok(view.includes('id="' + id + '"'), "Missing section anchor: " + id);
  }
  assert.match(view, /blueDeskStorySections\(\{/);
  assert.match(view, /originalObservations: article\.editorial\.evidenceClaims\.length/);
  assert.match(view, /causalLinks: article\.editorial\.causalLinks\.length/);
  assert.match(view, /missingVerifiedReaction: !verifiedReaction/);
  assert.match(view, /watchAvailable: hasStructuredWatch \|\| Boolean\(article\.conditionalOutlook\)/);
  assert.match(view, /navigation\.map\(section =>/);
  assert.match(view, /aria-label="Navigate this Story"/);
  // No new mutable state, current Dossier, Story, or source record is spliced into an old publication.
  assert.match(view, /getHybridExactDailyBriefEdition\(edition\)/);
  assert.match(view, /item\.articleId === normalizedArticleId && item\.editionId === edition/);
  assert.match(view, /readerParagraphSources\(paragraph, article\.editorial\.evidenceClaims\)/);
  assert.match(view, /claim\.availableAt/); // optional timing is displayed when recorded
  assert.doesNotMatch(view, /getCurrentStory|updateStory|createStory/);
});

test("responsive jump navigation is keyboard focusable, scrollable, and does not require JavaScript", () => {
  const css = readFileSync(new URL("../app/blue-desk/blue-desk.module.css", import.meta.url), "utf8");
  assert.match(css, /\.storyJumpNav\s*\{/);
  assert.match(css, /overflow-x:\s*auto/);
  assert.match(css, /\.storyJumpLink:hover,\.storyJumpLink:focus-visible/);
  assert.match(css, /scroll-margin-top:/);
});


test("V7 opening reads like an article while edition diagnostics remain one keyboard-accessible disclosure", () => {
  const view = readFileSync(new URL("../app/blue-desk/stories/[articleId]/page.tsx", import.meta.url), "utf8");
  const sheet = readFileSync(new URL("../app/blue-desk/stories/[articleId]/editorial-read.module.css", import.meta.url), "utf8");
  const openingStart = view.indexOf('<section id="story-overview"');
  const openingEnd = view.indexOf('</section>', openingStart);
  assert.ok(openingStart >= 0 && openingEnd > openingStart);
  const opening = view.slice(openingStart, openingEnd);
  assert.match(opening, /What this report establishes/);
  assert.match(opening, /article\.interpretationStatus === "UNRESOLVED"/);
  assert.match(opening, /no independently[\s\S]*?source-linked price, yield or futures response/);
  assert.match(opening, /article\.editorial\.evidenceClaims\.length/);
  assert.match(opening, /href="#story-observations"/);
  assert.match(opening, /href="#story-evidence"/);
  assert.doesNotMatch(opening, /storyMetricGrid|<dl\b|<dt\b|<dd\b|\.length\}<\/strong>|article\.editionId|dossierId/);
  assert.doesNotMatch(view.slice(view.indexOf("<header"), openingStart), /Edition \{article\.editionId\}/);

  const evidenceStart = view.indexOf('<section id="story-evidence"');
  const evidenceEnd = view.indexOf('</section>', evidenceStart);
  assert.ok(evidenceStart >= 0 && evidenceEnd > evidenceStart);
  const evidence = view.slice(evidenceStart, evidenceEnd);
  const detailsStart = evidence.indexOf('<details className={reader.transparencyDetails}>');
  const detailsEnd = evidence.indexOf('</details>');
  assert.ok(detailsStart > 0 && detailsEnd > detailsStart);
  const details = evidence.slice(detailsStart, detailsEnd);
  assert.match(details, /<summary>Evidence checks and publication record<\/summary>/);
  assert.match(details, /Original-source observations[\s\S]*?article\.editorial\.evidenceClaims\.length/);
  assert.match(details, /Evidence-linked mechanism steps[\s\S]*?article\.editorial\.causalLinks\.length/);
  assert.match(details, /verifiedReaction \? "Source-linked" : "Not verified"/);
  assert.match(details, /article\.interpretationStatus/);
  assert.match(details, /article\.editionId/);
  assert.match(details, /DualTimestamp value=\{frozen\.published_at\}/);
  assert.match(details, /article\.dossierId \?/);
  assert.doesNotMatch(view, /<h2>Publication<\/h2>/);
  assert.match(evidence.slice(0, detailsStart), /claim\.evidenceId/);
  assert.match(evidence.slice(0, detailsStart), /claim\.availableAt/);
  assert.match(evidence.slice(0, detailsStart), /href=\{claim\.sourceUrl\}/);
  assert.match(sheet, /\.transparencyDetails summary:focus-visible/);
  assert.match(sheet, /@media \(max-width: 560px\)/);
  assert.match(sheet, /prefers-reduced-motion:\s*reduce/);
  // Citation and verdict boundaries remain visible without expanding details.
  assert.ok(view.indexOf('id="story-reaction-gap"') < evidenceStart);
  assert.match(view, /readerParagraphSources\(paragraph, article\.editorial\.evidenceClaims\)/);
});

test("V7 reader cannot silently switch from pinned Story to today's mutable publication", () => {
  const view = readFileSync(new URL("../app/blue-desk/stories/[articleId]/page.tsx", import.meta.url), "utf8");
  assert.match(view, /typeof edition !== "string" \|\| !uuidPattern\.test\(edition\)/);
  assert.match(view, /articlePrefix = \`article:\$\{edition\}:\`/);
  assert.match(view, /getHybridExactDailyBriefEdition\(edition\)/);
  assert.match(view, /if \(!frozen\) notFound\(\)/);
  assert.match(view, /item\.articleId === normalizedArticleId && item\.editionId === edition/);
  assert.match(view, /if \(!article\) notFound\(\)/);
  assert.doesNotMatch(view, /getCurrentStory|createStory|updateStory|getLiveDeskHomepageDailyBrief|getMarketMonitor/);
});
