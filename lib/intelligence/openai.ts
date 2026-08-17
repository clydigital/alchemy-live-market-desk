import "server-only";
import { createHash } from "node:crypto";

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

export class OpenAIStageError extends Error {
  code: string;
  status: number | null;
  retryable: boolean;
  model: string | null;
  requestId: string | null;
  responseId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  providerStatus: string | null;
  incompleteReason: string | null;
  generatedLength: number | null;
  generatedHash: string | null;

  constructor(
    message: string,
    options: {
      code: string;
      status?: number | null;
      retryable?: boolean;
      model?: string | null;
      requestId?: string | null;
      responseId?: string | null;
      inputTokens?: number | null;
      outputTokens?: number | null;
      totalTokens?: number | null;
      providerStatus?: string | null;
      incompleteReason?: string | null;
      generatedLength?: number | null;
      generatedHash?: string | null;
    },
  ) {
    super(message);
    this.name = "OpenAIStageError";
    this.code = options.code;
    this.status = options.status ?? null;
    this.retryable = options.retryable ?? false;
    this.model = options.model ?? null;
    this.requestId = options.requestId ?? null;
    this.responseId = options.responseId ?? null;
    this.inputTokens = options.inputTokens ?? null;
    this.outputTokens = options.outputTokens ?? null;
    this.totalTokens = options.totalTokens ?? null;
    this.providerStatus = options.providerStatus ?? null;
    this.incompleteReason = options.incompleteReason ?? null;
    this.generatedLength = options.generatedLength ?? null;
    this.generatedHash = options.generatedHash ?? null;
  }
}

type ResponseOutputItem = {
  type?: string;
  content?: Array<{
    type?: string;
    text?: string;
    refusal?: string;
  }>;
};

type ResponsesApiPayload = {
  id?: string;
  model?: string;
  status?: string;
  incomplete_details?: {
    reason?: string;
  };
  output?: ResponseOutputItem[];
  output_text?: string;
  error?: { message?: string; code?: string };
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
};

const API_URL = "https://api.openai.com/v1/responses";
const DEFAULT_COMPLEX_MODEL = "gpt-5-mini";
const DEFAULT_FAST_MODEL = "gpt-5-mini";
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

export function intelligenceModel(kind: "complex" | "fast") {
  if (kind === "fast") {
    return process.env.OPENAI_INTELLIGENCE_FAST_MODEL?.trim()
      || process.env.OPENAI_INTELLIGENCE_MODEL?.trim()
      || DEFAULT_FAST_MODEL;
  }
  return process.env.OPENAI_INTELLIGENCE_MODEL?.trim() || DEFAULT_COMPLEX_MODEL;
}

export function intelligenceReasoningEffort(kind: "complex" | "fast"): IntelligenceReasoningEffort {
  const configured = (kind === "fast"
    ? process.env.OPENAI_INTELLIGENCE_FAST_REASONING_EFFORT
    : process.env.OPENAI_INTELLIGENCE_REASONING_EFFORT)?.trim() as IntelligenceReasoningEffort | undefined;
  if (configured && VALID_EFFORT.has(configured)) return configured;
  return kind === "complex" ? "medium" : "low";
}

/**
 * The Responses structured-output subset does not accept every JSON Schema
 * keyword. `uniqueItems`, for example, is rejected before inference starts.
 * Remove only that unsupported presentation constraint at the provider edge;
 * canonical requirement IDs are still deduplicated and scope-validated after
 * model output by the deterministic research-state validators.
 */
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

