import assert from "node:assert/strict";
import test from "node:test";

import { getFreshAlchemyArticles, parseAlchemyMarketInsightsFeed } from "../lib/alchemy.ts";

test("parses dated, direct articles from the official Alchemy Market Insights feed", () => {
  const articles = parseAlchemyMarketInsightsFeed(`
    <rss><channel>
      <item>
        <title><![CDATA[RBA Holds: What AUDUSD Needs Next]]></title>
        <link>https://alchemymarkets.com/education/market-insights/opening-bell/rba-audusd-aug-2026/</link>
        <pubDate>Tue, 11 Aug 2026 10:51:28 +0000</pubDate>
        <dc:creator>Lee Yang</dc:creator>
        <description><![CDATA[The rate decision changes the next AUDUSD test.]]></description>
        <content:encoded><![CDATA[<p>The rate decision changes the next AUDUSD test.</p>]]></content:encoded>
      </item>
      <item>
        <title>Missing date</title>
        <link>https://alchemymarkets.com/education/market-insights/opening-bell/no-date/</link>
      </item>
    </channel></rss>
  `);

  assert.equal(articles.length, 1);
  assert.equal(articles[0]?.id, "rba-audusd-aug-2026");
  assert.equal(articles[0]?.author, "Lee Yang");
  assert.equal(articles[0]?.publishedAt, "2026-08-11T10:51:28.000Z");
  assert.match(articles[0]?.bodyText || "", /AUDUSD/);
});

test("strict acquisition recovers a dated category article when RSS lags", async () => {
  const articleUrl = "https://alchemymarkets.com/education/market-insights/opening-bell/global-bonds-oil-sep-2026/";
  const openingBellUrl = "https://alchemymarkets.com/education/market-insights/opening-bell/";
  const feedUrl = "https://alchemymarkets.com/education/market-insights/feed/";
  const responses = new Map<string, string>([
    [feedUrl, "<rss><channel></channel></rss>"],
    [openingBellUrl, `<main><a href="${articleUrl}">Global Bond Yields Surge as Oil Tests $100</a></main>`],
    [articleUrl, `
      <html><head>
        <meta property="og:title" content="Global Bond Yields Surge as Oil Tests $100 | Alchemy Markets">
        <meta name="description" content="Oil near $100, rising G7 yields and Japan’s policy shift put PPI, CPI and the ECB at the centre of the next global rates move.">
        <meta property="article:published_time" content="2026-09-09T00:00:00.000Z">
        <meta name="author" content="Lee Yang">
      </head><body><article><p>Oil near $100 and rising global yields keep inflation and policy reaction functions in focus.</p></article></body></html>
    `],
  ]);

  const fakeFetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = responses.get(url);
    return body === undefined
      ? new Response("not found", { status: 404 })
      : new Response(body, { status: 200 });
  };

  const result = await getFreshAlchemyArticles(5, fakeFetch as typeof fetch);

  assert.equal(result.status, "checked");
  assert.equal(result.articles.length, 1);
  assert.equal(result.articles[0]?.url, articleUrl);
  assert.equal(result.articles[0]?.publishedAt, "2026-09-09T00:00:00.000Z");
  assert.match(result.articles[0]?.summary || "", /Oil near \$100/);
  assert.match(result.note || "", /direct category article/i);
});
