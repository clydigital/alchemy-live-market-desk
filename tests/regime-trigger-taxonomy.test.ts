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

test("AI warning rules name observables, numeric windows and bullish falsifiers rather than abstract bad-news labels", () => {
  const items = getDossierTriggerDefinitions("us-china-ai");
  for (const id of ["ai-capex-cash-coverage", "ai-supplier-customer-order-chain", "ai-earnings-valuation-bridge", "ai-equity-leadership-divergence"]) {
    const item = items.find((candidate) => candidate.id === id);
    assert.ok(item, id);
    assert.match(item.quantitativeTest ?? "", /[0-9]/, id);
    assert.ok(item.bullishFalsifier?.length, id);
    assert.ok(item.missingEvidence?.length, id);
    assert.ok(item.evidenceRequirement.length, id);
  }
});

test("financial-leadership breakdown needs corroboration and does not fire from XLF underperformance alone", () => {
  const item = getDossierTriggerDefinitions("equity-rally-quality").find((candidate) => candidate.id === "xlf-relative-leadership");
  assert.ok(item);
  assert.match(item.quantitativeTest ?? "", /-5pp/);
  assert.match(item.evidenceRequirement, /bank/);
  assert.match(item.missingEvidence ?? "", /alone cannot prove/);
});
