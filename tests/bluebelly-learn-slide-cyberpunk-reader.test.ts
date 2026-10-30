import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const reader=readFileSync("components/blue-desk/LearnSlideReader.tsx","utf8");
const css=readFileSync("app/blue-desk/learn/learn.module.css","utf8");
const lesson=readFileSync("app/blue-desk/learn/decks/[id]/page.tsx","utf8");
test("all nine original Learn decks share a slide-stage design without changing teaching content",()=>{
 assert.match(lesson,/LearnSlideReader deckId=\{record.meta.id\} slides=\{record.slides\}/);
 assert.match(reader,/data-slide-design="cyberpunk-presentation"/);
 assert.match(reader,/slides\.map\(slideCard\)/);
 assert.match(reader,/slide\.lines\.map/);
 assert.match(reader,/slide\.title/);
 assert.match(reader,/setReadAll/);
 assert.match(reader,/ArrowRight/);
 assert.match(reader,/ArrowLeft/);
 assert.match(css,/\.slideStage\{display:grid/);
 assert.match(css,/\.slideReticle\{/);
 assert.match(css,/\.slideVisualRail\{/);
 assert.match(css,/\.lessonSlide\{[^}]*aspect-ratio:16\/9/);
 assert.match(css,/@media\(max-width:730px\)/);
 for(const token of ["--bb-accent","--bb-text","--bb-muted","--bb-canvas","--bb-card-border"]){
  assert.ok(css.includes("var("+token+")"),token);
 }
 assert.doesNotMatch(reader,/supabaseAdmin|service_role|dangerouslySetInnerHTML/);
});
