export const RESEARCH_TIME_ZONE = "Asia/Kuala_Lumpur";

export const VIDEO_RESEARCH_SOURCES = [
  "fx-evolution",
  "kevin-gerrity",
  "clearvalue-tax",
  "stockedup",
  "wall-street-truth-bombs",
  "tradernick",
  "traders-reality",
  "beginner-trading",
] as const;

export const DESK_RESEARCH_SOURCES = [
  "zerohedge",
  "axios",
  "investing-com",
  "fxstreet",
  "alchemy-data-tables",
  "economic-calendar",
  "earnings-calendar",
  "alchemy-market-insights",
] as const;

export const REQUIRED_RESEARCH_SOURCES = [
  ...VIDEO_RESEARCH_SOURCES,
  ...DESK_RESEARCH_SOURCES,
] as const;

export const RESEARCH_SLOTS = [
  { key: "video_midnight", time: "00:40", label: "00:40 video intake", mode: "video_intake" },
  { key: "morning", time: "08:30", label: "08:30 full desk update", mode: "desk_update" },
  { key: "video_late_morning", time: "11:30", label: "11:30 video refresh", mode: "video_intake" },
  { key: "evening", time: "22:00", label: "22:00 evening delta", mode: "desk_update" },
] as const;

export type ResearchSourceKey = typeof REQUIRED_RESEARCH_SOURCES[number];
export type ResearchScheduleSlot = typeof RESEARCH_SLOTS[number]["key"] | "manual";
export type SourceCheckStatus = "checked" | "no_new_items" | "blocked";
export type IntakeItemType = "video" | "news" | "alchemy_article";
export type RecommendedAction = "ignore" | "monitor" | "collect_evidence" | "review_article" | "recalibrate_story";
export type DivergenceKind = "none" | "stats_lead" | "news_lead" | "contradiction";
export type ClaimVerificationStatus = "verified" | "partly_verified" | "contradicted" | "outdated" | "unverified";
export type ExpertType = "geopolitics" | "markets";
export type FocusDecision = "lead" | "top_three" | "background" | "rejected";
export type FreshnessStatus = "fresh_72h" | "upcoming_7d" | "materially_refreshed" | "stale";

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

export type ClaimCheckInput = {
  claim: string;
  material: boolean;
  status: ClaimVerificationStatus;
  assessment: string;
  independentSources?: EvidenceLinkInput[];
};

export type JargonResearchInput = {
  term: string;
  meaning: string;
  measurement: string;
  assumptions: string[];
  correctUsage: string;
  materiality: string;
  sources: EvidenceLinkInput[];
};

export type ExpertNoteInput = {
  expert: ExpertType;
  context: string;
  assessment: string;
  transmission: string;
  evidence?: EvidenceLinkInput[];
};

export type ProcessLogInput = {
  step: "discover" | "transcribe" | "review_video" | "extract_claims" | "research_jargon" | "consume_video_intake" | "cross_assess" | "calendar_scan" | "compare_desk_history" | "select_desk1" | "publish_desk1";
  status: "completed" | "blocked" | "not_applicable";
  note?: string;
};

