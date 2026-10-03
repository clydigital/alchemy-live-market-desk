import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Research Brain preserves TIC and Japan MOF scope and cadence boundaries", () => {
  const prompt = readFileSync(new URL("../lib/dossier-v2/research-brain-prompt.ts", import.meta.url), "utf8");

  assert.match(prompt, /Treasury TIC country holdings and Japan MOF weekly outward securities flows are different datasets/);
  assert.match(prompt, /monthly holdings change is not a same-week transaction measure/);
  assert.match(prompt, /not U\.S\.-Treasury-specific/);
  assert.match(prompt, /Never merge these into one synthetic flow series/);
  assert.match(prompt, /never call TIC month-over-month holdings change a contemporaneous auction-flow signal/);
});
