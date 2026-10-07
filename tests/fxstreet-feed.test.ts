import assert from "node:assert/strict";
import test from "node:test";

import { parseFxStreetNewsFeedPage } from "../lib/fxstreet-feed.ts";

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
