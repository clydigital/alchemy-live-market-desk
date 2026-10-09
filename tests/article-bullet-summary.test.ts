import assert from "node:assert/strict";
import test from "node:test";

import { articleSummaryBullets } from "../lib/article-bullet-summary.ts";

test("article highlights come from published copy, without invented cases or price levels", () => {
  const article = {
    title: "TSMC Sales Hit a Record",
    summary: "TSMC reported record September sales as demand for advanced chips remained strong.",
    bodyText: [
      "TSMC reported record September sales as demand for advanced chips remained strong.",
      "Quarterly revenue also grew, giving another sign that customers are still spending heavily on the hardware needed for artificial intelligence.",
      "Yet the shares fell after the release, raising questions over how much of that growth was already priced into the stock.",
      "Investors will also be watching bond yields and the cost of financing new AI projects over the coming months.",
      "Disclaimer: Trading involves risk and past performance is no guarantee of future returns.",
    ].join("\n"),
  };
  const bullets = articleSummaryBullets(article);
  assert.equal(bullets[0], article.summary);
  assert.ok(bullets.length >= 3 && bullets.length <= 4);
  assert.ok(bullets.every((bullet) => bullet === article.summary || article.bodyText.includes(bullet)));
  assert.ok(bullets.every((bullet) => !/disclaimer|trigger|invalidate/i.test(bullet)));
  assert.ok(bullets.some((bullet) => /shares fell/.test(bullet)));
});

test("fallback article with only a summary does not invent extra takeaways", () => {
  const summary = "Bitcoin held near the key support area, while risk assets elsewhere were under pressure.";
  assert.deepEqual(articleSummaryBullets({ title: "Bitcoin Holds Support", summary, bodyText: summary }), [summary]);
});

test("missing article body yields a single source-supported bullet", () => {
  const summary = "Yields rose even as inflation data came in softer.";
  assert.deepEqual(articleSummaryBullets({ title: "Rate Check", summary, bodyText: "" }), [summary]);
});
