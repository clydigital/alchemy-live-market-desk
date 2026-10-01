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
    kind: "market_reaction" | "causal_link" | "threshold" | "catalyst" | "countercase" | "positioning" | "technical_level" | "article_hook" | "research_question";
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
          kind: { type: "string", enum: ["market_reaction", "causal_link", "threshold", "catalyst", "countercase", "positioning", "technical_level", "article_hook", "research_question"] },
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
    const allowedKinds = new Set(["market_reaction", "causal_link", "threshold", "catalyst", "countercase", "positioning", "technical_level", "article_hook", "research_question"]);
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


export const MAX_TRANSCRIPT_MOTION_LEADS = 16;

export type TranscriptMotionLeadTag =
  | "company_event"
  | "ticker"
  | "statistic"
  | "catalyst"
  | "market_reaction"
  | "technical"
  | "positioning"
  | "causal"
  | "countercase"
  | "writing_angle"
  | "research_question"
  | "interpretation";

export type TranscriptMotionLead = {
  kind: "claim" | TranscriptResearchReview["expertNotes"][number]["kind"];
  text: string;
  tags: TranscriptMotionLeadTag[];
  entities: string[];
  verificationNeeded: boolean;
  verificationTarget: string | null;
  searchPrompt: string | null;
  articleHook: string | null;
  priority: number;
};

const STATISTIC_PATTERN = /(?:[$€£¥]\s?\d|\b\d+(?:\.\d+)?\s?(?:%|bps?|basis points?|billion|million|trillion|bn|mn|x)\b)/i;
const COMPANY_EVENT_PATTERN = /\b(?:ipo|prospectus|filed|filing|earnings|revenue|loss(?:es)?|guidance|acquisition|merger|launch(?:ed)?|contract|partnership|buyback|offering|ceo|cfo|layoffs?)\b/i;
const TICKER_STOPWORDS = new Set(["AI", "IPO", "ETF", "CPI", "PPI", "PCE", "GDP", "PMI", "ISM", "FOMC", "CEO", "CFO", "USD", "US", "UK", "EU"]);

function looksLikeTicker(value: string) {
  return /^[A-Z][A-Z0-9.-]{1,5}$/.test(value) && !TICKER_STOPWORDS.has(value);
}

function leadEntities(text: string, terms: string[]) {
  const lowered = text.toLowerCase();
  return terms
    .filter((term) => lowered.includes(term.toLowerCase()))
    .slice(0, 8);
}

function pushTag(tags: TranscriptMotionLeadTag[], tag: TranscriptMotionLeadTag, when = true) {
  if (when && !tags.includes(tag)) tags.push(tag);
}

function expertTags(kind: TranscriptResearchReview["expertNotes"][number]["kind"]): TranscriptMotionLeadTag[] {
  if (kind === "catalyst") return ["catalyst"];
  if (kind === "market_reaction") return ["market_reaction"];
  if (kind === "technical_level" || kind === "threshold") return ["technical"];
  if (kind === "positioning") return ["positioning"];
  if (kind === "causal_link") return ["causal", "interpretation"];
  if (kind === "countercase") return ["countercase", "interpretation"];
  if (kind === "article_hook") return ["writing_angle"];
  if (kind === "research_question") return ["research_question"];
  return [];
}

function leadPriority(kind: TranscriptMotionLead["kind"], reviewScore: number, verificationNeeded: boolean) {
  const base = Math.max(0, Math.min(100, reviewScore));
  if (kind === "article_hook") return Math.max(base, 92);
  if (kind === "research_question") return Math.max(base, 90);
  if (kind === "catalyst") return Math.max(base, 88);
  if (kind === "market_reaction") return Math.max(base, 84);
  if (kind === "claim" && verificationNeeded) return Math.max(base, 86);
  return base;
}

/**
 * Convert the structured transcript review into small discovery leads for Market Motion.
 * This is a projection of creator research, not verification and not a Motion promotion decision.
 */
export function buildTranscriptMotionLeads(review: TranscriptResearchReview): TranscriptMotionLead[] {
  const terms = [...new Set((review.termsDetected || []).map((term) => clean(term, 80)).filter(Boolean))];
  const leads: TranscriptMotionLead[] = [];

  for (const item of review.claimChecks || []) {
    const text = clean(item.claim, 600);
    if (!text) continue;
    const entities = leadEntities(text, terms);
    const tags: TranscriptMotionLeadTag[] = [];
    pushTag(tags, "statistic", STATISTIC_PATTERN.test(text));
    pushTag(tags, "company_event", COMPANY_EVENT_PATTERN.test(text));
    pushTag(tags, "interpretation", item.kind === "interpretation");
    pushTag(tags, "market_reaction", item.kind === "market_observation");
    pushTag(tags, "ticker", entities.some(looksLikeTicker));
    const verificationNeeded = Boolean(item.verificationNeeded);
    const verificationTarget = clean(item.verificationTarget, 300) || null;
    leads.push({
      kind: "claim",
      text,
      tags,
      entities,
      verificationNeeded,
      verificationTarget,
      searchPrompt: verificationTarget || (verificationNeeded ? `Verify creator claim: ${text}` : null),
      articleHook: null,
      priority: leadPriority("claim", review.researchLeadScore, verificationNeeded),
    });
  }

  for (const item of review.expertNotes || []) {
    const text = clean(item.note, 600);
    if (!text) continue;
    const entities = leadEntities(text, terms);
    const tags = expertTags(item.kind);
    pushTag(tags, "statistic", STATISTIC_PATTERN.test(text));
    pushTag(tags, "company_event", COMPANY_EVENT_PATTERN.test(text));
    pushTag(tags, "ticker", entities.some(looksLikeTicker));
    const verificationNeeded = !["article_hook", "research_question"].includes(item.kind);
    leads.push({
      kind: item.kind,
      text,
      tags,
      entities,
      verificationNeeded,
      verificationTarget: null,
      searchPrompt: item.kind === "research_question"
        ? text
        : verificationNeeded
          ? `Verify transcript lead: ${text}`
          : null,
      articleHook: item.kind === "article_hook" ? text : null,
      priority: leadPriority(item.kind, review.researchLeadScore, verificationNeeded),
    });
  }

  const seen = new Set<string>();
  return leads
    .filter((lead) => {
      const key = lead.text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => right.priority - left.priority)
    .slice(0, MAX_TRANSCRIPT_MOTION_LEADS);
}

/** Preserve the creator's opening frame and final conditional conclusions when a transcript is unusually long. */
export function boundedTranscriptForReview(text: string, maxChars = 48_000) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxChars) return cleaned;
  const head = Math.floor(maxChars * 0.64);
  const tail = maxChars - head;
  return `${cleaned.slice(0, head)}\n\n[...middle omitted for bounded review...]\n\n${cleaned.slice(-tail)}`;
}
