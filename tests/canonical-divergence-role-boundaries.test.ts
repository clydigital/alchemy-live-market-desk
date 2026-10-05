import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { DIVERGENCE_SCHEMA } from "../lib/intelligence/schemas.ts";

const root = path.resolve(import.meta.dirname, "..");
const runtime = fs.readFileSync(
  path.join(root, "lib", "intelligence", "runtime.ts"),
  "utf8",
);
const checkpoints = fs.readFileSync(
  path.join(root, "lib", "intelligence", "resumable-checkpoints.ts"),
  "utf8",
);

test("P2.1 Divergence owns mismatch detection and not causal explanation", () => {
  assert.match(runtime, /const DIVERGENCE_ROLE_RULES =/);
  assert.match(runtime, /Divergence owns expected-versus-observed mismatch detection only/);
  assert.match(runtime, /Do NOT choose the causal explanation here; causal formation belongs to Hypothesis/);
  assert.match(runtime, /Treat timing and sequencing as evidence/);
  assert.match(runtime, /later headline cannot explain an earlier price move/i);
  assert.match(runtime, /Historical base rates, seasonality and prior event windows may establish context for unusualness but are not deterministic forecasts/);
  assert.match(runtime, /return no divergence rather than inventing one/);
  assert.match(
    runtime,
    /stageKey === "divergence" \? `\\n\\n\$\{DIVERGENCE_ROLE_RULES\}` : ""/,
  );
});

test("P2.1 Divergence output contract contains no causal mechanism field", () => {
  const divergences = (
    DIVERGENCE_SCHEMA.properties as Record<string, unknown>
  ).divergences as {
    items?: {
      properties?: Record<string, unknown>;
    };
  };
  const properties = divergences.items?.properties ?? {};

  assert.deepEqual(Object.keys(properties).sort(), [
    "decisiveEvidenceIds",
    "expectedChange",
    "magnitude",
    "marketBeliefId",
    "observedChange",
    "persistenceScore",
  ]);
  assert.equal("causalMechanism" in properties, false);
  assert.equal("explanation" in properties, false);
  assert.equal("hypothesis" in properties, false);
});

test("P2.1 Hypothesis owns competing causal mechanisms for an actual divergence", () => {
  assert.match(runtime, /For stage "hypothesis": Hypothesis owns causal-thesis formation and idea generation/);
  assert.match(runtime, /A divergence is ONE high-value trigger, not a prerequisite/);
  assert.match(runtime, /When an actual supplied divergence is central to the hypothesis/);
  assert.match(runtime, /expectation\/pricing, rates or real yields, FX, positioning or short covering/);
  assert.match(runtime, /options or other mechanical flows/);
  assert.match(runtime, /physical-versus-financial market differences/);
  assert.match(runtime, /Treat every such mechanism as inferred or speculative until supplied canonical evidence directly supports the causal link/);
  assert.match(runtime, /Never promote short covering, dealer gamma, positioning, real yields, safe-haven demand or physical-market stress/);
  assert.match(runtime, /Prefer the explanation best supported by chronology, direct-market evidence and cross-asset confirmation/);
  assert.match(runtime, /If evidence cannot discriminate between competing mechanisms, keep confidence bounded/);
});

test("P2.1 non-divergence causal research remains valid", () => {
  assert.match(runtime, /CONVERGENCE: several independent facts reinforce the same mechanism/);
  assert.match(runtime, /CROSS_ASSET_TRANSMISSION/);
  assert.match(runtime, /SECOND_ORDER_EFFECT/);
  assert.match(runtime, /STRUCTURAL_SHIFT/);
  assert.match(runtime, /CATALYST_REPRICING/);
  assert.match(runtime, /Return divergenceId only when an actual supplied divergence is central to the thesis; otherwise return null/);
});

test("P2.1 Story Synthesis preserves unresolved mechanism uncertainty", () => {
  assert.match(
    runtime,
    /When supplied evidence cannot discriminate between plausible causal mechanisms, acceptedExplanation must preserve that unresolved state rather than manufacture certainty/,
  );
  assert.match(runtime, /nextTestSelection to state what evidence would resolve the mechanism/);
  assert.match(runtime, /Do not promote a speculative mechanism merely because it is the most narratively convenient explanation for a divergence/);
  assert.match(runtime, /label each mechanism step observed, strongly_supported, inferred or speculative/);
});

test("P2.1 reuses the existing canonical reasoning stages and adds no side engine", () => {
  assert.match(runtime, /stageKey: "divergence"/);
  assert.match(runtime, /stageKey: "hypothesis"/);
  assert.match(runtime, /stageKey: "story_synthesis"/);
  assert.match(runtime, /input: \{ beliefs, evidence: reasoningEvidence \}/);
  assert.doesNotMatch(
    runtime,
    /stageKey:\s*"(?:presenter|presenter_divergence|divergence_engine|causal_divergence)"/,
  );
  assert.doesNotMatch(
    checkpoints,
    /"(?:presenter|presenter_divergence|divergence_engine|causal_divergence)"/,
  );
});

test("P2.1 does not add divergence evidence recruitment yet", () => {
  const start = runtime.indexOf("const divergenceStage = await modelStage<DivergenceOutput>");
  const end = runtime.indexOf("const hypothesisStage = await modelStage<HypothesisOutput>", start);
  assert.notEqual(start, -1);
  assert.ok(end > start);
  const section = runtime.slice(start, end);

  assert.match(section, /input: \{ beliefs, evidence: reasoningEvidence \}/);
  assert.doesNotMatch(section, /fetch\(/);
  assert.doesNotMatch(section, /research[-_ ]?recruit/i);
  assert.doesNotMatch(section, /realYield|breakeven|dealerGamma|shortCovering/);
});
