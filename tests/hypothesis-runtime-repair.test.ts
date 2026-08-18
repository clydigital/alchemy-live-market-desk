import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  OpenAIStageError,
  parseStructuredProviderResponse,
  executeProviderWithRetry,
  intelligenceModel,
  formatStageFailureDetail,
  buildStageFailurePersistencePayload,
} from "../lib/intelligence/openai-core.ts";
import {
  buildHypothesisEvidencePack,
  buildHypothesisStoryPack,
  restrictHypothesisEvidenceIds,
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
import {
  defaultIntelligenceRunKey,
  startIntelligenceEngineRunWithClient,
} from "../lib/intelligence/engine-run-contract.ts";

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

test("Provider Boundary 2 & 3: incomplete output with max_tokens is identified and retryable", async () => {
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

test("Production runStructuredStage delegation: static source verification proves execution of shared retry helper", () => {
  const openaiCode = readFileSync(new URL("../lib/intelligence/openai.ts", import.meta.url), "utf8");
  assert.match(openaiCode, /executeProviderWithRetry<T>\(/, "runStructuredStage must delegate to shared executeProviderWithRetry");
});

test("Provider executeProviderWithRetry bounded retry: Attempt 1 malformed -> Attempt 2 valid succeeds", async () => {
  let attempts = 0;
  const fetcher = async () => {
    attempts += 1;
    if (attempts === 1) {
      return {
        status: 200,
        ok: true,
        requestId: "req_prod_1",
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
      requestId: "req_prod_2",
      responseText: JSON.stringify({
        id: "resp_valid_2",
        model: "gpt-5-mini",
        status: "completed",
        output_text: JSON.stringify({ hypotheses: [{ statement: "Production recovery" }] }),
        usage: { input_tokens: 100, output_tokens: 80, total_tokens: 180 },
      }),
    };
  };

  const result = await executeProviderWithRetry<{ hypotheses: Array<{ statement: string }> }>({
    fetcher,
    fallbackModel: "gpt-5-mini",
    maxAttempts: 2,
  });

  assert.equal(attempts, 2, "executeProviderWithRetry must execute retry path");
  assert.equal(result.data.hypotheses[0].statement, "Production recovery");
  assert.equal(result.requestId, "req_prod_2");
});

test("Provider executeProviderWithRetry bounded retry: malformed -> malformed exhausts maxAttempts", async () => {
  let attempts = 0;
  const fetcher = async () => {
    attempts += 1;
    return {
      status: 200,
      ok: true,
      requestId: `req_prod_mal_${attempts}`,
      responseText: JSON.stringify({
        id: `resp_mal_${attempts}`,
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
    assert.fail("Should have thrown malformed_structured_output");
  } catch (error) {
    assert.ok(error instanceof OpenAIStageError);
    assert.equal(error.code, "malformed_structured_output");
    assert.equal(error.retryable, true);
    assert.equal(attempts, 2, "Must exhaust maxAttempts");
    assert.equal(error.requestId, "req_prod_mal_2");
    assert.equal(error.responseId, "resp_mal_2");
  }
});

test("Provider Boundary Refusal: refusal in text output is non-retryable", async () => {
  const responseText = JSON.stringify({
    id: "resp_refusal",
    model: "gpt-5-mini",
    status: "completed",
    output: [{ content: [{ type: "refusal", refusal: "I cannot generate financial advice." }] }],
  });

  try {
    parseStructuredProviderResponse({
      status: 200,
      ok: true,
      requestId: "req_refusal",
      responseText,
      fallbackModel: "gpt-5-mini",
    });
    assert.fail("Should have thrown provider_refusal error");
  } catch (error) {
    assert.ok(error instanceof OpenAIStageError);
    assert.equal(error.code, "provider_refusal");
    assert.equal(error.retryable, false);
  }
});

test("Durable Telemetry Persistence Integration: buildStageFailurePersistencePayload constructs safe finishStage payload", () => {
  const error = new OpenAIStageError("OpenAI structured output could not be parsed as JSON.", {
    code: "malformed_structured_output",
    status: 200,
    retryable: true,
    model: "gpt-5-mini",
    requestId: "req_stage_1",
    responseId: "resp_stage_1",
    inputTokens: 500,
    outputTokens: 200,
    totalTokens: 700,
    providerStatus: "completed",
    incompleteReason: null,
    generatedLength: 150,
    generatedHash: "e1f2a3b4c5d6",
  });

  const payload = buildStageFailurePersistencePayload({
    message: "Scheduled timeout on stage hypothesis",
    failureCode: "timeout",
    stageError: error,
  });

  assert.equal(payload.failureCode, "timeout");
  assert.equal(payload.modelName, "gpt-5-mini");
  assert.equal(payload.providerRequestId, "req_stage_1");
  assert.equal(payload.inputTokens, 500);
  assert.equal(payload.outputTokens, 200);

  assert.match(payload.failureDetail, /Scheduled timeout on stage hypothesis/);
  assert.match(payload.failureDetail, /code: timeout/);
  assert.match(payload.failureDetail, /providerStatus: completed/);
  assert.match(payload.failureDetail, /responseId: resp_stage_1/);
  assert.match(payload.failureDetail, /generatedLength: 150/);
  assert.match(payload.failureDetail, /generatedHash: e1f2a3b4c5d6/);
  assert.match(payload.failureDetail, /totalTokens: 700/);
  assert.ok(!payload.failureDetail.includes("sk-"), "Telemetry must never leak API keys");
  assert.ok(payload.failureDetail.length <= 2000, "Persistence bound is strictly respected");
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

  const originalStoriesCopy = JSON.parse(JSON.stringify(mockStories));
  const filtered = buildHypothesisStoryPack(beliefs, hypothesisEvidence, mockStories);
  assert.equal(filtered.length, 2);
  assert.deepEqual(filtered.map((s) => s.id).sort(), ["story_1", "story_2"]);

  const noMatchFiltered = buildHypothesisStoryPack([{ affected_assets: ["BRL"] }], [], mockStories);
  assert.equal(noMatchFiltered.length, 0, "Zero matching stories returns empty set, never all stories");
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

  const requiredFields = (properties.items as Record<string, Record<string, unknown>>).required as unknown as string[];
  assert.ok(requiredFields.includes("divergenceId"));
  assert.ok(requiredFields.includes("question"));
  assert.ok(requiredFields.includes("statement"));
  assert.ok(requiredFields.includes("causalMechanism"));
  assert.ok(requiredFields.includes("confirmationCriteria"));
  assert.ok(requiredFields.includes("invalidationCriteria"));

  assert.equal((CHALLENGER_SCHEMA as Record<string, unknown>).type, "object");
  assert.equal((SCENARIO_SCHEMA as Record<string, unknown>).type, "object");
});

test("Resumability Lineage & Checkpoints: engine-run contract derives deterministic runKey and engineRunId lineage", async () => {
  const researchRunId = "res_12345";
  const triggerKind = "scheduled";
  const runKey = defaultIntelligenceRunKey(researchRunId, triggerKind);
  assert.match(runKey, /^intelligence:res_12345:/);

  const mockClient = async <T>(path: string, init?: RequestInit): Promise<T> => {
    if (path.includes("select=id,status")) {
      return [] as unknown as T;
    }
    if (path.includes("on_conflict=run_key") && init?.method === "POST") {
      return [{ id: "engine_run_999", status: "started" }] as unknown as T;
    }
    return [] as unknown as T;
  };

  const startResult = await startIntelligenceEngineRunWithClient(mockClient, {
    researchRunId,
    triggerKind,
    runKey,
  });

  assert.equal(startResult.kind, "started");
  assert.equal(startResult.runKey, runKey);
  const engineRunId = startResult.engineRunId;
  assert.equal(engineRunId, "engine_run_999");

  const MARKET_BELIEF = { beliefs: [{ id: "belief-1", statement: "Rates fall", affectedAssets: ["US10Y"] }] };
  const DIVERGENCE = { divergences: [{ id: "divergence-1", marketBeliefId: "belief-1", observedChange: "Yields rose 15bps" }] };
  const HYPOTHESIS = { hypotheses: [{ id: "hyp-1", divergenceId: "divergence-1", statement: "Supply flood" }] };

  const validObject = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object");

  const runs: PersistedStageRun[] = [
    { id: "run_mb_1", stage_key: "market_belief", status: "completed", output_payload: MARKET_BELIEF },
    { id: "run_div_1", stage_key: "divergence", status: "completed", output_payload: DIVERGENCE },
    { id: "run_hyp_failed", stage_key: "hypothesis", status: "failed", output_payload: {} },
  ];

  const checkpoints = completedStageCheckpoints(runs);

  // Reused Market Belief
  let mbCalls = 0;
  const mbResult = await runCheckpointedStage({
    stageKey: "market_belief",
    checkpoints,
    claim: async () => { throw new Error("Should not claim completed Market Belief"); },
    invoke: async () => { mbCalls += 1; return MARKET_BELIEF; },
    valid: validObject,
  });
  assert.equal(mbResult.source, "reused");
  assert.equal(mbCalls, 0);

  // Reused Divergence
  let divCalls = 0;
  const divResult = await runCheckpointedStage({
    stageKey: "divergence",
    checkpoints,
    claim: async () => { throw new Error("Should not claim completed Divergence"); },
    invoke: async () => { divCalls += 1; return DIVERGENCE; },
    valid: validObject,
  });
  assert.equal(divResult.source, "reused");
  assert.equal(divCalls, 0);

  // Hypothesis is first re-executed stage
  const nextStage = nextIncompleteIntelligenceStage(checkpoints);
  assert.equal(nextStage, "hypothesis");

  // Single active claim under same engine run lineage
  let activeClaim = false;
  let hypCalls = 0;
  const claim = async (): Promise<StageClaim> => {
    if (activeClaim) return { state: "busy", stageRunId: `${engineRunId}_stage_hypothesis_attempt_1` };
    activeClaim = true;
    return { state: "claimed", stageRunId: `${engineRunId}_stage_hypothesis_attempt_1` };
  };

  const [res1, res2] = await Promise.all([
    runCheckpointedStage({ stageKey: "hypothesis", checkpoints, claim, invoke: async () => { hypCalls += 1; return HYPOTHESIS; }, valid: validObject }),
    runCheckpointedStage({ stageKey: "hypothesis", checkpoints, claim, invoke: async () => { hypCalls += 1; return HYPOTHESIS; }, valid: validObject }),
  ]);

  assert.deepEqual([res1.source, res2.source].sort(), ["busy", "invoked"]);
  assert.equal(hypCalls, 1);
});

test("Model Routing Diagnosis: intelligenceModel resolves environment model and ignores dead model_hint", () => {
  const originalModel = process.env.OPENAI_INTELLIGENCE_MODEL;
  process.env.OPENAI_INTELLIGENCE_MODEL = "gpt-5-mini";

  const resolved = intelligenceModel("complex");
  assert.equal(resolved, "gpt-5-mini");

  process.env.OPENAI_INTELLIGENCE_MODEL = originalModel;
});
