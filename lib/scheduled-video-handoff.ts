export type DedicatedVideoRun = {
  id: string;
  status: "running" | "completed" | "blocked" | "failed";
  source_checks: unknown;
  warnings: unknown;
};

export type DedicatedVideoSlotRun = {
  transcript_status: "complete" | "partial" | "blocked" | null;
};

export type DedicatedVideoIntakeRow = {
  publisher: string;
  transcript_status: "ready" | "missing" | "unavailable" | "not_applicable";
  transcript_job_status: string | null;
  video_review_status: string | null;
  status: string | null;
  transcript_retryable: boolean | null;
};

type VideoSource = "stockedup" | "wall-street-truth-bombs" | "fx-evolution" | "tradernick";

export type DedicatedVideoSourceCheck = {
  source: VideoSource;
  status: "checked" | "no_new_items" | "blocked";
  itemCount: number;
  retryable?: boolean;
  note?: string;
};

export const REQUIRED_VIDEO_SOURCES: Array<{ source: VideoSource; channelName: string }> = [
  { source: "stockedup", channelName: "StockedUp" },
  { source: "wall-street-truth-bombs", channelName: "Wall Street Truthbombs" },
  { source: "fx-evolution", channelName: "FX Evolution" },
  { source: "tradernick", channelName: "TraderNick" },
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
 * discovery and transcript-provider work.
 */
export function videoSourceChecksFromDedicatedRun(
  videoRun: DedicatedVideoRun | null,
  slotRun: DedicatedVideoSlotRun | null,
  intakeRows?: DedicatedVideoIntakeRow[],
): DedicatedVideoSourceCheck[] {
  if (!videoRun) {
    return blockedVideoSourceChecks("No dedicated video-intake run was recorded for this desk cycle.");
  }
  const checks = new Map(sourceCheckRows(videoRun.source_checks).map((check) => [check.source, check]));
  const transcriptComplete = videoRun.status === "completed" && slotRun?.transcript_status === "complete";
  const perCreatorRows = intakeRows === undefined
    ? null
    : new Map(REQUIRED_VIDEO_SOURCES.map(({ channelName }) => [
        channelName,
        intakeRows.filter((row) => row.publisher === channelName),
      ] as const));

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
    if (perCreatorRows) {
      const rows = perCreatorRows.get(channelName) ?? [];
      if (!rows.length) {
        return {
          source,
          status: "no_new_items",
          itemCount: 0,
          note: "The dedicated intake found no eligible long-form upload for this creator inside the active 72-hour checkpoint window.",
        };
      }

      const usable = rows.filter((row) => (
        row.transcript_status === "ready"
        && row.transcript_job_status === "completed"
        && row.video_review_status === "reviewed"
        && row.status === "accepted"
      ));
      const unresolved = rows.filter((row) => !usable.includes(row));
      if (unresolved.length) {
        const retryable = unresolved.some((row) => (
          row.transcript_retryable !== false
          || ["pending", "retryable", "running"].includes(String(row.transcript_job_status))
        ));
        return {
          source,
          status: "blocked",
          // Source-check itemCount records completed coverage only when checked.
          // Mixed usable + unresolved creator rows are still blocked; the usable
          // subset remains traceable in note and the dedicated video intake.
          itemCount: 0,
          retryable,
          note: `${usable.length} creator transcript(s) are usable; ${unresolved.length} remain unresolved for this creator.`,
        };
      }

      return {
        source,
        status: "checked",
        itemCount: usable.length,
        note: `${usable.length} dedicated creator transcript(s) completed review and canonical evidence persistence.`,
      };
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
      note: `${check.itemCount} dedicated video intake item(s) have completed transcript processing in the canonical intake queue.`,
    };
  });
}
