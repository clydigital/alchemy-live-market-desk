import "server-only";

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
 * A scheduled stage may use more than the historical 60-second request window,
 * but no individual provider call can consume the entire 300-second function.
 * Callers still own the tighter route-level allocation.
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
  /** Per-stage controls used by bounded serverless orchestrators. */
  requestTimeoutMs?: number;
  maxAttempts?: number;
}): Promise<OpenAIStageResult<T>> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new OpenAIStageError("OPENAI_API_KEY is not configured.", {
      code: "configuration_required",
    });
  }

  const model = intelligenceModel(modelKind);
  const effort = intelligenceReasoningEffort(modelKind);
  const timeoutMs = boundedInteger(requestTimeoutMs, 60_000, 1_000, MAX_STAGE_REQUEST_TIMEOUT_MS);
  const attemptLimit = boundedInteger(maxAttempts, 3, 1, 3);
  const body = {
    model,
    instructions,
    input: JSON.stringify(input),
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
    max_output_tokens: maxOutputTokens,
    store: false,
  };

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
    maxOutputTokens,
    maxAttempts: attemptLimit,
    sleepFn: async (attempt, retryAfter) => {
      await sleep(retryDelay(attempt, retryAfter));
    },
  });
}
