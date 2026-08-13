import assert from "node:assert/strict";
import test from "node:test";

import { youtubeDiscoveryHealthState } from "../lib/youtube-health.ts";
import { XWADA_VIDEO_CHANNELS } from "../lib/youtube-reliability.ts";

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
