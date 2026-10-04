import assert from "node:assert/strict";
import test from "node:test";
import { getDossierTriggerDefinitions } from "../lib/regime-trigger-taxonomy.ts";

test("US Rate Regime trigger ladder preserves dossier escalation vocabulary", () => {
  const levels = new Set(getDossierTriggerDefinitions("global-cost-of-capital").map((item) => item.level));
  for (const expected of ["ACTIVE","ACCELERATION","CREDIT_TRANSMISSION","SYSTEMIC","US_CONFIDENCE_TAIL"]) assert.ok(levels.has(expected as never));
});

test("AI Capital Cycle separates monetisation, recourse and control triggers", () => {
  const ids = new Set(getDossierTriggerDefinitions("us-china-ai").map((item) => item.id));
  for (const expected of ["ai-monetisation-watch","ai-credit-spread","recourse-migration","coverage-warning","control-delay"]) assert.ok(ids.has(expected));
});

test("unrelated Regimes do not receive dossier ladders", () => {
  assert.deepEqual(getDossierTriggerDefinitions("gold-reserve-diversification"), []);
});
