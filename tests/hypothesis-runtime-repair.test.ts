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
  runCheckpointedStage,
  type PersistedStageRun,
  type StageClaim,
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

test("Provider Boundary Bounded Retry: Attempt 1 malformed -> Attempt 2 valid succeeds with 2 calls", async () => {
  let attempts = 0;
  const fetcher = async () => {
    attempts += 1;
    if (attempts === 1) {
      return {
        status: 200,
        ok: true,
        requestId: "req_mal_1",
        responseText: JSON.stringify({
          id: "resp_mal_1",
          model: "gpt-5-mini",
          status: "completed",
          output_text: "{ bad json }",
          usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
        }),
      };
    }
    return {
      status: 200,
      ok: true,
      requestId: "req_valid_2",
      responseText: JSON.stringify({
        id: "resp_valid_2",
        model: "gpt-5-mini",
        status: "completed",
        output_text: JSON.stringify({ hypotheses: [{ statement: "Valid recovery" }] }),
        usage: { input_tokens: 100, output_tokens: 80, total_tokens: 180 },
      }),
    };
  };

  const result = await executeProviderWithRetry<{ hypotheses: Array<{ statement: string }> }>({
    fetcher,
    fallbackModel: "gpt-5-mini",
    maxAttempts: 3,
  });

  assert.equal(attempts, 2, "Second attempt must succeed and stop retry loop");
  assert.equal(result.data.hypotheses[0].statement, "Valid recovery");
  assert.equal(result.requestId, "req_valid_2");
  assert.equal(result.responseId, "resp_valid_2");
});

test("Provider Boundary Bounded Retry: Attempt 1 malformed -> Attempt 2 malformed exhausts maxAttempts=2", async () => {
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
    assert.equal(error.retryable, true, "Retryable flag remains true for downstream PR #68 continuation");
    assert.equal(attempts, 2, "Bounded retry must attempt exactly configured maxAttempts limit");
    assert.equal(error.requestId, "req_mal_2");
    assert.equal(error.responseId, "resp_malformed_2");
  }
});

