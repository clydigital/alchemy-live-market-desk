import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const overview = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

test("economic-release Story links use the freshness-gated Live Story set", () => {
  assert.match(
    overview,
    /const storyRows = selectLegacyStoriesForLive\(data\.stories, recordLayer\.events, recordLayer\.thesisVersions\);[\s\S]*const releaseStories = getRelatedStoriesForRelease\(immediateRelease, storyRows, 3\);/,
  );
  assert.doesNotMatch(
    overview,
    /getRelatedStoriesForRelease\(immediateRelease, data\.stories, 3\)/,
  );
});
