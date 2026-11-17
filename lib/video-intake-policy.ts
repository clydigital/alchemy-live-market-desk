import { CREATOR_CHANNEL_PRIORITY } from "./creator-roster.ts";

export const TRANSCRIPT_CHANNEL_PRIORITY = CREATOR_CHANNEL_PRIORITY;

const TRANSCRIPT_CHANNEL_KEYS = new Set<string>(TRANSCRIPT_CHANNEL_PRIORITY);

export function isTranscriptChannel(channelKey: string) {
  return TRANSCRIPT_CHANNEL_KEYS.has(channelKey);
}

export function selectedTranscriptChannels<
  T extends { channelKey: string; videos: Array<{ isLive?: boolean; isShort?: boolean }> },
>(channels: readonly T[]): Array<Omit<T, "videos"> & { videos: T["videos"] }> {
  const priority = new Map<string, number>(TRANSCRIPT_CHANNEL_PRIORITY.map((key, index) => [key, index]));
  return channels
    .filter((channel) => isTranscriptChannel(channel.channelKey))
    .map((channel) => ({
      ...channel,
      videos: channel.videos.filter((video) => video.isLive !== true && video.isShort !== true),
    }))
    .sort((left, right) => (priority.get(left.channelKey) ?? 99) - (priority.get(right.channelKey) ?? 99)) as Array<
      Omit<T, "videos"> & { videos: T["videos"] }
    >;
}
