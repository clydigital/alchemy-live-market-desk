import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normaliseDirectFeedText, scoreDirectFeedHeadline } from "../lib/direct-news-evidence-triage.ts";

test("direct-feed scoring no longer awards the same market relevance to unrelated headlines", () => {
  const oil = scoreDirectFeedHeadline("US diesel imports lag distillate demand as fuel costs rise");
  const ai = scoreDirectFeedHeadline("TSMC raises AI chip revenue guidance and capital expenditure");
  const unrelated = scoreDirectFeedHeadline("Nevada runaway bride ordered to repay gambling debt");
  const politics = scoreDirectFeedHeadline("New White House press secretary selected");
  assert.equal(oil.reason, "market_observable");
  assert.equal(ai.reason, "market_observable");
  assert.ok(oil.relevance > unrelated.relevance);
  assert.ok(ai.materiality > politics.materiality);
  assert.equal(unrelated.reason, "relevance_unresolved");
  assert.equal(politics.reason, "relevance_unresolved");
});

test("secondary business and geopolitical leads remain available without false certainty", () => {
  const china = scoreDirectFeedHeadline("China's AI labs unveil another chip prototype");
  const regulation = scoreDirectFeedHeadline("Senate permitting proposal advances", "Power grid investment and data-centre costs are affected");
  const weaker = scoreDirectFeedHeadline("Regional winner named", "Diesel delivery report still under investigation");
  assert.equal(china.reason, "market_observable");
  assert.ok(regulation.relevance >= 50);
  assert.ok(weaker.relevance < 82);
  assert.ok(china.relevance >= regulation.relevance);
});

test("encoded and nested HTML in descriptions is removed before canonical claim text", () => {
  assert.equal(
    normaliseDirectFeedText("&#x3C;span property='schema:name'&#x3E;Oil prices &amp; yields&#x3c;/span&#x3e;"),
    "Oil prices & yields",
  );
  assert.equal(
    normaliseDirectFeedText("&lt;p&gt;U.S. &quot;diesel&quot; prices &amp; freight &lt;a href='https://example.test'&gt;rise&lt;/a&gt;&lt;/p&gt;"),
    'U.S. "diesel" prices & freight rise',
  );
  assert.equal(
    normaliseDirectFeedText("<![CDATA[<p>TSMC&nbsp;revenue <b>grew</b>.</p>]]>"),
    "TSMC revenue grew .",
  );
});

test("scheduled feed maps ranked values into existing intake without removing source-check rows", () => {
  const source = readFileSync(new URL("../lib/scheduled-research-input.ts", import.meta.url), "utf8");
  assert.match(source, /scoreDirectFeedHeadline\(entry.title, summary\)/);
  assert.match(source, /relevance: triage.relevance/);
  assert.match(source, /materiality: triage.materiality/);
  assert.match(source, /normaliseDirectFeedText\(value\)/);
  assert.match(source, /itemCount: unique.length/);
  assert.match(source, /items: unique.map\(\(entry\) => feedItem\(source, entry\)\)/);
});
