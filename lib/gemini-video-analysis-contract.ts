export const GEMINI_VIDEO_ANALYSIS_SCHEMA_VERSION = "gemini-video-analysis/1" as const;
export const GEMINI_SUMMARY_ONLY_LABEL = "GEMINI_SUMMARY_ONLY" as const;

export type GeminiVideoClaim = {
  text: string;
  classification: "creator_claim" | "observable_content" | "inference";
  timestampSeconds: number | null;
  figures: string[];
  dates: string[];
  requiresVerification: boolean;
  verificationTarget: string | null;
};

export type GeminiVideoAnalysis = {
  schemaVersion: typeof GEMINI_VIDEO_ANALYSIS_SCHEMA_VERSION;
  accessStatus: "full" | "partial" | "unavailable";
  mainThesis: string;
  directionalBias: "bullish" | "bearish" | "neutral" | "mixed" | "unclear";
  conviction: "high" | "medium" | "low" | "unclear";
  claims: GeminiVideoClaim[];
  uncertainty: string[];
  contradictions: string[];
  summary: string;
};

export type GeminiVideoAnalysisResult = {
  provider: "gemini";
  evidenceLabel: typeof GEMINI_SUMMARY_ONLY_LABEL;
  model: string;
  promptVersion: typeof GEMINI_VIDEO_ANALYSIS_SCHEMA_VERSION;
  analysis: GeminiVideoAnalysis;
};

export const GEMINI_VIDEO_ANALYSIS_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    schemaVersion: { type: "string", enum: [GEMINI_VIDEO_ANALYSIS_SCHEMA_VERSION] },
    accessStatus: { type: "string", enum: ["full", "partial", "unavailable"] },
    mainThesis: { type: "string" },
    directionalBias: { type: "string", enum: ["bullish", "bearish", "neutral", "mixed", "unclear"] },
    conviction: { type: "string", enum: ["high", "medium", "low", "unclear"] },
    claims: {
      type: "array",
      maxItems: 50,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: { type: "string" },
          classification: { type: "string", enum: ["creator_claim", "observable_content", "inference"] },
          timestampSeconds: { type: ["number", "null"], minimum: 0 },
          figures: { type: "array", items: { type: "string" }, maxItems: 20 },
          dates: { type: "array", items: { type: "string" }, maxItems: 20 },
          requiresVerification: { type: "boolean" },
          verificationTarget: { type: ["string", "null"] },
        },
        required: [
          "text",
          "classification",
          "timestampSeconds",
          "figures",
          "dates",
          "requiresVerification",
          "verificationTarget",
        ],
      },
    },
    uncertainty: { type: "array", items: { type: "string" }, maxItems: 20 },
    contradictions: { type: "array", items: { type: "string" }, maxItems: 20 },
    summary: { type: "string" },
  },
  required: [
    "schemaVersion",
    "accessStatus",
    "mainThesis",
    "directionalBias",
    "conviction",
    "claims",
    "uncertainty",
    "contradictions",
    "summary",
  ],
};

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string, maximum = 2_000) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must be a non-empty string.`);
  return value.trim().slice(0, maximum);
}

function nullableText(value: unknown, field: string, maximum = 1_000) {
  return value === null ? null : text(value, field, maximum);
}

function enumeration<T extends string>(value: unknown, field: string, values: readonly T[]): T {
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new Error(`${field} is unsupported.`);
  }
  return value as T;
}

function textArray(value: unknown, field: string, maximumItems = 20) {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array.`);
  return value.slice(0, maximumItems).map((item, index) => text(item, `${field}[${index}]`, 1_000));
}

export function validateGeminiVideoAnalysis(value: unknown): GeminiVideoAnalysis {
  const analysis = record(value, "analysis");
  if (analysis.schemaVersion !== GEMINI_VIDEO_ANALYSIS_SCHEMA_VERSION) {
    throw new Error("schemaVersion is unsupported.");
  }
  if (!Array.isArray(analysis.claims)) throw new Error("claims must be an array.");

  return {
    schemaVersion: GEMINI_VIDEO_ANALYSIS_SCHEMA_VERSION,
    accessStatus: enumeration(analysis.accessStatus, "accessStatus", ["full", "partial", "unavailable"]),
    mainThesis: text(analysis.mainThesis, "mainThesis"),
    directionalBias: enumeration(analysis.directionalBias, "directionalBias", ["bullish", "bearish", "neutral", "mixed", "unclear"]),
    conviction: enumeration(analysis.conviction, "conviction", ["high", "medium", "low", "unclear"]),
    claims: analysis.claims.slice(0, 50).map((candidate, index): GeminiVideoClaim => {
      const claim = record(candidate, `claims[${index}]`);
      const timestamp = claim.timestampSeconds;
      if (timestamp !== null && (typeof timestamp !== "number" || !Number.isFinite(timestamp) || timestamp < 0)) {
        throw new Error(`claims[${index}].timestampSeconds must be null or a non-negative finite number.`);
      }
      if (typeof claim.requiresVerification !== "boolean") {
        throw new Error(`claims[${index}].requiresVerification must be boolean.`);
      }
      return {
        text: text(claim.text, `claims[${index}].text`),
        classification: enumeration(
          claim.classification,
          `claims[${index}].classification`,
          ["creator_claim", "observable_content", "inference"],
        ),
        timestampSeconds: timestamp,
        figures: textArray(claim.figures, `claims[${index}].figures`),
        dates: textArray(claim.dates, `claims[${index}].dates`),
        requiresVerification: claim.requiresVerification,
        verificationTarget: nullableText(claim.verificationTarget, `claims[${index}].verificationTarget`),
      };
    }),
    uncertainty: textArray(analysis.uncertainty, "uncertainty"),
    contradictions: textArray(analysis.contradictions, "contradictions"),
    summary: text(analysis.summary, "summary"),
  };
}
