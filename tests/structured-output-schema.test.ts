import assert from "node:assert/strict";
import test from "node:test";

import { CHALLENGER_SCHEMA } from "../lib/intelligence/schemas.ts";
import { providerCompatibleJsonSchema } from "../lib/intelligence/structured-output-schema.ts";

test("provider schema adapter removes unsupported uniqueItems recursively", () => {
  const internal = {
    type: "object",
    properties: {
      ids: {
        type: "array",
        uniqueItems: true,
        items: { type: "string", enum: ["a", "b"] },
      },
    },
  };

  const provider = providerCompatibleJsonSchema(internal);
  assert.equal(JSON.stringify(provider).includes('"uniqueItems"'), false);
  assert.deepEqual((provider as typeof internal).properties.ids.items.enum, ["a", "b"]);
});

test("the Challenger schema sent to OpenAI no longer contains uniqueItems", () => {
  assert.equal(JSON.stringify(CHALLENGER_SCHEMA).includes('"uniqueItems"'), true,
    "the internal schema should retain its uniqueness intent");
  const provider = providerCompatibleJsonSchema(CHALLENGER_SCHEMA);
  assert.equal(JSON.stringify(provider).includes('"uniqueItems"'), false);
});
