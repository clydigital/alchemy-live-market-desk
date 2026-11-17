import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { CREATOR_CHANNELS, CREATOR_CHANNEL_PRIORITY, CREATOR_PUBLISHERS } from "../lib/creator-roster.ts";
import { XWADA_VIDEO_CHANNELS } from "../lib/youtube-reliability.ts";
import { isTranscriptChannel, selectedTranscriptChannels } from "../lib/video-intake-policy.ts";
import { TRANSCRIPT_WORKER_CREATORS, isLegacyClaimableTranscriptPlaceholder, LEGACY_TRANSCRIPT_PLACEHOLDER } from "../lib/transcript-job-state.ts";

test("all approved creators reach discovery, ordered selection and private legacy claims", () => {
  assert.equal(CREATOR_CHANNELS.length, 11);
  assert.equal(new Set(CREATOR_CHANNEL_PRIORITY).size, 11);
  assert.equal(new Set(CREATOR_PUBLISHERS).size, 11);
  assert.strictEqual(XWADA_VIDEO_CHANNELS, CREATOR_CHANNELS);
  const selected = selectedTranscriptChannels([...CREATOR_CHANNELS].reverse().map(c => ({
    channelKey: c.key, videos: [{ isLive: false, isShort: false }, { isLive: true }, { isShort: true }],
  })));
  assert.deepEqual(selected.map(c => c.channelKey), CREATOR_CHANNEL_PRIORITY);
  for (const creator of CREATOR_CHANNELS) {
    assert.equal(isTranscriptChannel(creator.key), true);
    assert.equal(TRANSCRIPT_WORKER_CREATORS.has(creator.name), true);
    assert.equal(isLegacyClaimableTranscriptPlaceholder({
      publisher: creator.name, status: "blocked", transcript_status: "missing",
      summary: LEGACY_TRANSCRIPT_PLACEHOLDER, external_id: "abcdefghijk",
      url: "https://www.youtube.com/watch?v=abcdefghijk",
    }), true);
  }
  assert.ok(selected.every(c => c.videos.length === 1));
});

test("unknown creators and malformed legacy placeholders remain blocked", () => {
  assert.equal(isTranscriptChannel("lucid-trading"), false);
  assert.equal(isTranscriptChannel("kevin-gerrity"), false);
  for (const publisher of ["Lucid Trading", "Kevin Gerrity", "Meet Kevin lookalike"]) {
    assert.equal(TRANSCRIPT_WORKER_CREATORS.has(publisher), false);
  }
  assert.equal(isLegacyClaimableTranscriptPlaceholder({
    publisher: "Traders Reality", status: "blocked", transcript_status: "missing",
    summary: LEGACY_TRANSCRIPT_PLACEHOLDER, external_id: "bad",
    url: "https://www.youtube.com/watch?v=bad",
  }), false);
  assert.equal(CREATOR_CHANNELS.find(c => c.key === "fx-evolution")?.handle, "@fxevolutionvideo");
  assert.equal(CREATOR_CHANNELS.find(c => c.key === "clearvalue-tax")?.officialChannelId, "UCigUBIf-zt_DA6xyOQtq2WA");
});

test("proposed SQL allowlist matches the TS publishers without weakening the lease or grants", () => {
  const sql = readFileSync(new URL("../docs/sql/creator-roster-claim-repair.sql", import.meta.url), "utf8");
  const array = sql.match(/intake.publisher = any \(array\[([\s\S]*?)\]\)/)?.[1] || "";
  const publishers = [...array.matchAll(/'([^']+)'::text/g)].map(m => m[1]);
  assert.deepEqual(publishers, CREATOR_PUBLISHERS);
  assert.match(sql, /for update skip locked/i);
  assert.match(sql, /security invoker/i);
  assert.match(sql, /revoke all[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute[\s\S]*to service_role/i);
});
