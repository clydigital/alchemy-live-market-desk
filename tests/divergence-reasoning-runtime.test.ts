import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const runtime = fs.readFileSync(path.join(root, "lib", "intelligence", "runtime.ts"), "utf8");
const checkpoints = fs.readFileSync(path.join(root, "lib", "intelligence", "resumable-checkpoints.ts"), "utf8");

test("Divergence stage owns expected-versus-observed mismatch without selecting the cause", () => {
  assert.match(runtime, /const DIVERGENCE_ROLE_RULES =/);
  assert.match(runtime, /expected-versus-observed mismatch detection only/);
  assert.match(runtime, /Do NOT choose the causal explanation here; causal formation belongs to Hypothesis/);
  assert.match(runtime, /Treat timing and sequencing as evidence/);
  assert.match(runtime, /Historical base rates and seasonality may establish context for unusualness but are not deterministic forecasts/);
  assert.match(runtime, /stageKey === "divergence" \? `\\n\\n\$\{DIVERGENCE_ROLE_RULES\}` : ""/);
});

test("Hypothesis tests relevant competing mechanisms without pretending missing evidence exists", () => {
  assert.match(runtime, /expectation\/pricing, rates or real yields, FX, positioning or short covering/);
  assert.match(runtime, /options or other mechanical flows/);
  assert.match(runtime, /physical-versus-financial market differences/);
  assert.match(runtime, /Treat each mechanism as inferred or speculative until supplied evidence supports the causal link/);
  assert.match(runtime, /Never promote short covering, dealer gamma, positioning, real yields, safe-haven demand or physical-market stress/);
  assert.match(runtime, /Prefer the explanation best supported by timing, direct-market evidence and cross-asset confirmation/);
  assert.match(runtime, /next discriminating evidence/);
});

test("Story Synthesis preserves unresolved mechanism uncertainty", () => {
  assert.match(runtime, /acceptedExplanation must preserve that unresolved state rather than manufacture certainty/);
  assert.match(runtime, /overlooked variable, confirmation\/invalidation and next test to state what evidence would resolve it/);
});

test("Presenter divergence refinement adds no parallel model stage", () => {
  assert.doesNotMatch(runtime, /stageKey:\s*"(?:presenter|presenter_divergence|divergence_engine)"/);
  assert.doesNotMatch(checkpoints, /"(?:presenter|presenter_divergence|divergence_engine)"/);
  assert.match(runtime, /stageKey: "divergence"/);
  assert.match(runtime, /input: \{ beliefs, evidence: reasoningEvidence \}/);
});
