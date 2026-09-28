import assert from "node:assert/strict";
import test from "node:test";

import type { MarketDossierV2 } from "../lib/dossier-v2/contracts.ts";
import { buildPriorInvestigations } from "../lib/dossier-v2/manual-run.ts";

const STATUSES = ["open", "strengthened", "weakened", "resolved", "parked"] as const;

test("Task C closure: every investigation lifecycle state survives prior-state reconstruction", () => {
  for (const status of STATUSES) {
    const dossier = {
      id: `11111111-1111-4111-8111-${status.padEnd(12, "0").slice(0, 12)}`,
      contract_version: "market-dossier-v2/1",
      previous_dossier_id: null,
      as_of: "2026-09-29T00:00:00.000Z",
      freshness: { warnings: [] },
      research_gaps: [],
      payload: {
        analytical_output: {
          diagnostics: { degraded: false },
          investigations: [{
            investigation_id: "inv:task-c-lifecycle",
            question: "Does the investigation state survive reconstruction?",
            expected_reaction: "Credit widens and breadth weakens.",
            observed_reaction: null,
            divergence: "UNRESOLVED",
            current_explanation: "State continuity is under test.",
            competing_explanations: [],
            research_next: "Carry the investigation into the next Dossier.",
            status,
            linked_story_ids: ["story:task-c"],
            linked_thesis_ids: ["thesis:task-c"],
          }],
        },
      },
      created_at: "2026-09-29T00:00:01.000Z",
    } as unknown as MarketDossierV2;

    const rebuilt = buildPriorInvestigations(dossier);

    assert.equal(rebuilt.length, 1, `expected one reconstructed investigation for ${status}`);
    assert.equal(rebuilt[0]?.investigation_id, "inv:task-c-lifecycle");
    assert.equal(rebuilt[0]?.expected_reaction, "Credit widens and breadth weakens.");
    assert.equal(rebuilt[0]?.status, status, `${status} must not be normalised back to open`);
  }
});
