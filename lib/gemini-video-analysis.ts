import { GoogleGenAI } from "@google/genai";

import {
  GEMINI_SUMMARY_ONLY_LABEL,
  GEMINI_VIDEO_ANALYSIS_RESPONSE_SCHEMA,
  GEMINI_VIDEO_ANALYSIS_SCHEMA_VERSION,
  validateGeminiVideoAnalysis,
  type GeminiVideoAnalysisResult,
} from "./gemini-video-analysis-contract.ts";

const DEFAULT_MODEL = "gemini-3.8-flash";
const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_RESPONSE_BYTES = 1_000_000;

export const GEMINI_VIDEO_ANALYSIS_PROMPT = `Analyse this public YouTube video for creator-market intelligence.

Return:
1. Main thesis
2. Directional bias and conviction
3. Key macro, market and news claims
4. Price levels, dates and figures
5. Timestamp for each claim where available
6. What the creator is uncertain about
7. Contradictory claims and claims requiring independent verification

Do not invent facts, timestamps or quotations.
Classify every claim as creator_claim, observable_content, or inference.
If the full video cannot be accessed, set accessStatus to unavailable and include only supported information.`;

export type GeminiVideoInteractionInput = {
  model: string;
  url: string;
  prompt: string;
  responseSchema: Record<string, unknown>;
  signal: AbortSignal;
};

export type GeminiVideoInteractionRunner = (
  input: GeminiVideoInteractionInput,
) => Promise<string>;

export class GeminiVideoAnalysisError extends Error {
  readonly code:
    | "invalid_video_url"
    | "not_configured"
    | "timeout"
    | "malformed_response"
    | "video_unavailable"
    | "provider_error";

  constructor(
    code:
      | "invalid_video_url"
      | "not_configured"
      | "timeout"
      | "malformed_response"
      | "video_unavailable"
      | "provider_error",
    message: string,
  ) {
    super(message);
    this.name = "GeminiVideoAnalysisError";
    this.code = code;
  }
}

export function isGeminiVideoAnalysisConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(env.GEMINI_API_KEY?.trim());
}

function validatePublicYouTubeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    const isYouTubeHost = host === "youtube.com"
      || host === "www.youtube.com"
      || host === "m.youtube.com"
      || host === "youtu.be";
    if (url.protocol !== "https:" || !isYouTubeHost) throw new Error("unsupported URL");
    return url.toString();
  } catch {
    throw new GeminiVideoAnalysisError(
      "invalid_video_url",
      "Gemini video analysis requires a public HTTPS YouTube URL.",
    );
  }
}

function defaultRunner(apiKey: string): GeminiVideoInteractionRunner {
  const ai = new GoogleGenAI({ apiKey });
  return async ({ model, url, prompt, responseSchema, signal }) => {
    const response = await ai.interactions.create({
      model,
      input: [
        { type: "text", text: prompt },
        { type: "video", uri: url },
      ],
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: responseSchema,
      },
    }, { signal });
    return response.output_text || "";
  };
}

async function runWithTimeout(
  runner: GeminiVideoInteractionRunner,
  request: Omit<GeminiVideoInteractionInput, "signal">,
  timeoutMs: number,
): Promise<string> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new GeminiVideoAnalysisError("timeout", "Gemini video analysis timed out."));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      runner({ ...request, signal: controller.signal }),
      timeoutPromise,
    ]);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new GeminiVideoAnalysisError("timeout", "Gemini video analysis timed out.");
    }
    if (error instanceof GeminiVideoAnalysisError) throw error;
    throw new GeminiVideoAnalysisError("provider_error", "Gemini video analysis failed.");
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function analysePublicYouTubeVideo(
  input: {
    url: string;
    apiKey?: string;
    model?: string;
  },
  options: {
    timeoutMs?: number;
    runInteraction?: GeminiVideoInteractionRunner;
  } = {},
): Promise<GeminiVideoAnalysisResult> {
  const url = validatePublicYouTubeUrl(input.url);
  const apiKey = input.apiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new GeminiVideoAnalysisError("not_configured", "Gemini video analysis is not configured.");
  }

  const model = input.model?.trim() || process.env.GEMINI_VIDEO_MODEL?.trim() || DEFAULT_MODEL;
  const timeoutMs = Math.max(1, Math.min(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, 120_000));
  const response = await runWithTimeout(
    options.runInteraction || defaultRunner(apiKey),
    {
      model,
      url,
      prompt: GEMINI_VIDEO_ANALYSIS_PROMPT,
      responseSchema: GEMINI_VIDEO_ANALYSIS_RESPONSE_SCHEMA,
    },
    timeoutMs,
  );

  if (Buffer.byteLength(response, "utf8") > MAX_RESPONSE_BYTES) {
    throw new GeminiVideoAnalysisError("malformed_response", "Gemini returned an oversized response.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(response);
  } catch {
    throw new GeminiVideoAnalysisError("malformed_response", "Gemini returned invalid JSON.");
  }

  let analysis;
  try {
    analysis = validateGeminiVideoAnalysis(parsed);
  } catch {
    throw new GeminiVideoAnalysisError("malformed_response", "Gemini returned an invalid analysis payload.");
  }
  if (analysis.accessStatus === "unavailable") {
    throw new GeminiVideoAnalysisError("video_unavailable", "Gemini could not access the public video.");
  }

  return {
    provider: "gemini",
    evidenceLabel: GEMINI_SUMMARY_ONLY_LABEL,
    model,
    promptVersion: GEMINI_VIDEO_ANALYSIS_SCHEMA_VERSION,
    analysis,
  };
}
