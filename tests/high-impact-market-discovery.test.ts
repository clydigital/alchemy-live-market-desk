import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { applyHighImpactMarketDiscovery } from "../lib/high-impact-market-discovery.ts";
import type { ResearchRunInput } from "../lib/research-update.ts";

function response(body: unknown, status = 200, contentType = "application/json") {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": contentType },
  });
}

function baseInput(): ResearchRunInput {
  return {
    runKey: "test-high-impact",
    scheduleSlot: "evening",
    scheduledFor: "2026-09-03T12:00:00Z",
    sourceChecks: [],
    items: [],
  };
}

test("targeted macro and yen searches retain underlying publisher pages after direct reads", async () => {
  const originalFirecrawl = process.env.FIRECRAWL_API_KEY;
  delete process.env.FIRECRAWL_API_KEY;
  const calls: string[] = [];
  const fetchImpl = async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.startsWith("https://api.gdeltproject.org/")) {
      const query = new URL(url).searchParams.get("query") || "";
      if (query.includes("CPI")) return response({ articles: [{
        title: "US services and inflation data reshape the rates debate",
        url: "https://www.reuters.com/markets/us/example-macro-2026-09-03/",
        seendate: "20260903T120000Z",
      }] });
      return response({ articles: [{
        title: "Yen jumps as traders reassess BOJ path and intervention risk",
        url: "https://www.tradingview.com/news/example-yen/",
        seendate: "20260903T121500Z",
      }] });
    }
    if (url.includes("reuters.com")) return response('<html><head><meta name="description" content="A current macro release changed rate expectations while investors examined inflation, employment and the next Federal Reserve decision in detail."></head></html>', 200, "text/html");
    if (url.includes("tradingview.com")) return response('<html><head><meta property="og:description" content="The yen strengthened sharply as markets reassessed Bank of Japan policy, official intervention risk and the USDJPY rate differential."></head></html>', 200, "text/html");
    return response("missing", 404, "text/plain");
  };

  try {
    const result = await applyHighImpactMarketDiscovery(baseInput(), "evening", {
      now: new Date("2026-09-03T13:00:00Z"),
      fetchImpl: fetchImpl as typeof fetch,
    });
    assert.equal(result.items.length, 2);
    assert.deepEqual(result.items.map((item) => item.publisher), ["reuters.com", "tradingview.com"]);
    assert.ok(result.items.every((item) => item.recommendedAction === "collect_evidence"));
    assert.ok(result.items.every((item) => item.evidence?.[0]?.url === item.url));
    assert.ok(calls.some((url) => url.includes("api.gdeltproject.org")));
    assert.ok(calls.some((url) => url.includes("reuters.com/markets/us/example-macro")));
    assert.ok(calls.some((url) => url.includes("tradingview.com/news/example-yen")));
    assert.ok(!calls.some((url) => url.includes("api.firecrawl.dev")));
  } finally {
    if (originalFirecrawl === undefined) delete process.env.FIRECRAWL_API_KEY;
    else process.env.FIRECRAWL_API_KEY = originalFirecrawl;
  }
});

test("an inaccessible discovered page remains a lead only when Firecrawl is unavailable", async () => {
  const originalFirecrawl = process.env.FIRECRAWL_API_KEY;
  delete process.env.FIRECRAWL_API_KEY;
  const fetchImpl = async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("https://api.gdeltproject.org/")) {
      const query = new URL(url).searchParams.get("query") || "";
      if (!query.includes("CPI")) return response({ articles: [] });
      return response({ articles: [{
        title: "US CPI preview moves rates",
        url: "https://example.com/blocked-macro",
        seendate: "20260903T120000Z",
      }] });
    }
    return response("blocked", 403, "text/plain");
  };

  try {
    const result = await applyHighImpactMarketDiscovery(baseInput(), "evening", {
      now: new Date("2026-09-03T13:00:00Z"),
      fetchImpl: fetchImpl as typeof fetch,
    });
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].recommendedAction, "monitor");
    assert.deepEqual(result.items[0].evidence, []);
    assert.match(result.items[0].divergenceNote || "", /must not materially recalibrate/i);
  } finally {
    if (originalFirecrawl === undefined) delete process.env.FIRECRAWL_API_KEY;
    else process.env.FIRECRAWL_API_KEY = originalFirecrawl;
  }
});

test("scheduled research runs normal discovery before targeted search and final Firecrawl recovery", () => {
  const source = readFileSync(new URL("../lib/firecrawl-scheduled-research.ts", import.meta.url), "utf8");
  const normal = source.indexOf("await applyResearchDiscoveryProviders");
  const targeted = source.indexOf("await applyHighImpactMarketDiscovery");
  const fallback = source.indexOf("return applyFirecrawlResearchFallback");
  assert.ok(normal >= 0 && targeted > normal && fallback > targeted);
});
