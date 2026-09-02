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

export type DossierStoryContext = {
  id: string;
  confidence: number;
  affectedAssets: string[];
  themes: string[];
  recencyAt?: string | null;
};

export type DossierCurrentAttention = {
  state: "fresh_change" | "recent_context" | "stale_context";
  freshness: number;
  materiality: number;
  momentum: number;
  breadth: number;
  urgency: number;
  primaryCategory: string;
  assessedAt: string;
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
  currentAttention: DossierCurrentAttention;
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
    noMaterialNews: boolean;
    recruitedClusterCount: number;
  };
};

type MaterialChange = Pick<EditionStory, "id">;

type RankedSource = {
  source: JourneyStorySource;
  story: EditionStory | undefined;
  context: DossierStoryContext | undefined;
  changed: boolean;
  confidence: number;
  attention: DossierCurrentAttention;
  currentMatch: number;
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

function iconFor(
  story: EditionStory | undefined,
  reasoning: CanonicalStoryReasoningV1,
  context: DossierStoryContext | undefined,
): DossierIcon {
  const text = `${reasoning.title} ${reasoning.centralQuestion || ""} ${(story?.themes || context?.themes || []).join(" ")} ${(story?.affectedAssets || context?.affectedAssets || []).join(" ")}`.toLowerCase();
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

function canonicalConfidence(
  story: EditionStory | undefined,
  context: DossierStoryContext | undefined,
  reasoning: CanonicalStoryReasoningV1,
) {
  if (Number.isFinite(reasoning.confidence)) return reasoning.confidence;
  if (story && Number.isFinite(story.confidence)) return story.confidence;
  if (context && Number.isFinite(context.confidence)) return context.confidence;
  return null;
}

function lessonFromSource(
  source: JourneyStorySource,
  number: number,
  story: EditionStory | undefined,
  context: DossierStoryContext | undefined,
  changed: boolean,
  confidence: number,
  attention: DossierCurrentAttention,
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
  const lessonCallouts = callouts(story, reasoning);
  if (!changed) {
    lessonCallouts.unshift({
      type: "commentary_context",
      label: attention.state === "recent_context" ? "RECENT CONTEXT — NO MATERIAL CHANGE" : "STALE CONTEXT",
      text: attention.state === "recent_context"
        ? "This persistent Story helps frame the current desk, but this run did not produce a material update to it."
        : "This Story is retained only as background. It must not be read as a fresh signal.",
    });
  }
  return {
    number,
    storyId: source.storyId,
    publicationSnapshotId: source.publicationSnapshotId,
    thesisVersionId: source.thesisVersionId,
    icon: iconFor(story, reasoning, context),
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
    callouts: lessonCallouts,
    watchItems,
    evidenceRefs: evidenceRefs(reasoning),
    confidence,
    currentAttention: attention,
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

function overlapWithCurrentMarket(
  source: JourneyStorySource,
  story: EditionStory | undefined,
  context: DossierStoryContext | undefined,
  marketTape: MarketTape,
) {
  const reasoning = source.reasoning;
  const tapeAssets = new Set(marketTape.assets.map((asset) => normaliseAsset(asset.symbol)));
  const storyAssets = unique([
    ...(story?.affectedAssets || context?.affectedAssets || []),
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
    ...(story?.themes || context?.themes || []),
    ...(story?.affectedAssets || context?.affectedAssets || []),
  ].join(" "));
  const textOverlap = [...storyText].filter((word) => tapeText.has(word)).length;
  return assetOverlap * 10 + textOverlap;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function recencyFreshness(value: string | null | undefined, generatedAt: string) {
  const at = value ? Date.parse(value) : Number.NaN;
  const now = Date.parse(generatedAt);
  if (!Number.isFinite(at) || !Number.isFinite(now) || at > now + 3_600_000) return 0;
  const ageHours = Math.max(0, (now - at) / 3_600_000);
  return clamp(100 * (1 - (ageHours / 120)));
}

function sourceAttention(
  source: JourneyStorySource,
  story: EditionStory | undefined,
  context: DossierStoryContext | undefined,
  changed: boolean,
  generatedAt: string,
): DossierCurrentAttention {
  if (changed) {
    const current = story?.currentAttention;
    const assessedAt = current?.assessedAt || story?.eventAt || source.reasoning.effectiveAt;
    return {
      state: "fresh_change",
      freshness: current ? clamp(current.freshness) : recencyFreshness(assessedAt, generatedAt),
      materiality: clamp(current?.materiality || 0),
      momentum: clamp(current?.momentum || 0),
      breadth: clamp(current?.breadth || 0),
      urgency: clamp(current?.urgency || 0),
      primaryCategory: current?.primaryCategory || "uncategorised",
      assessedAt,
    };
  }
  const assessedAt = story?.eventAt || context?.recencyAt || source.reasoning.effectiveAt;
  const freshness = recencyFreshness(assessedAt, generatedAt);
  return {
    state: freshness > 0 ? "recent_context" : "stale_context",
    freshness,
    materiality: 0,
    momentum: 0,
    breadth: 0,
    urgency: 0,
    primaryCategory: "persistent_story_context",
    assessedAt,
  };
}

/** Current-attention fields are ordered explicitly; no opaque blended score is used. */
function compareRanked(left: RankedSource, right: RankedSource) {
  return Number(right.changed) - Number(left.changed)
    || right.attention.materiality - left.attention.materiality
    || right.attention.freshness - left.attention.freshness
    || right.attention.urgency - left.attention.urgency
    || right.attention.breadth - left.attention.breadth
    || right.attention.momentum - left.attention.momentum
    || right.currentMatch - left.currentMatch
    || right.confidence - left.confidence
    || left.source.position - right.source.position
    || left.source.storyId.localeCompare(right.source.storyId);
}

function selectDossierSources({
  stories,
  changes,
  storySources,
  storyContext,
  marketTape,
  generatedAt,
  warnings,
}: {
  stories: EditionStory[];
  changes: MaterialChange[];
  storySources: JourneyStorySource[];
  storyContext: DossierStoryContext[];
  marketTape: MarketTape;
  generatedAt: string;
  warnings: string[];
}) {
  const changedIds = new Set(changes.map((change) => change.id));
  const storyById = new Map(stories.map((story) => [story.id, story]));
  const contextById = new Map(storyContext.map((story) => [story.id, story]));
  const validSources = storySources.filter(validSource);
  const validIds = new Set(validSources.map((source) => source.storyId));

  for (const change of changes) {
    if (!validIds.has(change.id)) {
      warnings.push(`Dossier omitted Story ${change.id}: exact immutable Canonical Story Reasoning V1 snapshot is unavailable.`);
    }
  }

  const ranked = validSources.flatMap((source) => {
    const story = storyById.get(source.storyId);
    const context = contextById.get(source.storyId);
    const changed = changedIds.has(source.storyId);
    if (!changed && !sourceIsActive(story, source.reasoning)) return [];
    const confidence = canonicalConfidence(story, context, source.reasoning);
    if (confidence === null) {
      warnings.push(`Dossier omitted Story ${source.storyId}: canonical confidence is unavailable in both Story reasoning and immutable prior Story context.`);
      return [];
    }
    const attention = sourceAttention(source, story, context, changed, generatedAt);
    const currentMatch = overlapWithCurrentMarket(source, story, context, marketTape);
    const scheduledOnlyContext = !changed && /\bschedul(?:e|ed|ing)|decision date|economic calendar\b/i.test([
      source.reasoning.title,
      source.reasoning.currentState || "",
      source.reasoning.whatChanged || "",
    ].join(" "));
    if (!changed && (attention.state === "stale_context" || scheduledOnlyContext) && currentMatch === 0) return [];
    return [{
      source,
      story,
      context,
      changed,
      confidence,
      attention,
      currentMatch,
    } satisfies RankedSource];
  }).sort(compareRanked);

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
    .sort(compareRanked);
}

function topicChips(selected: RankedSource[]) {
  return unique(selected.flatMap((item) => [
    ...(item.story?.themes || item.context?.themes || []),
    ...(item.story?.affectedAssets || item.context?.affectedAssets || []),
  ])).slice(0, 7);
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
  storyContext = [],
  marketTape,
  upcoming,
  diagnostics,
}: {
  generatedAt: string;
  stories: EditionStory[];
  changes: MaterialChange[];
  storySources: JourneyStorySource[];
  storyContext?: DossierStoryContext[];
  marketTape: MarketTape;
  upcoming: EditionUpcoming;
  diagnostics: Pick<EditionDiagnostics, "warnings" | "eventHorizonCoverage" | "recruitment">;
}): DossierBriefingV1 {
  const warnings = [...new Set(diagnostics.warnings)];
  const rankedSources = selectDossierSources({ generatedAt, stories, changes, storySources, storyContext, marketTape, warnings });
  const lessons = rankedSources.map((item, index) => lessonFromSource(
    item.source,
    index + 1,
    item.story,
    item.context,
    item.changed,
    item.confidence,
    item.attention,
  ));
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
      topicChips: topicChips(rankedSources),
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
        "Legacy Story reasoning may recover confidence and asset context only from the prior immutable canonical Story manifest; no current mutable Story table is used for that fallback.",
        "Commentary and creator material remain research leads unless independently verified in canonical evidence.",
      ],
    },
    readAloud: { available: true },
    diagnostics: {
      warnings: [...new Set(warnings)],
      eventHorizonCoverage: (diagnostics.eventHorizonCoverage || []).map((item) => ({ ...item })),
      noMaterialNews: changes.length === 0,
      recruitedClusterCount: diagnostics.recruitment?.recruitedClusterCount || 0,
    },
  };
}
