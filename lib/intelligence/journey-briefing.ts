import type {
  EditionDiagnostics,
  EditionStory,
  EditionUpcoming,
  MarketTape,
  MechanismStep,
} from "./edition";

export const JOURNEY_BRIEFING_V1 = "journey-briefing/v1" as const;

export type JourneyTimePrecision = "exact" | "date" | "window" | "tbc";

export type JourneyTiming = {
  value: string | null;
  label: string | null;
  precision: JourneyTimePrecision;
};

export type JourneyChronologyItem = {
  id: string;
  lane: "story" | "economic_calendar" | "earnings" | "geopolitical_clock";
  title: string;
  storyId: string | null;
  timing: JourneyTiming;
  evidenceRefs: string[];
};

export type JourneyBigStory = {
  storyId: string;
  parentStoryId: string;
  thesisVersionId: string | null;
  rank: number;
  question: string;
  headline: string;
  whatChanged: string;
  whereThingsStand: string;
  evidenceRefs: string[];
  marketInterpretation: string;
  alchemyInterpretation: string;
  mechanism: MechanismStep[];
  contradiction: string | null;
  assetImplications: { assets: string[]; text: string };
  nextTest: string;
  invalidation: string;
  confidence: number;
  eventAt: string;
};

export type JourneyBriefingV1 = {
  contractVersion: typeof JOURNEY_BRIEFING_V1;
  opening: {
    headline: string;
    summary: string;
    marketState: string;
  };
  tape: MarketTape["assets"];
  bigStories: JourneyBigStory[];
  leadStoryId: string | null;
  chronology: JourneyChronologyItem[];
  horizon: {
    today: JourneyChronologyItem[];
    tonight: JourneyChronologyItem[];
    later: JourneyChronologyItem[];
  };
  closingMemory: {
    currentBias: string;
    biggestUnresolvedQuestion: string;
    nextDecisiveTest: string;
    whatWouldChangeTheView: string;
  };
  diagnostics: Pick<EditionDiagnostics, "warnings" | "eventHorizonCoverage">;
};

type MaterialChange = {
  rank: number;
  headline: string;
  whatChanged: string;
  linkedStoryId: string;
};

function unique(values: string[]) {
  return [...new Set(values.filter((value) => value.trim()))];
}

function datePart(value: string | null | undefined) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] || null;
}

function timeLabel(value: string | null | undefined) {
  if (!value) return null;
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}\s*[·|]\s*(.+)$/);
  return match?.[1]?.trim() || null;
}

function offsetAware(value: string) {
  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim());
}

function timing(value: string | null | undefined, explicitPrecision?: JourneyTimePrecision | null): JourneyTiming {
  const raw = value ? String(value) : null;
  const label = timeLabel(raw);
  const date = datePart(raw);
  if (explicitPrecision === "tbc") return { value: raw, label, precision: "tbc" };
  if (explicitPrecision === "window") return { value: raw, label, precision: "window" };
  if (explicitPrecision === "date" || date) return { value: raw, label, precision: "date" };
  if (explicitPrecision === "exact" && raw && offsetAware(raw)) return { value: raw, label, precision: "exact" };
  if (raw && offsetAware(raw)) return { value: raw, label, precision: "exact" };
  return { value: raw, label, precision: "tbc" };
}

