import type { StoryLifecycleStatus } from "@/lib/intelligence/contracts";
import type { EventHorizonCoverage } from "@/lib/event-horizon-acquisition";
import type { MarketEventV1 } from "@/lib/market-events";
import {
  composeDossierBriefing,
  type DossierBriefingV1,
  type DossierStoryContext,
} from "./dossier-briefing.ts";
import { composeJourneyBriefing, type JourneyBriefingV1, type JourneyStorySource } from "./journey-briefing.ts";

export const ALCHEMY_MIXED_METHOD_VERSION = "alchemy-mixed-research-voice-v1";
export const TARGET_MINIMUM_MATERIAL_CHANGES = 4;
export const MAX_EDITION_CHANGES = 6;
export const MAX_WATCHLIST_NAMES = 6;

export type EvidenceStatus = "observed" | "strongly_supported" | "inferred" | "speculative";
export type SourceStatus = "official" | "named_source" | "reported" | "unverified";
export type MaterialChangeKind =
  | "evidence"
  | "catalyst"
  | "price_confirmation"
  | "probability"
  | "cross_asset_transmission"
  | "official_communication"
  | "management_communication"
  | "watchlist_state";

export type MechanismStep = {
  step: number;
  text: string;
  evidenceStatus: EvidenceStatus;
};

export type EditionStory = {
  id: string;
  parentStoryId: string;
  lifecycleStatus: StoryLifecycleStatus;
  title: string;
  centralQuestion: string;
  thesis: string;
  whatChanged: string;
  previousState: string;
  currentState: string;
  marketReaction: string;
  acceptedExplanation: string;
  contradiction: string;
  overlookedVariable: string;
  overlookedVariableEvidenceStatus: EvidenceStatus;
  marketMayBeRight: string;
  mechanismSteps: MechanismStep[];
  plainEnglish: string | null;
  affectedAssets: string[];
  themes: string[];
  nextTest: string;
  confirmation: string;
  invalidation: string;
  confidence: number;
  prohibitedClaims: string[];
  changeKinds: MaterialChangeKind[];
  eventAt: string;
};

export type MarketTape = {
  regimeSummary: string;
  assets: Array<{ symbol: string; move: string; state: string; whyRelevant: string }>;
};

export type BigNameStatement = {
  personOrInstitution: string;
  statement: string;
  sourceStatus: SourceStatus;
  whatChanged: string;
  implication: string;
  verificationNeeded: string;
};

export type ThemeWatch = {
  theme: string;
  state: "breakout" | "improving" | "strong" | "mixed" | "weakening" | "breakdown";
  driver: string;
  representativeNames: string[];
  whatChangesView: string;
};

export type WatchlistItem = {
  symbol: string;
  bucket: "momentum" | "setup" | "countertrend_risk";
  theme: string;
  whyNow: string;
  structure: string;
  confirmation: string;
  invalidation: string;
  catalyst: string;
  confidence: "low" | "medium" | "high";
};

export type PositioningAnomaly = {
  present: boolean;
  label: "Signal, not thesis.";
  type: "options" | "cot" | "etf_flow" | "dealer_gamma" | "block_trade" | "short_interest" | "filing" | "other";
  observation: string | null;
  sizeContext: string | null;
  plausibleInterpretations: string[];
  interpretationLimits: string | null;
  nextTest: string | null;
};

export type EconomicCalendarItem = {
  time: string;
  event: string;
  consensus: string | null;
  prior: string | null;
  exposedAssets: string[];
  whyItMatters: string;
};

export type EarningsItem = {
  company: string;
  time: string;
  decisiveVariable: string;
  linkedTheme: string;
  confirmationCase: string;
  disappointmentCase: string;
};

export type GeopoliticalClockItem = {
  time: string | null;
  event: string;
  participants: string[];
  transmission: string;
  decisiveOutcome: string;
  scheduled: boolean;
  eventType?: string;
  timePrecision?: "exact" | "date" | "window" | "tbc";
  verificationState?: "official" | "corroborated" | "reported" | "unverified";
  affectedAssets?: string[];
  sourceName?: string | null;
  sourceUrl?: string | null;
};

export type EditionUpcoming = {
  economicCalendar: EconomicCalendarItem[];
  earnings: EarningsItem[];
  geopoliticalClock: GeopoliticalClockItem[];
};

export type EditionDiagnostics = {
  warnings: string[];
  eventHorizonCoverage?: EventHorizonCoverage[];
};

