import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { responsesCompatibleJsonSchema } from "../lib/intelligence/openai-core.ts";
import { validateRequirementIds } from "../lib/intelligence/research-state.ts";

test("Responses structured-output boundary strips unsupported uniqueItems", () => {
  const openaiCore = readFileSync(new URL("../lib/intelligence/openai-core.ts", import.meta.url), "utf8");
  const openai = readFileSync(new URL("../lib/intelligence/openai.ts", import.meta.url), "utf8");

  assert.match(openaiCore, /key === "uniqueItems"/, "openai-core.ts must contain the uniqueItems stripping logic");
  assert.match(openai, /responsesCompatibleJsonSchema/, "openai.ts must import and re-export responsesCompatibleJsonSchema at production boundary");
  assert.match(openai, /schema: responsesCompatibleJsonSchema\(schema\)/, "runStructuredStage must pass schemas through responsesCompatibleJsonSchema");
});

test("Responses boundary preserves exact array cardinality and enum constraints", () => {
  const schema = responsesCompatibleJsonSchema({
    type: "array",
    minItems: 2,
    maxItems: 2,
    items: { type: "string", enum: ["a", "b"] },
  }) as any;

  assert.equal(schema.minItems, 2);
  assert.equal(schema.maxItems, 2);
  assert.deepEqual(schema.items.enum, ["a", "b"]);
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
