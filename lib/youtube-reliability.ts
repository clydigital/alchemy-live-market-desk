export const XWADA_VIDEO_CHANNELS = [
  { key: "fx-evolution", name: "FX Evolution", handle: "@FXEvolution", env: "YOUTUBE_CHANNEL_ID_FX_EVOLUTION" },
  { key: "kevin-gerrity", name: "Kevin Gerrity", handle: "@Kevin.Gerrity", env: "YOUTUBE_CHANNEL_ID_KEVIN_GERRITY" },
  // @ClearValueTax now resolves to an unrelated channel. Pin the known
  // ClearValue Tax identity so a renamed handle cannot silently change the
  // monitored source.
  {
    key: "clearvalue-tax",
    name: "ClearValue Tax",
    handle: "@clearvaluetax9382",
    env: "YOUTUBE_CHANNEL_ID_CLEARVALUE_TAX",
    officialChannelId: "UCigUBIf-zt_DA6xyOQtq2WA",
  },
  { key: "stockedup", name: "StockedUp", handle: "@StockedUp", env: "YOUTUBE_CHANNEL_ID_STOCKEDUP" },
  { key: "wall-street-truth-bombs", name: "Wall Street Truthbombs", handle: "@wstruthbombs", env: "YOUTUBE_CHANNEL_ID_WALL_STREET_TRUTH_BOMBS" },
  { key: "tradernick", name: "TraderNick", handle: "@TraderNick", env: "YOUTUBE_CHANNEL_ID_TRADERNICK" },
  { key: "traders-reality", name: "Traders Reality", handle: "@TradersReality", env: "YOUTUBE_CHANNEL_ID_TRADERS_REALITY" },
  { key: "beginner-trading", name: "Beginner Trading", handle: "@BeginnerTrading", env: "YOUTUBE_CHANNEL_ID_BEGINNER_TRADING" },
  { key: "eurodollar-university", name: "Eurodollar University", handle: "@eurodollaruniversity", env: "YOUTUBE_CHANNEL_ID_EURODOLLAR_UNIVERSITY" },
  { key: "bravos-research", name: "Bravos Research", handle: "@BravosResearch", env: "YOUTUBE_CHANNEL_ID_BRAVOS_RESEARCH" },
] as const;

export type XwadaChannelKey = typeof XWADA_VIDEO_CHANNELS[number]["key"];
export type XwadaCheckStatus =
  | "checked"
  | "no_recent_videos"
  | "configuration_error"
  | "youtube_auth_error"
  | "youtube_quota_error"
  | "youtube_rate_limited"
  | "youtube_request_failed";

export type XwadaVideo = {
  channelKey: XwadaChannelKey;
  channelName: string;
  channelId: string;
  videoId: string;
  title: string;
  url: string;
  publishedAt: string;
};

export type XwadaChannelResult = {
  channelKey: XwadaChannelKey;
  channelName: string;
  channelId?: string;
  uploadsPlaylistId?: string;
  status: XwadaCheckStatus;
  scannedCount: number;
  recentCount: number;
  videos: XwadaVideo[];
  detail?: string;
};

const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";
const LOOKBACK_MS = 72 * 60 * 60 * 1000;
const LATEST_VIDEO_LIMIT = 10;

type YoutubeErrorBody = {
  error?: {
    message?: string;
    errors?: Array<{ reason?: string }>;
  };
};

function errorDetail(body: unknown, fallback: string) {
  if (body && typeof body === "object" && "error" in body) {
    return (body as YoutubeErrorBody).error?.message || fallback;
  }
  return fallback;
}

function youtubeFailure(status: number, body: unknown): XwadaCheckStatus {
  const reason = body && typeof body === "object" && "error" in body
    ? (body as YoutubeErrorBody).error?.errors?.[0]?.reason || ""
    : "";
  if (status === 401 || status === 403 && /keyInvalid|ipRefererBlocked|accessNotConfigured/i.test(reason)) {
    return "youtube_auth_error";
  }
  if (status === 403 && /quotaExceeded|dailyLimitExceeded/i.test(reason)) return "youtube_quota_error";
  if (status === 429 || /rateLimitExceeded|userRateLimitExceeded/i.test(reason)) return "youtube_rate_limited";
  return "youtube_request_failed";
}

