import assert from "node:assert/strict";
import test from "node:test";

import {
  isSupadataTranscriptChannel,
  selectedSupadataTranscriptChannels,
} from "../lib/supadata-intake-policy.ts";
import { youtubeDurationSeconds } from "../lib/youtube-reliability.ts";
import type { XwadaChannelKey, XwadaChannelResult, XwadaVideo } from "../lib/youtube-reliability.ts";

function video(channelKey: XwadaChannelKey, videoId: string, options: { isLive?: boolean; isShort?: boolean } = {}): XwadaVideo {
  return {
    channelKey,
    channelName: channelKey,
    channelId: `channel-${channelKey}`,
    videoId,
    title: videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    publishedAt: "2026-08-25T00:00:00.000Z",
    isLive: options.isLive ?? false,
    isShort: options.isShort ?? false,
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

test("only selected creators' long-form non-live videos enter the Supadata provider work list", () => {
  const channels = [
    channel("fx-evolution", [
      video("fx-evolution", "fx-upload"),
      video("fx-evolution", "fx-live", { isLive: true }),
      video("fx-evolution", "fx-short", { isShort: true }),
    ]),
    channel("stockedup", [
      video("stockedup", "stock-upload"),
      video("stockedup", "stock-live", { isLive: true }),
      video("stockedup", "stock-short", { isShort: true }),
    ]),
    channel("kevin-gerrity", [video("kevin-gerrity", "kevin-upload")]),
    channel("clearvalue-tax", [
      video("clearvalue-tax", "clear-upload"),
      video("clearvalue-tax", "clear-live", { isLive: true }),
      video("clearvalue-tax", "clear-short", { isShort: true }),
    ]),
    channel("tradernick", [video("tradernick", "nick-upload")]),
  ];

  const workList = selectedSupadataTranscriptChannels(channels);
  assert.deepEqual(workList.map((entry) => entry.channelKey), [
    "stockedup",
    "kevin-gerrity",
    "clearvalue-tax",
    "fx-evolution",
  ]);
  assert.deepEqual(workList.flatMap((entry) => entry.videos.map((entryVideo) => entryVideo.videoId)), [
    "stock-upload",
    "kevin-upload",
    "clear-upload",
    "fx-upload",
  ]);
  assert.equal(isSupadataTranscriptChannel("stockedup"), true);
  assert.equal(isSupadataTranscriptChannel("kevin-gerrity"), true);
  assert.equal(isSupadataTranscriptChannel("clearvalue-tax"), true);
  assert.equal(isSupadataTranscriptChannel("fx-evolution"), true);
  assert.equal(isSupadataTranscriptChannel("tradernick"), false);
});

test("YouTube ISO durations support the conservative three-minute Shorts guard", () => {
  assert.equal(youtubeDurationSeconds("PT59S"), 59);
  assert.equal(youtubeDurationSeconds("PT3M"), 180);
  assert.equal(youtubeDurationSeconds("PT3M1S"), 181);
  assert.equal(youtubeDurationSeconds("PT15M39S"), 939);
  assert.equal(youtubeDurationSeconds("not-a-duration"), null);
});
