export type TranscriptResearchReview = {
  summary: string;
  creatorLogic: string;
  recontextualizedSummary: string;
  termsDetected: string[];
  claimChecks: Array<{
    claim: string;
    kind: "creator_claim" | "cited_fact" | "market_observation" | "interpretation";
    verificationNeeded: boolean;
    verificationTarget: string | null;
  }>;
  expertNotes: Array<{
    kind: "market_reaction" | "causal_link" | "threshold" | "catalyst" | "countercase" | "positioning" | "technical_level";
    note: string;
  }>;
  affectedStorySlugs: string[];
  researchLeadScore: number;
};

const stringArray10 = { type: "array", maxItems: 10, items: { type: "string" } };

export const TRANSCRIPT_RESEARCH_REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "creatorLogic",
    "recontextualizedSummary",
    "termsDetected",
    "claimChecks",
    "expertNotes",
    "affectedStorySlugs",
    "researchLeadScore",
  ],
  properties: {
    summary: { type: "string" },
    creatorLogic: { type: "string" },
    recontextualizedSummary: { type: "string" },
    termsDetected: stringArray10,
    claimChecks: {
      type: "array",
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["claim", "kind", "verificationNeeded", "verificationTarget"],
        properties: {
          claim: { type: "string" },
          kind: { type: "string", enum: ["creator_claim", "cited_fact", "market_observation", "interpretation"] },
          verificationNeeded: { type: "boolean" },
          verificationTarget: { type: ["string", "null"] },
        },
      },
    },
    expertNotes: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "note"],
        properties: {
          kind: { type: "string", enum: ["market_reaction", "causal_link", "threshold", "catalyst", "countercase", "positioning", "technical_level"] },
          note: { type: "string" },
        },
      },
    },
    affectedStorySlugs: { type: "array", maxItems: 6, items: { type: "string" }, uniqueItems: true },
    researchLeadScore: { type: "number", minimum: 0, maximum: 100 },
  },
} as const;

function clean(value: unknown, max = 2_000) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

export function normaliseTranscriptResearchReview(
  review: TranscriptResearchReview,
  allowedStorySlugs: ReadonlySet<string>,
): TranscriptResearchReview {
  const termsDetected = [...new Set((review.termsDetected ?? []).map((item) => clean(item, 80)).filter(Boolean))].slice(0, 10);
  const affectedStorySlugs = [...new Set((review.affectedStorySlugs ?? []).filter((slug) => allowedStorySlugs.has(slug)))].slice(0, 6);
  const claimChecks = (review.claimChecks ?? []).flatMap((item) => {
    const claim = clean(item.claim, 600);
    if (!claim) return [];
    const allowedKinds = new Set(["creator_claim", "cited_fact", "market_observation", "interpretation"]);
    return [{
      claim,
      kind: allowedKinds.has(item.kind) ? item.kind : "creator_claim" as const,
      verificationNeeded: Boolean(item.verificationNeeded),
      verificationTarget: clean(item.verificationTarget, 300) || null,
    }];
  }).slice(0, 10) as TranscriptResearchReview["claimChecks"];
  const expertNotes = (review.expertNotes ?? []).flatMap((item) => {
    const note = clean(item.note, 600);
    if (!note) return [];
    const allowedKinds = new Set(["market_reaction", "causal_link", "threshold", "catalyst", "countercase", "positioning", "technical_level"]);
    return allowedKinds.has(item.kind) ? [{ kind: item.kind, note }] : [];
  }).slice(0, 8) as TranscriptResearchReview["expertNotes"];
  return {
    summary: clean(review.summary, 1_500),
    creatorLogic: clean(review.creatorLogic, 2_500),
    recontextualizedSummary: clean(review.recontextualizedSummary, 2_000),
    termsDetected,
    claimChecks,
    expertNotes,
    affectedStorySlugs,
    researchLeadScore: Math.max(0, Math.min(100, Math.round(Number(review.researchLeadScore) || 0))),
  };
}

/** Preserve the creator's opening frame and final conditional conclusions when a transcript is unusually long. */
export function boundedTranscriptForReview(text: string, maxChars = 48_000) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxChars) return cleaned;
  const head = Math.floor(maxChars * 0.64);
  const tail = maxChars - head;
  return `${cleaned.slice(0, head)}\n\n[...middle omitted for bounded review...]\n\n${cleaned.slice(-tail)}`;
}
