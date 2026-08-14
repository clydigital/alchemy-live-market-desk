import assert from "node:assert/strict";
import test from "node:test";

import { applyFirecrawlResearchFallback } from "../lib/firecrawl-research-fallback.ts";
import { scrapePublicUrlWithFirecrawl } from "../lib/firecrawl.ts";
import { type ResearchRunInput } from "../lib/research-update.ts";

function inputWithSource(status: "checked" | "blocked" = "blocked"): ResearchRunInput {
  return {
    runKey: "firecrawl-test",
    scheduleSlot: "morning",
    scheduledFor: "2026-08-14T09:15:00+08:00",
    sourceChecks: [{
      source: "zerohedge",
      status,
      itemCount: status === "checked" ? 1 : 0,
      note: status === "blocked" ? "Direct feed returned HTTP 403." : "Direct feed acquired.",
    }],
    items: status === "checked" ? [{
      itemKey: "existing",
      itemType: "news",
      publisher: "ZeroHedge",
      title: "Existing direct item",
      url: "https://www.zerohedge.com/existing",
      publishedAt: "2026-08-14T08:00:00.000Z",
      summary: "Existing direct item",
      sourceQuality: 64,
      relevance: 68,
      novelty: 72,
      materiality: 64,
      recommendedAction: "collect_evidence",
    }] : [],
    recalibrations: [],
  };
}

test("Firecrawl client is inert when the API key is absent", async () => {
  const previous = process.env.FIRECRAWL_API_KEY;
  delete process.env.FIRECRAWL_API_KEY;
  try {
    const result = await scrapePublicUrlWithFirecrawl("https://example.com/feed");
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "not_configured");
  } finally {
    if (previous === undefined) delete process.env.FIRECRAWL_API_KEY;
    else process.env.FIRECRAWL_API_KEY = previous;
  }
});

test("healthy direct acquisition never invokes Firecrawl", async () => {
  const previousKey = process.env.FIRECRAWL_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.FIRECRAWL_API_KEY = "test-key";
  globalThis.fetch = (async () => {
    throw new Error("Firecrawl should not be called for a healthy direct source.");
  }) as typeof fetch;
  try {
    const original = inputWithSource("checked");
    const result = await applyFirecrawlResearchFallback(original, new Date("2026-08-14T10:00:00.000Z"));
    assert.equal(result, original);
    assert.equal(result.items.length, 1);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.FIRECRAWL_API_KEY;
    else process.env.FIRECRAWL_API_KEY = previousKey;
  }
});

test("blocked direct feed is recovered through Firecrawl with original provenance", async () => {
  const previousKey = process.env.FIRECRAWL_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.FIRECRAWL_API_KEY = "test-key";
  let requestBody = "";
  globalThis.fetch = (async (input, init) => {
    assert.equal(String(input), "https://api.firecrawl.dev/v2/scrape");
    requestBody = String(init?.body || "");
    return new Response(JSON.stringify({
      success: true,
      data: {
        rawHtml: `<rss><channel><item>
          <title>Oil shipping update</title>
          <link>https://www.zerohedge.com/markets/oil-shipping-update?utm_source=test</link>
          <pubDate>Fri, 14 Aug 2026 08:30:00 +0000</pubDate>
          <description><![CDATA[Physical shipping conditions changed overnight.]]></description>
        </item></channel></rss>`,
        metadata: {
          sourceURL: "https://feeds.feedburner.com/zerohedge/feed",
          statusCode: 200,
        },
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  try {
    const result = await applyFirecrawlResearchFallback(inputWithSource("blocked"), new Date("2026-08-14T10:00:00.000Z"));
    assert.equal(result.sourceChecks[0]?.status, "checked");
    assert.equal(result.sourceChecks[0]?.itemCount, 1);
    assert.match(result.sourceChecks[0]?.note || "", /Firecrawl fallback recovered/);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]?.publisher, "ZeroHedge");
    assert.equal(result.items[0]?.url, "https://www.zerohedge.com/markets/oil-shipping-update");
    assert.equal(result.items[0]?.evidence?.[0]?.url, "https://www.zerohedge.com/markets/oil-shipping-update");
    assert.match(result.items[0]?.reviewReason || "", /original article URL remains the canonical provenance URL/);
    const parsedBody = JSON.parse(requestBody) as { formats?: string[]; proxy?: string; url?: string };
    assert.deepEqual(parsedBody.formats, ["rawHtml"]);
    assert.equal(parsedBody.proxy, "auto");
    assert.equal(parsedBody.url, "https://feeds.feedburner.com/zerohedge/feed");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.FIRECRAWL_API_KEY;
    else process.env.FIRECRAWL_API_KEY = previousKey;
  }
});

test("Firecrawl failure remains diagnostic and does not fabricate evidence", async () => {
  const previousKey = process.env.FIRECRAWL_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.FIRECRAWL_API_KEY = "test-key";
  globalThis.fetch = (async () => new Response(JSON.stringify({
    success: false,
    error: "blocked upstream",
  }), { status: 500, headers: { "Content-Type": "application/json" } })) as typeof fetch;
  try {
    const result = await applyFirecrawlResearchFallback(inputWithSource("blocked"), new Date("2026-08-14T10:00:00.000Z"));
    assert.equal(result.sourceChecks[0]?.status, "blocked");
    assert.equal(result.items.length, 0);
    assert.match(result.sourceChecks[0]?.note || "", /Firecrawl fallback failed/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.FIRECRAWL_API_KEY;
    else process.env.FIRECRAWL_API_KEY = previousKey;
  }
});
