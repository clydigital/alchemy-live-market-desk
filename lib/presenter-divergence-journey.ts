import type {
  DossierPresentationCandidateExplanation,
  DossierPresentationInvestigation,
  DossierPresentationReactionCheck,
} from "./dossier-v2/presentation-adapter.ts";

const WINDOW_ORDER = {
  "5m": 0,
  "30m": 1,
  "4h": 2,
  close: 3,
  next_session: 4,
} as const;

export type PresenterReactionPath = {
  checkId: string;
  instrument: string;
  observedInstrument: string;
  isProxy: boolean;
  expectedDirection: "UP" | "DOWN";
  observedDirection: "UP" | "DOWN";
  relation: "ALIGNED" | "DIVERGENT";
  timingPrecision: "INTRADAY" | "DAILY_POST_EVENT";
  points: Array<{
    window: "5m" | "30m" | "4h" | "close" | "next_session";
    changePct: number;
    observedDirection: "UP" | "DOWN" | "FLAT";
  }>;
};

export type PresenterMechanism = DossierPresentationCandidateExplanation;

export type PresenterDivergenceCase = {
  id: string;
  question: string;
  whyItMatters: string;
  status: DossierPresentationInvestigation["status"];
  divergence: DossierPresentationInvestigation["divergence"];
  priorExpectedReaction: string | null;
  currentExpectedReaction: string | null;
  expectationChanged: boolean;
  observedReaction: string | null;
  calibrationOutcome: DossierPresentationInvestigation["reactionCalibration"]["outcome"];
  calibrationPrecision: DossierPresentationInvestigation["reactionCalibration"]["precision"];
  reactionWindows: DossierPresentationInvestigation["reactionCalibration"]["reactionWindows"];
  reactionPaths: PresenterReactionPath[];
  provisionalConclusion: string;
  mechanisms: PresenterMechanism[];
  fallbackCompetingExplanations: string[];
  researchNext: string;
  confirmationCondition: string;
  invalidationCondition: string;
  missingEvidence: string[];
};

function pathForCheck(check: DossierPresentationReactionCheck): PresenterReactionPath {
  const points = [...check.reactionPath]
    .sort((left, right) => WINDOW_ORDER[left.window] - WINDOW_ORDER[right.window])
    .map((point) => ({
      window: point.window,
      changePct: point.changePct,
      observedDirection: point.observedDirection,
    }));

  return {
    checkId: check.checkId,
    instrument: check.instrument,
    observedInstrument: check.observedInstrument,
    isProxy: check.isProxy,
    expectedDirection: check.expectedDirection,
    observedDirection: check.observedDirection,
    relation: check.relation,
    timingPrecision: check.timingPrecision,
    points,
  };
}

export function buildPresenterDivergenceJourney(
  investigations: DossierPresentationInvestigation[],
): PresenterDivergenceCase[] {
  return investigations.map((item) => ({
    id: item.id,
    question: item.question,
    whyItMatters: item.whyItMatters,
    status: item.status,
    divergence: item.divergence,
    priorExpectedReaction: item.journey.previousExpectedReaction ?? item.expectedReaction,
    currentExpectedReaction: item.expectedReaction,
    expectationChanged: item.journey.expectationChanged === true,
    observedReaction: item.observedReaction,
    calibrationOutcome: item.reactionCalibration.outcome,
    calibrationPrecision: item.reactionCalibration.precision,
    reactionWindows: [...item.reactionCalibration.reactionWindows],
    reactionPaths: item.reactionChecks.map(pathForCheck),
    provisionalConclusion: item.currentExplanation,
    mechanisms: item.candidateExplanations.map((candidate) => ({
      ...candidate,
      evidenceForRefs: [...candidate.evidenceForRefs],
      evidenceAgainstRefs: [...candidate.evidenceAgainstRefs],
    })),
    fallbackCompetingExplanations:
      item.candidateExplanations.length > 0 ? [] : [...item.competingExplanations],
    researchNext: item.researchNext,
    confirmationCondition: item.confirmationCondition,
    invalidationCondition: item.invalidationCondition,
    missingEvidence: [...item.missingEvidence],
  }));
}
