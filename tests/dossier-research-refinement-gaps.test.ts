import assert from "node:assert/strict";
import test from "node:test";

import { deriveResearchRefinementGaps } from "../lib/dossier-v2/execution.ts";
import type { ResearchBrainOutputV1 } from "../lib/dossier-v2/research-brain-contracts.ts";

function output() {
  return {
    diagnostics: {
      missing_input_categories: ["Intraday MOVE/VIX", "Bund/JGB intraday yields"],
    },
    investigations: [{
      question: "Is duration stress transmitting into credit and volatility?",
      missing_evidence: ["Intraday MOVE/VIX", "HY/IG confirmation"],
    }],
    research_now: [{
      blocking_evidence: ["HY/IG confirmation", "Cross-currency basis / FX-swap series"],
    }],
  } as unknown as ResearchBrainOutputV1;
}

test("missing inputs and unresolved investigation evidence become nonblocking refinement gaps", () => {
  const gaps = deriveResearchRefinementGaps(output());
  assert.deepEqual(gaps.map((gap) => gap.category), [
    "MISSING_INPUT",
    "MISSING_INPUT",
    "INVESTIGATION_EVIDENCE",
    "RESEARCH_NOW_EVIDENCE",
  ]);
  assert.ok(gaps.every((gap) => gap.severity === "INFORMATIONAL"));
  assert.ok(gaps.every((gap) => gap.gap_class === "REFINEMENT"));
  assert.ok(gaps.every((gap) => Array.isArray(gap.blocking_refs) && gap.blocking_refs.length === 0));
  assert.match(gaps[0]?.description ?? "", /Intraday MOVE\/VIX/);
  assert.match(gaps[3]?.description ?? "", /Cross-currency basis/);
});

test("refinement gap IDs are deterministic and duplicate missing evidence is collapsed", () => {
  const first = deriveResearchRefinementGaps(output());
  const second = deriveResearchRefinementGaps(output());
  assert.deepEqual(first, second);
  assert.equal(first.filter((gap) => /HY\/IG confirmation/.test(gap.description)).length, 1);
});