export type AlchemyEdition = {
  methodologyVersion: typeof ALCHEMY_MIXED_METHOD_VERSION;
  generatedAt: string;
  comparisonWindowStart: string;
  targetMinimumMaterialChanges: number;
  materialChangeTargetMet: boolean;
  regime: string;
  sinceYouLastChecked: Array<{
    id: string;
    rank: number;
    headline: string;
    whatChanged: string;
    previousState: string;
    currentState: string;
    confidence: "low" | "medium" | "high";
    linkedStoryId: string;
  }>;
  marketTape: MarketTape;
  stories: EditionStory[];
  bigNames: BigNameStatement[];
  themeWatch: ThemeWatch[];
  watchlist: WatchlistItem[];
  positioningAnomaly: PositioningAnomaly | null;
  upcoming: EditionUpcoming;
  dossier?: DossierBriefingV1;
  journey?: JourneyBriefingV1;
  diagnostics?: EditionDiagnostics;
  finalBoard: {
    highestConvictionChange: string;
    biggestUnresolvedContradiction: string;
    mostImportantMacroTest: string;
    mostImportantGeopoliticalTest: string;
    strongestTheme: string;
    riskToRespect: string;
  };
};

type LockedStoryFields = Pick<EditionStory, "thesis" | "confidence" | "confirmation" | "invalidation" | "prohibitedClaims">;

/**
 * The explanation pass may improve comprehension, but canonical analytical
 * fields always win. This is deliberately pure and does not invoke a model.
 */
export function applyExplanationPass<T extends LockedStoryFields>(
  canonical: T,
  explanation: Partial<T> & { plainEnglish?: string | null; numberComparisons?: string[] },
) {
  return {
    ...explanation,
    ...canonical,
    plainEnglish: explanation.plainEnglish ?? null,
    numberComparisons: explanation.numberComparisons ?? [],
  };
}

export function qualifySource({
  evidenceClass,
  sourceTier,
  isPoliticalOrSocialStatement = false,
}: {
  evidenceClass: string;
  sourceTier: number;
  isPoliticalOrSocialStatement?: boolean;
}) {
  const sourceStatus: SourceStatus = ["official_release", "company_primary", "regulatory_filing"].includes(evidenceClass)
    ? "official"
    : sourceTier <= 3
      ? "named_source"
      : sourceTier <= 5
        ? "reported"
        : "unverified";
  return {
    sourceStatus,
    establishesRealWorldCondition: !isPoliticalOrSocialStatement && sourceStatus !== "unverified",
    evidenceMeaning: isPoliticalOrSocialStatement ? "messaging_or_intent" as const : "condition_evidence" as const,
  };
}

function confidenceLabel(value: number): "low" | "medium" | "high" {
  if (value >= 75) return "high";
  if (value >= 55) return "medium";
  return "low";
}

function materialSignature(story: EditionStory) {
  return JSON.stringify({
    currentState: story.currentState,
    thesis: story.thesis,
    marketReaction: story.marketReaction,
    confirmation: story.confirmation,
    invalidation: story.invalidation,
    confidence: story.confidence,
  });
}

export function selectMaterialChanges(stories: EditionStory[], previousEdition?: AlchemyEdition | null) {
  const priorByParent = new Map((previousEdition?.stories ?? []).map((story) => [story.parentStoryId, story]));
  const seenParents = new Set<string>();
  return stories.filter((story) => {
    if (!story.changeKinds.length || seenParents.has(story.parentStoryId)) return false;
    const prior = priorByParent.get(story.parentStoryId);
    if (prior && materialSignature(prior) === materialSignature(story)) return false;
    seenParents.add(story.parentStoryId);
    return true;
  }).slice(0, MAX_EDITION_CHANGES);
}

export function normaliseWatchlist(items: WatchlistItem[]) {
  return items.filter((item) => Boolean(
    item.symbol.trim()
    && item.theme.trim()
    && item.whyNow.trim()
    && item.confirmation.trim()
    && item.invalidation.trim()
    && item.catalyst.trim(),
  )).slice(0, MAX_WATCHLIST_NAMES);
}

export function scheduledGeopoliticalEvents(items: GeopoliticalClockItem[]) {
  return items.filter((item) => {
    if (!item.scheduled || !item.event.trim()) return false;
    if (item.timePrecision === "tbc") return true;
    return Boolean(item.time && Number.isFinite(Date.parse(item.time)));
  });
}

function emptyUpcoming(): EditionUpcoming {
  return { economicCalendar: [], earnings: [], geopoliticalClock: [] };
}

