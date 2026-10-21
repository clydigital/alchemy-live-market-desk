import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  STORY_VISUAL_VERSION,
  storyVisualDescriptor,
  storyVisualKind,
} from "../lib/blue-desk-story-visual.ts";

const EDITION = "fcea17ef-f575-4283-a363-7d5fa9c918c7";
const STORY = "6e2c8a8c-fdc7-45eb-bec6-b685b0311f3e";

test("frozen 19 October AI artwork has a stable deterministic visual identity", () => {
  const input = { editionId: EDITION, storyId: STORY, category: "Equities & Earnings" };
  const first = storyVisualDescriptor(input);
  const repeated = storyVisualDescriptor(input);
  assert.ok(first);
  assert.deepEqual(first, repeated);
  assert.equal(first.visualVersion, STORY_VISUAL_VERSION);
  assert.equal(first.kind, "equities");
  assert.equal(first.label, "Equities & earnings");
  assert.equal(first.id, "story-art-y537h3",
    "Golden fixture: changing the art algorithm must require an explicit version decision");
  assert.equal(first.orbX, 746);
  assert.equal(first.orbY, 165);
  assert.equal(first.orbitTilt, 0);
  assert.equal(first.accents.length, 7);
  assert.ok(first.accents.every(dot =>
    dot.x >= 410 && dot.x < 880 && dot.y >= 30 && dot.y < 265));
});

test("visuals are distinct by exact edition, Story and separately versioned art", () => {
  const input = { editionId: EDITION, storyId: STORY, category: "Energy & Commodities" };
  const base = storyVisualDescriptor(input);
  const changedEdition = storyVisualDescriptor({
    ...input, editionId: "88ea836a-8081-44e8-8af0-06fd860b0367",
  });
  const changedStory = storyVisualDescriptor({
    ...input, storyId: "26955788-e038-4e8a-abae-90cde0c17a90",
  });
  const changedVersion = storyVisualDescriptor({ ...input, visualVersion: "abyssal-story/2" });
  assert.ok(base && changedEdition && changedStory && changedVersion);
  assert.notEqual(base.id, changedEdition.id);
  assert.notEqual(base.id, changedStory.id);
  assert.notEqual(base.id, changedVersion.id);
  assert.equal(changedVersion.visualVersion, "abyssal-story/2");
});

test("illustration descriptor rejects forged IDs and unapproved versions", () => {
  assert.equal(storyVisualDescriptor({
    editionId: "not-a-uuid", storyId: STORY, category: "Rates & Policy",
  }), null);
  assert.equal(storyVisualDescriptor({
    editionId: EDITION, storyId: "../private", category: "Rates & Policy",
  }), null);
  assert.equal(storyVisualDescriptor({
    editionId: EDITION, storyId: STORY, category: "Rates & Policy",
    visualVersion: "new-script<script>alert(1)</script>",
  }), null);
  assert.equal(storyVisualDescriptor({
    editionId: EDITION, storyId: STORY, category: "Rates & Policy",
    visualVersion: "abyssal-story/0",
  }), null);
});

test("visual category vocabulary is bounded and unrelated strings do not become labels", () => {
  assert.equal(storyVisualKind("Rates & Policy"), "rates");
  assert.equal(storyVisualKind("Energy & Commodities"), "energy");
  assert.equal(storyVisualKind("Equities & Earnings"), "equities");
  assert.equal(storyVisualKind("Unverified yield move +999bps"), "cross-asset");
  assert.equal(storyVisualKind("<img onerror=alert(1)>"), "cross-asset");
  const art = storyVisualDescriptor({
    editionId: EDITION, storyId: STORY, category: "<img onerror=alert(1)>",
  });
  assert.equal(art?.label, "Cross-asset markets");
});

test("reader art stays server-rendered, non-evidentiary and independent of market telemetry", () => {
  const page = readFileSync(new URL("../app/blue-desk/stories/[articleId]/page.tsx", import.meta.url), "utf8");
  const art = readFileSync(new URL("../components/blue-desk/StoryVisual.tsx", import.meta.url), "utf8");
  const style = readFileSync(new URL("../components/blue-desk/story-visual.module.css", import.meta.url), "utf8");
  assert.match(page, /getHybridExactDailyBriefEdition\(edition\)/);
  assert.match(page, /if \(!frozen\) notFound\(\)/);
  assert.match(page, /article\.articleId === normalizedArticleId && item\.editionId === edition/);
  assert.match(page, /<StoryVisual[\s\S]*?storyId=\{normalizedArticleId\.slice\(articlePrefix\.length\)\}/);
  assert.match(page, /editionId=\{article\.editionId\}/);
  assert.match(art, /role="img"/);
  assert.match(art, /aria-labelledby=/);
  assert.match(art, /<desc id=/);
  assert.match(art, /Not a market chart, observed move or evidence/);
  assert.match(art, /<SubjectMark kind=\{kind\}/);
  assert.match(style, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(art, /use client|dangerouslySetInnerHTML|foreignObject|<image\b|<script|fetch\(|Math\.random|Date\.now|setInterval|<canvas/);
  assert.doesNotMatch(art, /<text[^>]*>\s*\{category\}/);
  assert.doesNotMatch(art, /\b(?:d3|chart\.js|recharts|candlestick)\b/i);
});
