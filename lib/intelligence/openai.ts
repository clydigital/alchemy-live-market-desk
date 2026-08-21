import "server-only";

import { markModelStageInvoked } from "./invocation-context.ts";
import {
  OpenAIStageError,
  executeProviderWithRetry,
  intelligenceModel,
  responsesCompatibleJsonSchema,
} from "./openai-core.ts";

export type IntelligenceReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh" | "max";

export type JsonSchema = Record<string, unknown>;

export type OpenAIStageResult<T> = {
  data: T;
  requestId: string | null;
  responseId: string | null;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
};

export { OpenAIStageError, intelligenceModel };

const API_URL = "https://api.openai.com/v1/responses";
const VALID_EFFORT = new Set<IntelligenceReasoningEffort>(["none", "low", "medium", "high", "xhigh", "max"]);

/**
 * Provider-level safety ceiling only. Canonical intelligence no longer assigns
 * bespoke cognitive-stage budgets; one model stage owns each invocation and is
 * allowed to use the normal serverless request window.
 */
export const MAX_STAGE_REQUEST_TIMEOUT_MS = 240_000;

export function openAIIntelligenceEnabled() {
  return Boolean(process.env.OPENAI_API_KEY?.trim()) && process.env.OPENAI_INTELLIGENCE_ENABLED !== "false";
}

export function intelligenceReasoningEffort(kind: "complex" | "fast"): IntelligenceReasoningEffort {
  const configured = (kind === "fast"
    ? process.env.OPENAI_INTELLIGENCE_FAST_REASONING_EFFORT
    : process.env.OPENAI_INTELLIGENCE_REASONING_EFFORT)?.trim() as IntelligenceReasoningEffort | undefined;
  if (configured && VALID_EFFORT.has(configured)) return configured;
  return kind === "complex" ? "medium" : "low";
}

function retryDelay(attempt: number, retryAfter: string | null) {
  const seconds = retryAfter ? Number(retryAfter) : Number.NaN;
  if (Number.isFinite(seconds) && seconds >= 0 && seconds <= 30) return seconds * 1_000;
  return Math.min(4_000, 500 * 2 ** attempt);
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function boundedInteger(value: number | undefined, fallback: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.floor(value!)));
}

function deterministicStage<T>(stageKey: string, input: unknown): OpenAIStageResult<T> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;

  // Challenger is retained only as a deterministic compatibility checkpoint
  // while the old runtime shape is being retired. It cannot block canonical
  // reasoning, consumes no model call, and never changes canonical confidence.
  if (stageKey === "challenger") {
    const hypotheses = Array.isArray(record.hypotheses) ? record.hypotheses : [];
    const assessments = hypotheses.flatMap((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return [];
      const hypothesis = value as Record<string, unknown>;
      const hypothesisId = typeof hypothesis.id === "string" ? hypothesis.id : "";
      if (!hypothesisId) return [];
      const confidence = typeof hypothesis.confidence === "number"
        ? Math.max(0, Math.min(100, hypothesis.confidence))
        : 50;
      const catalysts = Array.isArray(hypothesis.next_catalysts)
        ? hypothesis.next_catalysts.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
        : [];
      return [{
        hypothesisId,
        verdict: "promote",
        strongestCountercase: "Compatibility critic is non-blocking; countercase testing belongs to Scenario and explicit invalidation criteria.",
        weakestLink: null,
        hiddenAssumptions: [],
        alternativeMechanisms: [],
        missingEvidence: [],
        missingRequirementIds: [],
        conflictingEvidenceIds: [],
        pricingConfirmation: null,
        crossAssetConfirmation: null,
        timingRisk: null,
        nextResolvingEvidence: catalysts[0] ?? null,
        adjustedConfidence: confidence,
        confidenceAdjustment: 0,
        synthetic: true,
      }];
    });
    return {
      data: { assessments } as T,
      requestId: null,
      responseId: null,
      model: "deterministic-nonblocking-critic",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };
  }

  // Lifecycle is a state transition, not a task that benefits from another LLM
  // call. Preserve the synthesis lifecycle state deterministically; structural
  // novelty/deduplication remains a separate persisted decision.
  if (stageKey === "lifecycle") {
    const candidates = Array.isArray(record.candidates) ? record.candidates : [];
    const decisions = candidates.flatMap((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return [];
      const candidate = value as Record<string, unknown>;
      const candidateKey = typeof candidate.candidateKey === "string" ? candidate.candidateKey : "";
      const lifecycleStatus = typeof candidate.lifecycleStatus === "string" ? candidate.lifecycleStatus : "detected";
      if (!candidateKey) return [];
      const allowed = new Set(["detected", "developing", "confirmed", "weakening", "invalidated", "archived"]);
      return [{
        candidateKey,
        lifecycleStatus: allowed.has(lifecycleStatus) ? lifecycleStatus : "detected",
        reason: "Deterministic lifecycle transition preserves the synthesis state; novelty and publication integrity are evaluated separately.",
      }];
    });
    return {
      data: { decisions } as T,
      requestId: null,
      responseId: null,
      model: "deterministic-lifecycle-v1",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };
  }

  return null;
}

