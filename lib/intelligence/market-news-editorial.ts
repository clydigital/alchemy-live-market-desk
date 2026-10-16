/**
 * Source-bound, edition-frozen news reading packets.
 *
 * This is NOT a second causal engine, an LLM writer, or an editorial approval.
 * Every sentence is copied from the already-admitted Live Motion or immutable
 * Story reasoning. LY-style rewrite requires separate approved upstream QC.
 */
import type { JourneyBigStory } from "./journey-briefing.ts";
import type { MarketMotionEditionItem } from "../market-motion-edition.ts";

export const MARKET_NEWS_EDITORIAL_V1 = "market-news-editorial/v1" as const;
export const MAX_MARKET_NEWS_ARTICLES = 5;

export type MarketNewsParagraph = {
  role: "development" | "story_context" | "mechanism" | "interpretation" | "countercase" | "next_test";
  text: string;
};

export type MarketNewsArticle = {
  articleId: string;
  storyId: string;
  storySnapshotId: string;
  thesisVersionId: string;
  motionIds: string[];
  motionEvidenceRefs: string[];
  storyEvidenceRefs: string[];
  regimeSlug: string | null;
  regimeRelation: "ROUTED_CONTEXT_ONLY";
  title: string;
  occurredAt: string;
  sourceName: string;
  sourceUrl: string;
  paragraphs: MarketNewsParagraph[];
  editorialStatus: "SOURCE_BOUND_DRAFT_NOT_LY_QC_APPROVED";
};

export type MarketNewsEditorialV1 = {
  contractVersion: typeof MARKET_NEWS_EDITORIAL_V1;
  articles: MarketNewsArticle[];
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function add(paragraphs: MarketNewsParagraph[], role: MarketNewsParagraph["role"], value: unknown) {
  const body = text(value);
  if (!body) return;
  if (paragraphs.some((p) => p.text.toLowerCase() === body.toLowerCase())) return;
  paragraphs.push({ role, text: body });
}

function mechanism(story: JourneyBigStory) {
  const edges = story.mechanism || [];
  const supported = edges.filter((edge) => text(edge.from) && text(edge.relationship) && text(edge.to)
    && Array.isArray(edge.evidenceIds) && edge.evidenceIds.length > 0);
  // Link strength stays visible. Do not turn inferred steps into observed facts.
  return supported.slice(0, 3).map((edge) => {
    const relationship = edge.from + " " + edge.relationship + " " + edge.to;
    const strength = (edge.evidenceState || "inferred").replaceAll("_", " ");
    return relationship + " (" + strength + ").";
  }).join(" ");
}

function qualifyingMotion(motion: MarketMotionEditionItem, story: JourneyBigStory) {
  return motion.lifecycleState === "PROMOTED"
    && motion.storyId === story.storyId
    && Boolean(text(motion.promotionEvidenceRef))
    && Boolean(text(motion.whatHappened))
    && Boolean(text(motion.sourceName))
    && /^https:\/\//.test(motion.sourceUrl)
    && Number.isFinite(Date.parse(motion.occurredAt));
}

/**
 * A publication-worthy event can lead an article only if Live has promoted the
 * exact Motion with canonical corroboration and a changed Story has an exact
 * immutable thesis snapshot. Never present background Story memory as news.
 */
export function composeMarketNewsEditorial(input: {
  stories: JourneyBigStory[];
  motions: MarketMotionEditionItem[];
}): MarketNewsEditorialV1 {
  const articles: MarketNewsArticle[] = [];
  const seen = new Set<string>();
  for (const story of input.stories) {
    if (!story.storyId || !story.publicationSnapshotId || !story.thesisVersionId
      || !Array.isArray(story.evidenceRefs) || !story.evidenceRefs.length) continue;
    const matches = input.motions.filter((motion) => qualifyingMotion(motion, story));
    if (!matches.length || seen.has(story.storyId)) continue;
    seen.add(story.storyId);
    const lead = [...matches].sort((a,b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt) || a.id.localeCompare(b.id))[0];
    const paragraphs: MarketNewsParagraph[] = [];
    add(paragraphs, "development", lead.whatHappened);
    add(paragraphs, "story_context", story.whatChanged);
    add(paragraphs, "mechanism", mechanism(story));
    add(paragraphs, "interpretation", story.marketInterpretation || story.alchemyInterpretation);
    add(paragraphs, "countercase", story.contradiction?.strongest);
    add(paragraphs, "next_test", story.nextTest?.label);
    // Never fill a draft with repeated or inferred statements.
    if (paragraphs.length < 3) continue;

    articles.push({
      articleId: story.publicationSnapshotId + ":" + lead.id,
      storyId: story.storyId,
      storySnapshotId: story.publicationSnapshotId,
      thesisVersionId: story.thesisVersionId,
      motionIds: matches.map((m) => m.id),
      motionEvidenceRefs: [...new Set(matches.map((m) => text(m.promotionEvidenceRef)).filter(Boolean))],
      storyEvidenceRefs: [...story.evidenceRefs],
      regimeSlug: lead.regimeSlug || null,
      regimeRelation: "ROUTED_CONTEXT_ONLY",
      title: lead.headline,
      occurredAt: lead.occurredAt,
      sourceName: lead.sourceName,
      sourceUrl: lead.sourceUrl,
      paragraphs,
      editorialStatus: "SOURCE_BOUND_DRAFT_NOT_LY_QC_APPROVED",
    });
    if (articles.length === MAX_MARKET_NEWS_ARTICLES) break;
  }
  return { contractVersion: MARKET_NEWS_EDITORIAL_V1, articles };
}
