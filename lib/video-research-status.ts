import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "./supabase/admin.ts";
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
  };
  channels: Array<{
    key: string;
    name: string;
    detector: { state: "detected" | "none" | "failed" | "not_run"; label: string };
    transcript: { state: "ready" | "failed" | "pending" | "none"; label: string };
    videos: Array<{
      title: string;
      url: string;
      publishedAt: string;
      transcriptStatus: "ready" | "missing" | "unavailable" | "not_applicable";
      transcriptProvider: string | null;
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

function transcript(rows: VideoIntakeRow[], detected: number): VideoResearchStatus["channels"][number]["transcript"] {
  const ready = rows.filter((row) => row.transcript_status === "ready").length;
  const failed = rows.filter((row) => (
    row.transcript_status === "unavailable"
    || (row.transcript_status === "missing" && Boolean(row.transcript_error_code) && (row.transcript_attempt_count || 0) > 0)
  )).length;
  const manualPending = rows.filter((row) => row.transcript_status === "missing" && !row.transcript_error_code).length;
  const untracked = Math.max(0, detected - rows.length);

  if (ready) return { state: "ready", label: `${ready} transcript${ready === 1 ? "" : "s"} added` };
  if (failed) return { state: "failed", label: `${failed} transcript${failed === 1 ? "" : "s"} failed` };
  if (manualPending) return { state: "pending", label: `${manualPending} transcript${manualPending === 1 ? "" : "s"} awaiting manual intake` };
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
  const detected = checks.reduce((total, check) => total + (check.status === "checked" ? check.itemCount : 0), 0);
  const transcriptsReady = videos.filter((row) => row.transcript_status === "ready").length;
  const transcriptsFailed = videos.filter((row) => (
    row.transcript_status === "unavailable"
    || (row.transcript_status === "missing" && Boolean(row.transcript_error_code) && (row.transcript_attempt_count || 0) > 0)
  )).length;
  const transcriptsPending = videos.filter((row) => row.transcript_status === "missing" && !row.transcript_error_code).length;

  return {
    available: Boolean(input.run),
    generatedAt: (input.now || new Date()).toISOString(),
    run: {
      status: input.run?.status || "not_run",
      startedAt: input.run?.started_at || null,
      completedAt: input.run?.completed_at || null,
    },
    summary: { detected, transcriptsReady, transcriptsFailed, transcriptsPending },
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
        transcript: transcript(channelVideos, check?.itemCount || 0),
        videos: channelVideos.map((video) => ({
          title: video.title,
          url: video.url,
          publishedAt: video.published_at,
          transcriptStatus: video.transcript_status,
          transcriptProvider: video.transcript_provider,
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
    .select("publisher,title,url,published_at,transcript_status,transcript_provider,transcript_error_code,transcript_attempt_count")
    .eq("run_id", run.id)
    .eq("item_type", "video")
    .order("published_at", { ascending: false })
    .limit(40);
  if (videoError) throw new Error(`Could not read latest monitored videos: ${videoError.message}`);
  return composeVideoResearchStatus({ run, videos: (videos || []) as VideoIntakeRow[] });
}
