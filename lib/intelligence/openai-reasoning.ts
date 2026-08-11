import type { ReasoningProvider, StageDefinition, StageExecution } from "./contracts.ts";

type OpenAIResponse = {
  id?: string;
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { code?: string; message?: string };
};

export class ReasoningConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReasoningConfigurationError";
  }
}

function outputText(response: OpenAIResponse) {
  if (response.output_text) return response.output_text;
  return (response.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text" && item.text)
    .map((item) => item.text)
    .join("");
}

export class OpenAIReasoningProvider implements ReasoningProvider {
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly endpoint: string;

  constructor(
    apiKey = process.env.OPENAI_API_KEY,
    model = process.env.OPENAI_INTELLIGENCE_MODEL || "gpt-5-mini",
    endpoint = process.env.OPENAI_RESPONSES_ENDPOINT || "https://api.openai.com/v1/responses",
  ) {
    this.apiKey = apiKey;
    this.model = model;
    this.endpoint = endpoint;
  }

  async execute<TOutput>(definition: StageDefinition<TOutput>, input: unknown): Promise<StageExecution<TOutput>> {
    if (!this.apiKey) {
      throw new ReasoningConfigurationError(`OPENAI_API_KEY is required to execute the ${definition.key} intelligence stage.`);
    }

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        store: false,
        instructions: `${definition.instructions}\nReturn only the requested decision record. Do not return hidden reasoning or chain-of-thought. Preserve uncertainty and evidence references.`,
        input: JSON.stringify(input),
        max_output_tokens: 5000,
        text: {
          format: {
            type: "json_schema",
            name: `alchemy_${definition.key}_v${definition.version}`,
            description: `Alchemy Market Intelligence ${definition.key} stage output`,
            schema: definition.outputSchema,
            strict: false,
          },
        },
        metadata: {
          system: "alchemy_market_intelligence",
          stage: definition.key,
          prompt_version: String(definition.version),
        },
      }),
    });

    const payload = await response.json() as OpenAIResponse;
    if (!response.ok) {
      const requestId = response.headers.get("x-request-id");
      throw new Error(`${definition.key} failed (${payload.error?.code || response.status})${requestId ? ` request ${requestId}` : ""}: ${payload.error?.message || response.statusText}`);
    }
    const text = outputText(payload);
    if (!text) throw new Error(`${definition.key} returned no structured output.`);

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`${definition.key} returned invalid JSON.`);
    }

    return {
      stage: definition.key,
      version: definition.version,
      model: this.model,
      requestId: payload.id || response.headers.get("x-request-id"),
      inputTokens: payload.usage?.input_tokens ?? null,
      outputTokens: payload.usage?.output_tokens ?? null,
      output: definition.parse(parsed),
    };
  }
}
