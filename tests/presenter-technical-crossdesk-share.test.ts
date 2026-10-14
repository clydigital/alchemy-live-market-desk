import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const share = readFileSync(new URL("../app/presenter/technical-checks/share/page.tsx", import.meta.url), "utf8");

test("user-approved transfer only to allowlisted Hybrid opener", () => {
  assert.match(share, /ALLOWED_HYBRID_ORIGINS\.has\(origin\)/);
  assert.match(share, /window\.opener/);
  assert.match(share, /nonce/);
  assert.match(share, /window\.opener\.postMessage/);
  assert.match(share, /onClick=\{share\}/);
  assert.doesNotMatch(share, /postMessage\([^)]*,\s*["']\*["']/);
});
test("transfer excludes example defaults and canonical persistence", () => {
  assert.match(share, /alchemy-presenter-technical-fundamentals-v1/);
  assert.match(share, /parsed\.version !== 1/);
  assert.match(share, /updatedAt/);
  assert.match(share, /observedOn/);
  assert.match(share, /13\)/);
  assert.doesNotMatch(share, /fetch\(|supabase|\.from\(/i);
  assert.match(share, /not continuous synchronisation/);
});
