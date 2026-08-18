import test from "node:test";
import assert from "node:assert/strict";

import {
  OpenAIStageError,
  parseStructuredProviderResponse,
  executeProviderWithRetry,
  intelligenceModel,
  buildHypothesisEvidencePack,
  buildHypothesisStoryPack,
  restrictHypothesisEvidenceIds,
  formatStageFailureDetail,
} from "../lib/intelligence/hypothesis-core.ts";
import {
  HYPOTHESIS_SCHEMA,
  CHALLENGER_SCHEMA,
  SCENARIO_SCHEMA,
} from "../lib/intelligence/schemas.ts";
import {
  completedStageCheckpoints,
  nextIncompleteIntelligenceStage,
  type PersistedStageRun,
} from "../lib/intelligence/resumable-checkpoints.ts";

test("Provider Boundary 1: completed valid Structured Output parses successfully", async () => {
  const responseText = JSON.stringify({
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
  });

  const result = parseStructuredProviderResponse<{ hypotheses: Array<{ statement: string }> }>({
    status: 200,
    ok: true,
    requestId: "req_456",
    responseText,
    fallbackModel: "gpt-5-mini",
  });

  assert.equal(result.data.hypotheses.length, 1);
  assert.equal(result.data.hypotheses[0].statement, "Demand destruction outweighed physical supply tightness.");
  assert.equal(result.requestId, "req_456");
  assert.equal(result.responseId, "resp_123");
  assert.equal(result.inputTokens, 120);
  assert.equal(result.outputTokens, 250);
});

test("Provider Boundary 2 & 3: incomplete output is identified with canonical vocabulary (max_tokens) and is retryable", async () => {
  const responseText = JSON.stringify({
    id: "resp_incomplete",
    model: "gpt-5-mini",
    status: "incomplete",
    incomplete_details: { reason: "max_tokens" },
    output_text: '{"hypotheses": [{"divergenceId": "div_1", "question": "Truncated...',
    usage: { input_tokens: 500, output_tokens: 4000, total_tokens: 4500 },
  });

  try {
    parseStructuredProviderResponse({
      status: 200,
      ok: true,
      requestId: "req_inc",
      responseText,
      fallbackModel: "gpt-5-mini",
    });
    assert.fail("Should have thrown incomplete_provider_response error");
  } catch (error) {
    assert.ok(error instanceof OpenAIStageError);
    assert.equal(error.code, "incomplete_provider_response");
    assert.equal(error.retryable, true);
    assert.equal(error.requestId, "req_inc");
    assert.equal(error.responseId, "resp_incomplete");
    assert.equal(error.outputTokens, 4000);
    assert.equal(error.incompleteReason, "max_tokens");
  }
});

test("Provider Boundary Bounded Retry: retries occur on malformed structured output and stop at attempt limit", async () => {
  let attempts = 0;
  const fetcher = async () => {
    attempts += 1;
    return {
      status: 200,
      ok: true,
      requestId: `req_mal_${attempts}`,
      responseText: JSON.stringify({
        id: `resp_malformed_${attempts}`,
        model: "gpt-5-mini",
        status: "completed",
        output_text: "{ bad json structure }",
        usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
      }),
    };
  };

  try {
    await executeProviderWithRetry({
      fetcher,
      fallbackModel: "gpt-5-mini",
      maxAttempts: 2,
    });
    assert.fail("Should have thrown malformed_structured_output after exhausting retries");
  } catch (error) {
    assert.ok(error instanceof OpenAIStageError);
    assert.equal(error.code, "malformed_structured_output");
    assert.equal(error.retryable, true);
    assert.equal(attempts, 2, "Bounded retry must attempt exactly configured attempt limit");
    assert.equal(error.requestId, "req_mal_2");
    assert.equal(error.responseId, "resp_malformed_2");
  }
});

test("Provider Boundary Refusal & Safety: content_filter and refusal are non-retryable", async () => {
  const responseText = JSON.stringify({
    id: "resp_safety",
    model: "gpt-5-mini",
    status: "incomplete",
    incomplete_details: { reason: "content_filter" },
  });

  try {
    parseStructuredProviderResponse({
      status: 200,
      ok: true,
      requestId: "req_safety",
      responseText,
      fallbackModel: "gpt-5-mini",
    });
    assert.fail("Should have thrown content_filter error");
  } catch (error) {
    assert.ok(error instanceof OpenAIStageError);
    assert.equal(error.code, "content_filter");
    assert.equal(error.retryable, false, "Safety/content filter incomplete responses must not be retried");
  }
});

test("Durable Failure Telemetry: formatStageFailureDetail builds safe, structured diagnostic detail", () => {
  const formatted = formatStageFailureDetail({
    message: "OpenAI structured output could not be parsed as JSON.",
    failureCode: "malformed_structured_output",
    providerStatus: "completed",
    incompleteReason: null,
    generatedLength: 120,
    generatedHash: "a1b2c3d4e5f6",
    totalTokens: 450,
  });

  assert.match(formatted, /OpenAI structured output could not be parsed as JSON/);
  assert.match(formatted, /code: malformed_structured_output/);
  assert.match(formatted, /providerStatus: completed/);
  assert.match(formatted, /generatedLength: 120/);
  assert.match(formatted, /generatedHash: a1b2c3d4e5f6/);
  assert.match(formatted, /totalTokens: 450/);
  assert.ok(!formatted.includes("sk-"), "Telemetry must never contain secret keys");
});

