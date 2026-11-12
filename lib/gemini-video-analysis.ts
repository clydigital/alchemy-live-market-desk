import { GoogleGenAI } from "@google/genai";

import {
  GEMINI_SUMMARY_ONLY_LABEL,
  GEMINI_VIDEO_ANALYSIS_RESPONSE_SCHEMA,
  GEMINI_VIDEO_ANALYSIS_SCHEMA_VERSION,
  validateGeminiVideoAnalysis,
  type GeminiVideoAnalysisResult,
} from "./gemini-video-analysis-contract.ts";

const DEFAULT_MODEL = "gemini-3.8-flash";
export const DEFAULT_GEMINI_VIDEO_ANALYSIS_TIMEOUT_MS = 90_000;
const MAX_RESPONSE_BYTES = 1_000_000;

export const GEMINI_VIDEO_ANALYSIS_PROMPT = `Analyse this public YouTube video for Bluebelly's PRIVATE creator-market intelligence.
This is a SUMMARY-ONLY FALLBACK after original-caption/transcript retrieval failed. It is NOT a transcript, independently verified market evidence, a trade signal or a public Story.

Return a COMPREHENSIVE, GRANULAR analysis in the existing JSON schema:
1. mainThesis: the creator's central argument, including what changed from their previously stated view ONLY if the video itself establishes a comparison.
2. directionalBias and conviction: the speaker's expressed stance (not the model's forecast).
3. claims: create a SEPARATE bullet-point-equivalent claim object for EACH distinct material point (up to 50). Do not collapse different bullish and bearish arguments into a generic summary. Begin claim.text with one suitable prefix:
   VIEW — asset/ticker, directional outlook, timeframe and mechanism;
   SUGGESTION — what the creator explicitly suggests buying/selling/shorting/holding/avoiding/waiting for, and whether it is a suggestion, personal position or hypothetical setup;
   TRIGGER — the exact conditional entry, exit, confirmation or invalidation test they state;
   WATCH — catalyst, expected announcement, instrument, timing and observation to monitor;
   RISK — exposure, debt, leverage, earnings, financing, macro or alternative scenario raised by the creator;
   COUNTERCASE — an opposing interpretation or what would prove their view wrong;
   MECHANISM — a concrete cause-and-effect chain the creator advances;
   RESEARCH QUESTION — a consequential unresolved claim worth independent verification.
4. Include bull AND bear views, specific opportunities, tickers, technical levels, market breadth, rates, policy/earnings, physical supply-demand and financing where the VIDEO discusses them. Do not add these topics if absent.
5. For every claim: use classification=creator_claim for statements attributable to the speaker; observable_content only for genuinely visible/audible material, which is not externally verified; inference ONLY for your own clearly labelled interpretation. Use figures[] and dates[] only for values actually given, retain the context and units in text, and provide timestampSeconds only when directly recoverable. Set requiresVerification=true and a SPECIFIC verificationTarget for market figures, news, levels, flows and causal assertions.
6. uncertainty: itemise missing information, access gaps, weak sourcing and the creator's expressed uncertainty.
7. contradictions: itemise internal inconsistencies, counterarguments and tensions without inventing opposition.
8. summary: a concise synthesis of the creator's current view, most actionable research questions and strongest countercase. The detail belongs in the atomic claims above.

Do NOT manufacture quotes, motives, trades, market measurements, timelines, timestamps, or video content.
Do not treat ETF turnover as net inflow, price moves as institutional money flow, or a creator's data as independently confirmed.
If you inspected only part of the video, set accessStatus=partial and describe coverage limits.
If you cannot actually inspect its content, set accessStatus=unavailable; do not fabricate bullets from a title or description.
Do not invent facts, timestamps or quotations.
Classify every claim as creator_claim, observable_content, or inference.`;

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
      // The rescue is a time-bounded summary, not a deep reasoning or evidence pass.
      // Gemini 3.8 Flash supports low thinking effort on the Interactions API.
      generation_config: { thinking_level: "low" },
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
    // Retain only a bounded HTTP status code: SDK errors can contain request
    // bodies, URL context or credentials that must not enter the intake ledger.
    const status = error && typeof error === "object" && "status" in error
      ? (error as { status?: unknown }).status
      : undefined;
    const httpStatus = typeof status === "number" && Number.isInteger(status)
      && status >= 400 && status <= 599 ? status : null;
    throw new GeminiVideoAnalysisError(
      "provider_error",
      httpStatus === null
        ? "Gemini video analysis failed (HTTP status unavailable)."
        : `Gemini video analysis failed (HTTP ${httpStatus}).`,
    );
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
  const timeoutMs = Math.max(1, Math.min(options.timeoutMs ?? DEFAULT_GEMINI_VIDEO_ANALYSIS_TIMEOUT_MS, 120_000));
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
