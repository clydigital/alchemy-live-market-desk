import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const overview = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

test("Overview uses the freshness-gated durable Story set", () => {
  assert.match(
    overview,
    /const storyRows = selectLegacyStoriesForLive\(data\.stories, recordLayer\.events, recordLayer\.thesisVersions\);[\s\S]*const persistentStoryRows = storyRows\.filter\([\s\S]*classifyRegimeStory\(story, latestVersionByStory\.get\(story\.id\) \|\| null\)\.maturity === "durable"[\s\S]*\);/,
  );
  assert.match(
    overview,
    /getRelatedStoriesForRelease\(immediateRelease, persistentStoryRows, 3\)/,
  );
  assert.match(
    overview,
    /getStoryHeaderImages\(persistentStoryRows\.map\(\(story\) => story\.id\), data\.sources\)/,
  );
  assert.match(
    overview,
    /const stories = persistentStoryRows\.map\(\(story\) => \{/,
  );
  assert.doesNotMatch(
    overview,
    /getRelatedStoriesForRelease\(immediateRelease, data\.stories, 3\)/,
  );
});

test("Overview reuses the governed Regime Story maturity classifier", () => {
  assert.match(
    overview,
    /import \{ buildRegimeProjection, classifyRegimeStory \} from "@\/lib\/regimes";/,
  );
});
