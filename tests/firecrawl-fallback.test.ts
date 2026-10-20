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
      assert.deepEqual(validateResearchRun({ ...recovered, recalibrations: [] }).errors, [], "actual scheduled publisher validator accepts the recovered item shape");

      const malformed = {
        ...recovered,
        items: recovered.items.map(({ articlePosition: _position, ...item }) => item),
      };
      assert.deepEqual(
        validateResearchRun({ ...malformed, recalibrations: [] }).errors.filter((error) => error.includes("articlePosition")),
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

test("FXStreet HTML recovery admits only fresh dated publisher-owned URLs, not scraped headlines as proof", async () => {
  const previousKey = process.env.FIRECRAWL_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.FIRECRAWL_API_KEY = "fixture-only";
  let requestedUrl = "";
  globalThis.fetch = (async (url, init) => {
    assert.equal(String(url), "https://api.firecrawl.dev/v2/scrape");
    requestedUrl = (JSON.parse(String(init?.body)) as { url: string }).url;
    return new Response(JSON.stringify({
      success: true,
      data: {
        rawHtml: `<html><body><h1>News Feed</h1>
          <a href="https://www.fxstreet.com/news/us-dollar-rallies-after-fed-remarks-202610201200">US Dollar rallies after Fed remarks</a>
          <a href="/news/us-dollar-rallies-after-fed-remarks-202610201200">Duplicate original</a>
          <a href="/news/old-september-story-202609201100">Stale headline</a>
          <a href="https://attacker.example/news/fake-202610201200">Mismatched provider</a>
          <a href="/news/undated-article">Unverifiable date</a>
        </body></html>`,
        metadata: { sourceURL: "https://www.fxstreet.com/news/feed", statusCode: 200 },
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  try {
    const source = {
      ...inputWithSource("blocked"),
      sourceChecks: [{source: "fxstreet" as const, status: "blocked" as const, itemCount: 0,
        note: "Direct origin denied HTTP 403."}],
    };
    const result = await applyFirecrawlResearchFallback(source, new Date("2026-10-20T13:00:00Z"));
    assert.equal(requestedUrl, "https://www.fxstreet.com/news/feed");
    assert.equal(result.sourceChecks[0]?.status, "checked");
    assert.equal(result.sourceChecks[0]?.itemCount, 1);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]?.publisher, "FXStreet");
    assert.equal(result.items[0]?.publishedAt, "2026-10-20T12:00:00.000Z");
    assert.equal(result.items[0]?.url, "https://www.fxstreet.com/news/us-dollar-rallies-after-fed-remarks-202610201200");
    assert.equal(result.items[0]?.evidence?.[0]?.url, result.items[0]?.url);
    assert.match(result.items[0]?.reviewReason || "", /research lead, not independent verification/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.FIRECRAWL_API_KEY;
    else process.env.FIRECRAWL_API_KEY = previousKey;
  }
});

test("old or malformed FXStreet HTML cannot clear a blocked publisher check", async () => {
  const previousKey = process.env.FIRECRAWL_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.FIRECRAWL_API_KEY = "fixture-only";
  globalThis.fetch = (async (_url, init) => {
    const requested = (JSON.parse(String(init?.body)) as {url: string}).url;
    return new Response(JSON.stringify({
      success: true,
      data: {
        rawHtml: requested.includes("news/feed")
          ? '<h1>News Feed</h1><a href="/news/old-news-202609201200">Old story</a>'
          : '<rss><channel><item><title>Old story</title><link>https://www.fxstreet.com/news/old-202609201200</link><pubDate>Sun, 20 Sep 2026 12:00:00 +0000</pubDate></item></channel></rss>',
        metadata: { sourceURL: requested, statusCode: 200 },
      },
    }), {status: 200, headers: {"Content-Type": "application/json"}});
  }) as typeof fetch;
  try {
    const source = {
      ...inputWithSource("blocked"),
      sourceChecks: [{source: "fxstreet" as const, status: "blocked" as const, itemCount: 0,
        note: "Direct 403."}],
    };
    const result = await applyFirecrawlResearchFallback(source, new Date("2026-10-20T13:00:00Z"));
    assert.equal(result.sourceChecks[0]?.status, "blocked");
    assert.equal(result.items.length, 0);
    assert.match(result.sourceChecks[0]?.note || "", /no fresh dated feed items/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.FIRECRAWL_API_KEY;
    else process.env.FIRECRAWL_API_KEY = previousKey;
  }
});

test("Vercel Jina credentials can recover recent FXStreet links when Firecrawl is unconfigured", async () => {
  const savedJina = process.env.JINA_API_KEY;
  const savedFirecrawl = process.env.FIRECRAWL_API_KEY;
  const savedFetch = globalThis.fetch;
  process.env.JINA_API_KEY = "fixture-jina-key";
  delete process.env.FIRECRAWL_API_KEY;
  let requests = 0;
  globalThis.fetch = (async (input, init) => {
    requests += 1;
    assert.equal(String(input), "https://r.jina.ai/https://www.fxstreet.com/news/feed");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("Authorization"), "Bearer fixture-jina-key");
    return new Response(`Title: News Feed
# News Feed
[US yields rally after CPI](https://www.fxstreet.com/news/us-yields-rally-after-cpi-202610201300)
[Stale article](https://www.fxstreet.com/news/stale-us-dollar-202609201200)
[Unrelated URL](https://example.com/news/false-202610201305)
`, {status: 200});
  }) as typeof fetch;
  try {
    const input = {
      ...inputWithSource("blocked"),
      sourceChecks: [{source:"fxstreet" as const, status:"blocked" as const, itemCount:0, note:"Direct origin HTTP 403."}],
    };
    const result = await applyFirecrawlResearchFallback(input, new Date("2026-10-20T13:30:00Z"));
    assert.equal(requests, 1);
    assert.equal(result.sourceChecks[0]?.status, "checked");
    assert.equal(result.sourceChecks[0]?.itemCount, 1);
    assert.match(result.sourceChecks[0]?.note || "", /Jina Reader recovered/);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]?.publisher, "FXStreet");
    assert.equal(result.items[0]?.publishedAt, "2026-10-20T13:00:00.000Z");
    assert.equal(result.items[0]?.url, "https://www.fxstreet.com/news/us-yields-rally-after-cpi-202610201300");
    assert.match(result.items[0]?.reviewReason || "", /not independent verification/);
  } finally {
    globalThis.fetch = savedFetch;
    if (savedJina === undefined) delete process.env.JINA_API_KEY;
    else process.env.JINA_API_KEY = savedJina;
    if (savedFirecrawl === undefined) delete process.env.FIRECRAWL_API_KEY;
    else process.env.FIRECRAWL_API_KEY = savedFirecrawl;
  }
});

test("Jina provider error never clears the blocked FXStreet source or invents a result", async () => {
  const savedJina = process.env.JINA_API_KEY;
  const savedFirecrawl = process.env.FIRECRAWL_API_KEY;
  const savedFetch = globalThis.fetch;
  process.env.JINA_API_KEY = "fixture-jina-key";
  delete process.env.FIRECRAWL_API_KEY;
  globalThis.fetch = (async () => new Response("rate limit", {status:429})) as typeof fetch;
  try {
    const input = {
      ...inputWithSource("blocked"),
      sourceChecks: [{source:"fxstreet" as const, status:"blocked" as const, itemCount:0, note:"HTTP 403."}],
    };
    const result = await applyFirecrawlResearchFallback(input, new Date("2026-10-20T13:30:00Z"));
    assert.equal(result.sourceChecks[0]?.status, "blocked");
    assert.equal(result.sourceChecks[0]?.itemCount, 0);
    assert.equal(result.items.length, 0);
    assert.match(result.sourceChecks[0]?.note || "", /Jina Reader could not recover/);
    assert.match(result.summary || "", /Firecrawl blocked-page recovery is not configured/);
  } finally {
    globalThis.fetch = savedFetch;
    if (savedJina === undefined) delete process.env.JINA_API_KEY;
    else process.env.JINA_API_KEY = savedJina;
    if (savedFirecrawl === undefined) delete process.env.FIRECRAWL_API_KEY;
    else process.env.FIRECRAWL_API_KEY = savedFirecrawl;
  }
});
