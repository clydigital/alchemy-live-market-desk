import type { EventHorizonCoverage } from "../event-horizon-acquisition.ts";
import {
  CANONICAL_STORY_REASONING_V1,
  type CanonicalStoryReasoningV1,
  type EvidenceState,
} from "./story-reasoning.ts";
import type {
  EditionDiagnostics,
  EditionStory,
  EditionUpcoming,
  MarketTape,
} from "./edition.ts";
import type { JourneyStorySource } from "./journey-briefing.ts";

export const DOSSIER_BRIEFING_V1 = "dossier-briefing/v1" as const;
const MAX_DOSSIER_LESSONS = 6;

export type DossierIcon =
  | "energy"
  | "policy"
  | "bonds"
  | "japan"
  | "gold"
  | "equities"
  | "fx"
  | "credit"
  | "macro"
  | "generic";

export type DossierCalloutType =
  | "plain_english"
  | "why_traders_care"
  | "confirmation"
  | "invalidation"
  | "warning"
  | "commentary_context";

export type DossierCallout = {
  type: DossierCalloutType;
  label: string;
  text: string;
};

export type DossierStorylineNode = {
  id: string;
  label: string;
};

export type DossierStorylineLink = {
  from: string;
  to: string;
  relationship: string;
  evidenceStatus: EvidenceState;
  evidenceRefs: string[];
};

export type DossierLesson = {
  number: number;
  storyId: string;
  publicationSnapshotId: string;
  thesisVersionId: string;
  icon: DossierIcon;
  title: string;
  question: string | null;
  body: string[];
  causeEffect: Array<{
    from: string;
    relationship: string;
    to: string;
    evidenceStatus: EvidenceState;
    evidenceRefs: string[];
  }>;
  callouts: DossierCallout[];
  watchItems: Array<{ variable: string; why: string }>;
  evidenceRefs: string[];
  confidence: number;
};

export type DossierBriefingV1 = {
  contractVersion: typeof DOSSIER_BRIEFING_V1;
  generatedAt: string;
  opening: {
    headline: string;
    summary: string;
    marketState: string;
    topicChips: string[];
  };
  quickSummary: Array<{
    rank: number;
    text: string;
    storyId: string;
  }>;
  primaryStoryline: {
    title: string;
    nodes: DossierStorylineNode[];
    links: DossierStorylineLink[];
    strongestBreakCondition: string | null;
  } | null;
  lessons: DossierLesson[];
  watchNow: Array<{
    variable: string;
    whyItMatters: string;
    strengtheningSignal: string | null;
  }>;
  ahead: EditionUpcoming;
  sourceDiscipline: {
    interpretationNotes: string[];
  };
  readAloud: {
    available: true;
  };
  diagnostics: {
    warnings: string[];
    eventHorizonCoverage: EventHorizonCoverage[];
  };
};

type MaterialChange = Pick<EditionStory, "id">;

type RankedSource = {
  source: JourneyStorySource;
  story: EditionStory | undefined;
  changed: boolean;
  score: number;
};

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()))];
}

function normaliseNode(value: string) {
  return value.trim().toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72) || "node";
}

function normaliseAsset(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function words(value: string) {
  return new Set(value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !["this", "that", "with", "from", "into", "have", "will", "market", "story", "current"].includes(word)));
}

function validSource(source: JourneyStorySource) {
  return source.position > 0
    && Boolean(source.publicationSnapshotId)
    && Boolean(source.storyId)
    && Boolean(source.thesisVersionId)
    && source.reasoning.contractVersion === CANONICAL_STORY_REASONING_V1
    && source.reasoning.storyId === source.storyId
    && source.reasoning.storyVersionId === source.thesisVersionId;
}