test("Provider Boundary Bounded Retry: Attempt 1 incomplete (max_output_tokens) -> Attempt 2 valid succeeds", async () => {
  let attempts = 0;
  const fetcher = async () => {
    attempts += 1;
    if (attempts === 1) {
      return {
        status: 200,
        ok: true,
        requestId: "req_inc_1",
        responseText: JSON.stringify({
          id: "resp_inc_1",
          model: "gpt-5-mini",
          status: "incomplete",
          incomplete_details: { reason: "max_output_tokens" },
          output_text: '{"hypotheses": [',
          usage: { input_tokens: 200, output_tokens: 4000, total_tokens: 4200 },
        }),
      };
    }
    return {
      status: 200,
      ok: true,
      requestId: "req_valid_2",
      responseText: JSON.stringify({
        id: "resp_valid_2",
        model: "gpt-5-mini",
        status: "completed",
        output_text: JSON.stringify({ hypotheses: [{ statement: "Recovered output" }] }),
        usage: { input_tokens: 200, output_tokens: 300, total_tokens: 500 },
      }),
    };
  };

  const result = await executeProviderWithRetry<{ hypotheses: Array<{ statement: string }> }>({
    fetcher,
    fallbackModel: "gpt-5-mini",
    maxAttempts: 3,
  });

  assert.equal(attempts, 2);
  assert.equal(result.data.hypotheses[0].statement, "Recovered output");
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

test("Durable Failure Telemetry: formatStageFailureDetail builds safe, structured diagnostic detail with responseId", () => {
  const formatted = formatStageFailureDetail({
    message: "OpenAI structured output could not be parsed as JSON.",
    failureCode: "malformed_structured_output",
    providerStatus: "completed",
    incompleteReason: null,
    responseId: "resp_diag_789",
    generatedLength: 120,
    generatedHash: "a1b2c3d4e5f6",
    totalTokens: 450,
  });

  assert.match(formatted, /OpenAI structured output could not be parsed as JSON/);
  assert.match(formatted, /code: malformed_structured_output/);
  assert.match(formatted, /providerStatus: completed/);
  assert.match(formatted, /responseId: resp_diag_789/);
  assert.match(formatted, /generatedLength: 120/);
  assert.match(formatted, /generatedHash: a1b2c3d4e5f6/);
  assert.match(formatted, /totalTokens: 450/);
  assert.ok(!formatted.includes("sk-"), "Telemetry must never contain secret keys");
  assert.ok(formatted.length <= 2000, "Failure detail bound is respected");
});

test("Durable Telemetry Preservation: OpenAIStageError preserves all telemetry properties on re-throw", () => {
  const original = new OpenAIStageError("Original timeout error", {
    code: "timeout",
    status: 408,
    retryable: true,
    model: "gpt-5-mini",
    requestId: "req_timeout_1",
    responseId: "resp_timeout_1",
    inputTokens: 300,
    outputTokens: 150,
    totalTokens: 450,
    providerStatus: "incomplete",
    incompleteReason: "max_output_tokens",
    generatedLength: 50,
    generatedHash: "f1e2d3c4b5a6",
  });

  // Emulate wrapping in modelStage when changing message
  const wrapped = new OpenAIStageError("Scheduled timeout on stage hypothesis", {
    code: original.code,
    status: original.status,
    retryable: original.retryable,
    model: original.model,
    requestId: original.requestId,
    responseId: original.responseId,
    inputTokens: original.inputTokens,
    outputTokens: original.outputTokens,
    totalTokens: original.totalTokens,
    providerStatus: original.providerStatus,
    incompleteReason: original.incompleteReason,
    generatedLength: original.generatedLength,
    generatedHash: original.generatedHash,
  });

  assert.equal(wrapped.message, "Scheduled timeout on stage hypothesis");
  assert.equal(wrapped.code, "timeout");
  assert.equal(wrapped.model, "gpt-5-mini");
  assert.equal(wrapped.requestId, "req_timeout_1");
  assert.equal(wrapped.responseId, "resp_timeout_1");
  assert.equal(wrapped.inputTokens, 300);
  assert.equal(wrapped.outputTokens, 150);
  assert.equal(wrapped.totalTokens, 450);
  assert.equal(wrapped.providerStatus, "incomplete");
  assert.equal(wrapped.incompleteReason, "max_output_tokens");
  assert.equal(wrapped.generatedLength, 50);
  assert.equal(wrapped.generatedHash, "f1e2d3c4b5a6");
});

test("Hypothesis Input Scope Invariant 10-14: buildHypothesisEvidencePack strictly resolves cited evidence without full fallback", () => {
  const beliefs = [{ evidence_ids: ["ev_cited_1"], affected_assets: ["US10Y"] }];
  const divergences = [{ decisive_evidence_ids: ["ev_cited_2"] }];
  const mockEvidence = [
    { id: "ev_cited_1", claim: "Fed cut rates", summary: null, evidenceClass: "official_release", sourceName: "Fed", sourceTier: 1, reliabilityScore: 90, ancestryGroupId: null, supportDirection: "context", eventAt: null, publishedAt: null, affectedAssets: ["US10Y"], affectedTopics: [], provenanceUrls: [] },
    { id: "ev_cited_2", claim: "CPI drop", summary: null, evidenceClass: "official_release", sourceName: "BLS", sourceTier: 1, reliabilityScore: 90, ancestryGroupId: null, supportDirection: "context", eventAt: null, publishedAt: null, affectedAssets: ["US10Y"], affectedTopics: [], provenanceUrls: [] },
    { id: "ev_unrelated", claim: "Unrelated news", summary: null, evidenceClass: "news_report", sourceName: "News", sourceTier: 3, reliabilityScore: 70, ancestryGroupId: null, supportDirection: "context", eventAt: null, publishedAt: null, affectedAssets: ["AUDUSD"], affectedTopics: [], provenanceUrls: [] },
  ];

  const filtered = buildHypothesisEvidencePack(beliefs, divergences, mockEvidence);
  assert.equal(filtered.length, 2);
  assert.deepEqual(filtered.map((e) => e.id).sort(), ["ev_cited_1", "ev_cited_2"]);

  const emptyPack = buildHypothesisEvidencePack([], [], mockEvidence);
  assert.equal(emptyPack.length, 0, "Non-resolving or empty scope returns empty array, never full 72 evidence records");
});

test("Hypothesis Input Scope Invariant: buildHypothesisStoryPack filtering behavior", () => {
  const beliefs = [{ evidence_ids: ["ev_1"], affected_assets: ["US10Y", "OIL"] }];
  const hypothesisEvidence = [
    { id: "ev_1", claim: "Fed cut rates", summary: null, evidenceClass: "official_release", sourceName: "Fed", sourceTier: 1, reliabilityScore: 90, ancestryGroupId: null, supportDirection: "context", eventAt: null, publishedAt: null, affectedAssets: ["US10Y"], affectedTopics: [], provenanceUrls: [] },
  ];
  const mockStories = [
    { id: "story_1", slug: "us10y-rates", title: "US10Y Yield Move", thesis: "Yields rising", status: "develop", confidence: 80, marketQuestion: null, dominantNarrative: null, strongestSupport: null, strongestContradiction: null, confirmationTrigger: null, invalidationTrigger: null, nextCatalyst: null, assets: ["US10Y"] },
    { id: "story_2", slug: "oil-supply", title: "Oil Tightness", thesis: "Oil rising", status: "develop", confidence: 75, marketQuestion: null, dominantNarrative: null, strongestSupport: null, strongestContradiction: null, confirmationTrigger: null, invalidationTrigger: null, nextCatalyst: null, assets: ["OIL"] },
    { id: "story_3", slug: "aud-retail", title: "AUD Weakness", thesis: "AUD falling", status: "develop", confidence: 70, marketQuestion: null, dominantNarrative: null, strongestSupport: null, strongestContradiction: null, confirmationTrigger: null, invalidationTrigger: null, nextCatalyst: null, assets: ["AUDUSD"] },
  ];

  // 1. Relevant story shares affected asset -> included
  // 2. Unrelated story -> excluded
  // 3. Multiple relevant stories -> retained
  const originalStoriesCopy = JSON.parse(JSON.stringify(mockStories));
  const filtered = buildHypothesisStoryPack(beliefs, hypothesisEvidence, mockStories);
  assert.equal(filtered.length, 2);
  assert.deepEqual(filtered.map((s) => s.id).sort(), ["story_1", "story_2"]);

  // 4. Zero matching stories -> returns empty set [], NOT all stories
  const noMatchFiltered = buildHypothesisStoryPack([{ affected_assets: ["BRL"] }], [], mockStories);
  assert.equal(noMatchFiltered.length, 0, "Zero matching stories returns empty set, never all stories");

  // 5. No accidental mutation of original Story input
  assert.deepEqual(mockStories, originalStoriesCopy, "Input story pack array must not be mutated");
});

test("Hypothesis Persistence Scope Invariant: output evidence IDs cannot escape supplied evidence pack", () => {
  const suppliedEvidenceIds = new Set(["ev_1", "ev_2"]);

  const modelOutputIds = ["ev_1", "ev_2", "ev_unrelated_3"];
  const restricted = restrictHypothesisEvidenceIds(modelOutputIds, suppliedEvidenceIds);

  assert.deepEqual(restricted, ["ev_1", "ev_2"]);
  assert.ok(!restricted.includes("ev_unrelated_3"), "Unsupplied evidence ID must be filtered out at persistence boundary");
});

test("Hypothesis Contract & Mandate: schema right-sizing & role rules enforce causal mechanism boundaries", () => {
  const schema = HYPOTHESIS_SCHEMA as Record<string, unknown>;
  const properties = (schema.properties as Record<string, Record<string, unknown>>).hypotheses;
  assert.equal(properties.maxItems, 8, "Hypotheses maxItems is right-sized to 8");

  const itemProperties = (properties.items as Record<string, Record<string, Record<string, unknown>>>).properties;
  assert.equal(itemProperties.causalChain.maxItems, 5);
  assert.equal(itemProperties.confirmationCriteria.maxItems, 4);
  assert.equal(itemProperties.invalidationCriteria.maxItems, 4);
  assert.equal(itemProperties.nextCatalysts.maxItems, 4);

  // Validate required schema properties on hypothesis items
  const requiredFields = (properties.items as Record<string, Record<string, unknown>>).required as unknown as string[];
  assert.ok(requiredFields.includes("divergenceId"));
  assert.ok(requiredFields.includes("question"));
  assert.ok(requiredFields.includes("statement"));
  assert.ok(requiredFields.includes("causalMechanism"));
  assert.ok(requiredFields.includes("confirmationCriteria"));
  assert.ok(requiredFields.includes("invalidationCriteria"));

  // Validate Challenger and Scenario schema shapes remain valid and registered
  assert.equal((CHALLENGER_SCHEMA as Record<string, unknown>).type, "object");
  assert.equal((SCENARIO_SCHEMA as Record<string, unknown>).type, "object");
});

test("Resumability Requirements A-F: completed stage reuse, failure resumption, lineage & deduplication", async () => {
  const MARKET_BELIEF = { beliefs: [{ id: "belief-1", statement: "Rates fall", affectedAssets: ["US10Y"] }] };
  const DIVERGENCE = { divergences: [{ id: "divergence-1", marketBeliefId: "belief-1", observedChange: "Yields rose 15bps" }] };
  const HYPOTHESIS = { hypotheses: [{ id: "hyp-1", divergenceId: "divergence-1", statement: "Supply flood" }] };

  const validObject = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object");

  // Initial completed runs up to Divergence, with Hypothesis failed
  const runs: PersistedStageRun[] = [
    { id: "run_mb_1", stage_key: "market_belief", status: "completed", output_payload: MARKET_BELIEF },
    { id: "run_div_1", stage_key: "divergence", status: "completed", output_payload: DIVERGENCE },
    { id: "run_hyp_failed", stage_key: "hypothesis", status: "failed", output_payload: {} },
  ];

  const checkpoints = completedStageCheckpoints(runs);

  // A. Completed Market Belief is reused (no model call)
  let mbCalls = 0;
  const mbResult = await runCheckpointedStage({
    stageKey: "market_belief",
    checkpoints,
    claim: async () => { throw new Error("Should not claim completed Market Belief"); },
    invoke: async () => { mbCalls += 1; return MARKET_BELIEF; },
    valid: validObject,
  });
  assert.equal(mbResult.source, "reused");
  assert.equal(mbCalls, 0, "Requirement A: Market Belief reused without model call");

  // B. Completed Divergence is reused (no model call)
  let divCalls = 0;
  const divResult = await runCheckpointedStage({
    stageKey: "divergence",
    checkpoints,
    claim: async () => { throw new Error("Should not claim completed Divergence"); },
    invoke: async () => { divCalls += 1; return DIVERGENCE; },
    valid: validObject,
  });
  assert.equal(divResult.source, "reused");
  assert.equal(divCalls, 0, "Requirement B: Divergence reused without model call");

  // C. Failed retryable Hypothesis is the first model stage re-executed
  const nextStage = nextIncompleteIntelligenceStage(checkpoints);
  assert.equal(nextStage, "hypothesis", "Requirement C: Hypothesis is first incomplete stage re-executed");

  // D & E. Stage claiming ensures lineage preservation and duplicate claim prevention
  let activeClaim = false;
  let hypCalls = 0;
  const claim = async (): Promise<StageClaim> => {
    if (activeClaim) return { state: "busy", stageRunId: "run_hyp_attempt_1" };
    activeClaim = true;
    return { state: "claimed", stageRunId: "run_hyp_attempt_1" };
  };

  const invokeHyp = async () => {
    hypCalls += 1;
    return HYPOTHESIS;
  };

  const [res1, res2] = await Promise.all([
    runCheckpointedStage({ stageKey: "hypothesis", checkpoints, claim, invoke: invokeHyp, valid: validObject }),
    runCheckpointedStage({ stageKey: "hypothesis", checkpoints, claim, invoke: invokeHyp, valid: validObject }),
  ]);

  assert.deepEqual([res1.source, res2.source].sort(), ["busy", "invoked"]);
  assert.equal(hypCalls, 1, "Requirement E: Concurrent claims allow exactly one model invocation");

  // F. After Hypothesis succeeds, checkpoint is updated and downstream stage (Challenger) becomes next
  checkpoints.set("hypothesis", { stageRunId: "run_hyp_attempt_1", stageKey: "hypothesis", outputPayload: HYPOTHESIS });
  const downstreamNext = nextIncompleteIntelligenceStage(checkpoints);
  assert.equal(downstreamNext, "challenger", "Requirement F: Execution proceeds to Challenger after Hypothesis succeeds");
});

test("Model Routing Diagnosis: intelligenceModel resolves environment model and ignores dead model_hint", () => {
  const originalModel = process.env.OPENAI_INTELLIGENCE_MODEL;
  process.env.OPENAI_INTELLIGENCE_MODEL = "gpt-5-mini";

  const resolved = intelligenceModel("complex");
  assert.equal(resolved, "gpt-5-mini");

  process.env.OPENAI_INTELLIGENCE_MODEL = originalModel;
});
