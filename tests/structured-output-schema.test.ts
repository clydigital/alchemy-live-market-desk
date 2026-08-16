import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

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

test("Challenger retains internal uniqueness intent while the provider adapter is applied", () => {
  const schemas = readFileSync(new URL("../lib/intelligence/schemas.ts", import.meta.url), "utf8");
  const openai = readFileSync(new URL("../lib/intelligence/openai.ts", import.meta.url), "utf8");

  assert.match(schemas, /uniqueItems:\s*true/);
  assert.match(openai, /schema:\s*providerCompatibleJsonSchema\(schema\)/);
});
