import assert from "node:assert/strict";
import test from "node:test";

import {
  isSupadataTranscriptChannel,
  selectedSupadataTranscriptChannels,
} from "../lib/supadata-intake-policy.ts";
import type { XwadaChannelKey, XwadaChannelResult, XwadaVideo } from "../lib/youtube-reliability.ts";

function video(channelKey: XwadaChannelKey, videoId: string, isLive = false): XwadaVideo {
  return {
    channelKey,
    channelName: channelKey,
    channelId: `channel-${channelKey}`,
    videoId,
    title: videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    publishedAt: "2026-08-25T00:00:00.000Z",
    isLive,
  };
}

function channel(channelKey: XwadaChannelKey, videos: XwadaVideo[]): XwadaChannelResult {
  return {
    channelKey,
    channelName: channelKey,
    channelId: `channel-${channelKey}`,
    status: "checked",
    scannedCount: videos.length,
    recentCount: videos.length,
    videos,
  };
}

test("only selected creators' non-live videos enter the Supadata provider work list", () => {
  const channels = [
    channel("fx-evolution", [video("fx-evolution", "fx-upload")]),
    channel("stockedup", [video("stockedup", "stock-upload"), video("stockedup", "stock-live", true)]),
    channel("kevin-gerrity", [video("kevin-gerrity", "kevin-upload")]),
    channel("clearvalue-tax", [video("clearvalue-tax", "clear-upload"), video("clearvalue-tax", "clear-live", true)]),
    channel("tradernick", [video("tradernick", "nick-upload")]),
  ];

  const workList = selectedSupadataTranscriptChannels(channels);
  assert.deepEqual(workList.map((entry) => entry.channelKey), ["stockedup", "kevin-gerrity", "clearvalue-tax"]);
  assert.deepEqual(workList.flatMap((entry) => entry.videos.map((entryVideo) => entryVideo.videoId)), [
    "stock-upload",
    "kevin-upload",
    "clear-upload",
  ]);
  assert.equal(isSupadataTranscriptChannel("stockedup"), true);
  assert.equal(isSupadataTranscriptChannel("kevin-gerrity"), true);
  assert.equal(isSupadataTranscriptChannel("clearvalue-tax"), true);
  assert.equal(isSupadataTranscriptChannel("fx-evolution"), false);
  assert.equal(isSupadataTranscriptChannel("tradernick"), false);
});
