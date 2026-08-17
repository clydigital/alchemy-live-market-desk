import "server-only";

import {
  OpenAIStageError,
  intelligenceModel,
  parseStructuredProviderResponse,
} from "./hypothesis-core.ts";

export function responsesCompatibleJsonSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(responsesCompatibleJsonSchema);
  if (!value || typeof value !== "object") return value;

  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === "uniqueItems") continue;
    output[key] = responsesCompatibleJsonSchema(child);
  }
  return output;
}

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

  let lastError: OpenAIStageError | null = null;
  for (let attempt = 0; attempt < attemptLimit; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "OpenAI request failed before receiving a response.";
      lastError = new OpenAIStageError(message, {
        code: error instanceof DOMException && error.name === "TimeoutError" ? "timeout" : "network_error",
        retryable: true,
        model,
      });
      if (attempt < attemptLimit - 1) {
        await sleep(retryDelay(attempt, null));
        continue;
      }
      throw lastError;
    }

    const requestId = response.headers.get("x-request-id");
    const responseText = await response.text();

    try {
      return parseStructuredProviderResponse<T>({
        status: response.status,
        ok: response.ok,
        requestId,
        responseText,
        fallbackModel: model,
        maxOutputTokens,
      });
    } catch (error) {
      if (error instanceof OpenAIStageError) {
        lastError = error;
        if (error.retryable && attempt < attemptLimit - 1) {
          await sleep(retryDelay(attempt, response.headers.get("retry-after")));
          continue;
        }
      }
      throw error;
    }
  }

  throw lastError || new OpenAIStageError("OpenAI stage failed.", { code: "unknown" });
}