/**
 * Transitional runtime compatibility can still construct a `challenger` field.
 * Scenario and Story Synthesis must never receive it as canonical model input.
 */
export function canonicalStageInput(stageKey: string, input: unknown) {
  if ((stageKey !== "scenario" && stageKey !== "story_synthesis") || !input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }
  const { challenger: _criticCompatibilityOnly, ...canonical } = input as Record<string, unknown>;
  return canonical;
}

export async function runStructuredStage<T>({
  stageKey,
  instructions,
  input,
  schema,
  modelKind = "complex",
  maxOutputTokens = 4_000,
  requestTimeoutMs,
  maxAttempts,
}: {
  stageKey: string;
  instructions: string;
  input: unknown;
  schema: JsonSchema;
  modelKind?: "complex" | "fast";
  maxOutputTokens?: number;
  /** Generic provider request ceiling. Canonical scheduling does not allocate per-stage cognitive budgets. */
  requestTimeoutMs?: number;
  maxAttempts?: number;
}): Promise<OpenAIStageResult<T>> {
  const deterministic = deterministicStage<T>(stageKey, input);
  if (deterministic) return deterministic;

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new OpenAIStageError("OPENAI_API_KEY is not configured.", {
      code: "configuration_required",
    });
  }

  const model = intelligenceModel(modelKind);
  const effort = intelligenceReasoningEffort(modelKind);
  const timeoutMs = boundedInteger(requestTimeoutMs, MAX_STAGE_REQUEST_TIMEOUT_MS, 1_000, MAX_STAGE_REQUEST_TIMEOUT_MS);
  const attemptLimit = boundedInteger(maxAttempts, 3, 1, 3);
  const modelInput = canonicalStageInput(stageKey, input);
  // Market Belief now carries the bounded existing-Story maintenance output in
  // the same provider call. Give strict JSON enough headroom to finish instead
  // of forcing a truncation/retry loop. This does not add another model call.
  const effectiveMaxOutputTokens = stageKey === "market_belief"
    ? Math.max(maxOutputTokens, 4_500)
    : maxOutputTokens;
  const body = {
    model,
    instructions,
    input: JSON.stringify(modelInput),
    reasoning: { effort },
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: `alchemy_${stageKey.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48)}`,
        strict: true,
        schema: responsesCompatibleJsonSchema(schema),
      },
    },
    max_output_tokens: effectiveMaxOutputTokens,
    store: false,
  };

  markModelStageInvoked(stageKey);
  const fetcher = async () => {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const requestId = response.headers.get("x-request-id");
    const responseText = await response.text();
    const retryAfter = response.headers.get("retry-after");
    return {
      status: response.status,
      ok: response.ok,
      requestId,
      responseText,
      retryAfter,
    };
  };

  return executeProviderWithRetry<T>({
    fetcher,
    fallbackModel: model,
    maxOutputTokens: effectiveMaxOutputTokens,
    maxAttempts: attemptLimit,
    sleepFn: async (attempt, retryAfter) => {
      await sleep(retryDelay(attempt, retryAfter));
    },
  });
}
