import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "./supabase/admin.ts";
import { effectiveTranscriptJobStatus, type TranscriptJobStatus } from "./transcript-job-state.ts";
import { XWADA_VIDEO_CHANNELS } from "./youtube-reliability.ts";

type VideoRunRow = {
  id: string;
  status: "running" | "completed" | "blocked" | "failed";
  started_at: string;
  completed_at: string | null;
  updated_at: string;
  source_checks: unknown;
};

type VideoIntakeRow = {
  publisher: string;
  title: string;
  url: string;
  published_at: string;
  transcript_status: "ready" | "missing" | "unavailable" | "not_applicable";
  transcript_provider: string | null;
  transcript_error_code: string | null;
  transcript_attempt_count: number | null;
  status: string;
  summary: string;
  video_review_status: string | null;
  external_id: string | null;
  transcript_job_status: TranscriptJobStatus | null;
  transcript_lease_expires_at: string | null;
  transcript_next_attempt_at: string | null;
};

type SourceCheck = {
  source: string;
  status: string;
  itemCount: number;
  note?: string;
};

export type VideoResearchStatus = {
  available: boolean;
  generatedAt: string;
  run: {
    status: "running" | "completed" | "blocked" | "failed" | "not_run";
    startedAt: string | null;
    completedAt: string | null;
  };
  summary: {
    detected: number;
    transcriptsReady: number;
    transcriptsFailed: number;
    transcriptsPending: number;
    transcriptsRunning: number;
    transcriptsRetryable: number;
    transcriptsBlocked: number;
    transcriptsCompleted: number;
  };
  channels: Array<{
    key: string;
    name: string;
    detector: { state: "detected" | "none" | "failed" | "not_run"; label: string };
    transcript: { state: "ready" | "running" | "retryable" | "failed" | "blocked" | "pending" | "none"; label: string };
    videos: Array<{
      title: string;
      url: string;
      publishedAt: string;
      transcriptStatus: "ready" | "missing" | "unavailable" | "not_applicable";
      transcriptProvider: string | null;
      jobStatus: TranscriptJobStatus;
    }>;
  }>;
};

function sourceChecks(value: unknown): SourceCheck[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): SourceCheck[] => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    const source = typeof row.source === "string" ? row.source : "";
    const status = typeof row.status === "string" ? row.status : "";
    const itemCount = Number(row.itemCount);
    if (!source || !status || !Number.isFinite(itemCount) || itemCount < 0) return [];
    return [{
      source,
      status,
      itemCount,
      note: typeof row.note === "string" ? row.note : undefined,
    }];
  });
}

function detector(check: SourceCheck | undefined): VideoResearchStatus["channels"][number]["detector"] {
  if (!check) return { state: "not_run", label: "Detector not run" };
  if (check.status === "checked" && check.itemCount > 0) {
    return { state: "detected", label: `${check.itemCount} new video${check.itemCount === 1 ? "" : "s"} detected` };
  }
  if (check.status === "checked" || check.status === "no_recent_videos") {
    return { state: "none", label: "No new videos detected" };
  }
  return { state: "failed", label: "Detector failed" };
}

function transcript(rows: VideoIntakeRow[], detected: number, now: Date): VideoResearchStatus["channels"][number]["transcript"] {
  const states = rows.map((row) => effectiveTranscriptJobStatus(row, now));
  const completed = states.filter((state) => state === "completed").length;
  const running = states.filter((state) => state === "running").length;
  const retryable = states.filter((state) => state === "retryable").length;
  const failed = states.filter((state) => state === "failed").length;
  const blocked = states.filter((state) => state === "blocked").length;
  const pending = states.filter((state) => state === "pending").length;
  const untracked = Math.max(0, detected - rows.length);

  if (completed) return { state: "ready", label: `${completed} transcript job${completed === 1 ? "" : "s"} completed` };
  if (running) return { state: "running", label: `${running} transcript job${running === 1 ? "" : "s"} running` };
  if (retryable) return { state: "retryable", label: `${retryable} transcript job${retryable === 1 ? "" : "s"} waiting to retry` };
  if (failed) return { state: "failed", label: `${failed} transcript${failed === 1 ? "" : "s"} failed` };
  if (blocked) return { state: "blocked", label: `${blocked} transcript job${blocked === 1 ? "" : "s"} blocked` };
  if (pending) return { state: "pending", label: `${pending} claimable transcript job${pending === 1 ? "" : "s"}` };
  if (untracked) return { state: "none", label: "No video added to research" };
  return { state: "none", label: "No transcript added" };
}

