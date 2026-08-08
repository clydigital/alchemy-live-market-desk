export const REQUIRED_VIDEO_RESEARCH_SOURCES = [
  "fx-evolution",
  "kevin-gerrity",
  "clearvalue-tax",
  "stockedup",
  "wall-street-truth-bombs",
  "tradernick",
  "traders-reality",
  "beginner-trading",
  "eurodollar-university",
] as const;

export type VideoResearchSourceKey = typeof REQUIRED_VIDEO_RESEARCH_SOURCES[number];

export const RESEARCH_VIDEO_CHANNELS: Record<VideoResearchSourceKey, { name: string; url: string }> = {
  "fx-evolution": { name: "FX Evolution", url: "https://www.youtube.com/@fxevolutionvideo/videos" },
  "kevin-gerrity": { name: "Kevin Gerrity", url: "https://www.youtube.com/@Kevin.Gerrity/videos" },
  "clearvalue-tax": { name: "ClearValue Tax", url: "https://www.youtube.com/@clearvaluetax9382/videos" },
  stockedup: { name: "StockedUp", url: "https://www.youtube.com/@StockedUp/videos" },
  "wall-street-truth-bombs": { name: "Wall Street Truthbombs", url: "https://www.youtube.com/@wstruthbombs/videos" },
  tradernick: { name: "TraderNick", url: "https://www.youtube.com/@TraderNick/videos" },
  "traders-reality": { name: "Traders Reality", url: "https://www.youtube.com/@TradersReality/videos" },
  "beginner-trading": { name: "Beginner Trading", url: "https://www.youtube.com/@BeginnerTrading/videos" },
  "eurodollar-university": { name: "Eurodollar University", url: "https://www.youtube.com/@eurodollaruniversity/videos" },
};

export const VIDEO_TRANSCRIPT_POLICY = {
  preferred: "official_youtube_caption_or_transcript",
  fallback: "https://youtubetotranscript.com/",
  readyRequiresTranscriptText: true,
  metadataIsNotTranscript: true,
  blockStoryImpactWithoutReadyTranscript: true,
} as const;
