import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  cleanEvidenceClaim,
  routeResearchItemToStories,
  sanitiseResearchText,
  type RoutableStory,
} from "@/lib/intelligence/story-routing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type IntakeCandidate = {
  id: string;
  item_type: "video" | "news" | "alchemy_article";
  title: string;
  summary: string;
  affected_story_slugs: string[];
  status: string;
  recommended_action: string;
  transcript_status: string | null;
  video_review_status: string | null;
  creator_logic: string | null;
  recontextualized_summary: string | null;
  divergence_note: string | null;
};

type StoryRow = {
  id: string;
  slug: string;
  title: string;
  thesis: string;
  market_question: string | null;
  dominant_narrative: string | null;
  strongest_support: string | null;
  strongest_contradiction: string | null;
  confirmation_trigger: string | null;
  invalidation_trigger: string | null;
  next_catalyst: string | null;
  assets: string[];
};

export type ResearchIntakeEnrichmentResult = {
  considered: number;
  updated: number;
  routed: number;
  quarantinedVideos: number;
  supersededEvidenceRows: number;
};

function storyForRouter(story: StoryRow): RoutableStory {
  return {
    id: story.id,
    slug: story.slug,
    title: story.title,
    thesis: story.thesis,
    marketQuestion: story.market_question,
    dominantNarrative: story.dominant_narrative,
    strongestSupport: story.strongest_support,
    strongestContradiction: story.strongest_contradiction,
    confirmationTrigger: story.confirmation_trigger,
    invalidationTrigger: story.invalidation_trigger,
    nextCatalyst: story.next_catalyst,
    assets: story.assets ?? [],
  };
}

function sameStrings(left: string[] | null | undefined, right: string[]) {
  const a = [...new Set(left ?? [])].sort();
  const b = [...new Set(right)].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

async function supersedePriorCanonicalEvidence(client: SupabaseClient, intakeId: string) {
  const { data, error } = await client
    .from("intelligence_evidence")
    .update({ freshness_status: "superseded", updated_at: new Date().toISOString() })
    .eq("external_evidence_id", `research-intake:${intakeId}`)
    .neq("freshness_status", "superseded")
    .select("id");
  if (error) throw new Error(`Could not supersede stale canonical intake evidence: ${error.message}`);
  return data?.length ?? 0;
}

/**
 * Canonical evidence routing must happen before the model. This pass removes
 * transport markup, quarantines transcript-only creator rows, and maps fresh
 * items to existing Story slugs using explainable deterministic signals.
 */
export async function enrichResearchIntakeForStories(input: {
  client?: SupabaseClient;
  lookbackDays?: number;
} = {}): Promise<ResearchIntakeEnrichmentResult> {
  const client = input.client ?? createSupabaseAdminClient();
  const lookbackDays = Math.max(1, Math.min(14, input.lookbackDays ?? 7));
  const since = new Date(Date.now() - lookbackDays * 86_400_000).toISOString();
  const [{ data: intake, error: intakeError }, { data: stories, error: storyError }] = await Promise.all([
    client
      .from("research_intake_items")
      .select("id,item_type,title,summary,affected_story_slugs,status,recommended_action,transcript_status,video_review_status,creator_logic,recontextualized_summary,divergence_note")
      .gte("published_at", since)
      .neq("status", "rejected")
      .order("published_at", { ascending: false })
      .limit(240),
    client
      .from("stories")
      .select("id,slug,title,thesis,market_question,dominant_narrative,strongest_support,strongest_contradiction,confirmation_trigger,invalidation_trigger,next_catalyst,assets")
      .neq("status", "archived")
      .neq("status", "discarded")
      .order("updated_at", { ascending: false }),
  ]);
  if (intakeError) throw new Error(`Could not load research intake for canonical enrichment: ${intakeError.message}`);
  if (storyError) throw new Error(`Could not load Stories for canonical intake routing: ${storyError.message}`);

  const storyRows = (stories ?? []) as StoryRow[];
  const routable = storyRows.map(storyForRouter);
  const validSlugs = new Set(storyRows.map((story) => story.slug));
  let updated = 0;
  let routed = 0;
  let quarantinedVideos = 0;
  let supersededEvidenceRows = 0;

  for (const item of (intake ?? []) as IntakeCandidate[]) {
    const isUnreviewedVideo = item.item_type === "video"
      && item.transcript_status === "ready"
      && item.video_review_status !== "reviewed";
    if (isUnreviewedVideo) {
      if (item.status !== "blocked") {
        const { error } = await client.from("research_intake_items").update({
          status: "blocked",
          review_reason: "Transcript retrieval completed, but creator logic has not yet been reviewed into a research lead.",
          updated_at: new Date().toISOString(),
        }).eq("id", item.id);
        if (error) throw new Error(`Could not quarantine unreviewed transcript ${item.id}: ${error.message}`);
        updated += 1;
      }
      quarantinedVideos += 1;
      supersededEvidenceRows += await supersedePriorCanonicalEvidence(client, item.id);
      continue;
    }

    const cleanedSummary = cleanEvidenceClaim({ title: item.title, summary: item.summary });
    const cleanTitle = sanitiseResearchText(item.title);
    const explicitStorySlugs = (item.affected_story_slugs ?? []).filter((slug) => validSlugs.has(slug));
    const routes = routeResearchItemToStories({
      title: cleanTitle,
      summary: cleanedSummary,
      extraText: [item.creator_logic, item.recontextualized_summary, item.divergence_note].filter(Boolean).join(" "),
      explicitStorySlugs,
      stories: routable,
      maxRoutes: 4,
    });
    const storySlugs = routes.map((route) => route.storySlug);
    if (storySlugs.length) routed += 1;

    const summaryChanged = Boolean(cleanedSummary) && cleanedSummary !== item.summary;
    const routingChanged = !sameStrings(item.affected_story_slugs, storySlugs);
    const shouldAcceptReviewedVideo = item.item_type === "video" && item.video_review_status === "reviewed" && item.status === "blocked";
    if (!summaryChanged && !routingChanged && !shouldAcceptReviewedVideo) continue;

    if (summaryChanged) supersededEvidenceRows += await supersedePriorCanonicalEvidence(client, item.id);
    const { error } = await client.from("research_intake_items").update({
      ...(summaryChanged ? { summary: cleanedSummary } : {}),
      affected_story_slugs: storySlugs,
      ...(shouldAcceptReviewedVideo ? { status: "accepted" } : {}),
      review_reason: routes.length
        ? `Deterministic Story routing: ${routes.map((route) => `${route.storySlug} (${route.score})`).join(", ")}.`
        : item.item_type === "video" ? "Creator transcript reviewed; no current Story passed the deterministic relevance threshold." : "No existing Story passed the deterministic relevance threshold.",
      updated_at: new Date().toISOString(),
    }).eq("id", item.id);
    if (error) throw new Error(`Could not persist canonical intake enrichment for ${item.id}: ${error.message}`);
    updated += 1;
  }

  return {
    considered: intake?.length ?? 0,
    updated,
    routed,
    quarantinedVideos,
    supersededEvidenceRows,
  };
}
