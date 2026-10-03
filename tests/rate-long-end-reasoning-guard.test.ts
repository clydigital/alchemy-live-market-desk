import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Research Brain is forbidden from converting long-end residual into unsupported term premium causality", () => {
  const prompt = readFileSync(new URL("../lib/dossier-v2/research-brain-prompt.ts", import.meta.url), "utf8");
  assert.match(prompt, /Treat the arithmetic residual as UNASSIGNED/);
  assert.match(prompt, /Never label that residual term premium/);
  assert.match(prompt, /Treasury buybacks are debt-management\/liquidity operations, not QE or yield control/);
  assert.match(prompt, /One weak auction metric alone is not sufficient/);
});
