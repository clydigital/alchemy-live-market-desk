import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateRequirementIds } from "../lib/intelligence/research-state.ts";

test("Responses structured-output boundary strips unsupported uniqueItems", () => {
  const openai = readFileSync(new URL("../lib/intelligence/openai.ts", import.meta.url), "utf8");

  assert.match(openai, /key === "uniqueItems"/);
  assert.match(openai, /schema: responsesCompatibleJsonSchema\(schema\)/);
});

test("Challenger requirement IDs remain unique after deterministic validation", () => {
  const validated = validateRequirementIds([
    "front-end-yields",
    "front-end-yields",
    "policy-pricing",
    "policy-pricing",
  ]);

  assert.deepEqual(validated.known, ["front-end-yields", "policy-pricing"]);
  assert.deepEqual(validated.unknown, []);
});
