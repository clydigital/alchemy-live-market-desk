import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getConcept, listConcepts } from "../lib/concepts.ts";
import { assembleLearnGlossary, LEARN_GLOSSARY_ADDITIONS } from "../lib/bluebelly-learn-glossary.ts";

test("Learn expands 28 governed concepts without changing research glossary authority", () => {
  const governed=listConcepts();
  assert.equal(governed.length,28);
  assert.equal(LEARN_GLOSSARY_ADDITIONS.length,78);
  const combined=assembleLearnGlossary(governed);
  assert.equal(combined.length,106);
  assert.equal(new Set(combined.map((entry)=>entry.key)).size,combined.length);
  assert.ok(combined.every((entry)=>entry.definition && entry.whyItMatters && entry.watch.length>0));
  assert.ok(LEARN_GLOSSARY_ADDITIONS.every((entry)=>entry.example && entry.topic!=="regime"));
  assert.equal(getConcept("credit-spread"),null,"Learn-only terms must not change canonical Dossier concept lookups");
  assert.equal(getConcept("real yields")?.key,"real-yield");

  const expectedFinanceTerms=[
    "trailing-twelve-months","property-plant-equipment","net-ppe-investment",
    "price-to-earnings","forward-pe","revenue","operating-income","net-income",
    "ebitda","market-capitalisation","enterprise-value","ev-to-ebitda",
    "price-to-sales","price-to-book","peg-ratio","return-on-invested-capital",
    "net-debt","stock-based-compensation","gaap","non-gaap",
    "financial-quarter","financial-year","year-over-year","quarter-over-quarter",
  ];
  for(const key of expectedFinanceTerms) {
    const concept=combined.find((entry)=>entry.key===key);
    assert.ok(concept, `Missing financial glossary term ${key}`);
    assert.ok(concept.example && concept.whyItMatters && concept.watch.length>0);
  }
  for(const key of ["trailing-twelve-months","property-plant-equipment","price-to-earnings","forward-pe","free-cash-flow"]) {
    assert.ok(combined.find((entry)=>entry.key===key)?.explanation,`Missing worked explanation for ${key}`);
  }
  assert.match(combined.find((entry)=>entry.key==="free-cash-flow")?.explanation||"",/168\.3bn.*210\.7bn.*42\.4bn/);
  assert.ok(combined.find((entry)=>entry.key==="trailing-twelve-months")?.aliases.includes("ttm"));
  assert.ok(combined.find((entry)=>entry.key==="property-plant-equipment")?.aliases.includes("pp&e"));
  assert.ok(combined.find((entry)=>entry.key==="price-to-earnings")?.aliases.includes("p\/e"));
  assert.equal(getConcept("trailing-twelve-months"),null,"Public finance explanations must not mutate canonical governed concepts");
});

test("cyberpunk Learn page remains theme-derived, public and educational",()=>{
  const page=readFileSync("app/blue-desk/learn/page.tsx","utf8");
  const client=readFileSync("components/blue-desk/BlueDeskLearnExplorer.tsx","utf8");
  const styles=readFileSync("app/blue-desk/learn/learn.module.css","utf8");
  assert.match(page,/assembleLearnGlossary\(listConcepts\(\)/);
  assert.match(page,/data-bluebelly-learn="public-governed-glossary"/);
  assert.match(page,/id="courses"/);
  assert.match(page,/id="glossary"/);
  assert.match(client,/type="search"/);
  assert.match(client,/aria-pressed/);
  assert.match(client,/aria-live/);
  assert.match(client,/item\.watch\.join/);
  assert.match(client,/setSelectedKey/);
  assert.match(client,/HOW THE NUMBERS WORK/);
  assert.match(client,/selected\.explanation/);
  assert.match(client,/visibleCount/);
  assert.match(client,/scrollIntoView/);
  assert.match(styles,/\.heroDiagram\{/);
  assert.match(styles,/\.glossaryWorkspace\{/);
  assert.match(styles,/\.entry:hover\{/);
  assert.match(styles,/var\(--bb-accent\)/);
  assert.match(styles,/var\(--bb-card-bg\)/);
  assert.match(styles,/@media\(max-width:560px\)/);
  assert.doesNotMatch(styles,/#ffdb23|#49e2d0|#3da8ff|#b9e9aa/);
  assert.doesNotMatch(page,/supabaseAdmin|service_role|creator_transcript|publishResearch/);
});
