import assert from "node:assert/strict";
import test from "node:test";
import { auditLYHeadline, noteLYHeadlineIssues } from "../lib/dossier-v2/ly-headline-quality.ts";
import { buildResearchBrainSystemInstructions } from "../lib/dossier-v2/research-brain-prompt.ts";

const bad = "NY Fed ACM shows a governed 10Y term premium (~0.92%) while AI/semiconductor leaders close resiliently, leaving rate pressure present but transmission into credit and breadth unresolved.";

test("flags the exact published research-note headline without rejecting its evidence", () => {
  assert.deepEqual(auditLYHeadline(bad), [
    "INTERNAL_VOCABULARY",
    "INSTITUTIONAL_SHORTCUT",
    "TECHNICAL_LEAD",
    "DENSE_HEADLINE",
  ]);
  const output = { main_thread: { headline: bad }, diagnostics: { notes: [] as string[] }, evidence_references: ["ev-original"] };
  const result = noteLYHeadlineIssues(output);
  assert.equal(result.main_thread.headline, bad);
  assert.deepEqual(result.evidence_references, ["ev-original"]);
  assert.match(result.diagnostics.notes[0], /LY_HEADLINE_REVIEW_REQUIRED/);
  noteLYHeadlineIssues(result);
  assert.equal(result.diagnostics.notes.length, 1);
});

test("approves direct market headlines even when technical detail is needed below", () => {
  assert.deepEqual(auditLYHeadline("AI Stocks Are Holding Up Despite Pressure From US Bonds"), []);
  assert.deepEqual(auditLYHeadline("US Yields Are Rising, but Credit Stress Has Not Been Confirmed"), []);
});

test("the original LY context and concrete rules are applied upstream in the Research Brain", () => {
  const prompt = buildResearchBrainSystemInstructions();
  assert.match(prompt, /reader should understand the market before seeing any model or provider name/i);
  assert.match(prompt, /keep the observation's original date/i);
  assert.match(prompt, /China is keeping more fuel at home/i);
  assert.match(prompt, /Do not imply an old observation happened today/i);
  assert.match(prompt, /technical terms in the supporting answer/i);
});
