import { getFourSlotResearchHealth, type FourSlotResearchHealth } from "@/lib/research-schedule-health";

export const REQUIRED_RESEARCH_SOURCES = [
  "stockedup",
  "wall-street-truth-bombs",
  "traders-reality",
  "zerohedge",
  "axios",
  "investing-com",
  "fxstreet",
  "alchemy-market-insights",
] as const;

export type ResearchSourceKey = typeof REQUIRED_RESEARCH_SOURCES[number];
export type ResearchScheduleSlot = "video_midnight" | "morning" | "video_late_morning" | "evening" | "manual";
export type SourceCheckStatus = "checked" | "no_new_items" | "blocked";
export type IntakeItemType = "video" | "news" | "alchemy_article";
export type RecommendedAction = "ignore" | "monitor" | "collect_evidence" | "review_article" | "recalibrate_story";
export type DivergenceKind = "none" | "stats_lead" | "news_lead" | "contradiction";
export type QuestionImpact = "confirming" | "contradicting" | "unresolved";

export type SourceCheckInput = {
  source: ResearchSourceKey;
  status: SourceCheckStatus;
  itemCount: number;
  note?: string;
};

export type EvidenceLinkInput = {
  title: string;
  url: string;
  publisher: string;
  publishedAt: string;
  claim: string;
};

export type IntakeItemInput = {
  itemKey: string;
  itemType: IntakeItemType;
  publisher: string;
  externalId?: string;
  title: string;
  url: string;
  publishedAt: string;
  articlePosition?: number;
  transcriptStatus?: "ready" | "missing" | "unavailable" | "not_applicable";
  transcriptText?: string;
  summary: string;
  affectedStorySlugs?: string[];
  sourceQuality: number;
  relevance: number;
  novelty: number;
  materiality: number;
  recommendedAction: RecommendedAction;
  statsSignal?: string;
  newsSignal?: string;
  divergenceKind?: DivergenceKind;
  divergenceNote?: string;
  evidence?: EvidenceLinkInput[];
  reviewReason?: string;
};

export type StoryRecalibrationInput = {
  storySlug: string;
  headline: string;
  detail: string;
  observedAt: string;
  confidenceDelta: number;
  strongestSupport: string;
  strongestContradiction: string;
  unresolvedTest: string;
  questionImpact?: QuestionImpact;
  decidingMonitor?: string;
  stillMissing?: string;
  evidenceItemKeys: string[];
};

export type ResearchRunInput = {
  runKey: string;
  scheduleSlot: ResearchScheduleSlot;
  scheduledFor: string;
  sourceChecks: SourceCheckInput[];
  items: IntakeItemInput[];
  recalibrations?: StoryRecalibrationInput[];
  summary?: string;
  dryRun?: boolean;
};

export type ValidationResult = {
  errors: string[];
  warnings: string[];
  requiredSourcesComplete: boolean;
  evidenceGatePassed: boolean;
  scoredItems: Array<IntakeItemInput & { candidateScore: number; evidence: EvidenceLinkInput[] }>;
  recalibrations: StoryRecalibrationInput[];
};

type RunLike = {
  schedule_slot: ResearchScheduleSlot;
  scheduled_for: string;
  completed_at: string | null;
  status: "running" | "completed" | "blocked" | "failed";
  warnings: string[];
  updates_published?: number;
};

export type ResearchScheduleHealth = FourSlotResearchHealth;

export function researchScheduleHealth(runs: RunLike[], now = new Date()): ResearchScheduleHealth {
  return getFourSlotResearchHealth(runs, now);
}

function validDate(value: unknown) {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value));
}

