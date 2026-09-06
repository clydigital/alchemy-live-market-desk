// The first three are the channels the research handoff explicitly requires.
// Keeping them at the head of the fixed six-video budget guarantees that a
// healthy dedicated intake can satisfy that contract without increasing the
// number of paid Supadata attempts per run.
export const SUPADATA_TRANSCRIPT_CHANNEL_PRIORITY = [
  "stockedup",
  "wall-street-truth-bombs",
  "traders-reality",
  "kevin-gerrity",
  "clearvalue-tax",
  "fx-evolution",
] as const;

const SUPADATA_TRANSCRIPT_CHANNEL_KEYS = new Set<string>(SUPADATA_TRANSCRIPT_CHANNEL_PRIORITY);

export function isSupadataTranscriptChannel(channelKey: string) {
  return SUPADATA_TRANSCRIPT_CHANNEL_KEYS.has(channelKey);
}

export function selectedSupadataTranscriptChannels<
  T extends { channelKey: string; videos: Array<{ isLive?: boolean; isShort?: boolean }> },
>(channels: readonly T[]): Array<Omit<T, "videos"> & { videos: T["videos"] }> {
  const priority = new Map<string, number>(SUPADATA_TRANSCRIPT_CHANNEL_PRIORITY.map((key, index) => [key, index]));
  return channels
    .filter((channel) => isSupadataTranscriptChannel(channel.channelKey))
    .map((channel) => ({
      ...channel,
      videos: channel.videos.filter((video) => video.isLive !== true && video.isShort !== true),
    }))
    .sort((left, right) => (priority.get(left.channelKey) ?? 99) - (priority.get(right.channelKey) ?? 99)) as Array<
      Omit<T, "videos"> & { videos: T["videos"] }
    >;
}
