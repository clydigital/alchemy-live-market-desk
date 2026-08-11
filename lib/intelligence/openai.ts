import "server-only";

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

  constructor(message: string, options: { code: string; status?: number | null; retryable?: boolean }) {
    super(message);
    this.name = "OpenAIStageError";
    this.code = options.code;
    this.status = options.status ?? null;
    this.retryable = options.retryable ?? false;
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
const DEFAULT_COMPLEX_MODEL = "gpt-5.6-terra";
const DEFAULT_FAST_MODEL = "gpt-5.6-luna";
const VALID_EFFORT = new Set<IntelligenceReasoningEffort>(["none", "low", "medium", "high", "xhigh", "max"]);

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

function outputText(payload: ResponsesApiPayload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  const chunks: string[] = [];
  for (const item of payload.output ?? []) {
    for (const part of item.content ?? []) {
      if (part.type === "refusal" && part.refusal) {
        throw new OpenAIStageError(part.refusal, { code: "provider_refusal" });
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

export async function runStructuredStage<T>({
  stageKey,
  instructions,
  input,
  schema,
  modelKind = "complex",
  maxOutputTokens = 4_000,
}: {
  stageKey: string;
  instructions: string;
  input: unknown;
  schema: JsonSchema;
  modelKind?: "complex" | "fast";
  maxOutputTokens?: number;
}): Promise<OpenAIStageResult<T>> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new OpenAIStageError("OPENAI_API_KEY is not configured.", {
      code: "configuration_required",
    });
  }

  const model = intelligenceModel(modelKind);
  const effort = intelligenceReasoningEffort(modelKind);
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
        schema,
      },
    },
    max_output_tokens: maxOutputTokens,
    store: false,
  };

  let lastError: OpenAIStageError | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
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
        signal: AbortSignal.timeout(60_000),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "OpenAI request failed before receiving a response.";
      lastError = new OpenAIStageError(message, {
        code: error instanceof DOMException && error.name === "TimeoutError" ? "timeout" : "network_error",
        retryable: true,
      });
      if (attempt < 2) {
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
      });
    }

    if (!response.ok) {
      const retryable = response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500;
      lastError = new OpenAIStageError(
        payload.error?.message || `OpenAI returned HTTP ${response.status}.`,
        {
          code: payload.error?.code || `http_${response.status}`,
          status: response.status,
          retryable,
        },
      );
      if (retryable && attempt < 2) {
        await sleep(retryDelay(attempt, response.headers.get("retry-after")));
        continue;
      }
      throw lastError;
    }

    const generated = outputText(payload);
    if (!generated) {
      throw new OpenAIStageError("OpenAI returned no structured output text.", {
        code: "empty_provider_response",
        status: response.status,
      });
    }

    let data: T;
    try {
      data = JSON.parse(generated) as T;
    } catch {
      throw new OpenAIStageError("OpenAI structured output could not be parsed as JSON.", {
        code: "malformed_structured_output",
        status: response.status,
      });
    }

    return {
      data,
      requestId,
      responseId: payload.id ?? null,
      model: payload.model || model,
      inputTokens: payload.usage?.input_tokens ?? null,
      outputTokens: payload.usage?.output_tokens ?? null,
      totalTokens: payload.usage?.total_tokens ?? null,
    };
  }

  throw lastError || new OpenAIStageError("OpenAI stage failed.", { code: "unknown" });
}