function chronologyId(lane: JourneyChronologyItem["lane"], title: string, rawTime: string | null) {
  return `${lane}:${title}:${rawTime || "tbc"}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function storyEvidence(story: EditionStory) {
  return unique(story.evidenceRefs || []);
}

function storyForMaterialChange(change: MaterialChange, stories: EditionStory[]): JourneyBigStory | null {
  const story = stories.find((candidate) => candidate.id === change.linkedStoryId);
  if (!story) return null;
  return {
    storyId: story.id,
    parentStoryId: story.parentStoryId,
    thesisVersionId: story.thesisVersionId || null,
    rank: change.rank,
    question: story.centralQuestion,
    headline: change.headline,
    whatChanged: change.whatChanged,
    whereThingsStand: story.currentState,
    evidenceRefs: storyEvidence(story),
    marketInterpretation: story.acceptedExplanation,
    alchemyInterpretation: story.thesis,
    mechanism: story.mechanismSteps.map((step) => ({ ...step })),
    contradiction: story.contradiction.trim() ? story.contradiction : null,
    assetImplications: { assets: [...story.affectedAssets], text: story.marketReaction },
    nextTest: story.nextTest,
    invalidation: story.invalidation,
    confidence: story.confidence,
    eventAt: story.eventAt,
  };
}

function forwardItem(
  lane: JourneyChronologyItem["lane"],
  title: string,
  rawTime: string | null,
  explicitPrecision: JourneyTimePrecision | null,
  evidenceRefs: string[] = [],
): JourneyChronologyItem {
  return {
    id: chronologyId(lane, title, rawTime),
    lane,
    title,
    storyId: null,
    timing: timing(rawTime, explicitPrecision),
    evidenceRefs: unique(evidenceRefs),
  };
}

function upcomingChronology(upcoming: EditionUpcoming) {
  return [
    ...upcoming.economicCalendar.map((item) => forwardItem(
      "economic_calendar",
      item.event,
      item.time || null,
      /^\d{4}-\d{2}-\d{2}$/.test(item.time) ? "date" : null,
    )),
    ...upcoming.earnings.map((item) => forwardItem(
      "earnings",
      `${item.company} earnings`,
      item.time || null,
      /^\d{4}-\d{2}-\d{2}$/.test(item.time) ? "date" : null,
    )),
    ...upcoming.geopoliticalClock.map((item) => forwardItem(
      "geopolitical_clock",
      item.event,
      item.time,
      item.timePrecision || null,
    )),
  ];
}

function chronologyFor(stories: JourneyBigStory[], upcoming: EditionUpcoming) {
  const storyItems = stories.map((story) => ({
    id: `story:${story.storyId}`,
    lane: "story" as const,
    title: story.headline,
    storyId: story.storyId,
    timing: timing(story.eventAt || null, "exact"),
    evidenceRefs: [...story.evidenceRefs],
  }));
  return [...storyItems, ...upcomingChronology(upcoming)].sort((left, right) => {
    const leftDate = datePart(left.timing.value);
    const rightDate = datePart(right.timing.value);
    if (leftDate && rightDate && leftDate !== rightDate) return leftDate.localeCompare(rightDate);
    if (leftDate && !rightDate) return -1;
    if (!leftDate && rightDate) return 1;
    return 0;
  });
}

function horizonBuckets(items: JourneyChronologyItem[], generatedAt: string) {
  const editionDate = datePart(generatedAt);
  const today: JourneyChronologyItem[] = [];
  const tonight: JourneyChronologyItem[] = [];
  const later: JourneyChronologyItem[] = [];
  for (const item of items.filter((candidate) => candidate.lane !== "story")) {
    const label = item.timing.label || "";
    if (datePart(item.timing.value) === editionDate && /tonight|evening|overnight/i.test(label)) tonight.push(item);
    else if (datePart(item.timing.value) === editionDate) today.push(item);
    else later.push(item);
  }
  return { today, tonight, later };
}

export function composeJourneyBriefing({
  generatedAt,
  stories,
  changes,
  marketTape,
  upcoming,
  diagnostics,
  finalBoard,
}: {
  generatedAt: string;
  stories: EditionStory[];
  changes: MaterialChange[];
  marketTape: MarketTape;
  upcoming: EditionUpcoming;
  diagnostics: Pick<EditionDiagnostics, "warnings" | "eventHorizonCoverage">;
  finalBoard: AlchemyFinalBoard;
}): JourneyBriefingV1 {
  const bigStories = changes
    .slice(0, 3)
    .map((change) => storyForMaterialChange(change, stories))
    .filter((story): story is JourneyBigStory => Boolean(story));
  const lead = bigStories[0] || null;
  const chronology = chronologyFor(bigStories, upcoming);
  const horizon = horizonBuckets(chronology, generatedAt);

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
    horizon,
    closingMemory: {
      currentBias: lead?.alchemyInterpretation || finalBoard.highestConvictionChange,
      biggestUnresolvedQuestion: lead?.question || finalBoard.biggestUnresolvedContradiction,
      nextDecisiveTest: lead?.nextTest || finalBoard.mostImportantMacroTest,
      whatWouldChangeTheView: lead?.invalidation || finalBoard.riskToRespect,
    },
    diagnostics: {
      warnings: [...new Set(diagnostics.warnings)],
      eventHorizonCoverage: diagnostics.eventHorizonCoverage,
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