test("Hypothesis Input Scope Invariant 10-14: non-resolving or empty scope returns empty pack, never full fallback", () => {
  const beliefs = [
    {
      evidence_ids: ["ev_cited_1"],
      affected_assets: ["US10Y"],
    },
  ];

  const divergences = [
    {
      decisive_evidence_ids: ["ev_cited_2"],
    },
  ];

  const mockEvidence = [
    {
      id: "ev_cited_1",
      claim: "Fed cut rates",
      summary: null,
      evidenceClass: "official_release",
      sourceName: "Fed",
      sourceTier: 1,
      reliabilityScore: 90,
      ancestryGroupId: null,
      supportDirection: "context",
      eventAt: null,
      publishedAt: null,
      affectedAssets: ["US10Y"],
      affectedTopics: [],
      provenanceUrls: [],
    },
    {
      id: "ev_unrelated",
      claim: "Unrelated news",
      summary: null,
      evidenceClass: "news_report",
      sourceName: "News",
      sourceTier: 3,
      reliabilityScore: 70,
      ancestryGroupId: null,
      supportDirection: "context",
      eventAt: null,
      publishedAt: null,
      affectedAssets: ["AUDUSD"],
      affectedTopics: [],
      provenanceUrls: [],
    },
  ];

  const filteredEvidence = buildHypothesisEvidencePack(beliefs, divergences, mockEvidence);
  assert.equal(filteredEvidence.length, 1);
  assert.equal(filteredEvidence[0].id, "ev_cited_1");

  // Invariant Test: Non-resolving scope returns empty array, NOT full evidence universe
  const nonResolvingEvidence = buildHypothesisEvidencePack([], [], mockEvidence);
  assert.equal(nonResolvingEvidence.length, 0, "Empty or non-resolving upstream scope must return empty pack");

  // Story Pack Invariant Test
  const mockStories = [
    {
      id: "story_1",
      slug: "us10y-rates",
      title: "US10Y Yield Move",
      thesis: "Yields rising",
      status: "develop",
      confidence: 80,
      marketQuestion: null,
      dominantNarrative: null,
      strongestSupport: null,
      strongestContradiction: null,
      confirmationTrigger: null,
      invalidationTrigger: null,
      nextCatalyst: null,
      assets: ["US10Y"],
    },
    {
      id: "story_2",
      slug: "australia-retail",
      title: "AUD Retail Sales",
      thesis: "AUD weakness",
      status: "develop",
      confidence: 70,
      marketQuestion: null,
      dominantNarrative: null,
      strongestSupport: null,
      strongestContradiction: null,
      confirmationTrigger: null,
      invalidationTrigger: null,
      nextCatalyst: null,
      assets: ["AUDUSD"],
    },
  ];

  const filteredStories = buildHypothesisStoryPack(beliefs, filteredEvidence, mockStories);
  assert.equal(filteredStories.length, 1);
  assert.equal(filteredStories[0].id, "story_1");

  const emptyStories = buildHypothesisStoryPack([], [], mockStories);
  assert.equal(emptyStories.length, 0, "Non-matching asset scope must return empty story pack, never full story history");
});

test("Hypothesis Persistence Scope Invariant: output evidence IDs cannot escape supplied evidence pack", () => {
  const suppliedEvidenceIds = new Set(["ev_1", "ev_2"]);

  const modelOutputIds = ["ev_1", "ev_2", "ev_unrelated_3"];
  const restricted = restrictHypothesisEvidenceIds(modelOutputIds, suppliedEvidenceIds);

  assert.deepEqual(restricted, ["ev_1", "ev_2"]);
  assert.ok(!restricted.includes("ev_unrelated_3"), "Unsupplied evidence ID must be filtered out at persistence boundary");
});

test("Hypothesis Schema & Downstream Compatibility: HYPOTHESIS_SCHEMA right-sized limits preserve Challenger and Scenario compatibility", () => {
  const schema = HYPOTHESIS_SCHEMA as Record<string, unknown>;
  const properties = (schema.properties as Record<string, Record<string, unknown>>).hypotheses;
  assert.equal(properties.maxItems, 8);

  const itemProperties = (properties.items as Record<string, Record<string, Record<string, unknown>>>).properties;
  assert.equal(itemProperties.causalChain.maxItems, 5);
  assert.equal(itemProperties.confirmationCriteria.maxItems, 4);
  assert.equal(itemProperties.invalidationCriteria.maxItems, 4);
  assert.equal(itemProperties.nextCatalysts.maxItems, 4);

  // Validate Challenger and Scenario schema shapes remain valid and registered
  assert.equal((CHALLENGER_SCHEMA as Record<string, unknown>).type, "object");
  assert.equal((SCENARIO_SCHEMA as Record<string, unknown>).type, "object");
});

test("Resumability PR #68: completed checkpoints are reused and Hypothesis is first incomplete stage", async () => {
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

  assert.ok(checkpoints.has("market_belief"));
  assert.ok(checkpoints.has("divergence"));
  assert.ok(!checkpoints.has("hypothesis"));

  const nextStage = nextIncompleteIntelligenceStage(checkpoints);
  assert.equal(nextStage, "hypothesis", "Continuation must resume at Hypothesis as the first incomplete stage");
});

test("Model Routing Diagnosis: intelligenceModel resolves environment model and ignores dead model_hint", () => {
  const originalModel = process.env.OPENAI_INTELLIGENCE_MODEL;
  process.env.OPENAI_INTELLIGENCE_MODEL = "gpt-5-mini";

  const resolved = intelligenceModel("complex");
  assert.equal(resolved, "gpt-5-mini");

  process.env.OPENAI_INTELLIGENCE_MODEL = originalModel;
});
