import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { runStructuredStage } from "./intelligence/openai.ts";
import { createSupabaseAdminClient } from "./supabase/admin.ts";
import {
  boundedTranscriptForReview,
  normaliseTranscriptResearchReview,
  TRANSCRIPT_RESEARCH_REVIEW_SCHEMA,
  type TranscriptResearchReview,
} from "./transcript-research-review-contract.ts";

const REVIEW_INSTRUCTIONS = `You are reviewing a creator transcript for the Alchemy Markets Live Desk.
The creator is a research lead, not an authoritative source. Extract how the creator reaches a market conclusion without promoting unverified claims into facts.

Identify the central thesis and causal chain; separate cited facts and observed moves from interpretation; capture tone, conviction, thresholds, catalysts, watch items, contradictions and the strongest countercase through the requested fields. Map only to supplied Story slugs. Mark factual creator claims that require independent verification and state the verification target.

Do not invent facts, sources, market moves, Story slugs or thresholds. Do not treat the creator's assertion as proof. Return only the requested structured output.`;

export type TranscriptReviewVideo = {
  id: string;
  publisher: string;
  title: string;
  url: string;
  publishedAt: string;
  transcriptText: string;
};

type ReviewStory = {
  id: string;
  slug: string;
  title: string;
  thesis: string;
  market_question: string | null;
  dominant_narrative: string | null;
  confirmation_trigger: string | null;
  invalidation_trigger: string | null;
  next_catalyst: string | null;
  assets: string[];
};

export async function reviewCreatorTranscript(input: {
  video: TranscriptReviewVideo;
  client?: SupabaseClient;
}): Promise<TranscriptResearchReview> {
  const client = input.client ?? createSupabaseAdminClient();
  const { data, error } = await client
    .from("stories")
    .select("id,slug,title,thesis,market_question,dominant_narrative,confirmation_trigger,invalidation_trigger,next_catalyst,assets")
    .neq("status", "archived")
    .neq("status", "discarded")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Could not load Story registry for transcript review: ${error.message}`);
  const stories = (data ?? []) as ReviewStory[];
  const allowedStorySlugs = new Set(stories.map((story) => story.slug));
  const result = await runStructuredStage<TranscriptResearchReview>({
    stageKey: "creator_transcript_review",
    instructions: REVIEW_INSTRUCTIONS,
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
