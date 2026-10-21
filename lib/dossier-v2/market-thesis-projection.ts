import type { DossierPresentationV1, DossierPresentationStory, DossierPresentationInvestigation } from "./presentation-adapter.ts";
import type { MarketMotionRecord } from "../market-motion.ts";

/**
 * A dated, read-only selection of already authored market arguments.
 * This is neither a model writer nor a second Story/Regime adjudication path.
 * Motion references are discussion context, never canonical evidence.
 */
export const DOSSIER_MARKET_THESES_V1 = "dossier-market-theses/1" as const;

export type DossierMarketThesis = {
  key: string;
  headline: string;
  thesis: string;
  tension: string;
  mechanism: string;
  implication: string;
  countercase: string | null;
  invalidation: string;
  status: "SUPPORTED" | "CONDITIONAL";
  charts: Array<{
    id: string;
    instrument: string;
    timeframe: string;
    comparison: string | null;
    question: string;
    confirmation: string;
    contradiction: string;
  }>;
  relatedDevelopments: Array<{
    motionId: string; // owner provenance only; never print in public-facing prose
    headline: string;
    sourceName: string;
    sourceUrl: string;
    verificationState: string;
  }>;
  canonicalStoryId: string | null;
  analyticalStoryId: string;
  evidenceRefs: string[]; // internal read-model lineage, never a new admission
  asOf: string;
};

type ThesisInput = {
  dossier: DossierPresentationV1;
  motions?: readonly MarketMotionRecord[];
  limit?: number;
};

const OPERATOR_COPY = /\b(?:research brain|system\s*2|canonical evidence|evidence (?:uuid|ids?)|dossier pipeline|research gap|writing potential|article angles?|opening bell|c[o0]td|as an ai|ai.generated)\b/i;
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function displayText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length >= 12 && text.length <= 720 && !OPERATOR_COPY.test(text) ? text : null;
}

function safeSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

function firstInvestigation(story: DossierPresentationStory, items: DossierPresentationInvestigation[]) {
  return items.find((item) =>
    item.status !== "resolved" && item.status !== "parked"
    && (item.storyIds.includes(story.id) || story.investigationIds.includes(item.id))
  ) ?? null;
}

function observedDivergence(item: DossierPresentationInvestigation | null) {
  return item !== null
    && (item.divergence === "MATERIAL" || item.divergence === "PARTIAL")
    && item.reactionChecks.some((check) => check.relation === "DIVERGENT")
    && Boolean(displayText(item.expectedReaction))
    && Boolean(displayText(item.observedReaction));
}

function motionReferences(
  story: DossierPresentationStory,
  motions: readonly MarketMotionRecord[],
  asOf: number,
): DossierMarketThesis["relatedDevelopments"] {
  // The analytical Story ID is NOT interchangeable with its persistent UUID.
  if (!story.persistentStoryId || !UUID.test(story.persistentStoryId)) return [];
  return motions.filter((item) => (
    item.lifecycle_state === "PROMOTED"
    && item.primary_story_id === story.persistentStoryId
    && Number.isFinite(Date.parse(item.occurred_at))
    && Date.parse(item.occurred_at) <= asOf
  )).flatMap((item) => {
    const sourceUrl = safeSourceUrl(item.source_url);
    const headline = displayText(item.headline);
    const sourceName = displayText(item.source_name) ?? item.source_name.trim();
    if (!sourceUrl || !headline || !sourceName) return [];
    return [{
      motionId: item.id,
      headline,
      sourceName,
      sourceUrl,
      verificationState: item.verification_state,
    }];
  }).slice(0, 3);
}

function linkedCharts(
  dossier: DossierPresentationV1,
  story: DossierPresentationStory,
  investigation: DossierPresentationInvestigation | null,
): DossierMarketThesis["charts"] {
  const relatedIds = new Set([...(story.chartIds ?? []), ...(investigation?.chartIds ?? [])]);
  const all = [...dossier.charts.core, ...dossier.charts.optional];
  const selected = all.filter((chart) =>
    relatedIds.has(chart.chart_id)
    || chart.linked_story_ids.includes(story.id)
    || Boolean(investigation && chart.linked_investigation_ids.includes(investigation.id))
  );
  return selected.slice(0, 3).flatMap((chart) => {
    const instrument = displayText(chart.ticker_or_instrument) ?? chart.ticker_or_instrument.trim();
    const question = displayText(chart.exact_question);
    const confirmation = displayText(chart.confirmation_condition);
    const contradiction = displayText(chart.contradiction_condition);
    if (!instrument || !question || !confirmation || !contradiction) return [];
    return [{
      id: chart.chart_id,
      instrument,
      timeframe: chart.timeframe,
      comparison: chart.overlay_or_comparison?.trim() || null,
      question,
      confirmation,
      contradiction,
    }];
  });
}

/** Preserve persisted Dossier provenance; no live facts, market levels or wording are invented. */
export function buildDossierMarketTheses(input: ThesisInput): {
  contractVersion: typeof DOSSIER_MARKET_THESES_V1;
  dossierId: string;
  asOf: string;
  items: DossierMarketThesis[];
} {
  const { dossier, motions = [] } = input;
  const asOf = Date.parse(dossier.asOf);
  const limit = Math.max(0, Math.min(8, input.limit ?? 6));
  const items: DossierMarketThesis[] = [];
  if (!Number.isFinite(asOf)) {
    return { contractVersion: DOSSIER_MARKET_THESES_V1, dossierId: dossier.dossierId, asOf: dossier.asOf, items };
  }
  for (const story of dossier.whatMattersNow.stories) {
    if (items.length >= limit) break;
    const headline = displayText(story.title);
    const thesis = displayText(story.conclusion);
    const mechanism = displayText(story.mechanism);
    const implication = displayText(story.whyItMatters);
    const invalidation = displayText(story.whatWouldChangeMind);
    if (!headline || !thesis || !mechanism || !implication || !invalidation
      || !Array.isArray(story.evidenceRefs) || story.evidenceRefs.length === 0) continue;

    const investigation = firstInvestigation(story, dossier.watchNext);
    const measured = observedDivergence(investigation);
    const tension = measured
      ? `Expected: ${investigation!.expectedReaction!.trim()} Observed: ${investigation!.observedReaction!.trim()}`
      : displayText(story.whatChanged);
    // A tension is an observed finding or an explicitly dated development, not a
    // newly generated assumption about what market participants expected.
    if (!tension || OPERATOR_COPY.test(tension)) continue;
    const countercase = (investigation?.competingExplanations ?? [])
      .map(displayText).find((value): value is string => Boolean(value)) ?? null;
    const references = [...new Set(story.evidenceRefs)];
    const status = !dossier.health.degraded && ["OBSERVED", "SUPPORTED"].includes(story.epistemicLabel)
      ? "SUPPORTED" as const : "CONDITIONAL" as const;

    items.push({
      key: story.id,
      headline,
      thesis,
      tension,
      mechanism,
      implication,
      countercase,
      invalidation,
      status,
      charts: linkedCharts(dossier, story, investigation),
      relatedDevelopments: motionReferences(story, motions, asOf),
      analyticalStoryId: story.id,
      canonicalStoryId: story.persistentStoryId && UUID.test(story.persistentStoryId)
        ? story.persistentStoryId : null,
      evidenceRefs: references,
      asOf: dossier.asOf,
    });
  }
  return {
    contractVersion: DOSSIER_MARKET_THESES_V1,
    dossierId: dossier.dossierId,
    asOf: dossier.asOf,
    items,
  };
}
