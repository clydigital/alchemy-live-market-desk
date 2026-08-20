import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { runStructuredStage } from "@/lib/intelligence/openai";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  boundedTranscriptForReview,
  normaliseTranscriptResearchReview,
  TRANSCRIPT_RESEARCH_REVIEW_SCHEMA,
  type TranscriptResearchReview,
} from "@/lib/transcript-research-review-contract";

const REQUIRED_CREATOR_NAMES = new Set([
  "stockedup",
  "wall street truthbombs",
  "traders reality",
]);

const REVIEW_INSTRUCTIONS = `You are reviewing a creator transcript for the Alchemy Markets Live Desk.
The creator is a research lead, not an authoritative source. Extract how the creator reaches a market conclusion without promoting unverified claims into facts.

Work like an institutional research assistant:
1. Identify the creator's central thesis.
2. Reconstruct the causal chain: premise -> mechanism -> market reaction -> implication.
3. Separate cited facts and observed market moves from interpretation.
4. Capture explicit price/yield/technical thresholds, catalysts and timing conditions.
5. Capture the strongest countercase or condition that would make the thesis wrong.
6. Map the transcript only to the supplied existing Story slugs when there is a direct substantive connection.
7. Mark factual creator claims that require independent verification and state what should verify them.

Useful reasoning patterns include: compare the latest move with the existing thesis; separate macro-driven price action from fundamental deterioration; challenge a headline narrative by checking mechanism and scale; connect cross-asset signals through an explicit causal chain; and end with observable next tests.

Do not invent facts, sources, market moves, Story slugs or thresholds. Do not treat the creator's assertion as proof. Return only the requested structured output.`;

