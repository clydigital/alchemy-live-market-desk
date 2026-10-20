import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseFxStreetNewsFeedPage, parseFxStreetNewsFeedMarkdown } from "../lib/fxstreet-feed.ts";

test("FXStreet official HTML news feed preserves canonical article provenance and slug time", () => {
  const html = `
    <html><body>
      <h1>News Feed</h1>
      <section>
        <h2>October 7, 2026</h2>
        <ul>
          <li><h4><a href="https://www.fxstreet.com/news/gold-falls-as-us-dollar-treasury-yields-rebound-ahead-of-fed-minutes-202610071045">Gold falls as US Dollar, Treasury yields rebound ahead of Fed Minutes</a></h4></li>
          <li><h4><a href="/news/us-dollar-near-term-upside-questioned-ocbc-202610071000">US Dollar: Near-term upside questioned – OCBC</a></h4></li>
        </ul>
      </section>
    </body></html>
  `;

  const entries = parseFxStreetNewsFeedPage(html);
  assert.equal(entries.length, 2);
  assert.equal(entries[0]?.publishedAt, "2026-10-07T10:45:00.000Z");
  assert.equal(entries[0]?.url, "https://www.fxstreet.com/news/gold-falls-as-us-dollar-treasury-yields-rebound-ahead-of-fed-minutes-202610071045");
  assert.equal(entries[0]?.summary, entries[0]?.title);
  assert.equal(entries[1]?.publishedAt, "2026-10-07T10:00:00.000Z");
  assert.equal(entries[1]?.url, "https://www.fxstreet.com/news/us-dollar-near-term-upside-questioned-ocbc-202610071000");
});

test("FXStreet parser rejects links without a canonical news timestamp", () => {
  const html = `<h1>News Feed</h1><a href="https://www.fxstreet.com/news/no-timestamp">No timestamp</a><a href="https://example.com/news/item-202610071045">External</a>`;
  assert.deepEqual(parseFxStreetNewsFeedPage(html), []);
});


test("scheduled FXStreet acquisition advertises the official HTML feed surface as HTML", () => {
  const source = readFileSync(
    new URL("../lib/scheduled-research-input.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /source === "fxstreet"[\s\S]*text\/html,application\/xhtml\+xml/);
  assert.match(source, /Accept-Language": "en-US,en;q=0\.9"/);
  assert.match(source, /headers: directFeedRequestHeaders\(source\.source\)/);
  assert.doesNotMatch(
    source,
    /fetch\(url,[\s\S]{0,300}Accept: "application\/rss\+xml[^"]*"[^\n]*\n[^\n]*"User-Agent": "Alchemy Live Desk scheduled research"/,
  );
});

test("Jina Markdown index admits only original dated FXStreet article links", () => {
  const md = `Title: News Feed
# News Feed
[US dollar rises after official CPI](https://www.fxstreet.com/news/us-dollar-rises-after-official-cpi-202610201315)
[Duplicate](https://www.fxstreet.com/news/us-dollar-rises-after-official-cpi-202610201315)
[Other publisher](https://fake.example/news/us-dollar-rises-202610201315)
[Undated FXStreet](https://www.fxstreet.com/news/us-dollar-rises)
[Earlier gold news](/news/gold-holds-202610191200)
`;
  const rows = parseFxStreetNewsFeedMarkdown(md);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.publishedAt, "2026-10-20T13:15:00.000Z");
  assert.equal(rows[0]?.url, "https://www.fxstreet.com/news/us-dollar-rises-after-official-cpi-202610201315");
  assert.equal(rows[1]?.url, "https://www.fxstreet.com/news/gold-holds-202610191200");
  assert.ok(rows.every(row => row.publishedAt && row.url.startsWith("https://www.fxstreet.com/news/")));
});

test("Jina Markdown without publisher news-feed identity cannot become intake", () => {
  assert.deepEqual(parseFxStreetNewsFeedMarkdown(
    "[Fake](https://www.fxstreet.com/news/us-dollar-rises-202610201315)"), []);
});
