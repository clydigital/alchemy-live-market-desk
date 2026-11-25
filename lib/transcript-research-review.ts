import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { loadPersistentStoriesForCreatorReview } from "./creator-story-routing.ts";
import { runStructuredStage } from "./intelligence/openai.ts";
import { createSupabaseAdminClient } from "./supabase/admin.ts";
import {
  boundedTranscriptForReview,
  normaliseTranscriptResearchReview,
  TRANSCRIPT_RESEARCH_REVIEW_SCHEMA,
  type TranscriptResearchReview,
} from "./transcript-research-review-contract.ts";

const REVIEW_INSTRUCTIONS = `You are reviewing a creator transcript for Bluebelly's creator intelligence research backend.
The creator is a research lead, not an authoritative source. Extract how the creator reaches a market conclusion without promoting unverified claims into facts.

Identify the central thesis and causal chain; separate cited facts and observed moves from interpretation; capture tone, conviction, thresholds, catalysts, watch items, contradictions and the strongest countercase through the requested fields. Preserve named companies, tickers, dated statistics, earnings/IPO/regulatory/company events and unusual interpretations when they are actually present in the transcript. Use expertNotes.kind=article_hook for a concrete writing angle worth exploring and expertNotes.kind=research_question for the specific follow-up search that could validate or deepen a lead. Map only to supplied Story slugs. Mark factual creator claims that require independent verification and state the verification target.

For the 1–2 most decision-relevant theses, use creatorLogic for explicit IF [measurable premises] AND [conditions] THEN [mechanism and outcome by horizon] UNLESS [rival or invalidation]. In claimChecks prioritize original news, economic releases and statistics, with metric, unit, actual/prior/consensus or comparable baseline, observation period, named original source and exact verification target when stated. Treat every unverified transcript claim as an attributed candidate, never an independent fact. Recalculate consequential arithmetic; if speech recognition or units conflict, state the conflict rather than silently repair it. Distinguish price vs realized revenue, run-rate vs actual spending, and bond yield vs equity return. In expertNotes prioritize causal_link (premise-to-outcome and horizon), countercase (competing mechanism), catalyst (next resolving release/threshold) and research_question (specific external evidence needed); indicate which premise an external new/revised news event or statistic could confirm, weaken, invalidate or transmit. Do not count repeated references to one original release as independent confirmations; no invented timecodes, probabilities or additive support scores. Existing story context is routing, not verification. Preserve useful partial reasoning and the existing field and length limits; article_hook is optional and lower priority than consequential evidence.

Do not invent facts, sources, market moves, Story slugs or thresholds. Do not treat the creator's assertion as proof. Return only the requested structured output.`;

export type TranscriptReviewVideo = {
  id: string;
  publisher: string;
  title: string;
  url: string;
  publishedAt: string;
  transcriptText: string;
};

export async function reviewCreatorTranscript(input: {
  video: TranscriptReviewVideo;
  client?: SupabaseClient;
}): Promise<TranscriptResearchReview> {
  const client = input.client ?? createSupabaseAdminClient();
  const stories = await loadPersistentStoriesForCreatorReview(client);
  const allowedStorySlugs = new Set(stories.map((story) => story.slug));
  const result = await runStructuredStage<TranscriptResearchReview>({
    stageKey: "creator_transcript_review",
    instructions: REVIEW_INSTRUCTIONS + (input.video.publisher === "ClearValueTax" ? "\nScope this review strictly to interest rates, Fed policy and forward projections; include labour or inflation only as it bears directly on rates. Ignore other topics, and emit no unrelated claims or Story mappings. If no relevant material exists, state that explicitly." : ""),
    input: {
      publisher: input.video.publisher,
      title: input.video.title,
      sourceUrl: input.video.url,
      publishedAt: input.video.publishedAt,
      existingStories: stories.map((story) => ({
        slug: story.slug,
        title: story.title,
        thesis: story.thesis,
        marketQuestion: story.market_question,
        dominantNarrative: story.dominant_narrative,
        confirmationTrigger: story.confirmation_trigger,
        invalidationTrigger: story.invalidation_trigger,
        nextCatalyst: story.next_catalyst,
        assets: story.assets ?? [],
      })),
      transcript: boundedTranscriptForReview(input.video.transcriptText),
    },
    schema: TRANSCRIPT_RESEARCH_REVIEW_SCHEMA as unknown as Record<string, unknown>,
    modelKind: "fast",
    maxOutputTokens: 3_200,
    requestTimeoutMs: 60_000,
    maxAttempts: 1,
  });
  return normaliseTranscriptResearchReview(result.data, allowedStorySlugs);
}
