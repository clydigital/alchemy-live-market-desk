export type DedicatedVideoRun = {
  id: string;
  status: "running" | "completed" | "blocked" | "failed";
  source_checks: unknown;
  warnings: unknown;
};

export type DedicatedVideoSlotRun = {
  transcript_status: "complete" | "partial" | "blocked" | null;
};

type VideoSource = "stockedup" | "wall-street-truth-bombs" | "traders-reality";

export type DedicatedVideoSourceCheck = {
  source: VideoSource;
  status: "checked" | "no_new_items" | "blocked";
  itemCount: number;
  retryable?: boolean;
  note?: string;
};

const REQUIRED_VIDEO_SOURCES: Array<{ source: VideoSource; channelName: string }> = [
  { source: "stockedup", channelName: "StockedUp" },
  { source: "wall-street-truth-bombs", channelName: "Wall Street Truthbombs" },
  { source: "traders-reality", channelName: "Traders Reality" },
];

function sourceCheckRows(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((check) => {
    if (!check || typeof check !== "object" || Array.isArray(check)) return [];
    const row = check as Record<string, unknown>;
    return typeof row.source === "string" && typeof row.status === "string"
      ? [{
        source: row.source,
        status: row.status,
        itemCount: Number.isInteger(row.itemCount) && Number(row.itemCount) >= 0 ? Number(row.itemCount) : 0,
        note: typeof row.note === "string" ? row.note : "",
      }]
      : [];
  });
}

export function blockedVideoSourceChecks(note: string): DedicatedVideoSourceCheck[] {
  return REQUIRED_VIDEO_SOURCES.map(({ source }) => ({ source, status: "blocked", itemCount: 0, retryable: true, note }));
}

/**
 * Maps the independently persisted video intake result into the desk's source
 * contract. The desk never treats a partial or missing transcript run as
 * successful coverage; the dedicated video cadence remains the sole owner of
 * discovery and TranscriptAPI work.
 */
export function videoSourceChecksFromDedicatedRun(
  videoRun: DedicatedVideoRun | null,
  slotRun: DedicatedVideoSlotRun | null,
): DedicatedVideoSourceCheck[] {
  if (!videoRun) {
    return blockedVideoSourceChecks("No dedicated video-intake run was recorded for this desk cycle.");
  }
  const checks = new Map(sourceCheckRows(videoRun.source_checks).map((check) => [check.source, check]));
  const transcriptComplete = videoRun.status === "completed" && slotRun?.transcript_status === "complete";
  return REQUIRED_VIDEO_SOURCES.map(({ source, channelName }) => {
    const check = checks.get(channelName);
    if (!check) {
      return { source, status: "blocked", itemCount: 0, retryable: true, note: `Dedicated video intake did not record a discovery result for ${channelName}.` };
    }
    if (check.status === "no_recent_videos") {
      return {
        source,
        status: "no_new_items",
        itemCount: 0,
        note: "The dedicated video intake checked this channel; no videos were published in its 72-hour discovery window.",
      };
    }
    if (check.status !== "checked") {
      return { source, status: "blocked", itemCount: 0, retryable: true, note: check.note || `Dedicated YouTube discovery status: ${check.status}.` };
    }
    if (!transcriptComplete) {
      return {
        source,
        status: "blocked",
        itemCount: 0,
        retryable: videoRun.status !== "failed",
        note: "Dedicated video discovery found uploads, but its transcript lifecycle is not complete; creator evidence remains research debt.",
      };
    }
    return {
      source,
      status: "checked",
      itemCount: Math.max(1, check.itemCount),
      note: `${check.itemCount} dedicated video intake item(s) have completed TranscriptAPI processing in the canonical intake queue.`,
    };
  });
}
