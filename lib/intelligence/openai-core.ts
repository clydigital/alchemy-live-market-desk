import { createHash } from "node:crypto";

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

export function intelligenceModel(kind: "complex" | "fast") {
  const defaultModel = "gpt-5-mini";
  if (kind === "fast") {
    return process.env.OPENAI_INTELLIGENCE_FAST_MODEL?.trim()
      || process.env.OPENAI_INTELLIGENCE_MODEL?.trim()
      || defaultModel;
  }
  return process.env.OPENAI_INTELLIGENCE_MODEL?.trim() || defaultModel;
}

export type ResponsesApiPayload = {
  id?: string;
  model?: string;
  status?: string;
  incomplete_details?: {
    reason?: string;
  };
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      refusal?: string;
    }>;
  }>;
  output_text?: string;
  error?: { message?: string; code?: string };
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
};

export function extractOutputText(payload: ResponsesApiPayload, telemetry?: {
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

export function parseStructuredProviderResponse<T>(input: {
  status: number;
  ok: boolean;
  requestId: string | null;
  responseText: string;
  fallbackModel: string;
  maxOutputTokens?: number;
}): {
  data: T;
  requestId: string | null;
  responseId: string | null;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
} {
  let payload: ResponsesApiPayload;
  try {
    payload = input.responseText ? (JSON.parse(input.responseText) as ResponsesApiPayload) : {};
  } catch {
    throw new OpenAIStageError(`OpenAI returned malformed JSON (HTTP ${input.status}).`, {
      code: "malformed_provider_response",
      status: input.status,
      model: input.fallbackModel,
      requestId: input.requestId,
      retryable: input.status >= 500,
    });
  }

  const responseId = payload.id ?? null;
  const modelName = payload.model || input.fallbackModel;
  const inputTokens = payload.usage?.input_tokens ?? null;
  const outputTokens = payload.usage?.output_tokens ?? null;
  const totalTokens = payload.usage?.total_tokens ?? null;
  const providerStatus = payload.status ?? null;
  const incompleteReason = payload.incomplete_details?.reason ?? null;

  const commonTelemetry = {
    model: modelName,
    requestId: input.requestId,
    responseId,
    inputTokens,
    outputTokens,
    totalTokens,
    providerStatus,
    incompleteReason,
  };

  if (!input.ok) {
    const retryable = input.status === 408 || input.status === 409 || input.status === 429 || input.status >= 500;
    throw new OpenAIStageError(
      payload.error?.message || `OpenAI returned HTTP ${input.status}.`,
      {
        code: payload.error?.code || `http_${input.status}`,
        status: input.status,
        retryable,
        ...commonTelemetry,
      },
    );
  }

  if (providerStatus === "failed" || payload.error) {
    throw new OpenAIStageError(
      payload.error?.message || "OpenAI provider returned failed status.",
      {
        code: payload.error?.code || "provider_failed",
        status: input.status,
        retryable: false,
        ...commonTelemetry,
      },
    );
  }

  if (providerStatus === "incomplete" || incompleteReason) {
    const isTokenExhaustion = incompleteReason === "max_tokens";
    throw new OpenAIStageError(
      `OpenAI response was incomplete (${incompleteReason || "truncated"}).`,
      {
        code: "incomplete_provider_response",
        status: input.status,
        retryable: isTokenExhaustion,
        ...commonTelemetry,
      },
    );
  }

  const generated = extractOutputText(payload, { status: input.status, ...commonTelemetry });
  if (!generated) {
    throw new OpenAIStageError("OpenAI returned no structured output text.", {
      code: "empty_provider_response",
      status: input.status,
      retryable: true,
      ...commonTelemetry,
    });
  }

  const generatedLength = generated.length;
  const generatedHash = createHash("sha256").update(generated).digest("hex").slice(0, 16);

  let data: T;
  try {
    data = JSON.parse(generated) as T;
  } catch {
    const maxTokens = input.maxOutputTokens ?? 4_000;
    if (outputTokens !== null && outputTokens >= maxTokens) {
      throw new OpenAIStageError(
        `OpenAI response was incomplete (output token limit reached: ${outputTokens}/${maxTokens}).`,
        {
          code: "incomplete_provider_response",
          status: input.status,
          retryable: true,
          ...commonTelemetry,
          generatedLength,
          generatedHash,
        },
      );
    }
    throw new OpenAIStageError("OpenAI structured output could not be parsed as JSON.", {
      code: "malformed_structured_output",
      status: input.status,
      retryable: true,
      ...commonTelemetry,
      generatedLength,
      generatedHash,
    });
  }

  return {
    data,
    requestId: input.requestId,
    responseId,
    model: modelName,
    inputTokens,
    outputTokens,
    totalTokens,
  };
}

export async function executeProviderWithRetry<T>(input: {
  fetcher: () => Promise<{ status: number; ok: boolean; requestId: string | null; responseText: string; retryAfter?: string | null }>;
  fallbackModel: string;
  maxOutputTokens?: number;
  maxAttempts?: number;
  sleepFn?: (attempt: number, retryAfter: string | null) => Promise<void>;
}): Promise<{ data: T; requestId: string | null; responseId: string | null; model: string; inputTokens: number | null; outputTokens: number | null; totalTokens: number | null }> {
  const attemptLimit = input.maxAttempts ?? 3;
  let lastError: OpenAIStageError | null = null;
  for (let attempt = 0; attempt < attemptLimit; attempt += 1) {
    let res;
    try {
      res = await input.fetcher();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Fetch failed.";
      lastError = new OpenAIStageError(message, {
        code: err instanceof DOMException && err.name === "TimeoutError" ? "timeout" : "network_error",
        retryable: true,
        model: input.fallbackModel,
      });
      if (attempt < attemptLimit - 1) {
        if (input.sleepFn) await input.sleepFn(attempt, null);
        continue;
      }
      throw lastError;
    }

    try {
      return parseStructuredProviderResponse<T>({
        status: res.status,
        ok: res.ok,
        requestId: res.requestId,
        responseText: res.responseText,
        fallbackModel: input.fallbackModel,
        maxOutputTokens: input.maxOutputTokens,
      });
    } catch (err) {
      if (err instanceof OpenAIStageError) {
        lastError = err;
        if (err.retryable && attempt < attemptLimit - 1) {
          if (input.sleepFn) await input.sleepFn(attempt, res.retryAfter ?? null);
          continue;
        }
      }
      throw err;
    }
  }
  throw lastError || new OpenAIStageError("Stage failed.", { code: "unknown" });
}

export function buildStageFailurePersistencePayload(input: {
  message: string;
  failureCode?: string | null;
  stageError?: OpenAIStageError | null;
}) {
  const stageError = input.stageError;
  const failureDetail = formatStageFailureDetail({
    message: input.message,
    failureCode: input.failureCode,
    providerStatus: stageError?.providerStatus,
    incompleteReason: stageError?.incompleteReason,
    responseId: stageError?.responseId,
    generatedLength: stageError?.generatedLength,
    generatedHash: stageError?.generatedHash,
    totalTokens: stageError?.totalTokens,
  });

  return {
    failureCode: input.failureCode || "stage_error",
    failureDetail,
    modelName: stageError?.model ?? null,
    providerRequestId: stageError ? (stageError.requestId || stageError.responseId) : null,
    inputTokens: stageError?.inputTokens ?? null,
    outputTokens: stageError?.outputTokens ?? null,
  };
}

export function formatStageFailureDetail(input: {
  message: string;
  failureCode?: string | null;
  providerStatus?: string | null;
  incompleteReason?: string | null;
  generatedLength?: number | null;
  generatedHash?: string | null;
  totalTokens?: number | null;
  responseId?: string | null;
}): string {
  const parts: string[] = [input.message];
  if (input.failureCode) parts.push(`code: ${input.failureCode}`);
  if (input.providerStatus) parts.push(`providerStatus: ${input.providerStatus}`);
  if (input.incompleteReason) parts.push(`incompleteReason: ${input.incompleteReason}`);
  if (input.responseId) parts.push(`responseId: ${input.responseId}`);
  if (input.generatedLength !== undefined && input.generatedLength !== null) {
    parts.push(`generatedLength: ${input.generatedLength}`);
  }
  if (input.generatedHash) parts.push(`generatedHash: ${input.generatedHash}`);
  if (input.totalTokens !== undefined && input.totalTokens !== null) {
    parts.push(`totalTokens: ${input.totalTokens}`);
  }
  return parts.join(" | ").slice(0, 2_000);
}
