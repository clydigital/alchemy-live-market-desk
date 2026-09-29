import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runtime = readFileSync(new URL("../lib/intelligence/runtime.ts", import.meta.url), "utf8");
const schemas = readFileSync(new URL("../lib/intelligence/schemas.ts", import.meta.url), "utf8");

test("Research idea gate prefers specific useful falsifiable mechanisms", () => {
  assert.match(runtime, /IDEA QUALITY GATE: Prefer a few strong hypotheses over broad coverage/);
  assert.match(runtime, /specific causal mechanism/);
  assert.match(runtime, /decision-relevant market or economic implication/);
  assert.match(runtime, /observable confirmation or invalidation path/);
  assert.match(runtime, /A headline restatement, generic theme label or unsupported clever connection is not a good idea/);
  assert.match(runtime, /QUALITY OVER QUANTITY: Return only hypotheses that are useful enough to become durable market research/);
});

test("Story synthesis does not force contrarian annotations", () => {
  assert.match(runtime, /Divergence and contrarian annotations are OPTIONAL/);
  assert.match(runtime, /divergenceSummary: use null unless an actual supplied divergence/);
  assert.match(runtime, /marketReaction: use null unless supplied canonical market evidence/);
  assert.match(runtime, /overlookedVariable: use null unless the evidence supports a distinct measurable variable/);
  assert.match(runtime, /marketMayBeRight: use null unless there is a meaningful supplied alternative interpretation/);

  assert.match(schemas, /divergenceSummary: string \| null/);
  assert.match(schemas, /marketReaction: string \| null/);
  assert.match(schemas, /overlookedVariable: string \| null/);
  assert.match(schemas, /marketMayBeRight: string \| null/);
  assert.match(schemas, /divergenceSummary: nullableString/);
  assert.match(schemas, /marketReaction: nullableString/);
  assert.match(schemas, /overlookedVariable: nullableString/);
  assert.match(schemas, /marketMayBeRight: nullableString/);
});

test("Legacy edition projection safely collapses absent optional annotations", () => {
  assert.match(runtime, /marketReaction: candidate\.marketReaction \?\? ""/);
  assert.match(runtime, /overlookedVariable: candidate\.overlookedVariable \?\? ""/);
  assert.match(runtime, /overlookedVariableEvidenceStatus: candidate\.overlookedVariableEvidenceStatus \?\? "speculative"/);
  assert.match(runtime, /marketMayBeRight: candidate\.marketMayBeRight \?\? ""/);
});
