import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) =>
  readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("legacy presenter actions link to Bluebelly's existing owner studio, not Hybrid", () => {
  const legacy = read("app/hybrid-output/page.tsx");
  const presenter = read("app/owner/presenter/page.tsx");
  const labels = legacy.match(/Open Bluebelly Presenter Studio/g) ?? [];
  const destinations = legacy.match(/href="\/owner\/presenter"/g) ?? [];

  assert.equal(labels.length, 2, "both legacy presenter actions must explain the new destination");
  assert.equal(destinations.length, 2, "both legacy actions must stay on the native owner route");
  assert.doesNotMatch(legacy, /href="https:\/\/alchemy-hybrid-market-desk[^"]*"/);
  assert.doesNotMatch(legacy, /href="\/owner\/presenter"\s+target="_blank"/);
  assert.match(presenter, /data-presenter-studio="owner-only"/);
});

test("legacy presenter redirect does not remove compatibility or rewrite machine feeds", () => {
  const legacy = read("app/hybrid-output/page.tsx");
  assert.match(legacy, /export default/);
  const telemetry = read("lib/intelligence/publication-caller-telemetry.ts");
  assert.match(telemetry, /publication_feed_caller/);
  assert.match(telemetry, /"\/api\/hybrid-feed-v2"/);
});
