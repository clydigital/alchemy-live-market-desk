import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { BLUEBELLY_ORIGINAL_PPTX, getOriginalLearnPptx } from "../lib/bluebelly-learn-pptx.ts";

const lesson = readFileSync("app/blue-desk/learn/decks/[id]/page.tsx","utf8");
const reader = readFileSync("components/blue-desk/LearnOriginalPptxViewer.tsx","utf8");
const home = readFileSync("app/blue-desk/learn/page.tsx","utf8");

test("all nine Learn routes render the actual original PPTX rather than re-created slide HTML",()=>{
  assert.match(lesson,/LearnOriginalPptxViewer/);
  assert.doesNotMatch(lesson,/<LearnSlideReader/);
  assert.match(reader,/view.officeapps.live.com|viewerUrl/);
  assert.match(reader,/<iframe/);
  assert.match(reader,/fullScreenUrl/);
  assert.match(reader,/sourceUrl/);
  assert.doesNotMatch(reader,/slide\.lines\.map|slides\.map|dangerouslySetInnerHTML/);
  assert.match(home,/ORIGINAL PPTX SLIDES/);
  for(const id of Object.keys(BLUEBELLY_ORIGINAL_PPTX)){
    const deck=getOriginalLearnPptx(id);
    assert.ok(deck && deck.filename.endsWith(".pptx"));
    assert.ok(deck?.viewerUrl.includes("view.officeapps.live.com"));
    assert.ok(deck?.sourceUrl.includes("raw.githubusercontent.com"));
  }
});

test("RELEASE GATE: all nine unchanged original PowerPoint binaries must be Git-tracked before merge",()=>{
  // Do NOT replace these with rendered PDFs or JSON text just to satisfy CI.
  for(const filename of Object.values(BLUEBELLY_ORIGINAL_PPTX)){
    const path="public/bluebelly/learn/original/"+filename;
    assert.ok(existsSync(path),"Missing exact original PowerPoint: "+path);
    assert.ok(statSync(path).size>100_000,"Unexpectedly small PowerPoint; inspect original: "+path);
  }
});
