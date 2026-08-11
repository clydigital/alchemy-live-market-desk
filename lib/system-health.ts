import { getHybridDeskData } from "@/lib/data";
import { getEconomicCalendar } from "@/lib/calendar";
import { getHybridPublicationRecords } from "@/lib/hybrid-publication";
import { openAIIntelligenceEnabled, intelligenceModel } from "@/lib/intelligence/openai";

function configured(value: string | undefined) {
  return Boolean(value?.trim());
}

function state(enabled: boolean, healthy: boolean) {
  if (!enabled) return "not_configured";
  return healthy ? "healthy" : "configured_unverified";
}

export async function getSystemHealth() {
  const generatedAt = new Date().toISOString();
  const [data, publication, calendar] = await Promise.all([
    getHybridDeskData(),
    getHybridPublicationRecords(),
    getEconomicCalendar(),
  ]);
  const latestResearchRun = data.researchRuns[0] || null;
  const latestIntelligenceRun = data.intelligenceRuns[0] || null;
  const latestIntelligenceStages = data.intelligenceStages
    .filter((row) => row.engine_run_id === latestIntelligenceRun?.id)
    .slice(0, 20);
  const videoRows = data.researchIntake.filter((item) => item.item_type === "video");
  const latestVideo = videoRows[0] || null;
  const sourceChecks = latestResearchRun?.source_checks || [];
  const youtubeChecks = sourceChecks.filter((check) => /youtube|video|fx-evolution|stockedup|trader|clearvalue|eurodollar|bravos/i.test(check.source));
  const openDebt = data.researchDebt.filter((row) => row.status === "open");
  const scheduleEnabled = process.env.NEXT_PUBLIC_RESEARCH_SCHEDULE_ENABLED === "true";
  const cronConfigured = configured(process.env.CRON_SECRET);
  const openAIConfigured = configured(process.env.OPENAI_API_KEY) && openAIIntelligenceEnabled();
  const youtubeConfigured = configured(process.env.YOUTUBE_DATA_API_KEY);
  const transcriptConfigured = configured(process.env.TRANSCRIPT_API_KEY);
  const openBBConfigured = configured(process.env.OPENBB_API_URL);
  const rbaCoverage = calendar.filter((release) => release.country === "Australia");
  const rbnzCoverage = calendar.filter((release) => release.country === "New Zealand");
  const structuredMetrics = data.macroReleaseMetrics;

  return {
    generatedAt,
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
    youtube: {
      state: state(youtubeConfigured, youtubeChecks.some((check) => check.status === "ok" || check.status === "checked") || videoRows.length > 0),
      configured: youtubeConfigured,
      channelCount: 10,
      latestChecks: youtubeChecks,
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
      state: data.acquisitionFailures.some((failure) => !failure.resolved_at) ? "attention_required" : "healthy",
      unresolved: data.acquisitionFailures.filter((failure) => !failure.resolved_at).length,
      latest: data.acquisitionFailures.slice(0, 20),
      note: "Only persisted failures are reported. An empty list means no failure was recorded, not that every optional provider was exercised.",
    },
    economicCalendar: {
      state: rbaCoverage.length && rbnzCoverage.length && structuredMetrics.length ? "healthy" : "degraded",
      releases: calendar.length,
      structuredMetrics: structuredMetrics.length,
      rbaReleases: rbaCoverage.length,
      rbnzReleases: rbnzCoverage.length,
      fieldPolicy: "previous, revised previous, consensus, Alchemy expectation and actual are stored separately",
    },
    canonicalStories: {
      state: data.intelligenceRuns.length ? "healthy" : "awaiting_first_runtime_run",
      publishedStories: publication.intelligenceStates.filter((row) => row.publication_eligible).length,
      storyStates: publication.intelligenceStates.length,
      snapshots: publication.snapshots.length,
    },
    hybridPublication: {
      state: publication.snapshots.length ? "healthy" : "degraded",
      mode: "read_only_canonical_consumer",
      snapshots: publication.snapshots.length,
      latestSnapshotAt: publication.snapshots[0]?.published_at || null,
    },
    researchDebt: {
      state: openDebt.length ? "attention_required" : "healthy",
      open: openDebt.length,
      highPriority: openDebt.filter((row) => row.severity === "high" || row.severity === "critical").length,
      items: openDebt.slice(0, 20),
    },
  };
}
