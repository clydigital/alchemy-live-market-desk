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

test("Story workspace presents the quick read before collapsing original-source audits", () => {
  const view = readFileSync(new URL("../app/blue-desk/stories/[articleId]/page.tsx", import.meta.url), "utf8");
  for (const id of ["story-overview","story-observations","story-mechanisms","story-analysis","story-reaction-gap","story-watch"])
    assert.ok(view.includes('id="' + id + '"'), "Missing section anchor: " + id);
  const summary=view.indexOf('id="story-overview"');
  const article=view.indexOf('id="story-analysis"');
  const audit=view.indexOf('data-article-extra-evidence="collapsed-by-default"');
  assert.ok(summary>=0 && article>summary && audit>article);
  assert.match(view,/The bottom line/);
  assert.match(view,/What to watch:/);
  assert.match(view,/article\.editorial\.evidenceClaims\.map\(claim =>/);
  assert.match(view,/getHybridExactDailyBriefEdition\(edition\)/);
  assert.match(view,/item\.articleId === normalizedArticleId && item\.editionId === edition/);
  assert.match(view,/readerParagraphSources\(paragraph, article\.editorial\.evidenceClaims\)/);
  assert.match(view,/claim\.availableAt/);
  assert.doesNotMatch(view,/getCurrentStory|updateStory|createStory/);
});

test("read more evidence disclosure is accessible and works without JavaScript", () => {
  const css = readFileSync(new URL("../app/blue-desk/blue-desk.module.css", import.meta.url), "utf8");
  const view = readFileSync(new URL("../app/blue-desk/stories/[articleId]/page.tsx", import.meta.url), "utf8");
  assert.match(view,/<details className=\{styles\.simpleEvidenceDetails\}/);
  assert.match(view,/<summary>More detail:/);
  assert.match(css,/\.simpleEvidenceDetails>summary:focus-visible/);
});