function evidenceRefs(reasoning: CanonicalStoryReasoningV1) {
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

function iconFor(story: EditionStory | undefined, reasoning: CanonicalStoryReasoningV1): DossierIcon {
  const text = `${reasoning.title} ${reasoning.centralQuestion || ""} ${(story?.themes || []).join(" ")} ${(story?.affectedAssets || []).join(" ")}`.toLowerCase();
  if (/oil|crude|brent|wti|energy|diesel|gasoline|lng|hormuz|refin/.test(text)) return "energy";
  if (/fed|fomc|central bank|rate decision|policy|warsh|powell|ecb|boe/.test(text)) return "policy";
  if (/treasury|yield|bond|duration|term premium|curve|jgb/.test(text)) return "bonds";
  if (/japan|yen|jpy|boj/.test(text)) return "japan";
  if (/gold|xau|precious/.test(text)) return "gold";
  if (/credit|spread|funding|refinanc/.test(text)) return "credit";
  if (/usd|eur|gbp|aud|nzd|cad|chf|fx|currency/.test(text)) return "fx";
  if (/equity|stock|software|semiconductor|tech|earnings|nasdaq|s&p|spy|qqq/.test(text)) return "equities";
  if (/inflation|cpi|ppi|pce|jobs|payroll|ism|gdp|growth|consumer/.test(text)) return "macro";
  return "generic";
}

function traderRelevance(reasoning: CanonicalStoryReasoningV1) {
  return reasoning.assetImplications
    .slice(0, 3)
    .map((impact) => `${impact.asset}: ${impact.baseCase}`)
    .join(" ");
}

function callouts(story: EditionStory | undefined, reasoning: CanonicalStoryReasoningV1): DossierCallout[] {
  const output: DossierCallout[] = [];
  if (story?.plainEnglish?.trim()) {
    output.push({ type: "plain_english", label: "IN PLAIN ENGLISH", text: story.plainEnglish.trim() });
  }
  const relevance = traderRelevance(reasoning);
  if (relevance) output.push({ type: "why_traders_care", label: "WHY TRADERS CARE", text: relevance });
  const countercase = reasoning.countercase.marketMayBeRight || reasoning.countercase.strongest;
  if (countercase?.trim()) output.push({ type: "warning", label: "IMPORTANT CAVEAT", text: countercase.trim() });
  if (reasoning.confirmation.length) {
    output.push({ type: "confirmation", label: "WHAT CONFIRMS THIS?", text: reasoning.confirmation.join("; ") });
  }
  if (reasoning.invalidation.length) {
    output.push({ type: "invalidation", label: "WHAT WEAKENS THIS?", text: reasoning.invalidation.join("; ") });
  }
  return output;
}

function lessonFromSource(
  source: JourneyStorySource,
  number: number,
  story: EditionStory | undefined,
  changed: boolean,
): DossierLesson {
  const reasoning = source.reasoning;
  const body = unique(changed
    ? [
      reasoning.whatChanged,
      reasoning.currentState,
      reasoning.acceptedExplanation,
      reasoning.overlookedVariable.text ? `The detail to keep in view: ${reasoning.overlookedVariable.text}` : null,
    ]
    : [
      reasoning.currentState,
      reasoning.acceptedExplanation,
      reasoning.overlookedVariable.text ? `The detail to keep in view: ${reasoning.overlookedVariable.text}` : null,
    ]);
  const watchItems = reasoning.nextTest?.label
    ? [{ variable: reasoning.nextTest.label, why: "This is the next canonical test attached to the Story." }]
    : [];
  return {
    number,
    storyId: source.storyId,
    publicationSnapshotId: source.publicationSnapshotId,
    thesisVersionId: source.thesisVersionId,
    icon: iconFor(story, reasoning),
    title: reasoning.centralQuestion || reasoning.title,
    question: reasoning.centralQuestion,
    body,
    causeEffect: reasoning.causalChain.map((edge) => ({
      from: edge.from,
      relationship: edge.relationship,
      to: edge.to,
      evidenceStatus: edge.evidenceState,
      evidenceRefs: [...edge.evidenceIds],
    })),
    callouts: callouts(story, reasoning),
    watchItems,
    evidenceRefs: evidenceRefs(reasoning),
    confidence: reasoning.confidence,
  };
}

function storyline(lessons: DossierLesson[]) {
  if (!lessons.length) return null;
  const nodeMap = new Map<string, DossierStorylineNode>();
  const links: DossierStorylineLink[] = [];
  for (const lesson of lessons) {
    for (const edge of lesson.causeEffect) {
      const fromId = `node:${normaliseNode(edge.from)}`;
      const toId = `node:${normaliseNode(edge.to)}`;
      if (!nodeMap.has(fromId)) nodeMap.set(fromId, { id: fromId, label: edge.from });
      if (!nodeMap.has(toId)) nodeMap.set(toId, { id: toId, label: edge.to });
      links.push({
        from: fromId,
        to: toId,
        relationship: edge.relationship,
        evidenceStatus: edge.evidenceStatus,
        evidenceRefs: [...edge.evidenceRefs],
      });
    }
  }
  const strongestBreakCondition = lessons
    .flatMap((lesson) => lesson.callouts.filter((item) => item.type === "invalidation").map((item) => item.text))[0] || null;
  return {
    title: lessons.length > 1 ? "How today's main stories connect" : lessons[0].title,
    nodes: [...nodeMap.values()],
    links,
    strongestBreakCondition,
  };
}

function lifecycleScore(story: EditionStory | undefined, reasoning: CanonicalStoryReasoningV1) {
  const lifecycle = story?.lifecycleStatus || reasoning.lifecycle;
  if (lifecycle === "confirmed") return 30;
  if (lifecycle === "developing") return 20;
  if (lifecycle === "detected") return 10;
  if (lifecycle === "weakening") return 0;
  return -100;
}

function sourceIsActive(story: EditionStory | undefined, reasoning: CanonicalStoryReasoningV1) {
  const lifecycle = story?.lifecycleStatus || reasoning.lifecycle;
  return lifecycle !== "invalidated" && lifecycle !== "archived";
}

function sourceScore({
  source,
  story,
  changed,
  marketTape,
}: Omit<RankedSource, "score"> & { marketTape: MarketTape }) {
  const reasoning = source.reasoning;
  const tapeAssets = new Set(marketTape.assets.map((asset) => normaliseAsset(asset.symbol)));
  const storyAssets = unique([
    ...(story?.affectedAssets || []),
    ...reasoning.assetImplications.map((impact) => impact.asset),
  ]).map(normaliseAsset);
  const assetOverlap = storyAssets.filter((asset) => tapeAssets.has(asset)).length;

  const tapeText = words([
    marketTape.regimeSummary,
    ...marketTape.assets.flatMap((asset) => [asset.symbol, asset.state, asset.whyRelevant]),
  ].join(" "));
  const storyText = words([
    reasoning.title,
    reasoning.centralQuestion || "",
    reasoning.currentState,
    reasoning.acceptedExplanation,
    reasoning.overlookedVariable.text,
    ...(story?.themes || []),
    ...(story?.affectedAssets || []),
  ].join(" "));
  const textOverlap = [...storyText].filter((word) => tapeText.has(word)).length;

  return reasoning.confidence
    + (changed ? 30 : 0)
    + lifecycleScore(story, reasoning)
    + Math.max(0, 20 - Math.max(0, source.position - 1) * 3)
    + Math.min(60, assetOverlap * 20)
    + Math.min(20, textOverlap * 4);
}

function selectDossierSources({
  stories,
  changes,
  storySources,
  marketTape,
  warnings,
}: {
  stories: EditionStory[];
  changes: MaterialChange[];
  storySources: JourneyStorySource[];
  marketTape: MarketTape;
  warnings: string[];
}) {
  const changedIds = new Set(changes.map((change) => change.id));
  const storyById = new Map(stories.map((story) => [story.id, story]));
  const validSources = storySources.filter(validSource);
  const validIds = new Set(validSources.map((source) => source.storyId));

  for (const change of changes) {
    if (!validIds.has(change.id)) {
      warnings.push(`Dossier omitted Story ${change.id}: exact immutable Canonical Story Reasoning V1 snapshot is unavailable.`);
    }
  }

  const ranked = validSources
    .filter((source) => changedIds.has(source.storyId) || sourceIsActive(storyById.get(source.storyId), source.reasoning))
    .map((source) => {
      const story = storyById.get(source.storyId);
      const changed = changedIds.has(source.storyId);
      return {
        source,
        story,
        changed,
        score: sourceScore({ source, story, changed, marketTape }),
      } satisfies RankedSource;
    })
    .sort((left, right) => right.score - left.score || left.source.position - right.source.position || left.source.storyId.localeCompare(right.source.storyId));

  const selected = ranked.slice(0, MAX_DOSSIER_LESSONS);
  const selectedIds = new Set(selected.map((item) => item.source.storyId));
  for (const changed of ranked.filter((item) => item.changed && !selectedIds.has(item.source.storyId))) {
    let replaceIndex = -1;
    for (let index = selected.length - 1; index >= 0; index -= 1) {
      if (!selected[index].changed) {
        replaceIndex = index;
        break;
      }
    }
    if (replaceIndex < 0) break;
    selectedIds.delete(selected[replaceIndex].source.storyId);
    selected[replaceIndex] = changed;
    selectedIds.add(changed.source.storyId);
  }

  return selected
    .sort((left, right) => right.score - left.score || left.source.position - right.source.position || left.source.storyId.localeCompare(right.source.storyId));
}

function topicChips(stories: EditionStory[], selectedStoryIds: string[]) {
  const selected = new Set(selectedStoryIds);
  return unique(stories
    .filter((story) => selected.has(story.id))
    .flatMap((story) => [...story.themes, ...story.affectedAssets]))
    .slice(0, 7);
}

function watchNow(lessons: DossierLesson[], marketTape: MarketTape) {
  const output: DossierBriefingV1["watchNow"] = [];
  const seen = new Set<string>();
  const push = (variable: string, whyItMatters: string, strengtheningSignal: string | null) => {
    const key = variable.trim().toLocaleLowerCase("en-US");
    if (!key || seen.has(key)) return;
    seen.add(key);
    output.push({ variable, whyItMatters, strengtheningSignal });
  };
  for (const lesson of lessons) {
    for (const item of lesson.watchItems) push(item.variable, item.why, null);
  }
  for (const asset of marketTape.assets.slice(0, 6)) {
    push(asset.symbol, asset.whyRelevant || asset.state, asset.state || null);
  }
  return output.slice(0, 10);
}

export function composeDossierBriefing({
  generatedAt,
  stories,
  changes,
  storySources,
  marketTape,
  upcoming,
  diagnostics,
}: {
  generatedAt: string;
  stories: EditionStory[];
  changes: MaterialChange[];
  storySources: JourneyStorySource[];
  marketTape: MarketTape;
  upcoming: EditionUpcoming;
  diagnostics: Pick<EditionDiagnostics, "warnings" | "eventHorizonCoverage">;
}): DossierBriefingV1 {
  const warnings = [...new Set(diagnostics.warnings)];
  const rankedSources = selectDossierSources({ stories, changes, storySources, marketTape, warnings });
  const lessons = rankedSources.map((item, index) => lessonFromSource(item.source, index + 1, item.story, item.changed));
  const lead = lessons[0] || null;
  const quickSummary = lessons.slice(0, 5).map((lesson, index) => ({
    rank: index + 1,
    text: lesson.body[0] || lesson.title,
    storyId: lesson.storyId,
  }));
  return {
    contractVersion: DOSSIER_BRIEFING_V1,
    generatedAt,
    opening: {
      headline: lead?.title || "No supported active Story context is available for this edition.",
      summary: lead?.body[0] || "The canonical Live edition contains no active Story reasoning to explain.",
      marketState: marketTape.regimeSummary,
      topicChips: topicChips(stories, lessons.map((lesson) => lesson.storyId)),
    },
    quickSummary,
    primaryStoryline: storyline(lessons),
    lessons,
    watchNow: watchNow(lessons, marketTape),
    ahead: {
      economicCalendar: upcoming.economicCalendar.map((item) => ({ ...item, exposedAssets: [...item.exposedAssets] })),
      earnings: upcoming.earnings.map((item) => ({ ...item })),
      geopoliticalClock: upcoming.geopoliticalClock.map((item) => ({
        ...item,
        participants: [...item.participants],
        affectedAssets: item.affectedAssets ? [...item.affectedAssets] : undefined,
      })),
    },
    sourceDiscipline: {
      interpretationNotes: [
        "Dossier content is derived from canonical Live Story reasoning and may simplify wording without changing evidence status, confidence, confirmation or invalidation.",
        "Active persistent Stories may remain in the Dossier when they still help explain the current market state, even if they did not materially change in this run.",
        "Commentary and creator material remain research leads unless independently verified in canonical evidence.",
      ],
    },
    readAloud: { available: true },
    diagnostics: {
      warnings: [...new Set(warnings)],
      eventHorizonCoverage: (diagnostics.eventHorizonCoverage || []).map((item) => ({ ...item })),
    },
  };
}