function validUrl(value: unknown) {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function score(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100;
}

export function candidateScore(item: IntakeItemInput) {
  return Math.round(
    item.sourceQuality * 0.25
    + item.relevance * 0.3
    + item.novelty * 0.2
    + item.materiality * 0.25,
  );
}

export function validateResearchRun(input: ResearchRunInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sourceChecks = Array.isArray(input.sourceChecks) ? input.sourceChecks : [];
  const items = Array.isArray(input.items) ? input.items : [];
  const recalibrations = Array.isArray(input.recalibrations) ? input.recalibrations : [];

  if (!input.runKey || input.runKey.length > 120) errors.push("runKey is required and must be at most 120 characters.");
  if (!["video_midnight", "morning", "video_late_morning", "evening", "manual"].includes(input.scheduleSlot)) errors.push("scheduleSlot is invalid.");
  if (!validDate(input.scheduledFor)) errors.push("scheduledFor must be a valid date.");
  if (items.length > 250) errors.push("A run may contain at most 250 retained intake items.");

  const sourceMap = new Map(sourceChecks.map((check) => [check.source, check]));
  if (sourceMap.size !== sourceChecks.length) errors.push("sourceChecks contains a duplicate source.");
  for (const required of REQUIRED_RESEARCH_SOURCES) {
    const check = sourceMap.get(required);
    if (!check) {
      errors.push(`Missing source check: ${required}.`);
      continue;
    }
    if (!["checked", "no_new_items", "blocked"].includes(check.status)) errors.push(`Invalid status for ${required}.`);
    if (!Number.isInteger(check.itemCount) || check.itemCount < 0) errors.push(`Invalid itemCount for ${required}.`);
    if (required === "alchemy-market-insights" && check.itemCount > 30) errors.push("Alchemy Market Insights may scan at most the 30 most recent dated articles.");
    if (check.status === "blocked") warnings.push(`${required} was blocked: ${check.note || "no reason supplied"}.`);
  }
  const requiredSourcesComplete = REQUIRED_RESEARCH_SOURCES.every((source) => {
    const check = sourceMap.get(source);
    return check && check.status !== "blocked";
  });

  const itemKeys = new Set<string>();
  const articlePositions = new Set<number>();
  const scoredItems = items.map((item, index) => {
    const prefix = `items[${index}]`;
    if (!item.itemKey || itemKeys.has(item.itemKey)) errors.push(`${prefix}.itemKey is missing or duplicated.`);
    itemKeys.add(item.itemKey);
    if (!["video", "news", "alchemy_article"].includes(item.itemType)) errors.push(`${prefix}.itemType is invalid.`);
    if (!item.publisher?.trim()) errors.push(`${prefix}.publisher is required.`);
    if (!item.title?.trim()) errors.push(`${prefix}.title is required.`);
    if (!validUrl(item.url)) errors.push(`${prefix}.url must be HTTPS.`);
    if (!validDate(item.publishedAt)) errors.push(`${prefix}.publishedAt is required and must be valid.`);
    if (!item.summary?.trim()) errors.push(`${prefix}.summary is required.`);
    for (const field of ["sourceQuality", "relevance", "novelty", "materiality"] as const) {
      if (!score(item[field])) errors.push(`${prefix}.${field} must be an integer from 0 to 100.`);
    }
    if (!["ignore", "monitor", "collect_evidence", "review_article", "recalibrate_story"].includes(item.recommendedAction)) {
      errors.push(`${prefix}.recommendedAction is invalid.`);
    }
    if (item.itemType === "video") {
      if (!item.transcriptStatus) errors.push(`${prefix}.transcriptStatus is required for video items.`);
      if (item.transcriptStatus === "ready" && !item.transcriptText?.trim()) errors.push(`${prefix}.transcriptText is required when the transcript is ready.`);
      if (item.recommendedAction !== "ignore" && item.transcriptStatus !== "ready") {
        warnings.push(`${item.title} cannot affect a story until its transcript is ready.`);
      }
    }
    if (item.itemType === "alchemy_article") {
      if (!Number.isInteger(item.articlePosition) || (item.articlePosition || 0) < 1 || (item.articlePosition || 0) > 30) {
        errors.push(`${prefix}.articlePosition must be from 1 to 30.`);
      } else if (articlePositions.has(item.articlePosition!)) {
        errors.push(`${prefix}.articlePosition is duplicated.`);
      } else {
        articlePositions.add(item.articlePosition!);
      }
    }
    const evidence = Array.isArray(item.evidence) ? item.evidence : [];
    evidence.forEach((link, evidenceIndex) => {
      const evidencePrefix = `${prefix}.evidence[${evidenceIndex}]`;
      if (!link.title?.trim() || !link.publisher?.trim() || !link.claim?.trim()) errors.push(`${evidencePrefix} requires title, publisher and claim.`);
      if (!validUrl(link.url)) errors.push(`${evidencePrefix}.url must be HTTPS.`);
      if (!validDate(link.publishedAt)) errors.push(`${evidencePrefix}.publishedAt is required and must be valid.`);
    });
    return { ...item, evidence, candidateScore: candidateScore(item) };
  });

  const itemByKey = new Map(scoredItems.map((item) => [item.itemKey, item]));
  let evidenceGatePassed = true;
  recalibrations.forEach((update, index) => {
    const prefix = `recalibrations[${index}]`;
    if (!update.storySlug?.trim()) errors.push(`${prefix}.storySlug is required.`);
    if (!update.headline?.trim() || update.headline.length > 90) errors.push(`${prefix}.headline is required and must be at most 90 characters.`);
    if (!update.detail?.trim() || !update.strongestSupport?.trim() || !update.strongestContradiction?.trim() || !update.unresolvedTest?.trim()) {
      errors.push(`${prefix} requires detail, support, contradiction and unresolved test.`);
    }
    const validQuestionImpact = ["confirming", "contradicting", "unresolved"].includes(update.questionImpact || "");
    const hasDecidingMonitor = Boolean(update.decidingMonitor?.trim());
    const hasStillMissing = Boolean(update.stillMissing?.trim());
    if (!validQuestionImpact || !hasDecidingMonitor || !hasStillMissing) {
      evidenceGatePassed = false;
      warnings.push(`${update.storySlug || prefix} is missing questionImpact, decidingMonitor or stillMissing; Story recalibration is blocked while intake can continue.`);
    } else {
      update.detail = `Question impact: ${update.questionImpact}.\nDeciding monitor: ${update.decidingMonitor}.\n\n${update.detail}\n\nStill missing: ${update.stillMissing}.`;
    }
    if (!validDate(update.observedAt)) errors.push(`${prefix}.observedAt must be a valid date.`);
    if (!Number.isInteger(update.confidenceDelta) || Math.abs(update.confidenceDelta) > 8) errors.push(`${prefix}.confidenceDelta must be an integer between -8 and 8.`);
    const linkedItems = [...new Set(update.evidenceItemKeys || [])].map((key) => itemByKey.get(key)).filter(Boolean);
    const evidenceUrls = new Set(linkedItems.flatMap((item) => item!.evidence.map((link) => link.url)));
    const videoBlocked = linkedItems.some((item) => item!.itemType === "video" && item!.transcriptStatus !== "ready");
    if (evidenceUrls.size < 4) {
      evidenceGatePassed = false;
      warnings.push(`${update.storySlug} has ${evidenceUrls.size}/4 distinct evidence links; recalibration is blocked.`);
    }
    if (videoBlocked) {
      evidenceGatePassed = false;
      warnings.push(`${update.storySlug} references a video without a ready transcript; recalibration is blocked.`);
    }
    if (!linkedItems.length) {
      evidenceGatePassed = false;
      warnings.push(`${update.storySlug} has no linked intake items; recalibration is blocked.`);
    }
  });

  return { errors, warnings, requiredSourcesComplete, evidenceGatePassed, scoredItems, recalibrations };
}
