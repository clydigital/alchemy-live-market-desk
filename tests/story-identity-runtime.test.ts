import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("existing Story updates preserve identity and keep candidate wording in the event", () => {
  const runtime = readFileSync(new URL("../lib/intelligence/runtime.ts", import.meta.url), "utf8");
  const start = runtime.indexOf("async function promoteCandidate");
  const end = runtime.indexOf("function lifecycleThemeState", start);
  const section = runtime.slice(start, end);

  assert.match(section, /resolvePersistentStoryIdentity/);
  assert.match(section, /decision\.noveltyClass === "existing_story_update" \? matched : null/);
  assert.match(section, /title: identity\.title\.slice\(0, 180\)/);
  assert.match(section, /market_question: identity\.marketQuestion/);
  assert.match(section, /dominant_narrative: identity\.dominantNarrative/);
  assert.match(section, /headline: candidate\.title\.slice\(0, 180\)/);
  assert.match(section, /story_identity_preserved: true/);
  assert.match(section, /provisional_title: candidate\.title/);
});
