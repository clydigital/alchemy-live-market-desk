export const REQUIRED_VIDEO_RESEARCH_SOURCES = [
  "stockedup",
  "wall-street-truth-bombs",
  "fx-evolution",
  "tradernick",
] as const;

export type VideoResearchSourceKey = typeof REQUIRED_VIDEO_RESEARCH_SOURCES[number];

export const RESEARCH_VIDEO_CHANNELS: Record<VideoResearchSourceKey, { name: string; url: string }> = {
  stockedup: { name: "StockedUp", url: "https://www.youtube.com/@StockedUp/videos" },
  "wall-street-truth-bombs": { name: "Wall Street Truthbombs", url: "https://www.youtube.com/@wstruthbombs/videos" },
  "fx-evolution": { name: "FX Evolution", url: "https://www.youtube.com/@fxevolutionvideo/videos" },
  tradernick: { name: "TraderNick", url: "https://www.youtube.com/@TraderNick/videos" },
};

export const VIDEO_TRANSCRIPT_POLICY = {
  preferred: "official_youtube_caption_or_transcript",
  fallback: "https://youtubetotranscript.com/",
  readyRequiresTranscriptText: true,
  metadataIsNotTranscript: true,
  blockStoryImpactWithoutReadyTranscript: true,
} as const;