async function youtubeJson<T>(path: string, apiKey: string): Promise<T> {
  const separator = path.includes("?") ? "&" : "?";
  const result = await fetch(`${YOUTUBE_API}/${path}${separator}key=${encodeURIComponent(apiKey)}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  const body = await result.json().catch(() => ({}));
  if (!result.ok) {
    const error = new Error(errorDetail(body, `YouTube request failed with ${result.status}.`));
    Object.assign(error, { xwadaStatus: youtubeFailure(result.status, body) });
    throw error;
  }
  return body as T;
}

async function resolveChannelId(channel: typeof XWADA_VIDEO_CHANNELS[number], apiKey: string) {
  const configured = process.env[channel.env]?.trim();
  if ("officialChannelId" in channel && channel.officialChannelId) {
    if (configured && configured !== channel.officialChannelId) {
      const error = new Error(
        `${channel.env} does not match the pinned official ${channel.name} channel ID. `
        + `Set it to ${channel.officialChannelId}.`,
      );
      Object.assign(error, { xwadaStatus: "configuration_error" satisfies XwadaCheckStatus });
      throw error;
    }
    return channel.officialChannelId;
  }
  if (configured) return configured;
  const response = await youtubeJson<{ items?: Array<{ id?: string }> }>(
    `channels?part=id&forHandle=${encodeURIComponent(channel.handle)}`,
    apiKey,
  );
  const id = response.items?.[0]?.id;
  if (!id) {
    const error = new Error(`Could not resolve ${channel.name} from ${channel.handle}. Set ${channel.env} explicitly.`);
    Object.assign(error, { xwadaStatus: "configuration_error" satisfies XwadaCheckStatus });
    throw error;
  }
  return id;
}

async function uploadsPlaylist(channelId: string, apiKey: string) {
  const response = await youtubeJson<{
    items?: Array<{ contentDetails?: { relatedPlaylists?: { uploads?: string } } }>;
  }>(`channels?part=contentDetails&id=${encodeURIComponent(channelId)}`, apiKey);
  const playlistId = response.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!playlistId) {
    const error = new Error(`YouTube returned no uploads playlist for channel ${channelId}.`);
    Object.assign(error, { xwadaStatus: "youtube_request_failed" satisfies XwadaCheckStatus });
    throw error;
  }
  return playlistId;
}

async function latestUploads(playlistId: string, apiKey: string) {
  return youtubeJson<{
    items?: Array<{
      contentDetails?: { videoId?: string; videoPublishedAt?: string };
      snippet?: { title?: string; publishedAt?: string };
    }>;
  }>(
    `playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(playlistId)}&maxResults=${LATEST_VIDEO_LIMIT}`,
    apiKey,
  );
}

function statusFromError(error: unknown, fallback: XwadaCheckStatus): XwadaCheckStatus {
  if (error && typeof error === "object" && "xwadaStatus" in error) {
    return (error as { xwadaStatus: XwadaCheckStatus }).xwadaStatus;
  }
  return fallback;
}

export async function discoverXwadaVideoChannels(now = new Date()): Promise<XwadaChannelResult[]> {
  const youtubeApiKey = process.env.YOUTUBE_DATA_API_KEY?.trim();
  if (!youtubeApiKey) {
    return XWADA_VIDEO_CHANNELS.map((channel) => ({
      channelKey: channel.key,
      channelName: channel.name,
      status: "configuration_error",
      scannedCount: 0,
      recentCount: 0,
      videos: [],
      detail: "Missing YOUTUBE_DATA_API_KEY.",
    }));
  }

  const cutoff = now.getTime() - LOOKBACK_MS;
  return Promise.all(XWADA_VIDEO_CHANNELS.map(async (channel): Promise<XwadaChannelResult> => {
    try {
      const channelId = await resolveChannelId(channel, youtubeApiKey);
      const playlistId = await uploadsPlaylist(channelId, youtubeApiKey);
      const response = await latestUploads(playlistId, youtubeApiKey);
      const scanned = (response.items || []).slice(0, LATEST_VIDEO_LIMIT);
      const recent = scanned.filter((item) => {
        const publishedAt = item.contentDetails?.videoPublishedAt || item.snippet?.publishedAt;
        return Boolean(publishedAt && Number.isFinite(Date.parse(publishedAt)) && Date.parse(publishedAt!) >= cutoff);
      });
      const videos = recent.flatMap((item): XwadaVideo[] => {
        const videoId = item.contentDetails?.videoId;
        const publishedAt = item.contentDetails?.videoPublishedAt || item.snippet?.publishedAt;
        if (!videoId || !publishedAt) return [];
        return [{
          channelKey: channel.key,
          channelName: channel.name,
          channelId,
          videoId,
          title: item.snippet?.title || videoId,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          publishedAt,
        }];
      });
      return {
        channelKey: channel.key,
        channelName: channel.name,
        channelId,
        uploadsPlaylistId: playlistId,
        status: recent.length ? "checked" : "no_recent_videos",
        scannedCount: scanned.length,
        recentCount: videos.length,
        videos,
        detail: recent.length
          ? `Scanned the latest ${scanned.length} uploads and retained videos published in the last 72 hours.`
          : `Scanned the latest ${scanned.length} uploads; none were published in the last 72 hours.`,
      };
    } catch (error) {
      return {
        channelKey: channel.key,
        channelName: channel.name,
        status: statusFromError(error, "youtube_request_failed"),
        scannedCount: 0,
        recentCount: 0,
        videos: [],
        detail: error instanceof Error ? error.message : "Unknown YouTube discovery failure.",
      };
    }
  }));
}

export function xwadaDiscoverySummary(results: XwadaChannelResult[]) {
  return {
    channelsChecked: results.filter((result) => ["checked", "no_recent_videos"].includes(result.status)).length,
    channelsFailed: results.filter((result) => !["checked", "no_recent_videos"].includes(result.status)).length,
    uploadsScanned: results.reduce((sum, result) => sum + result.scannedCount, 0),
    recentVideos: results.reduce((sum, result) => sum + result.videos.length, 0),
  };
}
