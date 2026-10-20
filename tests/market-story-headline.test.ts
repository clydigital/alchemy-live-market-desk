import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { marketStoryHeadline } from "../lib/market-story-headline.ts";

test("a source-authored statement outranks a question, without rewriting the underlying claim", () => {
  const question = "How will higher US yields affect equities?";
  const update = "US yields rose after the inflation release";
  assert.equal(marketStoryHeadline([question, update]), update);
  assert.equal(question, "How will higher US yields affect equities?");
  assert.equal(marketStoryHeadline(["Is the AI boom ending?", "AI funding costs remain elevated"]),
    "AI funding costs remain elevated");
});

test("question-only Story titles cannot become invented market headlines", () => {
  assert.equal(marketStoryHeadline(["Will Brent rise?", "Why is oil volatile?"]),
    "");
});

test("all displayed Story headlines are at most 80 characters", () => {
  const result = marketStoryHeadline(["US Treasury yields remained elevated while the dollar gained and long-duration growth equities weakened after the latest release"]);
  assert.ok(Array.from(result).length <= 80);
  assert.ok(result.endsWith("…"));
  assert.doesNotMatch(result, /[?？]/);
});

test("Blue Desk and Live Desk present declarative content in content-sized Story cards", () => {
  const blue = readFileSync(new URL("../app/blue-desk/blue-desk.module.css", import.meta.url), "utf8");
  const live = readFileSync(new URL("../components/live-desk/market-regime-strip.module.css", import.meta.url), "utf8");
  const projection = readFileSync(new URL("../lib/market-brief-articles.ts", import.meta.url), "utf8");
  const homepage = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(projection, /marketStoryHeadline\(\[/);
  assert.match(homepage, /marketStoryHeadline\(\[/);
  assert.match(blue, /\.storyCard\s*\{[\s\S]*?width: max-content/);
  assert.match(live, /\.storyCard\s*\{[\s\S]*?width: max-content/);
  assert.match(blue, /scroll-snap-type: x proximity/);
});

test("does not turn a research question into a fabricated observed move", () => {
  assert.equal(marketStoryHeadline(["Why did yields fall?", "Will the dollar rally?"]), "");
});