function priorDossierStoryContext(previousEdition: AlchemyEdition | null): DossierStoryContext[] {
  if (!previousEdition) return [];
  const manifest = (previousEdition as unknown as { canonicalStoryManifest?: unknown }).canonicalStoryManifest;
  if (!Array.isArray(manifest)) return [];

  const seen = new Set<string>();
  return manifest.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const candidate = entry as { storyId?: unknown; state?: unknown };
    if (!candidate.state || typeof candidate.state !== "object" || Array.isArray(candidate.state)) return [];
    const state = candidate.state as Record<string, unknown>;
    const id = typeof candidate.storyId === "string"
      ? candidate.storyId
      : typeof state.id === "string" ? state.id : null;
    const confidence = state.confidence;
    if (!id || seen.has(id) || typeof confidence !== "number" || !Number.isFinite(confidence)) return [];
    seen.add(id);
    const assets = Array.isArray(state.assets)
      ? state.assets.filter((asset): asset is string => typeof asset === "string")
      : Array.isArray(state.affectedAssets)
        ? state.affectedAssets.filter((asset): asset is string => typeof asset === "string")
        : [];
    const themes = Array.isArray(state.themes)
      ? state.themes.filter((theme): theme is string => typeof theme === "string")
      : [];
    return [{ id, confidence, affectedAssets: [...assets], themes: [...themes] }];
  });
}

export function composeAlchemyEdition({
  generatedAt,
  comparisonWindowStart,
  stories,
  previousEdition = null,
  marketTape = { regimeSummary: "Canonical market-tape evidence is not available for this edition.", assets: [] },
  bigNames = [],
  themeWatch = [],
  watchlist = [],
  positioningAnomaly = null,
  upcoming = emptyUpcoming(),
  journeyStorySources = [],
  marketEvents = [],
  diagnostics = { warnings: [] },
}: {
  generatedAt: string;
  comparisonWindowStart: string;
  stories: EditionStory[];
  previousEdition?: AlchemyEdition | null;
  marketTape?: MarketTape;
  bigNames?: BigNameStatement[];
  themeWatch?: ThemeWatch[];
  watchlist?: WatchlistItem[];
  positioningAnomaly?: PositioningAnomaly | null;
  upcoming?: EditionUpcoming;
  journeyStorySources?: JourneyStorySource[];
  marketEvents?: MarketEventV1[];
  diagnostics?: EditionDiagnostics;
}): AlchemyEdition {
  const changes = selectMaterialChanges(stories, previousEdition);
  const normalisedWatchlist = normaliseWatchlist(watchlist);
  const normalisedUpcoming = {
    ...upcoming,
    geopoliticalClock: scheduledGeopoliticalEvents(upcoming.geopoliticalClock),
  };
  const lead = [...changes].sort((left, right) => right.confidence - left.confidence)[0] ?? null;
  const contradiction = stories.find((story) => story.contradiction.trim())?.contradiction || "No evidence-backed contradiction cleared the edition gate.";
  const macroTest = normalisedUpcoming.economicCalendar[0]?.event || "No scheduled macro test is available in canonical evidence.";
  const geopoliticalTest = normalisedUpcoming.geopoliticalClock[0]?.event || "No scheduled geopolitical event is available in canonical evidence.";
  const strongestTheme = themeWatch[0]?.theme || stories.flatMap((story) => story.themes)[0] || "No material evidence theme is available.";
  const finalBoard = {
    highestConvictionChange: lead?.whatChanged || "No material change is available.",
    biggestUnresolvedContradiction: contradiction,
    mostImportantMacroTest: macroTest,
    mostImportantGeopoliticalTest: geopoliticalTest,
    strongestTheme,
    riskToRespect: lead?.invalidation || "No canonical invalidation condition is available.",
  };

  return {
    methodologyVersion: ALCHEMY_MIXED_METHOD_VERSION,
    generatedAt,
    comparisonWindowStart,
    targetMinimumMaterialChanges: TARGET_MINIMUM_MATERIAL_CHANGES,
    materialChangeTargetMet: changes.length >= TARGET_MINIMUM_MATERIAL_CHANGES,
    regime: marketTape.regimeSummary,
    sinceYouLastChecked: changes.map((story, index) => ({
      id: `${story.id}:change`,
      rank: index + 1,
      headline: story.title,
      whatChanged: story.whatChanged,
      previousState: story.previousState,
      currentState: story.currentState,
      confidence: confidenceLabel(story.confidence),
      linkedStoryId: story.id,
    })),
    marketTape,
    stories,
    bigNames: bigNames.map((statement) => ({ ...statement })),
    themeWatch,
    watchlist: normalisedWatchlist,
    positioningAnomaly: positioningAnomaly?.present ? { ...positioningAnomaly, label: "Signal, not thesis." } : null,
    upcoming: normalisedUpcoming,
    dossier: composeDossierBriefing({
      generatedAt,
      stories,
      changes,
      storySources: journeyStorySources,
      storyContext: priorDossierStoryContext(previousEdition),
      marketTape,
      upcoming: normalisedUpcoming,
      diagnostics,
    }),
    journey: composeJourneyBriefing({
      generatedAt,
      stories,
      changes,
      journeyStorySources,
      marketTape,
      marketEvents,
      diagnostics,
      finalBoard,
    }),
    diagnostics: { warnings: [...new Set(diagnostics.warnings)], eventHorizonCoverage: diagnostics.eventHorizonCoverage },
    finalBoard,
  };
}
