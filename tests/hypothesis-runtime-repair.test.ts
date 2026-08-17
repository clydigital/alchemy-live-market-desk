import test from "node:test";
import assert from "node:assert/strict";

import {
  OpenAIStageError,
  runStructuredStage,
  intelligenceModel,
} from "../lib/intelligence/openai.ts";
import {
  buildHypothesisEvidencePack,
  buildHypothesisStoryPack,
} from "../lib/intelligence/runtime.ts";
import { HYPOTHESIS_SCHEMA } from "../lib/intelligence/schemas.ts";
import {
  completedStageCheckpoints,
  nextIncompleteIntelligenceStage,
  type PersistedStageRun,
} from "../lib/intelligence/resumable-checkpoints.ts";

test("Provider Boundary 1: completed valid Structured Output parses successfully", async () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "sk-test-key";

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        id: "resp_123",
        model: "gpt-5-mini",
        status: "completed",
        output_text: JSON.stringify({
          hypotheses: [
            {
              divergenceId: "div_1",
              question: "Why did oil fall despite supply cuts?",
              statement: "Demand destruction outweighed physical supply tightness.",
              causalMechanism: "Global demand contraction",
              affectedAssets: ["OIL", "US10Y"],
              evidenceForIds: ["ev_1"],
              evidenceAgainstIds: [],
              causalChain: [
                {
                  from: "PMI contraction",
                  relationship: "reduces demand",
                  to: "lower oil consumption",
                  evidenceState: "strongly_supported",
                  evidenceIds: ["ev_1"],
                },
              ],
              confirmationCriteria: ["Oil inventory build"],
              invalidationCriteria: ["Refinery run increase"],
              nextCatalysts: ["EIA report"],
              confidence: 75,
            },
          ],
        }),
        usage: { input_tokens: 120, output_tokens: 250, total_tokens: 370 },
      }),
      { status: 200, headers: { "x-request-id": "req_456" } },
    );
  };

  try {
    const result = await runStructuredStage<{ hypotheses: Array<{ statement: string }> }>({
      stageKey: "hypothesis",
      instructions: "Test instructions",
      input: {},
      schema: HYPOTHESIS_SCHEMA,
      maxAttempts: 1,
    });

    assert.equal(result.data.hypotheses.length, 1);
    assert.equal(result.data.hypotheses[0].statement, "Demand destruction outweighed physical supply tightness.");
    assert.equal(result.requestId, "req_456");
    assert.equal(result.responseId, "resp_123");
    assert.equal(result.inputTokens, 120);
    assert.equal(result.outputTokens, 250);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalApiKey;
  }
});

test("Provider Boundary 2 & 3: incomplete output is identified before blind JSON parsing and is retryable", async () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "sk-test-key";

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        id: "resp_incomplete",
        model: "gpt-5-mini",
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        output_text: '{"hypotheses": [{"divergenceId": "div_1", "question": "Truncated...',
        usage: { input_tokens: 500, output_tokens: 4000, total_tokens: 4500 },
      }),
      { status: 200, headers: { "x-request-id": "req_inc" } },
    );
  };

  try {
    await runStructuredStage({
      stageKey: "hypothesis",
      instructions: "Test instructions",
      input: {},
      schema: HYPOTHESIS_SCHEMA,
      maxAttempts: 1,
    });
    assert.fail("Should have thrown incomplete_provider_response error");
  } catch (error) {
    assert.ok(error instanceof OpenAIStageError);
    assert.equal(error.code, "incomplete_provider_response");
    assert.equal(error.retryable, true);
    assert.equal(error.requestId, "req_inc");
    assert.equal(error.responseId, "resp_incomplete");
    assert.equal(error.outputTokens, 4000);
    assert.equal(error.incompleteReason, "max_output_tokens");
  } finally {
    globalThis.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalApiKey;
  }
});

test("Provider Boundary 4 & 5: malformed completed Structured Output produces an auditable retryable error", async () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "sk-test-key";

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        id: "resp_malformed",
        model: "gpt-5-mini",
        status: "completed",
        output_text: "{ invalid json string }",
        usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
      }),
      { status: 200, headers: { "x-request-id": "req_malformed" } },
    );
  };

  try {
    await runStructuredStage({
      stageKey: "hypothesis",
      instructions: "Test instructions",
      input: {},
      schema: HYPOTHESIS_SCHEMA,
      maxAttempts: 1,
    });
    assert.fail("Should have thrown malformed_structured_output error");
  } catch (error) {
    assert.ok(error instanceof OpenAIStageError);
    assert.equal(error.code, "malformed_structured_output");
    assert.equal(error.retryable, true);
    assert.equal(error.requestId, "req_malformed");
    assert.equal(error.responseId, "resp_malformed");
    assert.equal(error.generatedLength, "{ invalid json string }".length);
    assert.ok(typeof error.generatedHash === "string" && error.generatedHash.length > 0);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalApiKey;
  }
});

