import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { evaluateNewStoryMarketAdmissibility } from "../lib/intelligence/story-admissibility.ts";

test("research provenance methodology cannot become a new market Story by itself", () => {
  const result = evaluateNewStoryMarketAdmissibility({
    title: "Primary-source timestamps as the decisive evidence for record reclassification",
    thesis: "Reversing prior classifications should require preserved primary-source creation/event timestamps and provenance.",
    question: "Should later interpretive products without primary timestamps reverse prior record classifications?",
    causalMechanism: "Missing provenance creates uncertainty about temporal ordering and raises look-ahead bias.",
    marketBelief: "Archival provenance should control record reclassification.",
    affectedAssets: [],
  });

  assert.equal(result.admissible, false);
  assert.equal(result.reason, "research_process_without_market_mechanism");
  assert.ok(result.processSignals.length > 0);
  assert.deepEqual(result.marketSignals, []);
});

test("asset-light stable-value liquidity research remains admissible", () => {
  const result = evaluateNewStoryMarketAdmissibility({
    title: "Stable-value contractual design reduces near-term system-wide run risk",
    thesis: "Wrap providers, separate accounts and crediting-rate mechanics reduce immediate participant liquidity-run and insurer-contagion risk.",
    question: "Can stable-value fund structure contain participant outflows and insurer stress?",
    causalMechanism: "Contract design disperses counterparty exposure and slows liquidity transmission.",
    marketBelief: "Stable-value funds can absorb local stress without an immediate system-wide run.",
    affectedAssets: [],
  });

  assert.equal(result.admissible, true);
  assert.equal(result.reason, "market_or_economic_mechanism");
  assert.ok(result.marketSignals.includes("credit_financing"));
});

test("asset-light macro and policy Stories remain admissible", () => {
  const result = evaluateNewStoryMarketAdmissibility({
    title: "Tariff escalation tightens the inflation-policy trade-off",
    thesis: "Higher tariffs can lift goods inflation while weakening trade-sensitive growth.",
    question: "Will tariff pressure reduce central-bank room to ease?",
    causalMechanism: "Trade policy raises import costs, shifts inflation and changes the policy-rate path.",
    marketBelief: "Tariff escalation can transmit into inflation and rates.",
    affectedAssets: [],
  });

  assert.equal(result.admissible, true);
  assert.ok(result.marketSignals.includes("policy_geopolitics"));
  assert.ok(result.marketSignals.includes("macro_economy"));
});

test("runtime gates only new identities before canonical Story promotion", () => {
  const runtime = readFileSync(new URL("../lib/intelligence/runtime.ts", import.meta.url), "utf8");

  assert.match(runtime, /decision\.noveltyClass === "new_story"/);
  assert.match(runtime, /decision\.noveltyClass === "related_distinct"/);
  assert.match(runtime, /evaluateNewStoryMarketAdmissibility\(/);
  assert.match(runtime, /const structurallyPublishable = integrity\.publishable && hasPrimaryCorroboration && marketDomainAdmissible/);
  assert.match(runtime, /new canonical Story requires a market\/economic mechanism/);
  assert.match(runtime, /MARKET-DOMAIN BOUNDARY: Do not create a market hypothesis/);
  assert.match(runtime, /MARKET-DOMAIN BOUNDARY: Every Story candidate/);
});
