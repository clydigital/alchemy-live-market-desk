import { getHybridDeskData } from "@/lib/data";
import { getEconomicCalendar } from "@/lib/calendar";
import { firecrawlConfigured } from "@/lib/firecrawl";
import { openAIIntelligenceEnabled, intelligenceModel } from "@/lib/intelligence/openai";
import { youtubeDiscoveryHealthState } from "@/lib/youtube-health";
import { getPrimaryMacroContextHealth } from "@/lib/macro/macro-context-capture-supabase";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function configured(value: string | undefined) {
  return Boolean(value?.trim());
}

function state(enabled: boolean, healthy: boolean) {
  if (!enabled) return "not_configured";
  return healthy ? "healthy" : "configured_unverified";
}

type PublicationHealthSummary = {
  available: boolean;
  snapshots: number;
  latestSnapshotAt: string | null;
  publishedStories: number;
  storyStates: number;
  error: string | null;
};

/**
 * Health must not load the full immutable publication archive. The normal
 * publication loader intentionally reconstructs replay history and can span
 * many paginated queries; health only needs counts plus the latest daily brief.
 */
async function getPublicationHealthSummary(): Promise<PublicationHealthSummary> {
  try {
    const client = createSupabaseAdminClient();
    const [snapshotCount, latestSnapshot, publishedStoryCount, storyStateCount] = await Promise.all([
      client.from("hybrid_publication_snapshots")
        .select("id", { count: "exact", head: true })
        .eq("snapshot_type", "daily_brief")
        .abortSignal(AbortSignal.timeout(3_000)),
      client.from("hybrid_publication_snapshots")
        .select("id,published_at")
        .eq("snapshot_type", "daily_brief")
        .order("published_at", { ascending: false })
        .limit(1)
        .abortSignal(AbortSignal.timeout(3_000))
        .maybeSingle<{ id: string; published_at: string }>(),
      client.from("intelligence_story_states")
        .select("story_id", { count: "exact", head: true })
        .eq("publication_eligible", true)
        .abortSignal(AbortSignal.timeout(3_000)),
      client.from("intelligence_story_states")
        .select("story_id", { count: "exact", head: true })
        .abortSignal(AbortSignal.timeout(3_000)),
    ]);
    const errors = [snapshotCount.error, latestSnapshot.error, publishedStoryCount.error, storyStateCount.error].filter(Boolean);
    if (errors.length) throw errors[0];
    return {
      available: true,
      snapshots: snapshotCount.count ?? 0,
      latestSnapshotAt: latestSnapshot.data?.published_at ?? null,
      publishedStories: publishedStoryCount.count ?? 0,
      storyStates: storyStateCount.count ?? 0,
      error: null,
    };
  } catch (error) {
    return {
      available: false,
      snapshots: 0,
      latestSnapshotAt: null,
      publishedStories: 0,
      storyStates: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getSystemHealth() {
  const generatedAt = new Date().toISOString();
  const [data, publication, calendar, macroSource] = await Promise.all([
    // Operational health must reflect the current scheduler run and provider
    // state, rather than the desk's normal short-lived display cache.
    getHybridDeskData({ fresh: true }),
    getPublicationHealthSummary(),
    getEconomicCalendar(),
    getPrimaryMacroContextHealth(),
  ]);
  const orderedRuns = [...data.researchRuns].sort((left, right) => (
    Date.parse(right.scheduled_for) - Date.parse(left.scheduled_for)
    || Date.parse(right.updated_at) - Date.parse(left.updated_at)
  ));
  const latestResearchRun = orderedRuns.find((run) => run.schedule_slot === "morning" || run.schedule_slot === "evening") || null;
  const latestVideoRun = orderedRuns.find((run) => run.schedule_slot === "video_midnight" || run.schedule_slot === "video_late_morning") || null;
  const latestIntelligenceRun = data.intelligenceRuns[0] || null;
  const latestIntelligenceStages = data.intelligenceStages
    .filter((row) => row.engine_run_id === latestIntelligenceRun?.id)
    .slice(0, 20);
  const videoRows = data.researchIntake.filter((item) => item.item_type === "video");
  const latestVideo = videoRows[0] || null;
  const sourceChecks = latestResearchRun?.source_checks || [];
  const firecrawlRecoveries = sourceChecks.filter((check) => /firecrawl fallback recovered/i.test(check.note || ""));
  const youtubeChecks = (latestVideoRun?.source_checks || []).filter((check) => /youtube|video|fx-evolution|stockedup|trader|clearvalue|eurodollar|bravos/i.test(check.source));
  const youtubeDiscoveryFailures = youtubeChecks.filter((check) => !["ok", "checked", "no_recent_videos"].includes(check.status));
  const scheduledProviderFailures = sourceChecks
    .filter((check) => check.status === "blocked")
    .map((check) => ({
      provider_key: check.source,
      capability: "scheduled_research",
      request_key: latestResearchRun?.run_key || null,
      failure_code: check.retryable === false ? "source_check_permanent_unavailability" : "source_check_blocked",
      failure_detail: check.note || "Required source check was blocked.",
      retryable: check.retryable ?? true,
      last_failed_at: latestResearchRun?.updated_at || null,
      resolved_at: null,
    }));
  const unresolvedProviderFailures = [
    ...data.acquisitionFailures.filter((failure) => !failure.resolved_at),
    ...scheduledProviderFailures,
  ];
  const openDebt = data.researchDebt.filter((row) => row.status === "open");
  const scheduleEnabled = process.env.NEXT_PUBLIC_RESEARCH_SCHEDULE_ENABLED === "true";
  const cronConfigured = configured(process.env.CRON_SECRET);
  const openAIConfigured = configured(process.env.OPENAI_API_KEY) && openAIIntelligenceEnabled();
  const youtubeConfigured = configured(process.env.YOUTUBE_DATA_API_KEY);
  const transcriptConfigured = configured(process.env.TRANSCRIPT_API_KEY);
  const openBBConfigured = configured(process.env.OPENBB_API_URL);
  const firecrawlEnabled = firecrawlConfigured();
  const rbaCoverage = calendar.filter((release) => release.country === "Australia");
  const rbnzCoverage = calendar.filter((release) => release.country === "New Zealand");
  const structuredMetrics = data.macroReleaseMetrics;
  const overdueMissingActuals = calendar.filter((release) => (
    ["ingestion_pending", "released_pending_ingestion", "stale_error"].includes(release.status)
  ) && !release.actual);

  return {
    generatedAt,
    deployment: {
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || null,
      gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
      gitCommitRef: process.env.VERCEL_GIT_COMMIT_REF || null,
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null,
      deploymentUrl: process.env.VERCEL_URL || null,
      productionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL || null,
    },
    overall: {
      state: "degraded",
      reason: latestIntelligenceRun
        ? "The canonical runtime has recorded execution; provider gaps remain visible below."
        : "The canonical OpenAI runtime is configured but has not recorded an intelligence run.",
    },
    scheduling: {
      state: scheduleEnabled && cronConfigured ? "enabled" : scheduleEnabled ? "blocked_missing_cron_secret" : "intentionally_disabled",
      configured: scheduleEnabled && cronConfigured,
      cronConfigured,
      expectedSlots: ["09:15 Asia/Kuala_Lumpur", "21:15 Asia/Kuala_Lumpur"],
      latestResearchRunAt: latestResearchRun?.completed_at || latestResearchRun?.updated_at || null,
      latestResearchRunStatus: latestResearchRun?.status || null,
      latestResearchRunKey: latestResearchRun?.run_key || null,
      note: scheduleEnabled
        ? cronConfigured
          ? "The two Live-owned Vercel Cron routes are enabled; each requires CRON_SECRET and publishes only through the canonical Live runtime."
          : "The schedule flag is on but CRON_SECRET is missing, so unattended execution remains blocked."
        : "Cron is intentionally off during coding and is not classified as a fault.",
    },
    supabase: {
      state: state(configured(process.env.NEXT_PUBLIC_SUPABASE_URL) && configured(process.env.SUPABASE_SERVICE_ROLE_KEY), Boolean(latestResearchRun)),
      configured: configured(process.env.NEXT_PUBLIC_SUPABASE_URL) && configured(process.env.SUPABASE_SERVICE_ROLE_KEY),
      latestResearchRunId: latestResearchRun?.id || null,
    },
    openAI: {
      state: state(openAIConfigured, Boolean(latestIntelligenceRun)),
      configured: openAIConfigured,
      owner: "Live Desk",
      model: intelligenceModel("complex"),
      fastModel: intelligenceModel("fast"),
      latestRun: latestIntelligenceRun,
      latestStages: latestIntelligenceStages,
    },
    openBB: {
      state: openBBConfigured ? "configured_unverified" : "not_configured",
      configured: openBBConfigured,
      note: openBBConfigured
        ? "A self-hosted OpenBB endpoint is configured; no secret or endpoint value is exposed here."
        : "No self-hosted OpenBB API/Workspace bridge is configured. Direct official providers remain the active data path.",
    },
    firecrawl: {
      state: firecrawlEnabled ? (firecrawlRecoveries.length ? "healthy" : "configured_unverified") : "not_configured",
      configured: firecrawlEnabled,
      mode: "fallback_only",
      recoveriesInLatestDeskRun: firecrawlRecoveries.length,
      note: firecrawlEnabled
        ? "Firecrawl is available only after a supported public direct feed is blocked; original publisher/article provenance remains canonical."
        : "Firecrawl fallback is optional and inactive. Healthy direct providers continue unchanged.",
    },
    youtube: {
      state: youtubeDiscoveryHealthState(youtubeConfigured, youtubeChecks),
      configured: youtubeConfigured,
      channelCount: 10,
      latestChecks: youtubeChecks,
      discoveryFailures: youtubeDiscoveryFailures.length,
      persistedVideos: videoRows.length,
    },
    transcriptAPI: {
      state: state(transcriptConfigured, videoRows.some((item) => item.transcript_status === "ready")),
      configured: transcriptConfigured,
      latest: latestVideo ? {
        publisher: latestVideo.publisher,
        status: latestVideo.transcript_status,
        provider: latestVideo.transcript_provider,
        retrievedAt: latestVideo.transcript_retrieved_at,
        errorCode: latestVideo.transcript_error_code,
        retryable: latestVideo.transcript_retryable,
        attempts: latestVideo.transcript_attempt_count,
      } : null,
    },
    providerFailures: {
      state: unresolvedProviderFailures.length ? "attention_required" : "healthy",
      unresolved: unresolvedProviderFailures.length,
      latest: unresolvedProviderFailures.slice(0, 20),
      note: "The latest full-desk source checks and persisted acquisition failures are both reported. An empty list means no required source was blocked in the latest desk cycle.",
    },
    macroSource: {
      state: macroSource.retainedPriorComplete ? "degraded_retaining_complete" : macroSource.latestAttemptStatus || "unavailable",
      ...macroSource,
      hierarchy: "Daily Investment Brief primary → MacroMicro supplemental → authoritative/official source validation; retired Macro Indicators dashboard excluded from scheduled capture.",
      note: macroSource.retainedPriorComplete
        ? "The latest Daily Investment Brief attempt degraded; the prior COMPLETE Daily Investment Brief snapshot remains pinned. MacroMicro never silently replaces the primary source."
        : "Only a usable Daily Investment Brief primary snapshot is marked COMPLETE. Placeholder/security-verification responses stay degraded or unavailable.",
    },
    economicCalendar: {
      state: rbaCoverage.length && rbnzCoverage.length && structuredMetrics.length && !overdueMissingActuals.length ? "healthy" : "degraded",
      releases: calendar.length,
      structuredMetrics: structuredMetrics.length,
      rbaReleases: rbaCoverage.length,
      rbnzReleases: rbnzCoverage.length,
      overdueMissingActuals: overdueMissingActuals.length,
      overdueReleaseIds: overdueMissingActuals.map((release) => release.id),
      fieldPolicy: "previous, revised previous, consensus, Alchemy expectation and actual are stored separately; released official Actuals are ingested independently from dashboard capture",
    },
    canonicalStories: {
      state: publication.available ? (publication.storyStates ? "healthy" : "awaiting_first_runtime_run") : "unavailable",
      publishedStories: publication.publishedStories,
      storyStates: publication.storyStates,
      snapshots: publication.snapshots,
      error: publication.error,
    },
    hybridPublication: {
      state: publication.available ? (publication.latestSnapshotAt ? "healthy" : "degraded") : "unavailable",
      mode: "read_only_canonical_consumer",
      snapshots: publication.snapshots,
      latestSnapshotAt: publication.latestSnapshotAt,
      error: publication.error,
    },
    researchDebt: {
      state: openDebt.length ? "attention_required" : "healthy",
      open: openDebt.length,
      highPriority: openDebt.filter((row) => row.severity === "high" || row.severity === "critical").length,
      items: openDebt.slice(0, 20),
    },
  };
}
