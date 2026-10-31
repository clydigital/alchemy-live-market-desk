import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("retired Live Hybrid handoff has no outbound presenter links to standalone Hybrid", () => {
  const legacy = read("app/hybrid-output/page.tsx");
  const target = 'href="https://bluebelly-desk.vercel.app/my-reports"';
  assert.equal(legacy.split(target).length - 1, 2);
  assert.equal(legacy.split("Open Bluebelly My Desk").length - 1, 2);
  assert.doesNotMatch(legacy, /href="https:\/\/alchemy-hybrid-market-desk[^"]*"/);
  assert.doesNotMatch(legacy, /target="_blank"[^>]*Open Bluebelly My Desk/);
});

test("Hybrid UI retirement does not modify canonical and private machine compatibility contracts", () => {
  const legacy = read("app/hybrid-output/page.tsx");
  const telemetry = read("lib/intelligence/publication-caller-telemetry.ts");
  const privateRoute = read("app/api/internal/canonical-feed/route.ts");
  const evidenceRoute = read("app/api/internal/legacy-evidence/route.ts");
  const owner = read("app/owner/presenter/page.tsx");
  assert.match(legacy, /export default async function HybridOutputPage/);
  assert.match(telemetry, /publication_feed_caller/);
  assert.match(privateRoute, /export async function GET/);
  assert.match(evidenceRoute, /export async function GET/);
  assert.match(owner, /redirect\("\/my-reports"\)/);
});