export type ReviewableVideo = {
  id: string;
  publisher: string;
  title: string;
  url: string;
  published_at: string;
  transcript_text: string;
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

export type TranscriptReviewBatchResult = {
  reviewed: number;
  failed: number;
  considered: number;
  reviewedVideoIds: string[];
  failures: Array<{ id: string; title: string; error: string }>;
};

function creatorPriority(publisher: string) {
  return REQUIRED_CREATOR_NAMES.has(publisher.trim().toLowerCase()) ? 0 : 1;
}

/**
 * Prevent one prolific channel from consuming the whole review budget. The
 * first pass takes the newest item from each publisher (required creators
 * first); spare capacity is then spent on additional videos.
 */
export function selectTranscriptReviewBatch(videos: ReviewableVideo[], maxReviews: number) {
  const limit = Math.max(1, Math.min(6, maxReviews));
  const ordered = [...videos].sort((left, right) => (
    creatorPriority(left.publisher) - creatorPriority(right.publisher)
      || right.published_at.localeCompare(left.published_at)
      || left.id.localeCompare(right.id)
  ));
  const selected: ReviewableVideo[] = [];
  const seenPublishers = new Set<string>();
  for (const video of ordered) {
    const publisher = video.publisher.trim().toLowerCase();
    if (seenPublishers.has(publisher)) continue;
    seenPublishers.add(publisher);
    selected.push(video);
    if (selected.length >= limit) return selected;
  }
  const selectedIds = new Set(selected.map((video) => video.id));
  for (const video of ordered) {
    if (selectedIds.has(video.id)) continue;
    selected.push(video);
    if (selected.length >= limit) break;
  }
  return selected;
}

async function reviewOne(video: ReviewableVideo, stories: ReviewStory[]) {
  const allowedStorySlugs = new Set(stories.map((story) => story.slug));
  const compactStories = stories.map((story) => ({
    slug: story.slug,
    title: story.title,
    thesis: story.thesis,
    marketQuestion: story.market_question,
    dominantNarrative: story.dominant_narrative,
    confirmationTrigger: story.confirmation_trigger,
    invalidationTrigger: story.invalidation_trigger,
    nextCatalyst: story.next_catalyst,
    assets: story.assets ?? [],
  }));
  const result = await runStructuredStage<TranscriptResearchReview>({
    stageKey: "creator_transcript_review",
    instructions: REVIEW_INSTRUCTIONS,
    input: {
      publisher: video.publisher,
      title: video.title,
      sourceUrl: video.url,
      publishedAt: video.published_at,
      existingStories: compactStories,
      transcript: boundedTranscriptForReview(video.transcript_text),
    },
    schema: TRANSCRIPT_RESEARCH_REVIEW_SCHEMA as unknown as Record<string, unknown>,
    modelKind: "fast",
    maxOutputTokens: 3_200,
    requestTimeoutMs: 60_000,
    maxAttempts: 1,
  });
  return normaliseTranscriptResearchReview(result.data, allowedStorySlugs);
}

/**
 * Turn stored transcripts into bounded research leads before the canonical
 * intelligence engine sees them. Retrieval success alone is not review.
 */
export async function reviewReadyCreatorTranscripts(input: {
  client?: SupabaseClient;
  maxReviews?: number;
} = {}): Promise<TranscriptReviewBatchResult> {
  const client = input.client ?? createSupabaseAdminClient();
  const maxReviews = Math.max(1, Math.min(6, input.maxReviews ?? 6));
  const since = new Date(Date.now() - (7 * 86_400_000)).toISOString();
  const [{ data: videos, error: videoError }, { data: stories, error: storyError }] = await Promise.all([
    client
      .from("research_intake_items")
      .select("id,publisher,title,url,published_at,transcript_text")
      .eq("item_type", "video")
      .eq("transcript_status", "ready")
      .eq("video_review_status", "transcript_only")
      .gte("published_at", since)
      .not("transcript_text", "is", null)
      .order("published_at", { ascending: false })
      .limit(48),
    client
      .from("stories")
      .select("id,slug,title,thesis,market_question,dominant_narrative,confirmation_trigger,invalidation_trigger,next_catalyst,assets")
      .neq("status", "archived")
      .neq("status", "discarded")
      .order("updated_at", { ascending: false }),
  ]);
  if (videoError) throw new Error(`Could not load transcript review queue: ${videoError.message}`);
  if (storyError) throw new Error(`Could not load Story registry for transcript review: ${storyError.message}`);

  const selected = selectTranscriptReviewBatch((videos ?? []) as ReviewableVideo[], maxReviews);
  const storyRows = (stories ?? []) as ReviewStory[];
  const outcomes = await Promise.all(selected.map(async (video) => {
    try {
      const review = await reviewOne(video, storyRows);
      const { error } = await client
        .from("research_intake_items")
        .update({
          summary: review.summary || video.title,
          creator_logic: review.creatorLogic || null,
          recontextualized_summary: review.recontextualizedSummary || null,
          terms_detected: review.termsDetected,
          claim_checks: review.claimChecks,
          expert_notes: review.expertNotes,
          affected_story_slugs: review.affectedStorySlugs,
          video_review_status: "reviewed",
          status: "accepted",
          review_reason: "Transcript reviewed into a research lead. Creator claims remain non-canonical until corroborated by traceable evidence.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", video.id)
        .eq("video_review_status", "transcript_only");
      if (error) throw new Error(error.message);
      return { ok: true as const, video };
    } catch (error) {
      return {
        ok: false as const,
        video,
        error: error instanceof Error ? error.message.slice(0, 500) : "Unknown transcript research-review failure.",
      };
    }
  }));

  const reviewedVideoIds = outcomes.flatMap((outcome) => outcome.ok ? [outcome.video.id] : []);
  const failures = outcomes.flatMap((outcome) => outcome.ok ? [] : [{
    id: outcome.video.id,
    title: outcome.video.title,
    error: outcome.error,
  }]);

  return {
    reviewed: reviewedVideoIds.length,
    failed: failures.length,
    considered: selected.length,
    reviewedVideoIds,
    failures,
  };
}
