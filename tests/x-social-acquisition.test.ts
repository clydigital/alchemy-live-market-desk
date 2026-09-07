import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { sourceVerificationRole, sourceVerificationWeight } from "../lib/intelligence/source-verification.ts";
import {
  extractSyndicationPayload,
  parseSyndicationTimelinePayload,
  xPostToIntakeItem,
} from "../lib/x-social-acquisition.ts";

const CREATED_AT = "Sun Sep 07 08:10:00 +0000 2026";

function tweet(overrides: Record<string, unknown> = {}) {
  return {
    rest_id: "1999999999999999999",
    core: {
      user_results: {
        result: {
          legacy: { screen_name: "Bluekurtic", name: "Blue Kurtic" },
        },
      },
    },
    legacy: {
      id_str: "1999999999999999999",
      full_text: "US 10Y yields rise as oil and inflation expectations firm. https://t.co/abc",
      created_at: CREATED_AT,
      conversation_id_str: "1999999999999999999",
      in_reply_to_status_id_str: null,
      in_reply_to_screen_name: null,
      entities: {
        urls: [{ url: "https://t.co/abc", expanded_url: "https://example.com/chart" }],
      },
      extended_entities: {
        media: [{
          type: "photo",
          media_url_https: "https://pbs.twimg.com/media/example.jpg",
          expanded_url: "https://x.com/Bluekurtic/status/1999999999999999999/photo/1",
          original_info: { width: 1200, height: 675 },
        }],
      },
    },
    ...overrides,
  };
}

test("X syndication payload preserves exact attribution, timestamp, links and media", () => {
  const payload = {
    props: {
      pageProps: {
        timeline: {
          entries: [{ content: { itemContent: { tweet_results: { result: tweet() } } } }],
        },
      },
    },
  };
  const posts = parseSyndicationTimelinePayload(payload);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].postId, "1999999999999999999");
  assert.equal(posts[0].authorHandle, "Bluekurtic");
  assert.equal(posts[0].postedAt, "2026-09-07T08:10:00.000Z");
  assert.equal(posts[0].canonicalUrl, "https://x.com/Bluekurtic/status/1999999999999999999");
  assert.deepEqual(posts[0].links, ["https://example.com/chart"]);
  assert.equal(posts[0].media[0]?.mediaUrl, "https://pbs.twimg.com/media/example.jpg");
});

test("X HTML parser reads the public __NEXT_DATA__ payload", () => {
  const html = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ hello: "world" })}</script></html>`;
  assert.deepEqual(extractSyndicationPayload(html), { hello: "world" });
});

test("retweet-only posts are dropped while an original social post becomes first-class discovery intake", () => {
  const original = parseSyndicationTimelinePayload({ result: tweet() })[0];
  const item = xPostToIntakeItem(original);
  assert.ok(item);
  assert.equal(item.itemType, "social_post");
  assert.equal(item.publisher, "X @Bluekurtic");
  assert.equal(item.url, "https://x.com/Bluekurtic/status/1999999999999999999");
  assert.match(item.reviewReason || "", /proves only that the attributed account published/i);
  assert.match(item.divergenceNote || "", /"sourceVerificationRole":"discovery_only"/);

  const retweetNode = tweet({
    legacy: {
      ...(tweet().legacy as Record<string, unknown>),
      full_text: "RT @AnotherAccount: oil is moving",
    },
  });
  const retweet = parseSyndicationTimelinePayload({ result: retweetNode })[0];
  assert.equal(xPostToIntakeItem(retweet), null);
});

test("X URLs and the X provider are discovery-only with zero canonical verification weight", () => {
  assert.equal(sourceVerificationRole({ provenanceUrls: ["https://x.com/Bluekurtic/status/1999999999999999999"] }), "discovery_only");
  assert.equal(sourceVerificationRole({ providerKey: "x_syndication_embed" }), "discovery_only");
  assert.equal(sourceVerificationWeight({
    id: "ev-x",
    claim: "Attributed social statement",
    summary: null,
    evidenceClass: "news_report",
    sourceName: "X @Bluekurtic",
    sourceTier: 4,
    reliabilityScore: 52,
    ancestryGroupId: "x-bluekurtic",
    supportDirection: "context",
    eventAt: "2026-09-07T08:10:00.000Z",
    publishedAt: "2026-09-07T08:10:00.000Z",
    availableAt: "2026-09-07T08:10:00.000Z",
    receivedAt: "2026-09-07T08:11:00.000Z",
    freshnessStatus: "current",
    affectedAssets: [],
    affectedTopics: [],
    provenanceUrls: ["https://x.com/Bluekurtic/status/1999999999999999999"],
    providerKey: "x_syndication_embed",
    sourceVerificationRole: "discovery_only",
    structuredPayload: {},
  }), 0);
});

test("research contract accepts social_post and requires a visible x-social source check", () => {
  const source = readFileSync("lib/research-update.ts", "utf8");
  assert.match(source, /"x-social"/);
  assert.match(source, /export type IntakeItemType = "video" \| "news" \| "social_post" \| "alchemy_article"/);
  assert.match(source, /\["video", "news", "social_post", "alchemy_article"\]\.includes\(item\.itemType\)/);
});

test("X migration seeds the approved registry, versions raw posts and enables RLS", () => {
  const migration = readFileSync("supabase/migrations/20260907123000_x_social_intake.sql", "utf8");
  for (const handle of [
    "Bluekurtic",
    "HFI_Research",
    "OilandEnergy",
    "TheStudyofWar",
    "Currentreport1",
    "arena",
    "KobeissiLetter",
    "FirstSquawk",
    "zerohedge",
    "GordianKnotDev",
  ]) assert.match(migration, new RegExp(`'${handle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}'`));
  assert.match(migration, /'social_post'::text/);
  assert.match(migration, /unique \(provider, post_id, content_hash\)/i);
  assert.match(migration, /alter table public\.research_social_posts enable row level security/i);
  assert.match(migration, /'unverified'/);
  assert.match(migration, /'discovery_only'/);
});
