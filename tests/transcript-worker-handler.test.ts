import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const handler = fs.readFileSync(
  path.resolve(import.meta.dirname, "..", "lib", "transcript-worker-handler.ts"),
  "utf8",
);

test("the handler wires server-side Gemini configuration and public video URL analysis", () => {
  assert.match(handler, /isGeminiVideoAnalysisConfigured/);
  assert.match(handler, /analysePublicYouTubeVideo/);
  assert.match(handler, /url:\s*job\.url/);
  assert.match(handler, /apiKey:\s*process\.env\.GEMINI_API_KEY/);
  assert.match(handler, /model:\s*process\.env\.GEMINI_VIDEO_MODEL/);
  assert.doesNotMatch(handler, /GEMINI_API_KEY[^\n]*NextResponse\.json/);
});

test("only completed transcript jobs can refresh Market Motion", () => {
  assert.match(handler, /filter\(\(outcome\) => outcome\.status === "completed"\)/);
  assert.doesNotMatch(handler, /summary_only[\s\S]*completedItemIds/);
});
