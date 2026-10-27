import assert from "node:assert/strict";
import test from "node:test";
import { classifyPublicStory, PUBLIC_STORY_CATEGORIES } from "../lib/blue-desk-story-categories.ts";
import { readFileSync } from "node:fs";

const story = (title: string, slug = "recorded-market-story") => ({ title, slug });

test("a Story category is navigation only, with a safe fallback", () => {
  assert.equal(classifyPublicStory(story("Brent and Hormuz tanker disruptions")), "Energy & Geopolitics");
  assert.equal(classifyPublicStory(story("AI capex and semiconductor cash conversion")), "AI & Technology");
  assert.equal(classifyPublicStory(story("Japanese yen carry unwind")), "FX & Japan");
  assert.equal(classifyPublicStory(story("US Treasury yields test Fed rate expectations")), "Rates & Fed");
  assert.equal(classifyPublicStory(story("Equity earnings and credit funding")), "Equities & Credit");
  assert.equal(classifyPublicStory(story("An unrelated new market question")), "Other Markets");
  assert.equal(new Set(PUBLIC_STORY_CATEGORIES).size, PUBLIC_STORY_CATEGORIES.length);
});

test("homepage puts up to four historical Stories in one editorial lead grid without faking headlines", () => {
  const page=readFileSync(new URL("../app/blue-desk/page.tsx",import.meta.url),"utf8");
  assert.match(page, /theses\.slice\(0,4\)/);
  assert.match(page, /index===0\?tracked\.lead:tracked\.card/);
  assert.match(page, /classifyPublicStory\(thesis\)/);
  assert.match(page, /ONGOING RESEARCH/);
  assert.match(page, /#thesis-/);
  assert.doesNotMatch(page, /theses\.slice\(0,9\)/);
  const css=readFileSync(new URL("../app/blue-desk/tracked-stories.module.css",import.meta.url),"utf8");
  assert.match(css, /\.lead\{/);
  assert.match(css, /grid-column:span 2/);
  assert.match(css, /@media\(max-width:690px\)/);
});
