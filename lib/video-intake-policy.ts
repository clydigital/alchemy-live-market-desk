// Fixed creator universe for creator intelligence. Keep this list aligned with
// discovery, the transcript worker and the creator-research workflow.
export const TRANSCRIPT_CHANNEL_PRIORITY = [
  "meetkevin",
  "stockedup",
  "fx-evolution",
  "traders-reality",
  "wall-street-truth-bombs",
  "trade-brigade",
  "real-eisman-playbook",
  "tradernick",
  "clearvalue-tax",
] as const;

// Conservative acquisition gate; ambiguous uploads remain eligible for private manual review.
export function isRatesOutlookTitle(title?: string): boolean {
  return /\b(?:fed(?:eral reserve|watch)?|fomc|powell|interest rates?|rate (?:cuts?|hikes?|outlook|forecast|projections?)|monetary policy|treasury yields?)\b/i.test(title || "");
}

const TRANSCRIPT_CHANNEL_KEYS = new Set<string>(TRANSCRIPT_CHANNEL_PRIORITY);

export function isTranscriptChannel(channelKey: string) {
  return TRANSCRIPT_CHANNEL_KEYS.has(channelKey);
}

export function selectedTranscriptChannels<
  T extends { channelKey: string; videos: Array<{ isLive?: boolean; isShort?: boolean; title?: string }> },
>(channels: readonly T[]): Array<Omit<T, "videos"> & { videos: T["videos"] }> {
  const priority = new Map<string, number>(TRANSCRIPT_CHANNEL_PRIORITY.map((key, index) => [key, index]));
  return channels
    .filter((channel) => isTranscriptChannel(channel.channelKey))
    .map((channel) => ({
      ...channel,
      videos: channel.videos.filter((video) => video.isLive !== true && video.isShort !== true &&
        (channel.channelKey !== "clearvalue-tax" || isRatesOutlookTitle(video.title))),
    }))
    .sort((left, right) => (priority.get(left.channelKey) ?? 99) - (priority.get(right.channelKey) ?? 99)) as Array<
      Omit<T, "videos"> & { videos: T["videos"] }
    >;
}
