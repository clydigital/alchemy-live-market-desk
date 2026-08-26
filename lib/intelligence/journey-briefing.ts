import type { EventHorizonCoverage } from "../event-horizon-acquisition.ts";
import type { MarketEventV1, MarketEventTimePrecision } from "../market-events.ts";
import {
  CANONICAL_STORY_REASONING_V1,
  type CanonicalAssetImplicationV1,
  type CanonicalCausalEdgeV1,
  type CanonicalClaimV1,
  type CanonicalNextTestV1,
  type CanonicalStoryReasoningV1,
} from "./story-reasoning.ts";
import type { EditionDiagnostics, EditionStory, MarketTape } from "./edition.ts";

export const JOURNEY_BRIEFING_V1 = "journey-briefing/v1" as const;

export type JourneyStorySource = {
  position: number;
  publicationSnapshotId: string;
  storyId: string;
  thesisVersionId: string;
  reasoning: CanonicalStoryReasoningV1;
};

export type JourneyTiming = {
  value: string | null;
  label: string | null;
  precision: MarketEventTimePrecision;
};

export type JourneyChronologyItem = {
  id: string;
  lane: "story" | "economic_calendar" | "earnings" | "geopolitical_clock" | "market_event";
  title: string;
  storyId: string | null;
  thesisVersionId: string | null;
  eventId: string | null;
  timing: JourneyTiming;
  evidenceRefs: string[];
};

export type JourneyBigStory = {
  storyId: string;
  publicationSnapshotId: string;
  thesisVersionId: string;
  rank: number;
  question: string | null;
  headline: string;
  lifecycle: CanonicalStoryReasoningV1["lifecycle"];
  whatChanged: string | null;
  previousState: string | null;
  whereThingsStand: string | null;
  facts: CanonicalClaimV1[];
  evidenceRefs: string[];
  marketInterpretation: string | null;
  alchemyInterpretation: string;
  mechanism: CanonicalCausalEdgeV1[];
  contradiction: CanonicalStoryReasoningV1["countercase"];
  overlookedVariable: CanonicalStoryReasoningV1["overlookedVariable"];
  assetImplications: CanonicalAssetImplicationV1[];
  nextTest: CanonicalNextTestV1 | null;
  confirmation: string[];
  invalidation: string[];
  confidence: number;
  effectiveAt: string;
};

export type JourneyBriefingV1 = {
  contractVersion: typeof JOURNEY_BRIEFING_V1;
  opening: { headline: string; summary: string; marketState: string };
  tape: MarketTape["assets"];
  bigStories: JourneyBigStory[];
  leadStoryId: string | null;
  chronology: JourneyChronologyItem[];
  horizon: { today: JourneyChronologyItem[]; tonight: JourneyChronologyItem[]; later: JourneyChronologyItem[] };
  closingMemory: {
    currentBias: string;
    biggestUnresolvedQuestion: string;
    nextDecisiveTest: string;
    whatWouldChangeTheView: string;
  };
  diagnostics: { warnings: string[]; eventHorizonCoverage: EventHorizonCoverage[] };
};

type MaterialChange = Pick<EditionStory, "id">;

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))];
}

function storyEvidence(reasoning: CanonicalStoryReasoningV1) {
  return unique([
    ...reasoning.claims.flatMap((claim) => claim.evidenceIds),
    ...reasoning.causalChain.flatMap((edge) => edge.evidenceIds),
    ...reasoning.countercase.evidenceIds,
    ...reasoning.overlookedVariable.evidenceIds,
    ...reasoning.assetImplications.flatMap((impact) => impact.evidenceIds),
    ...(reasoning.nextTest?.evidenceIds || []),
    ...(reasoning.nextTest?.resolutionEvidenceIds || []),
  ]);
}

