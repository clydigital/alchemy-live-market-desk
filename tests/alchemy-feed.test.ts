import assert from "node:assert/strict";
import test from "node:test";

import { parseAlchemyMarketInsightsFeed } from "../lib/alchemy.ts";

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

