import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {reviewSourceOverlap} from "../lib/blue-desk-originality-review.ts";

const copied="A prolonged disruption of refined product shipments could raise transport costs and feed through to the household inflation rate over time.";
test("detects extended near-verbatim source language while preserving original analyst explanation",()=>{
 const source="Research note: "+copied+" Independent source document needs review.";
 const duplicate=reviewSourceOverlap("Here is a headline. "+copied,source);
 assert.equal(duplicate.status,"REVIEW_SOURCE_OVERLAP");
 assert.ok(duplicate.longestMatchedWords>=12);
 const original=reviewSourceOverlap(
  "More expensive diesel can push delivery bills higher. If that happens repeatedly, retail prices may eventually respond.",
  source);
 assert.equal(original.status,"NO_LONG_EXACT_OVERLAP_DETECTED");
 assert.match(original.note,/does not search the internet/);
});
test("private model returns originality warning and private article Studio displays it without claiming plagiarism clearance",()=>{
 const route=readFileSync(new URL("../app/api/owner/editorial-generate/route.ts",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../components/blue-desk/DailyArticleStudio.tsx",import.meta.url),"utf8");
 assert.match(route,/reviewSourceOverlap\(draft,packet\)/);
 assert.match(ui,/REVIEW_SOURCE_OVERLAP/);
 assert.match(ui,/Rewrite and review the source before use/);
});