function journeyStory(source: JourneyStorySource, rank: number): JourneyBigStory {
  const reasoning = source.reasoning;
  return {
    storyId: source.storyId,
    publicationSnapshotId: source.publicationSnapshotId,
    thesisVersionId: source.thesisVersionId,
    rank,
    question: reasoning.centralQuestion,
    headline: reasoning.title,
    lifecycle: reasoning.lifecycle,
    whatChanged: reasoning.whatChanged,
    previousState: reasoning.previousState,
    whereThingsStand: reasoning.currentState,
    facts: reasoning.claims.filter((claim) => claim.type === "fact").map((claim) => ({ ...claim, evidenceIds: [...claim.evidenceIds] })),
    evidenceRefs: storyEvidence(reasoning),
    marketInterpretation: reasoning.acceptedExplanation,
    alchemyInterpretation: reasoning.thesis,
    mechanism: reasoning.causalChain.map((edge) => ({ ...edge, evidenceIds: [...edge.evidenceIds] })),
    contradiction: { ...reasoning.countercase, evidenceIds: [...reasoning.countercase.evidenceIds] },
    overlookedVariable: { ...reasoning.overlookedVariable, evidenceIds: [...reasoning.overlookedVariable.evidenceIds] },
    assetImplications: reasoning.assetImplications.map((impact) => ({ ...impact, evidenceIds: [...impact.evidenceIds] })),
    nextTest: reasoning.nextTest ? {
      ...reasoning.nextTest,
      evidenceIds: [...reasoning.nextTest.evidenceIds],
      resolutionEvidenceIds: [...reasoning.nextTest.resolutionEvidenceIds],
    } : null,
    confirmation: [...reasoning.confirmation],
    invalidation: [...reasoning.invalidation],
    confidence: reasoning.confidence,
    effectiveAt: reasoning.effectiveAt,
  };
}

function validJourneySource(source: JourneyStorySource) {
  const reasoning = source.reasoning;
  return source.position > 0
    && Boolean(source.publicationSnapshotId)
    && Boolean(source.storyId)
    && Boolean(source.thesisVersionId)
    && reasoning.contractVersion === CANONICAL_STORY_REASONING_V1
    && reasoning.storyId === source.storyId
    && reasoning.storyVersionId === source.thesisVersionId;
}

function orderedChangedStories(changes: MaterialChange[], sources: JourneyStorySource[], warnings: string[]) {
  const changedIds = new Set(changes.map((change) => change.id));
  const validSources = sources.filter(validJourneySource);
  const sourceIds = new Set(validSources.map((source) => source.storyId));
  const missing = [...changedIds].filter((storyId) => !sourceIds.has(storyId));
  warnings.push(...missing.map((storyId) => `Journey omitted Story ${storyId}: exact immutable Canonical Story Reasoning V1 snapshot is unavailable.`));
  return validSources
    .filter((source) => changedIds.has(source.storyId))
    .sort((left, right) => left.position - right.position)
    .map((source, index) => journeyStory(source, index + 1));
}

function eventLane(event: MarketEventV1): JourneyChronologyItem["lane"] {
  if (event.eventType === "earnings") return "earnings";
  if (["geopolitical_meeting", "sanctions_or_policy_deadline", "energy_policy_meeting", "regulatory_or_legal_event"].includes(event.eventType)) return "geopolitical_clock";
  if (["economic_release", "central_bank_decision", "central_bank_speech", "conference_or_symposium", "treasury_or_fiscal_event"].includes(event.eventType)) return "economic_calendar";
  return "market_event";
}

function eventItem(event: MarketEventV1): JourneyChronologyItem {
  return {
    id: event.id,
    lane: eventLane(event),
    title: event.title,
    storyId: event.linkedStoryIds[0] || null,
    thesisVersionId: null,
    eventId: event.id,
    timing: { value: event.startAt, label: event.timeLabel, precision: event.timePrecision },
    evidenceRefs: unique(event.sourceRecordRefs),
  };
}

function storyChronologyItem(story: JourneyBigStory): JourneyChronologyItem {
  return {
    id: story.thesisVersionId,
    lane: "story",
    title: story.whatChanged || story.headline,
    storyId: story.storyId,
    thesisVersionId: story.thesisVersionId,
    eventId: null,
    timing: { value: story.effectiveAt, label: null, precision: "exact" },
    evidenceRefs: [...story.evidenceRefs],
  };
}

const KL_OFFSET_MS = 8 * 60 * 60 * 1_000;

function localParts(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  const local = new Date(timestamp + KL_OFFSET_MS);
  return { timestamp, date: local.toISOString().slice(0, 10), hour: local.getUTCHours() };
}

function eventDate(event: MarketEventV1) {
  if (!event.startAt) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(event.startAt)) return event.startAt;
  return localParts(event.startAt)?.date || null;
}

function nextDate(date: string) {
  const parsed = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(parsed) ? new Date(parsed + 86_400_000).toISOString().slice(0, 10) : null;
}

function horizonBucket(event: MarketEventV1, generatedAt: string): "today" | "tonight" | "later" {
  const generated = localParts(generatedAt);
  const date = eventDate(event);
  if (!generated || !date || event.timePrecision === "tbc") return "later";
  if (event.timePrecision === "date" || event.timePrecision === "window") return date === generated.date ? "today" : "later";
  const exact = event.startAt ? localParts(event.startAt) : null;
  if (!exact) return "later";
  if (date === generated.date) return exact.hour >= 18 ? "tonight" : "today";
  if (date === nextDate(generated.date) && exact.hour < 6 && exact.timestamp - generated.timestamp <= 12 * 60 * 60 * 1_000) return "tonight";
  return "later";
}