function outputText(payload: ResponsesApiPayload, telemetry?: {
  status: number;
  model: string;
  requestId: string | null;
  responseId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  providerStatus: string | null;
  incompleteReason: string | null;
}) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  const chunks: string[] = [];
  for (const item of payload.output ?? []) {
    for (const part of item.content ?? []) {
      if (part.type === "refusal" && part.refusal) {
        throw new OpenAIStageError(part.refusal, {
          code: "provider_refusal",
          status: telemetry?.status ?? null,
          retryable: false,
          model: telemetry?.model ?? null,
          requestId: telemetry?.requestId ?? null,
          responseId: telemetry?.responseId ?? null,
          inputTokens: telemetry?.inputTokens ?? null,
          outputTokens: telemetry?.outputTokens ?? null,
          totalTokens: telemetry?.totalTokens ?? null,
          providerStatus: telemetry?.providerStatus ?? null,
          incompleteReason: telemetry?.incompleteReason ?? null,
        });
      }
      if (part.type === "output_text" && typeof part.text === "string") chunks.push(part.text);
    }
  }
  return chunks.join("\n").trim();
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
    const text = await response.text();
    let payload: ResponsesApiPayload;
    try {
      payload = text ? JSON.parse(text) as ResponsesApiPayload : {};
    } catch {
      throw new OpenAIStageError(`OpenAI returned malformed JSON (HTTP ${response.status}).`, {
        code: "malformed_provider_response",
        status: response.status,
        model,
        requestId,
        retryable: response.status >= 500,
      });
    }

    const responseId = payload.id ?? null;
    const modelName = payload.model || model;
    const inputTokens = payload.usage?.input_tokens ?? null;
    const outputTokens = payload.usage?.output_tokens ?? null;
    const totalTokens = payload.usage?.total_tokens ?? null;
    const providerStatus = payload.status ?? null;
    const incompleteReason = payload.incomplete_details?.reason ?? null;

    const commonTelemetry = {
      model: modelName,
      requestId,
      responseId,
      inputTokens,
      outputTokens,
      totalTokens,
      providerStatus,
      incompleteReason,
    };

    if (!response.ok) {
      const retryable = response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500;
      lastError = new OpenAIStageError(
        payload.error?.message || `OpenAI returned HTTP ${response.status}.`,
        {
          code: payload.error?.code || `http_${response.status}`,
          status: response.status,
          retryable,
          ...commonTelemetry,
        },
      );
      if (retryable && attempt < attemptLimit - 1) {
        await sleep(retryDelay(attempt, response.headers.get("retry-after")));
        continue;
      }
      throw lastError;
    }

    if (providerStatus === "incomplete" || incompleteReason === "max_output_tokens") {
      lastError = new OpenAIStageError(
        `OpenAI response was incomplete (${incompleteReason || "truncated"}).`,
        {
          code: "incomplete_provider_response",
          status: response.status,
          retryable: true,
          ...commonTelemetry,
        },
      );
      if (attempt < attemptLimit - 1) {
        await sleep(retryDelay(attempt, null));
        continue;
      }
      throw lastError;
    }

    const generated = outputText(payload, { status: response.status, ...commonTelemetry });
    if (!generated) {
      lastError = new OpenAIStageError("OpenAI returned no structured output text.", {
        code: "empty_provider_response",
        status: response.status,
        retryable: true,
        ...commonTelemetry,
      });
      if (attempt < attemptLimit - 1) {
        await sleep(retryDelay(attempt, null));
        continue;
      }
      throw lastError;
    }

    const generatedLength = generated.length;
    const generatedHash = createHash("sha256").update(generated).digest("hex").slice(0, 16);

    let data: T;
    try {
      data = JSON.parse(generated) as T;
    } catch {
      if (outputTokens !== null && outputTokens >= maxOutputTokens) {
        lastError = new OpenAIStageError(
          `OpenAI response was incomplete (output token limit reached: ${outputTokens}/${maxOutputTokens}).`,
          {
            code: "incomplete_provider_response",
            status: response.status,
            retryable: true,
            ...commonTelemetry,
            generatedLength,
            generatedHash,
          },
        );
      } else {
        lastError = new OpenAIStageError("OpenAI structured output could not be parsed as JSON.", {
          code: "malformed_structured_output",
          status: response.status,
          retryable: true,
          ...commonTelemetry,
          generatedLength,
          generatedHash,
        });
      }
      if (attempt < attemptLimit - 1) {
        await sleep(retryDelay(attempt, null));
        continue;
      }
      throw lastError;
    }

    return {
      data,
      requestId,
      responseId,
      model: modelName,
      inputTokens,
      outputTokens,
      totalTokens,
    };
  }

  throw lastError || new OpenAIStageError("OpenAI stage failed.", { code: "unknown" });
}
