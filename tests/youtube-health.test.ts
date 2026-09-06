import assert from "node:assert/strict";
import test from "node:test";

import { youtubeDiscoveryHealthState } from "../lib/youtube-health.ts";
import { discoverXwadaVideoChannels, XWADA_VIDEO_CHANNELS } from "../lib/youtube-reliability.ts";

test("pins ClearValue Tax to its known official channel rather than the renamed handle", () => {
  const clearValue = XWADA_VIDEO_CHANNELS.find((channel) => channel.key === "clearvalue-tax");
  assert.deepEqual(clearValue, {
    key: "clearvalue-tax",
    name: "ClearValue Tax",
    handle: "@clearvaluetax9382",
    env: "YOUTUBE_CHANNEL_ID_CLEARVALUE_TAX",
    officialChannelId: "UCigUBIf-zt_DA6xyOQtq2WA",
  });
});

test("a latest YouTube discovery failure cannot be hidden by other successful channels", () => {
  assert.equal(youtubeDiscoveryHealthState(true, [
    { status: "checked" },
    { status: "youtube_request_failed" },
  ]), "attention_required");
  assert.equal(youtubeDiscoveryHealthState(true, [{ status: "no_recent_videos" }]), "healthy");
  assert.equal(youtubeDiscoveryHealthState(true, []), "configured_unverified");
  assert.equal(youtubeDiscoveryHealthState(false, [{ status: "checked" }]), "not_configured");
});

test("Chrome recovery is used only after API discovery is unavailable and retains its provenance", async () => {
  let chromeCalls = 0;
  const results = await discoverXwadaVideoChannels(new Date("2026-09-07T12:00:00.000Z"), {
    youtubeApiKey: "",
    browserTranscriptConfigured: () => true,
    discoverWithChrome: async (input) => {
      chromeCalls += 1;
      return {
        status: "ready",
        channelId: `browser-${input.channelKey}`,
        scannedCount: 1,
        videos: input.channelKey === "stockedup"
          ? [{
              videoId: "yNiWeHGBl98",
              title: "A browser-recovered upload",
              url: "https://www.youtube.com/watch?v=yNiWeHGBl98",
              publishedAt: "2026-09-07T11:00:00.000Z",
              isLive: false,
              isShort: false,
            }]
          : [],
        detail: "Browser-derived public-channel check.",
      };
    },
  });

  assert.equal(chromeCalls, XWADA_VIDEO_CHANNELS.length);
  const stockedUp = results.find((result) => result.channelKey === "stockedup");
  assert.equal(stockedUp?.status, "checked");
  assert.equal(stockedUp?.videos[0]?.videoId, "yNiWeHGBl98");
  assert.match(stockedUp?.detail || "", /Original YouTube Data API status: configuration_error/);
  assert.ok(results.filter((result) => result.status === "no_recent_videos").length > 0);
});
