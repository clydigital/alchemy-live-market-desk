import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { listConcepts } from "../lib/concepts.ts";
import { assembleLearnGlossary, LEARN_GLOSSARY_ADDITIONS } from "../lib/bluebelly-learn-glossary.ts";
import { BLUEBELLY_LEARN_RESOURCES } from "../lib/bluebelly-learn-resources.ts";

test("public Learn links 13 publisher resources across all three tracks",()=>{
  assert.equal(BLUEBELLY_LEARN_RESOURCES.length,13);
  assert.equal(new Set(BLUEBELLY_LEARN_RESOURCES.map((r)=>r.id)).size,13);
  assert.equal(new Set(BLUEBELLY_LEARN_RESOURCES.map((r)=>r.track)).size,3);
  const concepts=assembleLearnGlossary(listConcepts());
  for(const resource of BLUEBELLY_LEARN_RESOURCES){
    assert.match(resource.url,/^https:\/\//);
    for(const key of resource.concepts)
      assert.ok(concepts.some((term)=>term.key===key),"Unknown resource glossary term "+key);
  }
  const page=readFileSync("app/blue-desk/learn/page.tsx","utf8");
  assert.match(page,/BLUEBELLY_LEARN_RESOURCES/);
  assert.match(page,/id="resources"/);
  assert.match(page,/rel="noopener noreferrer"/);
  assert.doesNotMatch(page,/BLUEBELLY_LEARN_DECKS|ORIGINAL PPTX SLIDES/);
});

test("new financial and behavioural concepts are original, grounded and linked",()=>{
  const sourced=LEARN_GLOSSARY_ADDITIONS.filter((term)=>term.source);
  assert.equal(sourced.length,26);
  const all=assembleLearnGlossary(listConcepts());
  assert.equal(all.length,132);
  for(const term of sourced){
    assert.ok(term.example && term.whyItMatters && term.watch.length);
    assert.match(term.source?.url||"",/^https:\/\//);
    assert.ok(term.source?.label);
  }
  const reader=readFileSync("components/blue-desk/BlueDeskLearnExplorer.tsx","utf8");
  assert.match(reader,/selected\.source/);
  assert.match(reader,/hashchange/);
});
