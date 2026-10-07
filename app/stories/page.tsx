import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import StoriesRegistry from "@/components/live-desk/StoriesRegistry";
import { Badge, DataState, MetricGrid, Panel } from "@/components/live-desk/LiveDeskUi";
import { getStoryRegistryData } from "@/lib/data";
import { getStoryRecordLayer } from "@/lib/persistence/read";
import { classifyRegimeStory, getRegimeDefinition, routeStoryToRegimes } from "@/lib/regimes";
import { getStableStoryFallbackImage } from "@/lib/story-fallback-images";
import { assessStoryCatalyst, catalystDisplayLabel } from "@/lib/story-hygiene";
import { getStoryHeaderImages } from "@/lib/story-images";
import { getStoryReviewQueueState, storyHasFreshUnreviewedEvidence } from "@/lib/story-review-actionability";
import { deriveStoryTags } from "@/lib/story-tags";

export const dynamic = "force-dynamic";

export default async function StoriesPage() {
  const [data, recordLayer] = await Promise.all([getStoryRegistryData(), getStoryRecordLayer()]);
  const [storyImages, reviewQueueState] = await Promise.all([
    getStoryHeaderImages(data.stories.map((story) => story.id), data.sources),
    getStoryReviewQueueState(data.stories.map((story) => story.id)),
  ]);
  const reviewByStory = new Map(reviewQueueState.map((item) => [item.storyId, item]));
  const coverageBySlug = new Map(data.evidenceCoverage.map((coverage) => [coverage.slug, coverage]));
  const legacyEventCounts = new Map<string, number>();
  data.updates.forEach((update) => legacyEventCounts.set(update.story_id, (legacyEventCounts.get(update.story_id) || 0) + 1));

  const persistentEventCounts = new Map<string, number>();
  recordLayer.events.forEach((event) => persistentEventCounts.set(event.story_id, (persistentEventCounts.get(event.story_id) || 0) + 1));
  const versionCounts = new Map<string, number>();
  const latestVersionByStory = new Map<string, (typeof recordLayer.thesisVersions)[number]>();
  recordLayer.thesisVersions.forEach((version) => {
    versionCounts.set(version.story_id, (versionCounts.get(version.story_id) || 0) + 1);
    const prior = latestVersionByStory.get(version.story_id);
    if (!prior || version.version_number > prior.version_number || (
      version.version_number === prior.version_number && version.effective_at > prior.effective_at
    )) latestVersionByStory.set(version.story_id, version);
  });

  const now = new Date();
  const registryStories = data.stories.map((story) => {
    const image = storyImages.get(story.id);
    const fallback = getStableStoryFallbackImage(story.id);
    const version = latestVersionByStory.get(story.id);
    const current = {
      ...story,
      title: version?.title || story.title,
      thesis: version?.thesis || story.thesis,
      market_question: version?.market_question || story.market_question,
      next_catalyst: version?.next_catalyst || story.next_catalyst,
      assets: version?.assets || story.assets || [],
    };
    const maturity = classifyRegimeStory(story, version);
    const evidenceCoverage = coverageBySlug.get(story.slug);
    const catalyst = assessStoryCatalyst({
      nextCatalyst: current.next_catalyst,
      version,
      now,
    });
    const review = reviewByStory.get(story.id) ?? {
      storyId: story.id,
      pendingReviewCount: 0,
      lastEvidenceAt: null,
      lastEvaluatedAt: null,
    };
    const reviewActionability = maturity.maturity === "durable"
      ? "canonical_v1_ready" as const
      : maturity.maturity === "reasoning_gap"
        ? review.pendingReviewCount > 0
          ? "review_queued" as const
          : storyHasFreshUnreviewedEvidence(review)
            ? "fresh_evidence_unqueued" as const
            : "waiting_for_evidence" as const
        : "not_applicable" as const;
    const regimes = routeStoryToRegimes(story, version)
      .map((route) => getRegimeDefinition(route.regime))
      .filter((regime, index, all): regime is NonNullable<typeof regime> => Boolean(regime) && all.findIndex((item) => item?.slug === regime?.slug) === index)
      .map((regime) => ({ slug: regime.slug, label: regime.shortTitle }));
    return {
      id: story.id,
      slug: story.slug,
      title: current.title,
      thesis: current.thesis,
      lifecycle: version?.status || story.status,
      editorialVerdict: version?.article_verdict ?? story.article_verdict,
      confidence: version?.confidence ?? story.confidence,
      assets: current.assets,
      tags: deriveStoryTags(current, 8),
      marketQuestion: current.market_question,
      nextCatalyst: catalystDisplayLabel(catalyst),
      catalystStatus: catalyst.status,
      catalystRecalibrationRequired: catalyst.recalibrationRequired,
      maturity: maturity.maturity,
      maturityReason: maturity.reason,
      reviewActionability,
      pendingReviewCount: review.pendingReviewCount,
      lastEvidenceAt: review.lastEvidenceAt,
      lastEvaluatedAt: review.lastEvaluatedAt,
      evidenceRoom: evidenceCoverage?.room_status || null,
      evidenceSourceCount: evidenceCoverage?.source_count || 0,
      tier1SourceCount: evidenceCoverage?.tier1_source_count || 0,
      unresolvedEvidenceCount: evidenceCoverage?.unresolved_count || 0,
      evidenceGateScore: evidenceCoverage?.gate_score ?? null,
      eventCount: recordLayer.available ? (persistentEventCounts.get(story.id) || 0) : (legacyEventCounts.get(story.id) || 0),
      versionCount: recordLayer.available ? (versionCounts.get(story.id) || 0) : null,
      imageUrl: image?.imageUrl || fallback.dataUri,
      fallbackImageUrl: fallback.dataUri,
      imageSourceUrl: image?.articleUrl || null,
      imagePublisher: image?.publisher || null,
      imageKind: image?.kind || "fallback" as const,
      regimes,
      hybridHref: `/hybrid-output?story=${encodeURIComponent(story.slug)}`,
    };
  });

  const currentDrivers = registryStories.filter((story) => story.maturity === "durable").length;
  const reasoningGaps = registryStories.filter((story) => story.maturity === "reasoning_gap").length;
  const queuedReasoningReviews = registryStories.filter((story) => story.reviewActionability === "review_queued").length;
  const freshEvidenceUnqueued = registryStories.filter((story) => story.reviewActionability === "fresh_evidence_unqueued").length;
  const waitingForEvidence = registryStories.filter((story) => story.reviewActionability === "waiting_for_evidence").length;
  const thinEvidence = registryStories.filter((story) => story.evidenceRoom === "thin").length;
  const catalystsNeedingReview = registryStories.filter((story) => story.catalystRecalibrationRequired).length;

  return (
    <LiveDeskShell
      activePath="/stories"
      title="Stories"
      description="Living market theses inside durable Regimes. Visible headlines follow the latest accepted Story version while identity and history stay stable."
      meta={`${data.stories.length} non-archived Stories`}
    >
      <div className={styles.grid}>
        <MetricGrid
          items={[
            { value: currentDrivers, label: "Current Regime drivers" },
            { value: reasoningGaps, label: "Reasoning gaps" },
            { value: queuedReasoningReviews, label: "Reasoning reviews queued" },
            { value: freshEvidenceUnqueued, label: "Fresh evidence · not queued" },
            { value: waitingForEvidence, label: "Waiting for new evidence" },
            { value: thinEvidence, label: "Thin evidence rooms" },
            { value: catalystsNeedingReview, label: "Catalysts needing review" },
          ]}
        />

        <DataState
          state={recordLayer.available ? "ready" : "warn"}
          title={recordLayer.available ? "Versioned Story history available" : "Current thesis view active"}
          detail={recordLayer.available
            ? `${recordLayer.thesisVersions.length} immutable thesis versions, ${recordLayer.events.length} append-only Story events and ${data.evidenceCount} active evidence records are available.`
            : `The registry is using current Story records, exact dated updates and ${data.evidenceCount} active evidence records. Historical full-thesis versions will appear after the approved persistence migration is applied.`}
        />

        <DataState
          state={freshEvidenceUnqueued > 0 ? "risk" : queuedReasoningReviews > 0 || waitingForEvidence > 0 ? "warn" : "ready"}
          title="Reasoning-gap workability"
          detail={
            `${queuedReasoningReviews} reasoning-gap ${queuedReasoningReviews === 1 ? "Story has" : "Stories have"} evidence-backed A3 review already queued · ${freshEvidenceUnqueued} ${freshEvidenceUnqueued === 1 ? "has" : "have"} newer evidence without a queued review · ${waitingForEvidence} ${waitingForEvidence === 1 ? "is" : "are"} waiting for new canonical evidence. Queued reviews can progress through the existing Story-review path; a rerun alone cannot manufacture evidence or canonical V1 reasoning for a waiting Story.`
          }
        />

        <Panel
          title="Story registry"
          description="Current Regime-driving Stories are shown first. Use the operational filters to isolate queued reasoning reviews, reasoning gaps waiting for evidence, thin evidence rooms or catalysts that need recalibration; these are work queues, not permission to promote a Story without evidence."
          action={<Badge tone={recordLayer.available ? "ready" : "default"}>{recordLayer.available ? "Versioned" : "Current records"}</Badge>}
        >
          {registryStories.length ? (
            <StoriesRegistry stories={registryStories} />
          ) : (
            <DataState state="risk" title="Stories are updating" detail="No current Story records are available. No illustrative Stories are inserted in their place." />
          )}
        </Panel>
      </div>
    </LiveDeskShell>
  );
}