export type CalendarCheckInput = {
  calendar: "economic" | "earnings";
  status: "checked" | "blocked";
  windowStart: string;
  windowEnd: string;
  eventCount: number;
  note?: string;
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
  transcriptProvider?: "youtubetotranscript.com" | "official" | "other";
  transcriptText?: string;
  videoReviewStatus?: "reviewed" | "listened" | "transcript_only" | "unavailable";
  creatorLogic?: string;
  recontextualizedSummary?: string;
  claimChecks?: ClaimCheckInput[];
  termsDetected?: string[];
  jargonResearch?: JargonResearchInput[];
  expertNotes?: ExpertNoteInput[];
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

export type StoryFocusInput = {
  storySlug: string;
  headline: string;
  angleKey: string;
  priority: number;
  proposedDecision: FocusDecision;
  eventAt?: string;
  nextCatalystAt?: string;
  materialChange: boolean;
  materialChangeReason?: string;
  cosmeticRewrite?: boolean;
  evidenceItemKeys: string[];
  expertContexts?: ExpertType[];
  expertNotes?: ExpertNoteInput[];
};

export type ValidatedStoryFocus = StoryFocusInput & {
  decision: FocusDecision;
  freshnessStatus: FreshnessStatus;
  freshnessReason: string;
  demotionReason: string | null;
};

export type PreviousDeskDayInput = {
  date: string;
  leadStorySlug: string | null;
  angleKey: string | null;
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
  evidenceItemKeys: string[];
};

export type ResearchRunInput = {
  runKey: string;
  scheduleSlot: ResearchScheduleSlot;
  scheduledFor: string;
  sourceChecks: SourceCheckInput[];
  processLog: ProcessLogInput[];
  calendarChecks?: CalendarCheckInput[];
  previousDeskDays?: PreviousDeskDayInput[];
  items: IntakeItemInput[];
  storyFocus?: StoryFocusInput[];
  recalibrations?: StoryRecalibrationInput[];
  summary?: string;
  dryRun?: boolean;
};

export type EvidenceItemRecord = {
  runId?: string;
  runStatus?: "running" | "completed" | "blocked" | "failed";
  itemKey: string;
  itemType: IntakeItemType;
  intakeStatus?: "candidate" | "accepted" | "blocked" | "published" | "rejected";
  transcriptStatus?: IntakeItemInput["transcriptStatus"];
  videoReviewStatus?: IntakeItemInput["videoReviewStatus"];
  claimChecks: ClaimCheckInput[];
  evidence: EvidenceLinkInput[];
};

export type ValidationResult = {
  errors: string[];
  warnings: string[];
  requiredSourcesComplete: boolean;
  processGatePassed: boolean;
  calendarGatePassed: boolean;
  videoGatePassed: boolean;
  freshnessGatePassed: boolean;
  evidenceGatePassed: boolean;
  scoredItems: Array<IntakeItemInput & { candidateScore: number; freshnessScore: number; evidence: EvidenceLinkInput[]; claimChecks: ClaimCheckInput[]; jargonResearch: JargonResearchInput[]; expertNotes: ExpertNoteInput[] }>;
  storyFocus: ValidatedStoryFocus[];
  recalibrations: StoryRecalibrationInput[];
};

type RunLike = {
  schedule_slot: ResearchScheduleSlot;
  scheduled_for: string;
  completed_at: string | null;
  status: "running" | "completed" | "blocked" | "failed";
  warnings: string[];
};

export type ResearchScheduleHealth = {
  state: "healthy" | "attention" | "not_configured";
  due: Array<{
    slot: Exclude<ResearchScheduleSlot, "manual">;
    label: string;
    mode: "video_intake" | "desk_update";
    expectedAt: string;
    status: "complete" | "blocked" | "missed";
    completedAt: string | null;
  }>;
  latestCompletedAt: string | null;
  warningCount: number;
};

const ITEM_KEY_PATTERN = /^[A-Za-z0-9:_-]{1,160}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export function isVideoSlot(slot: ResearchScheduleSlot) {
  return slot === "video_midnight" || slot === "video_late_morning";
}

export function isDeskPublicationSlot(slot: ResearchScheduleSlot) {
  return slot === "morning" || slot === "evening";
}

export function requiredSourcesForSlot(slot: ResearchScheduleSlot): readonly ResearchSourceKey[] {
  if (isVideoSlot(slot)) return VIDEO_RESEARCH_SOURCES;
  if (isDeskPublicationSlot(slot)) return DESK_RESEARCH_SOURCES;
  return REQUIRED_RESEARCH_SOURCES;
}

function malaysiaParts(now: Date) {
  const values = new Intl.DateTimeFormat("en-CA", {
    timeZone: RESEARCH_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  return Object.fromEntries(values.map((part) => [part.type, part.value]));
}

function malaysiaDueIso(now: Date, slot: Exclude<ResearchScheduleSlot, "manual">) {
  const definition = RESEARCH_SLOTS.find((item) => item.key === slot)!;
  const parts = malaysiaParts(now);
  let candidate = new Date(`${parts.year}-${parts.month}-${parts.day}T${definition.time}:00+08:00`);
  if (candidate.getTime() > now.getTime()) candidate = new Date(candidate.getTime() - DAY);
  return candidate.toISOString();
}

export function researchScheduleHealth(runs: RunLike[], now = new Date()): ResearchScheduleHealth {
  const due = RESEARCH_SLOTS.map((definition) => {
    const expectedAt = malaysiaDueIso(now, definition.key);
    const matching = runs
      .filter((run) => run.schedule_slot === definition.key && Math.abs(Date.parse(run.scheduled_for) - Date.parse(expectedAt)) <= 30 * 60_000)
      .sort((a, b) => Date.parse(b.scheduled_for) - Date.parse(a.scheduled_for))[0];
    return {
      slot: definition.key,
      label: `${definition.time} MYT`,
      mode: definition.mode,
      expectedAt,
      status: matching?.status === "completed" ? "complete" as const : matching ? "blocked" as const : "missed" as const,
      completedAt: matching?.completed_at || null,
    };
  });
  const completed = runs
    .filter((run) => run.status === "completed" && run.completed_at)
    .sort((a, b) => Date.parse(b.completed_at!) - Date.parse(a.completed_at!));
  return {
    state: !runs.length ? "not_configured" : due.every((item) => item.status === "complete") ? "healthy" : "attention",
    due,
    latestCompletedAt: completed[0]?.completed_at || null,
    warningCount: runs.slice(0, 4).reduce((sum, run) => sum + (run.warnings?.length || 0), 0),
  };
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

function normalized(value: string) {
  return value.trim().toLocaleLowerCase("en");
}

export function itemFreshnessScore(publishedAt: string, scheduledFor = new Date().toISOString()) {
  const age = Date.parse(scheduledFor) - Date.parse(publishedAt);
  if (!Number.isFinite(age) || age < -HOUR) return 0;
  if (age <= DAY) return 100;
  if (age <= 72 * HOUR) return 80;
  if (age <= 7 * DAY) return 40;
  return 0;
}

export function candidateScore(item: IntakeItemInput, freshnessScore = itemFreshnessScore(item.publishedAt)) {
  return Math.round(
    item.sourceQuality * 0.2
    + item.relevance * 0.25
    + item.novelty * 0.15
    + item.materiality * 0.25
    + freshnessScore * 0.15,
  );
}

function validateEvidenceLink(link: EvidenceLinkInput, prefix: string, errors: string[]) {
  if (!link.title?.trim() || !link.publisher?.trim() || !link.claim?.trim()) errors.push(`${prefix} requires title, publisher and claim.`);
  if (!validUrl(link.url)) errors.push(`${prefix}.url must be HTTPS.`);
  if (!validDate(link.publishedAt)) errors.push(`${prefix}.publishedAt is required and must be valid.`);
}

function validateExpertNotes(notes: ExpertNoteInput[], prefix: string, errors: string[]) {
  notes.forEach((note, index) => {
    const notePrefix = `${prefix}[${index}]`;
    if (!["geopolitics", "markets"].includes(note.expert)) errors.push(`${notePrefix}.expert is invalid.`);
    if (!note.context?.trim() || !note.assessment?.trim() || !note.transmission?.trim()) {
      errors.push(`${notePrefix} requires context, assessment and transmission.`);
    }
    (note.evidence || []).forEach((link, evidenceIndex) => validateEvidenceLink(link, `${notePrefix}.evidence[${evidenceIndex}]`, errors));
  });
}

function validateScheduleAlignment(input: ResearchRunInput, errors: string[]) {
  if (input.scheduleSlot === "manual" || !validDate(input.scheduledFor)) return;
  const definition = RESEARCH_SLOTS.find((item) => item.key === input.scheduleSlot);
  if (!definition) return;
  const parts = malaysiaParts(new Date(input.scheduledFor));
  if (`${parts.hour}:${parts.minute}` !== definition.time) {
    errors.push(`scheduledFor must align with the ${definition.time} Asia/Kuala_Lumpur ${input.scheduleSlot} slot.`);
  }
}

function deriveStoryFocus(focus: StoryFocusInput, scheduledFor: string, previousDays: PreviousDeskDayInput[]): ValidatedStoryFocus {
  const scheduled = Date.parse(scheduledFor);
  const event = focus.eventAt ? Date.parse(focus.eventAt) : Number.NaN;
  const catalyst = focus.nextCatalystAt ? Date.parse(focus.nextCatalystAt) : Number.NaN;
  const eventAge = scheduled - event;
  const freshEvent = Number.isFinite(event) && eventAge >= 0 && eventAge <= 72 * HOUR;
  const upcomingCatalyst = Number.isFinite(catalyst) && catalyst >= scheduled && catalyst <= scheduled + 7 * DAY;
  const repeatedLead = previousDays.some((day) => day.leadStorySlug === focus.storySlug);

  let freshnessStatus: FreshnessStatus = "stale";
  let freshnessReason = "No event from the last 72 hours, seven-day catalyst or material development was supplied.";
  if (freshEvent) {
    freshnessStatus = "fresh_72h";
    freshnessReason = "The deciding event occurred within the last 72 hours.";
  } else if (upcomingCatalyst) {
    freshnessStatus = "upcoming_7d";
    freshnessReason = "A named catalyst occurs within the next seven days.";
  } else if (focus.materialChange) {
    freshnessStatus = "materially_refreshed";
    freshnessReason = focus.materialChangeReason || "A material development changed the prior story logic.";
  }

  let decision = focus.proposedDecision;
  let demotionReason: string | null = null;
  if (focus.cosmeticRewrite) {
    decision = "rejected";
    demotionReason = "Cosmetic rewrite of an existing desk story.";
  } else if (focus.proposedDecision === "lead" && repeatedLead && !focus.materialChange) {
    decision = "background";
    demotionReason = "The same lead appeared in the prior two Desk 1 days without a material development.";
  } else if ((focus.proposedDecision === "lead" || focus.proposedDecision === "top_three") && freshnessStatus === "stale") {
    decision = "background";
    demotionReason = "Unchanged story demoted to background by the freshness gate.";
  }

  return { ...focus, decision, freshnessStatus, freshnessReason, demotionReason };
}

function itemRecord(item: IntakeItemInput & { evidence: EvidenceLinkInput[]; claimChecks: ClaimCheckInput[] }): EvidenceItemRecord {
  return {
    itemKey: item.itemKey,
    itemType: item.itemType,
    transcriptStatus: item.transcriptStatus,
    videoReviewStatus: item.videoReviewStatus,
    claimChecks: item.claimChecks,
    evidence: item.evidence,
  };
}

export function referencedEvidenceItemKeys(input: ResearchRunInput) {
  const storyFocus = Array.isArray(input.storyFocus) ? input.storyFocus : [];
  const recalibrations = Array.isArray(input.recalibrations) ? input.recalibrations : [];
  const items = Array.isArray(input.items) ? input.items : [];
  return [...new Set([
    ...storyFocus.flatMap((focus) => Array.isArray(focus?.evidenceItemKeys) ? focus.evidenceItemKeys : []),
    ...recalibrations.flatMap((update) => Array.isArray(update?.evidenceItemKeys) ? update.evidenceItemKeys : []),
    ...items.map((item) => item?.itemKey),
  ].filter((key): key is string => typeof key === "string" && ITEM_KEY_PATTERN.test(key)))];
}

export function validateResearchRun(input: ResearchRunInput, persistedItems: EvidenceItemRecord[] = []): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sourceChecks = Array.isArray(input.sourceChecks) ? input.sourceChecks : [];
  const processLog = Array.isArray(input.processLog) ? input.processLog : [];
  const calendarChecks = Array.isArray(input.calendarChecks) ? input.calendarChecks : [];
  const previousDeskDays = Array.isArray(input.previousDeskDays) ? input.previousDeskDays : [];
  const items = Array.isArray(input.items) ? input.items : [];
  const storyFocusInput = Array.isArray(input.storyFocus) ? input.storyFocus : [];
  const recalibrations = Array.isArray(input.recalibrations) ? input.recalibrations : [];

  if (!input.runKey || input.runKey.length > 120) errors.push("runKey is required and must be at most 120 characters.");
  if (![...RESEARCH_SLOTS.map((slot) => slot.key), "manual"].includes(input.scheduleSlot)) errors.push("scheduleSlot is invalid.");
  if (!validDate(input.scheduledFor)) errors.push("scheduledFor must be a valid date.");
  if (items.length > 250) errors.push("A run may contain at most 250 retained intake items.");
  validateScheduleAlignment(input, errors);

  const expectedSources = requiredSourcesForSlot(input.scheduleSlot);
  const sourceMap = new Map(sourceChecks.map((check) => [check.source, check]));
  if (sourceMap.size !== sourceChecks.length) errors.push("sourceChecks contains a duplicate source.");
  sourceChecks.forEach((check) => {
    if (!REQUIRED_RESEARCH_SOURCES.includes(check.source)) errors.push(`Unknown research source: ${check.source}.`);
    if (!expectedSources.includes(check.source)) errors.push(`${check.source} is not scheduled for the ${input.scheduleSlot} slot.`);
  });
  for (const required of expectedSources) {
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
  const requiredSourcesComplete = expectedSources.every((source) => sourceMap.get(source)?.status !== "blocked" && sourceMap.has(source));

  const requiredSteps = isVideoSlot(input.scheduleSlot)
    ? ["discover", "transcribe", "review_video", "extract_claims", "research_jargon", "cross_assess"]
    : isDeskPublicationSlot(input.scheduleSlot)
      ? ["discover", "consume_video_intake", "cross_assess", "calendar_scan", "compare_desk_history", "select_desk1", "publish_desk1"]
      : ["discover", "cross_assess"];
  const stepMap = new Map(processLog.map((entry) => [entry.step, entry]));
  if (stepMap.size !== processLog.length) errors.push("processLog contains a duplicate step.");
  requiredSteps.forEach((step) => {
    if (!stepMap.has(step as ProcessLogInput["step"])) errors.push(`Missing process step: ${step}.`);
  });
  const processGatePassed = requiredSteps.every((step) => stepMap.get(step as ProcessLogInput["step"])?.status === "completed");
  processLog.filter((entry) => entry.status === "blocked").forEach((entry) => warnings.push(`Process step ${entry.step} was blocked: ${entry.note || "no reason supplied"}.`));

  let calendarGatePassed = true;
  if (isDeskPublicationSlot(input.scheduleSlot)) {
    const calendarMap = new Map(calendarChecks.map((check) => [check.calendar, check]));
    if (calendarMap.size !== calendarChecks.length) errors.push("calendarChecks contains a duplicate calendar.");
    for (const calendar of ["economic", "earnings"] as const) {
      const check = calendarMap.get(calendar);
      if (!check) {
        errors.push(`Missing calendar check: ${calendar}.`);
        calendarGatePassed = false;
        continue;
      }
      if (!validDate(check.windowStart) || !validDate(check.windowEnd)) errors.push(`${calendar} calendar window must contain valid dates.`);
      if (!Number.isInteger(check.eventCount) || check.eventCount < 0) errors.push(`${calendar} calendar eventCount is invalid.`);
      const scheduled = Date.parse(input.scheduledFor);
      if (Date.parse(check.windowStart) > scheduled || Date.parse(check.windowEnd) < scheduled + 7 * DAY) {
        errors.push(`${calendar} calendar must cover the scheduled run through the next seven days.`);
      }
      if (check.status === "blocked") {
        calendarGatePassed = false;
        warnings.push(`${calendar} calendar was blocked: ${check.note || "no reason supplied"}.`);
      }
    }

    if (previousDeskDays.length !== 2) errors.push("Desk publication runs must compare exactly the previous two Desk 1 days.");
    if (!storyFocusInput.length) errors.push("Desk publication runs must record at least one Desk 1 focus decision, including background-only outcomes.");
    const priorDates = new Set<string>();
    previousDeskDays.forEach((day, index) => {
      if (!DATE_PATTERN.test(day.date)) errors.push(`previousDeskDays[${index}].date must use YYYY-MM-DD.`);
      if (priorDates.has(day.date)) errors.push("previousDeskDays contains a duplicate date.");
      priorDates.add(day.date);
      if (DATE_PATTERN.test(day.date) && Date.parse(`${day.date}T23:59:59+08:00`) >= Date.parse(input.scheduledFor)) {
        errors.push(`previousDeskDays[${index}] must precede scheduledFor.`);
      }
    });
  } else if (calendarChecks.length || previousDeskDays.length || storyFocusInput.length || recalibrations.length) {
    errors.push("Video intake and manual runs cannot publish Desk 1 focus, calendar decisions or story recalibrations.");
  }

  const itemKeys = new Set<string>();
  const articlePositions = new Set<number>();
  let videoGatePassed = true;
  const scoredItems = items.map((item, index) => {
    const prefix = `items[${index}]`;
    if (!ITEM_KEY_PATTERN.test(item.itemKey) || itemKeys.has(item.itemKey)) errors.push(`${prefix}.itemKey is missing, invalid or duplicated.`);
    itemKeys.add(item.itemKey);
    if (!["video", "news", "alchemy_article"].includes(item.itemType)) errors.push(`${prefix}.itemType is invalid.`);
    if (isVideoSlot(input.scheduleSlot) && item.itemType !== "video") errors.push(`${prefix} must be a video in a video-intake slot.`);
    if (isDeskPublicationSlot(input.scheduleSlot) && item.itemType === "video") errors.push(`${prefix} video belongs in a video-intake slot, not a Desk 1 publication slot.`);
    if (!item.publisher?.trim()) errors.push(`${prefix}.publisher is required.`);
    if (!item.title?.trim()) errors.push(`${prefix}.title is required.`);
    if (!validUrl(item.url)) errors.push(`${prefix}.url must be HTTPS.`);
    if (!validDate(item.publishedAt)) errors.push(`${prefix}.publishedAt is required and must be valid.`);
    if (!item.summary?.trim()) errors.push(`${prefix}.summary is required.`);
    for (const field of ["sourceQuality", "relevance", "novelty", "materiality"] as const) {
      if (!score(item[field])) errors.push(`${prefix}.${field} must be an integer from 0 to 100.`);
    }
    if (!["ignore", "monitor", "collect_evidence", "review_article", "recalibrate_story"].includes(item.recommendedAction)) errors.push(`${prefix}.recommendedAction is invalid.`);

    const evidence = Array.isArray(item.evidence) ? item.evidence : [];
    const claimChecks = Array.isArray(item.claimChecks) ? item.claimChecks : [];
    const jargonResearch = Array.isArray(item.jargonResearch) ? item.jargonResearch : [];
    const expertNotes = Array.isArray(item.expertNotes) ? item.expertNotes : [];
    evidence.forEach((link, evidenceIndex) => validateEvidenceLink(link, `${prefix}.evidence[${evidenceIndex}]`, errors));
    validateExpertNotes(expertNotes, `${prefix}.expertNotes`, errors);

    if (item.itemType === "video") {
      const retained = item.recommendedAction !== "ignore";
      if (!item.transcriptStatus) errors.push(`${prefix}.transcriptStatus is required for video items.`);
      if (item.transcriptStatus === "ready" && !item.transcriptText?.trim()) errors.push(`${prefix}.transcriptText is required when the transcript is ready.`);
      if (retained && item.transcriptStatus !== "ready") {
        videoGatePassed = false;
        warnings.push(`${item.title} cannot affect a story until its transcript is ready.`);
      }
      if (retained && !["youtubetotranscript.com", "official"].includes(item.transcriptProvider || "")) {
        videoGatePassed = false;
        errors.push(`${prefix}.transcriptProvider must be youtubetotranscript.com or official for retained videos.`);
      }
      if (retained && !["reviewed", "listened"].includes(item.videoReviewStatus || "")) {
        videoGatePassed = false;
        errors.push(`${prefix}.videoReviewStatus must prove an independent review or listen for retained videos.`);
      }
      if (retained && (!item.creatorLogic?.trim() || !item.recontextualizedSummary?.trim())) {
        errors.push(`${prefix} requires creatorLogic and recontextualizedSummary; creator material is idea discovery only.`);
      }
      if (item.materiality >= 50 && !claimChecks.some((claim) => claim.material)) errors.push(`${prefix} requires at least one labelled material claim.`);
      claimChecks.forEach((claim, claimIndex) => {
        const claimPrefix = `${prefix}.claimChecks[${claimIndex}]`;
        if (!claim.claim?.trim() || !claim.assessment?.trim()) errors.push(`${claimPrefix} requires claim and assessment.`);
        if (!["verified", "partly_verified", "contradicted", "outdated", "unverified"].includes(claim.status)) errors.push(`${claimPrefix}.status is invalid.`);
        const independentSources = Array.isArray(claim.independentSources) ? claim.independentSources : [];
        independentSources.forEach((link, evidenceIndex) => validateEvidenceLink(link, `${claimPrefix}.independentSources[${evidenceIndex}]`, errors));
        if (claim.material && claim.status !== "unverified" && !independentSources.some((link) => link.url !== item.url)) {
          errors.push(`${claimPrefix} needs an independent source for its ${claim.status} label.`);
        }
      });

      const terms = [...new Set((item.termsDetected || []).map(normalized).filter(Boolean))];
      const jargonMap = new Map(jargonResearch.map((entry) => [normalized(entry.term), entry]));
      terms.forEach((term) => {
        if (!jargonMap.has(term)) errors.push(`${prefix}.jargonResearch is missing unfamiliar term: ${term}.`);
      });
      jargonResearch.forEach((entry, jargonIndex) => {
        const jargonPrefix = `${prefix}.jargonResearch[${jargonIndex}]`;
        if (!entry.term?.trim() || !entry.meaning?.trim() || !entry.measurement?.trim() || !entry.correctUsage?.trim() || !entry.materiality?.trim()) {
          errors.push(`${jargonPrefix} requires meaning, measurement, correct usage and materiality.`);
        }
        if (!Array.isArray(entry.assumptions) || !entry.assumptions.length) errors.push(`${jargonPrefix}.assumptions must not be empty.`);
        if (!Array.isArray(entry.sources) || !entry.sources.length) errors.push(`${jargonPrefix}.sources must not be empty.`);
        (entry.sources || []).forEach((link, evidenceIndex) => validateEvidenceLink(link, `${jargonPrefix}.sources[${evidenceIndex}]`, errors));
      });
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
    const freshnessScore = itemFreshnessScore(item.publishedAt, input.scheduledFor);
    if (freshnessScore < 80 && item.recommendedAction === "recalibrate_story") warnings.push(`${item.title} is outside the preferred 72-hour intake window.`);
    return { ...item, evidence, claimChecks, jargonResearch, expertNotes, freshnessScore, candidateScore: candidateScore(item, freshnessScore) };
  });

  const storySlugs = new Set<string>();
  const storyFocus = storyFocusInput.map((focus, index) => {
    const prefix = `storyFocus[${index}]`;
    if (!focus.storySlug?.trim() || storySlugs.has(focus.storySlug)) errors.push(`${prefix}.storySlug is missing or duplicated.`);
    storySlugs.add(focus.storySlug);
    if (!focus.headline?.trim() || focus.headline.length > 110) errors.push(`${prefix}.headline is required and must be at most 110 characters.`);
    if (!focus.angleKey?.trim()) errors.push(`${prefix}.angleKey is required.`);
    if (!Number.isInteger(focus.priority) || focus.priority < 1 || focus.priority > 20) errors.push(`${prefix}.priority must be from 1 to 20.`);
    if (!["lead", "top_three", "background", "rejected"].includes(focus.proposedDecision)) errors.push(`${prefix}.proposedDecision is invalid.`);
    if (focus.eventAt && !validDate(focus.eventAt)) errors.push(`${prefix}.eventAt must be a valid date.`);
    if (focus.nextCatalystAt && !validDate(focus.nextCatalystAt)) errors.push(`${prefix}.nextCatalystAt must be a valid date.`);
    if (focus.materialChange && !focus.materialChangeReason?.trim()) errors.push(`${prefix}.materialChangeReason is required for a material change.`);
    const expertNotes = Array.isArray(focus.expertNotes) ? focus.expertNotes : [];
    validateExpertNotes(expertNotes, `${prefix}.expertNotes`, errors);
    (focus.expertContexts || []).forEach((expert) => {
      if (!expertNotes.some((note) => note.expert === expert)) errors.push(`${prefix} requires a ${expert} expert note for the supplied context.`);
    });
    const validated = deriveStoryFocus({ ...focus, expertNotes }, input.scheduledFor, previousDeskDays);
    if ((validated.decision === "lead" || validated.decision === "top_three") && !validated.evidenceItemKeys.length) {
      errors.push(`${prefix}.evidenceItemKeys is required for lead and top-three stories.`);
    }
    if (validated.demotionReason) warnings.push(`${focus.storySlug}: ${validated.demotionReason}`);
    return validated;
  });
  if (storyFocus.filter((focus) => focus.decision === "lead").length > 1) errors.push("A Desk 1 run may select at most one lead story.");
  if (storyFocus.filter((focus) => focus.decision === "lead" || focus.decision === "top_three").length > 3) {
    errors.push("A Desk 1 run may select at most three active focus stories.");
  }
  const freshnessGatePassed = storyFocus.every((focus) =>
    !["lead", "top_three"].includes(focus.decision) || focus.freshnessStatus !== "stale",
  );

  const records = new Map<string, EvidenceItemRecord>();
  scoredItems.forEach((item) => records.set(item.itemKey, itemRecord(item)));
  persistedItems.forEach((item) => records.set(item.itemKey, item));
  let evidenceGatePassed = true;
  const assessEvidence = (keys: string[]) => {
    const uniqueKeys = [...new Set(keys || [])];
    const linkedItems = uniqueKeys.map((key) => records.get(key)).filter(Boolean) as EvidenceItemRecord[];
    const missingKeys = uniqueKeys.filter((key) => !records.has(key));
    const evidenceUrls = new Set(linkedItems.flatMap((item) => [
      ...item.evidence.map((link) => link.url),
      ...item.claimChecks.flatMap((claim) => (claim.independentSources || []).map((link) => link.url)),
    ]));
    const videoBlocked = linkedItems.some((item) => item.itemType === "video" && (item.transcriptStatus !== "ready" || !["reviewed", "listened"].includes(item.videoReviewStatus || "")));
    const unverifiedMaterialClaim = linkedItems.some((item) => item.claimChecks.some((claim) => claim.material && claim.status === "unverified"));
    const persistedItemBlocked = linkedItems.some((item) => item.runId && (
      item.runStatus !== "completed" || !["accepted", "published"].includes(item.intakeStatus || "")
    ));
    return { linkedItems, missingKeys, evidenceUrls, videoBlocked, unverifiedMaterialClaim, persistedItemBlocked };
  };
  storyFocus.filter((focus) => focus.decision === "lead" || focus.decision === "top_three").forEach((focus) => {
    const state = assessEvidence(focus.evidenceItemKeys);
    if (state.missingKeys.length) {
      evidenceGatePassed = false;
      warnings.push(`${focus.storySlug} focus references missing intake items: ${state.missingKeys.join(", ")}.`);
    }
    if (!state.linkedItems.length || state.evidenceUrls.size < 4) {
      evidenceGatePassed = false;
      warnings.push(`${focus.storySlug} focus has ${state.evidenceUrls.size}/4 distinct evidence links; Desk 1 publication is blocked.`);
    }
    if (state.videoBlocked || state.unverifiedMaterialClaim || state.persistedItemBlocked) {
      evidenceGatePassed = false;
      warnings.push(`${focus.storySlug} focus contains unvalidated persisted intake, an unreviewed video or an unverified material creator claim; Desk 1 publication is blocked.`);
    }
  });
  recalibrations.forEach((update, index) => {
    const prefix = `recalibrations[${index}]`;
    if (!update.storySlug?.trim()) errors.push(`${prefix}.storySlug is required.`);
    if (!update.headline?.trim() || update.headline.length > 90) errors.push(`${prefix}.headline is required and must be at most 90 characters.`);
    if (!update.detail?.trim() || !update.strongestSupport?.trim() || !update.strongestContradiction?.trim() || !update.unresolvedTest?.trim()) errors.push(`${prefix} requires detail, support, contradiction and unresolved test.`);
    if (!validDate(update.observedAt)) errors.push(`${prefix}.observedAt must be a valid date.`);
    if (!Number.isInteger(update.confidenceDelta) || Math.abs(update.confidenceDelta) > 8) errors.push(`${prefix}.confidenceDelta must be an integer between -8 and 8.`);
    const focus = storyFocus.find((item) => item.storySlug === update.storySlug);
    if (!focus || !["lead", "top_three"].includes(focus.decision) || !focus.materialChange) {
      evidenceGatePassed = false;
      warnings.push(`${update.storySlug} is not a material lead/top-three Desk 1 decision; recalibration is blocked.`);
    }
    const state = assessEvidence(update.evidenceItemKeys);
    if (state.missingKeys.length) {
      evidenceGatePassed = false;
      warnings.push(`${update.storySlug} references missing intake items: ${state.missingKeys.join(", ")}.`);
    }
    if (state.evidenceUrls.size < 4) {
      evidenceGatePassed = false;
      warnings.push(`${update.storySlug} has ${state.evidenceUrls.size}/4 distinct evidence links; recalibration is blocked.`);
    }
    if (state.videoBlocked || state.unverifiedMaterialClaim || state.persistedItemBlocked) {
      evidenceGatePassed = false;
      warnings.push(`${update.storySlug} contains unvalidated persisted intake, an unreviewed video or an unverified material creator claim; recalibration is blocked.`);
    }
    if (!state.linkedItems.length) {
      evidenceGatePassed = false;
      warnings.push(`${update.storySlug} has no linked intake items; recalibration is blocked.`);
    }
  });

  return {
    errors,
    warnings,
    requiredSourcesComplete,
    processGatePassed,
    calendarGatePassed,
    videoGatePassed,
    freshnessGatePassed,
    evidenceGatePassed,
    scoredItems,
    storyFocus,
    recalibrations,
  };
}
