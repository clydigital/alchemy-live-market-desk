import assert from "node:assert/strict";
import test from "node:test";
import { isReboundCapitalArticleUrl, REBOUND_CAPITAL_FEED_URL } from "../lib/rebound-capital-feed.ts";
import { applyFirecrawlResearchFallback } from "../lib/firecrawl-research-fallback.ts";
import { OPTIONAL_RESEARCH_SOURCES, REQUIRED_RESEARCH_SOURCES, validateResearchRun } from "../lib/research-update.ts";

test("Rebound Capital is a real, optional, separately identified opinion source", () => {
  assert.ok(OPTIONAL_RESEARCH_SOURCES.includes("rebound-capital"));
  assert.equal(REBOUND_CAPITAL_FEED_URL, "https://reboundcapital.substack.com/feed");
  assert.equal(isReboundCapitalArticleUrl("https://reboundcapital.substack.com/p/top-rebound-stocks-for-nov26"), true);
  assert.equal(isReboundCapitalArticleUrl("https://www.rebound.capital/p/top-rebound-stocks-for-nov-26"), true);
  assert.equal(isReboundCapitalArticleUrl("https://rebound.capital/p/top-rebound-stocks-for-nov-26"), true);
  for (const unsafe of ["https://reboundcapital.substack.com.evil.org/p/article", "https://evil.example/p/article", "http://reboundcapital.substack.com/p/article", "https://reboundcapital.substack.com/archive", "not-a-url"]) {
    assert.equal(isReboundCapitalArticleUrl(unsafe), false, unsafe);
  }
});

test("blocked Rebound RSS recovers only publisher-owned dated leads, deduplicates, and never masquerades as official data", async () => {
  const priorKey = process.env.FIRECRAWL_API_KEY;
  const priorFetch = globalThis.fetch;
  process.env.FIRECRAWL_API_KEY = "test-token-no-network";
  globalThis.fetch = (async (url, init) => {
    assert.equal(String(url), "https://api.firecrawl.dev/v2/scrape");
    assert.equal(JSON.parse(String(init?.body)).url, REBOUND_CAPITAL_FEED_URL);
    return new Response(JSON.stringify({success:true,data:{rawHtml:`<rss><channel>
      <item><title>Semiconductor valuation reset</title><link>https://reboundcapital.substack.com/p/semiconductor-valuation-reset?utm_source=feed</link><pubDate>Sun, 22 Nov 2026 09:00:00 GMT</pubDate><description>An analyst's relative valuation argument.</description></item>
      <item><title>Duplicate</title><link>https://reboundcapital.substack.com/p/semiconductor-valuation-reset</link><pubDate>Sun, 22 Nov 2026 09:00:00 GMT</pubDate><description>Duplicate title.</description></item>
      <item><title>Off-domain claim</title><link>https://example.org/p/article</link><pubDate>Sun, 22 Nov 2026 09:00:00 GMT</pubDate><description>Should not be admitted.</description></item>
      <item><title>Old</title><link>https://reboundcapital.substack.com/p/old-article</link><pubDate>Sun, 01 Nov 2026 09:00:00 GMT</pubDate><description>Out of window.</description></item>
    </channel></rss>`,metadata:{sourceURL:REBOUND_CAPITAL_FEED_URL,statusCode:200}}}), {status:200,headers:{"Content-Type":"application/json"}});
  }) as typeof fetch;
  try {
    const baseline={runKey:"cron-v1:morning:2026-11-23", scheduleSlot:"morning" as const,scheduledFor:"2026-11-23T01:30:00.000Z",
      sourceChecks:[...REQUIRED_RESEARCH_SOURCES.map(source=>({source,status:"no_new_items" as const,itemCount:0})),{source:"rebound-capital" as const,status:"blocked" as const,itemCount:0}],items:[],recalibrations:[]};
    assert.deepEqual(validateResearchRun(baseline).errors, []);
    const result=await applyFirecrawlResearchFallback(baseline,new Date("2026-11-23T10:00:00.000Z"));
    assert.equal(result.sourceChecks.find(s=>s.source==="rebound-capital")?.status,"checked");
    assert.equal(result.items.length,1);
    assert.equal(result.items[0].publisher,"Rebound Capital");
    assert.equal(result.items[0].url,"https://reboundcapital.substack.com/p/semiconductor-valuation-reset");
    assert.match(result.items[0].reviewReason||"",/independent investment opinion/i);
    assert.deepEqual(validateResearchRun({...result,recalibrations:[]}).errors,[]);
  } finally {
    globalThis.fetch=priorFetch;
    if(priorKey===undefined) delete process.env.FIRECRAWL_API_KEY;
    else process.env.FIRECRAWL_API_KEY=priorKey;
  }
});