test("Provider Boundary 6: refusal remains correctly classified and non-retryable", async () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "sk-test-key";

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        id: "resp_refusal",
        model: "gpt-5-mini",
        output: [
          {
            content: [{ type: "refusal", refusal: "Request violates safety policies." }],
          },
        ],
      }),
      { status: 200, headers: { "x-request-id": "req_refusal" } },
    );
  };

  try {
    await runStructuredStage({
      stageKey: "hypothesis",
      instructions: "Test instructions",
      input: {},
      schema: HYPOTHESIS_SCHEMA,
      maxAttempts: 1,
    });
    assert.fail("Should have thrown provider_refusal error");
  } catch (error) {
    assert.ok(error instanceof OpenAIStageError);
    assert.equal(error.code, "provider_refusal");
    assert.equal(error.retryable, false);
    assert.equal(error.message, "Request violates safety policies.");
  } finally {
    globalThis.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalApiKey;
  }
});

test("Provider Boundary 7: deterministic schema/configuration errors do not become infinite retries", async () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "sk-test-key";

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        error: { message: "Invalid JSON Schema provided", code: "invalid_schema" },
      }),
      { status: 400, headers: { "x-request-id": "req_bad_schema" } },
    );
  };

  try {
    await runStructuredStage({
      stageKey: "hypothesis",
      instructions: "Test instructions",
      input: {},
      schema: HYPOTHESIS_SCHEMA,
      maxAttempts: 1,
    });
    assert.fail("Should have thrown http error");
  } catch (error) {
    assert.ok(error instanceof OpenAIStageError);
    assert.equal(error.code, "invalid_schema");
    assert.equal(error.retryable, false);
    assert.equal(error.status, 400);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalApiKey;
  }
});

test("Provider Boundary 8 & 9: failure telemetry survives into stage error without secret leakage", async () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "sk-secret-key-12345";

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        id: "resp_telemetry",
        model: "gpt-5-mini",
        status: "completed",
        output_text: "not json",
        usage: { input_tokens: 150, output_tokens: 300, total_tokens: 450 },
      }),
      { status: 200, headers: { "x-request-id": "req_telemetry_789" } },
    );
  };

  try {
    await runStructuredStage({
      stageKey: "hypothesis",
      instructions: "Test instructions",
      input: {},
      schema: HYPOTHESIS_SCHEMA,
      maxAttempts: 1,
    });
  } catch (error) {
    assert.ok(error instanceof OpenAIStageError);
    assert.equal(error.model, "gpt-5-mini");
    assert.equal(error.requestId, "req_telemetry_789");
    assert.equal(error.responseId, "resp_telemetry");
    assert.equal(error.inputTokens, 150);
    assert.equal(error.outputTokens, 300);
    assert.equal(error.totalTokens, 450);

    // Verify secret API key is not present in message or properties
    assert.ok(!error.message.includes("sk-secret-key-12345"));
    assert.ok(!JSON.stringify(error).includes("sk-secret-key-12345"));
  } finally {
    globalThis.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalApiKey;
  }
});