export function composeVideoResearchStatus(input: {
  now?: Date;
  run?: VideoRunRow | null;
  videos?: VideoIntakeRow[];
}): VideoResearchStatus {
  const checks = sourceChecks(input.run?.source_checks);
  const videos = input.videos || [];
  const now = input.now || new Date();
  const detected = checks.reduce((total, check) => total + (check.status === "checked" ? check.itemCount : 0), 0);
  const transcriptsReady = videos.filter((row) => row.transcript_status === "ready").length;
  const jobStates = videos.map((row) => effectiveTranscriptJobStatus(row, now));
  const transcriptsFailed = jobStates.filter((state) => state === "failed").length;
  const transcriptsPending = jobStates.filter((state) => state === "pending").length;
  const transcriptsRunning = jobStates.filter((state) => state === "running").length;
  const transcriptsRetryable = jobStates.filter((state) => state === "retryable").length;
  const transcriptsBlocked = jobStates.filter((state) => state === "blocked").length;
  const transcriptsCompleted = jobStates.filter((state) => state === "completed").length;

  return {
    available: Boolean(input.run),
    generatedAt: now.toISOString(),
    run: {
      status: input.run?.status || "not_run",
      startedAt: input.run?.started_at || null,
      completedAt: input.run?.completed_at || null,
    },
    summary: {
      detected,
      transcriptsReady,
      transcriptsFailed,
      transcriptsPending,
      transcriptsRunning,
      transcriptsRetryable,
      transcriptsBlocked,
      transcriptsCompleted,
    },
    channels: XWADA_VIDEO_CHANNELS.map((channel) => {
      const check = checks.find((item) => item.source === channel.name);
      const channelVideos = videos
        .filter((video) => video.publisher === channel.name)
        .sort((left, right) => Date.parse(right.published_at) - Date.parse(left.published_at))
        .slice(0, 2);
      return {
        key: channel.key,
        name: channel.name,
        detector: detector(check),
        transcript: transcript(channelVideos, check?.itemCount || 0, now),
        videos: channelVideos.map((video) => ({
          title: video.title,
          url: video.url,
          publishedAt: video.published_at,
          transcriptStatus: video.transcript_status,
          transcriptProvider: video.transcript_provider,
          jobStatus: effectiveTranscriptJobStatus(video, now),
        })),
      };
    }),
  };
}

export async function getVideoResearchStatus(client: SupabaseClient = createSupabaseAdminClient()) {
  const { data: runs, error: runError } = await client
    .from("research_runs")
    .select("id,status,started_at,completed_at,updated_at,source_checks")
    .in("schedule_slot", ["video_midnight", "video_late_morning"])
    .order("started_at", { ascending: false })
    .limit(1);
  if (runError) throw new Error(`Could not read latest video research run: ${runError.message}`);
  const run = (runs?.[0] || null) as VideoRunRow | null;
  if (!run) return composeVideoResearchStatus({ run: null });

  const { data: videos, error: videoError } = await client
    .from("research_intake_items")
    .select("publisher,title,url,published_at,transcript_status,transcript_provider,transcript_error_code,transcript_attempt_count,status,summary,video_review_status,external_id,transcript_job_status,transcript_lease_expires_at,transcript_next_attempt_at")
    .eq("run_id", run.id)
    .eq("item_type", "video")
    .order("published_at", { ascending: false })
    .limit(40);
  if (videoError) throw new Error(`Could not read latest monitored videos: ${videoError.message}`);
  return composeVideoResearchStatus({ run, videos: (videos || []) as VideoIntakeRow[] });
}
