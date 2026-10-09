import assert from "node:assert/strict";
import test from "node:test";

import { applyFirecrawlResearchFallback } from "../lib/firecrawl-research-fallback.ts";
import { scrapePublicUrlWithFirecrawl } from "../lib/firecrawl.ts";
import { REQUIRED_RESEARCH_SOURCES, validateResearchRun } from "../lib/research-update.ts";

function inputWithSource(status: "checked" | "blocked" = "blocked") {
  return {
    runKey: "firecrawl-test",
    scheduleSlot: "morning" as const,
    scheduledFor: "2026-08-14T09:30:00+08:00",
    sourceChecks: [{
      source: "zerohedge" as const,
      status,
      itemCount: status === "checked" ? 1 : 0,
      note: status === "blocked" ? "Direct feed returned HTTP 403." : "Direct feed acquired.",
    }],
    items: status === "checked" ? [{
      itemKey: "existing",
      itemType: "news" as const,
      publisher: "ZeroHedge",
      title: "Existing direct item",
      url: "https://www.zerohedge.com/existing",
      publishedAt: "2026-08-14T08:00:00.000Z",
      summary: "Existing direct item",
      sourceQuality: 64,
      relevance: 68,
      novelty: 72,
      materiality: 64,
      recommendedAction: "collect_evidence" as const,
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

test("Firecrawl fallback preserves earlier acquisition diagnostics in the run summary", async () => {
  const previousKey = process.env.FIRECRAWL_API_KEY;
  delete process.env.FIRECRAWL_API_KEY;
  try {
    const input = {
      ...inputWithSource("blocked"),
      summary: "Direct macro/news coverage is degraded. Regional discovery checked Korea and Japan.",
    };
    const result = await applyFirecrawlResearchFallback(input, new Date("2026-08-14T10:00:00.000Z"));
    assert.match(result.summary || "", /Direct macro\/news coverage is degraded/);
    assert.match(result.summary || "", /Regional discovery checked Korea and Japan/);
    assert.match(result.summary || "", /Firecrawl blocked-page recovery is not configured/);
  } finally {
    if (previousKey === undefined) delete process.env.FIRECRAWL_API_KEY;
    else process.env.FIRECRAWL_API_KEY = previousKey;
  }
});


test("recovered Alchemy articles receive ordered, unique publisher positions and pass the actual validator", async () => {
  const previousKey = process.env.FIRECRAWL_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.FIRECRAWL_API_KEY = "fixture-key-not-a-real-token";
  globalThis.fetch = (async (url) => {
    assert.equal(String(url), "https://api.firecrawl.dev/v2/scrape");
    return new Response(JSON.stringify({
      success: true,
      data: {
        rawHtml: `<rss><channel>
          <item><title>Older rates note</title><link>https://alchemymarkets.com/education/market-insights/older-rates</link><pubDate>Thu, 08 Oct 2026 07:00:00 +0000</pubDate><description>Older canonical publisher summary.</description></item>
          <item><title>Newer energy note</title><link>https://alchemymarkets.com/education/market-insights/newer-energy</link><pubDate>Thu, 08 Oct 2026 09:00:00 +0000</pubDate><description>Newer canonical publisher summary.</description></item>
          <item><title>Duplicate newer energy note</title><link>https://alchemymarkets.com/education/market-insights/newer-energy</link><pubDate>Thu, 08 Oct 2026 09:00:00 +0000</pubDate><description>Duplicate URL must not create another article.</description></item>
        </channel></rss>`,
        metadata: { sourceURL: "https://alchemymarkets.com/education/market-insights/feed/", statusCode: 200 },
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  try {
    for (const scheduleSlot of ["morning", "evening"] as const) {
      const baseline = {
        runKey: `cron-v1:${scheduleSlot}:2026-10-09`,
        scheduleSlot,
        scheduledFor: scheduleSlot === "morning" ? "2026-10-09T01:30:00.000Z" : "2026-10-09T13:30:00.000Z",
        sourceChecks: REQUIRED_RESEARCH_SOURCES.map((source) => ({
          source,
          status: source === "alchemy-market-insights" || source === "stockedup"
            ? "blocked" as const : "no_new_items" as const,
          itemCount: 0,
          note: "Source checked or unavailable in this fixture.",
        })),
        items: [],
        recalibrations: [],
      };
      assert.deepEqual(validateResearchRun(baseline).errors, [], "partial or blocked acquisition is structurally valid without fabricating items");
      const recovered = await applyFirecrawlResearchFallback(baseline, new Date("2026-10-09T11:00:00.000Z"));
      assert.equal(recovered.sourceChecks.length, REQUIRED_RESEARCH_SOURCES.length);
      assert.equal(recovered.sourceChecks.find((check) => check.source === "alchemy-market-insights")?.status, "checked");
      assert.equal(recovered.sourceChecks.find((check) => check.source === "alchemy-market-insights")?.itemCount, 2);
      assert.equal(recovered.items.length, 2);
      assert.deepEqual(recovered.items.map((item) => item.articlePosition), [1, 2]);
      assert.deepEqual(recovered.items.map((item) => item.title), ["Duplicate newer energy note", "Older rates note"]);
      assert.deepEqual(validateResearchRun(recovered).errors, [], "actual scheduled publisher validator accepts the recovered item shape");

      const malformed = {
        ...recovered,
        items: recovered.items.map(({ articlePosition: _position, ...item }) => item),
      };
      assert.deepEqual(
        validateResearchRun(malformed).errors.filter((error) => error.includes("articlePosition")),
        [
          "items[0].articlePosition must be from 1 to 30.",
          "items[1].articlePosition must be from 1 to 30.",
        ],
        "previous malformed recovery path is proven to fail the canonical publisher",
      );
    }
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.FIRECRAWL_API_KEY;
    else process.env.FIRECRAWL_API_KEY = previousKey;
  }
});
