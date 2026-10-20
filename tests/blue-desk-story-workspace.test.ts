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
