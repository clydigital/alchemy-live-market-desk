// User-authorized nine-creator production roster, 24 Nov 2026.
export const CREATOR_ROSTER = [
  { key: "meetkevin", name: "MeetKevin", handle: "@MeetKevin", env: "YOUTUBE_CHANNEL_ID_MEETKEVIN" },
  { key: "stockedup", name: "StockedUp", handle: "@StockedUp", env: "YOUTUBE_CHANNEL_ID_STOCKEDUP" },
  { key: "fx-evolution", name: "FX Evolution", handle: "@fxevolutionvideo", env: "YOUTUBE_CHANNEL_ID_FX_EVOLUTION" },
  { key: "traders-reality", name: "Traders Reality", handle: "@TradersReality", env: "YOUTUBE_CHANNEL_ID_TRADERS_REALITY", officialChannelId: "UCbvtzZkMmTeM4oWvH3ziGTg" },
  { key: "wall-street-truth-bombs", name: "Wall Street Truthbombs", handle: "@wstruthbombs", env: "YOUTUBE_CHANNEL_ID_WALL_STREET_TRUTH_BOMBS" },
  { key: "trade-brigade", name: "Trade Brigade", handle: "@TradeBrigade", env: "YOUTUBE_CHANNEL_ID_TRADE_BRIGADE", officialChannelId: "UCYKtr6GfycBqQJf32tbQSbQ" },
  { key: "real-eisman-playbook", name: "Real Eisman Playbook", handle: "@RealEismanPlaybook", env: "YOUTUBE_CHANNEL_ID_REAL_EISMAN_PLAYBOOK" },
  { key: "tradernick", name: "TraderNick", handle: "@TraderNick", env: "YOUTUBE_CHANNEL_ID_TRADERNICK" },
  { key: "clearvalue-tax", name: "ClearValueTax", handle: "@clearvaluetax9382", env: "YOUTUBE_CHANNEL_ID_CLEARVALUE_TAX", officialChannelId: "UCigUBIf-zt_DA6xyOQtq2WA" },
] as const;
export type CreatorChannelKey = typeof CREATOR_ROSTER[number]["key"];
export const TRANSCRIPT_CHANNEL_PRIORITY = CREATOR_ROSTER.map(channel => channel.key);
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