test("Hypothesis Input 10-14: input filtering isolates upstream-relevant evidence and excludes unrelated evidence", () => {
  const beliefs = [
    {
      id: "bel_1",
      belief_key: "k1",
      statement: "Fed will cut rates by 50bps",
      priced_state: "priced",
      consensus_strength: 80,
      affected_assets: ["US10Y", "SPX"],
      evidence_ids: ["ev_cited_by_belief_1", "ev_cited_by_belief_2"],
    },
  ];

  const divergences = [
    {
      id: "div_1",
      divergence_key: "dk1",
      market_belief_id: "bel_1",
      observed_change: "10Y yield rose 12bps despite rate cut expectations",
      expected_change: "Yields fall",
      magnitude: 85,
      persistence_score: 90,
      decisive_evidence_ids: ["ev_decisive_div_1"],
    },
  ];

  const mockEvidence = [
    {
      id: "ev_cited_by_belief_1",
      claim: "Fed official statement",
      summary: null,
      evidenceClass: "official_release",
      sourceName: "Fed",
      sourceTier: 1,
      reliabilityScore: 90,
      ancestryGroupId: null,
      supportDirection: "context",
      eventAt: "2026-08-17T00:00:00Z",
      publishedAt: "2026-08-17T00:00:00Z",
      affectedAssets: ["US10Y"],
      affectedTopics: [],
      provenanceUrls: ["https://federalreserve.gov/release"],
    },
    {
      id: "ev_cited_by_belief_2",
      claim: "CPI inflation print",
      summary: null,
      evidenceClass: "official_release",
      sourceName: "BLS",
      sourceTier: 1,
      reliabilityScore: 95,
      ancestryGroupId: null,
      supportDirection: "context",
      eventAt: "2026-08-17T00:00:00Z",
      publishedAt: "2026-08-17T00:00:00Z",
      affectedAssets: ["US10Y"],
      affectedTopics: [],
      provenanceUrls: ["https://bls.gov/cpi"],
    },
    {
      id: "ev_decisive_div_1",
      claim: "Treasury auction soft demand",
      summary: null,
      evidenceClass: "market_observation",
      sourceName: "Treasury",
      sourceTier: 2,
      reliabilityScore: 85,
      ancestryGroupId: null,
      supportDirection: "mixed",
      eventAt: "2026-08-17T00:00:00Z",
      publishedAt: "2026-08-17T00:00:00Z",
      affectedAssets: ["US10Y"],
      affectedTopics: [],
      provenanceUrls: ["https://treasury.gov/auction"],
    },
    {
      id: "ev_unrelated_1",
      claim: "Unrelated Australian retail sales",
      summary: null,
      evidenceClass: "news_report",
      sourceName: "ABC",
      sourceTier: 3,
      reliabilityScore: 70,
      ancestryGroupId: null,
      supportDirection: "context",
      eventAt: "2026-08-17T00:00:00Z",
      publishedAt: "2026-08-17T00:00:00Z",
      affectedAssets: ["AUDUSD"],
      affectedTopics: [],
      provenanceUrls: ["https://abc.net.au/news"],
    },
  ];

  const filtered = buildHypothesisEvidencePack(beliefs, divergences, mockEvidence);

  assert.equal(filtered.length, 3);
  const filteredIds = new Set(filtered.map((e) => e.id));

  // Test 12: Decisive divergence evidence included
  assert.ok(filteredIds.has("ev_decisive_div_1"));

  // Test 13: Market belief evidence included
  assert.ok(filteredIds.has("ev_cited_by_belief_1"));
  assert.ok(filteredIds.has("ev_cited_by_belief_2"));

  // Test 14: Unrelated evidence excluded
  assert.ok(!filteredIds.has("ev_unrelated_1"));
});

test("Hypothesis Contract 15 & 16: HYPOTHESIS_SCHEMA enforces array maxItems constraints", () => {
  const schema = HYPOTHESIS_SCHEMA as Record<string, unknown>;
  const properties = (schema.properties as Record<string, Record<string, unknown>>).hypotheses;
  assert.equal(properties.maxItems, 8);

  const itemProperties = (properties.items as Record<string, Record<string, Record<string, unknown>>>).properties;
  assert.equal(itemProperties.causalChain.maxItems, 5);
  assert.equal(itemProperties.confirmationCriteria.maxItems, 4);
  assert.equal(itemProperties.invalidationCriteria.maxItems, 4);
  assert.equal(itemProperties.nextCatalysts.maxItems, 4);
});

test("Resumability 20-24: completed Market Belief and Divergence checkpoints are reused on resumption", () => {
  const completedRuns: PersistedStageRun[] = [
    {
      id: "run_mb_1",
      stage_key: "market_belief",
      status: "completed",
      output_payload: { beliefs: [{ statement: "b1" }] },
    },
    {
      id: "run_div_1",
      stage_key: "divergence",
      status: "completed",
      output_payload: { divergences: [{ marketBeliefId: "b1", observedChange: "c1" }] },
    },
    {
      id: "run_hyp_failed",
      stage_key: "hypothesis",
      status: "failed",
      output_payload: {},
    },
  ];

  const checkpoints = completedStageCheckpoints(completedRuns);

  // Test 20 & 21: Checkpoints for Market Belief and Divergence are present and reusable
  assert.ok(checkpoints.has("market_belief"));
  assert.ok(checkpoints.has("divergence"));
  assert.ok(!checkpoints.has("hypothesis"));

  // Test 22: Next incomplete stage is hypothesis
  const nextStage = nextIncompleteIntelligenceStage(checkpoints);
  assert.equal(nextStage, "hypothesis");
});

test("Model Routing: intelligenceModel environment configuration takes precedence over advisory model_hint", () => {
  const originalModel = process.env.OPENAI_INTELLIGENCE_MODEL;
  process.env.OPENAI_INTELLIGENCE_MODEL = "gpt-5-mini";

  const resolved = intelligenceModel("complex");
  assert.equal(resolved, "gpt-5-mini");

  process.env.OPENAI_INTELLIGENCE_MODEL = originalModel;
});