function splitEvents(events: MarketEventV1[], generatedAt: string) {
  const generatedMs = Date.parse(generatedAt);
  const chronology: JourneyChronologyItem[] = [];
  const horizon = { today: [] as JourneyChronologyItem[], tonight: [] as JourneyChronologyItem[], later: [] as JourneyChronologyItem[] };
  for (const event of events) {
    if (event.status === "cancelled") continue;
    const exactMs = event.timePrecision === "exact" && event.startAt ? Date.parse(event.startAt) : Number.NaN;
    const completed = event.status === "completed" || (Number.isFinite(exactMs) && exactMs <= generatedMs);
    if (completed) chronology.push(eventItem(event));
    else horizon[horizonBucket(event, generatedAt)].push(eventItem(event));
  }
  const sort = (left: JourneyChronologyItem, right: JourneyChronologyItem) => {
    const leftTime = Date.parse(left.timing.value || "");
    const rightTime = Date.parse(right.timing.value || "");
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) return leftTime - rightTime || left.id.localeCompare(right.id);
    if (Number.isFinite(leftTime)) return -1;
    if (Number.isFinite(rightTime)) return 1;
    return left.id.localeCompare(right.id);
  };
  chronology.sort(sort);
  horizon.today.sort(sort);
  horizon.tonight.sort(sort);
  horizon.later.sort(sort);
  return { chronology, horizon };
}

function noPortfolioBias(marketTape: MarketTape) {
  return marketTape.assets.length ? marketTape.regimeSummary : "No single portfolio-wide bias is canonically supported for this edition.";
}

export function composeJourneyBriefing({
  generatedAt,
  changes,
  journeyStorySources,
  marketTape,
  marketEvents,
  diagnostics,
  finalBoard,
}: {
  generatedAt: string;
  stories: EditionStory[];
  changes: MaterialChange[];
  journeyStorySources: JourneyStorySource[];
  marketTape: MarketTape;
  marketEvents: MarketEventV1[];
  diagnostics: Pick<EditionDiagnostics, "warnings" | "eventHorizonCoverage">;
  finalBoard: AlchemyFinalBoard;
}): JourneyBriefingV1 {
  const warnings = [...new Set(diagnostics.warnings)];
  const bigStories = orderedChangedStories(changes, journeyStorySources, warnings);
  const lead = bigStories[0] || null;
  const temporal = splitEvents(marketEvents, generatedAt);
  const chronology = [...bigStories.map(storyChronologyItem), ...temporal.chronology]
    .sort((left, right) => (Date.parse(left.timing.value || "") || 0) - (Date.parse(right.timing.value || "") || 0) || left.id.localeCompare(right.id));
  const nextEvent = [...temporal.horizon.today, ...temporal.horizon.tonight, ...temporal.horizon.later][0] || null;

  return {
    contractVersion: JOURNEY_BRIEFING_V1,
    opening: {
      headline: lead?.headline || "No materially supported Story change in this edition.",
      summary: lead?.whatChanged || "The canonical edition contains no material Story change to recap.",
      marketState: marketTape.regimeSummary,
    },
    tape: marketTape.assets.map((asset) => ({ ...asset })),
    bigStories,
    leadStoryId: lead?.storyId || null,
    chronology,
    horizon: temporal.horizon,
    closingMemory: {
      currentBias: noPortfolioBias(marketTape),
      biggestUnresolvedQuestion: lead?.contradiction.strongest || lead?.question || finalBoard.biggestUnresolvedContradiction,
      nextDecisiveTest: lead?.nextTest?.label || nextEvent?.title || finalBoard.mostImportantMacroTest,
      whatWouldChangeTheView: lead?.invalidation.join("; ") || finalBoard.riskToRespect,
    },
    diagnostics: {
      warnings: [...new Set(warnings)],
      eventHorizonCoverage: (diagnostics.eventHorizonCoverage || []).map((item) => ({ ...item })),
    },
  };
}

export type AlchemyFinalBoard = {
  highestConvictionChange: string;
  biggestUnresolvedContradiction: string;
  mostImportantMacroTest: string;
  mostImportantGeopoliticalTest: string;
  strongestTheme: string;
  riskToRespect: string;
};
