import assert from "node:assert/strict";
import test from "node:test";

import { getResearchBrainJsonSchema } from "../lib/dossier-v2/research-brain-prompt.ts";

function auditStrictObjectSchemas(
  node: unknown,
  path = "$",
  failures: string[] = [],
): string[] {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    return failures;
  }

  const schema = node as Record<string, unknown>;
  if (schema.type === "object" && schema.properties && typeof schema.properties === "object") {
    const propertyKeys = Object.keys(schema.properties as Record<string, unknown>).sort();
    const required = Array.isArray(schema.required)
      ? schema.required.filter((item): item is string => typeof item === "string").sort()
      : [];

    if (schema.additionalProperties === false) {
      const missing = propertyKeys.filter((key) => !required.includes(key));
      const unknownRequired = required.filter((key) => !propertyKeys.includes(key));

      if (missing.length > 0) {
        failures.push(
          `${path}: strict object schema is missing required entries for: ${missing.join(", ")}`,
        );
      }
      if (unknownRequired.length > 0) {
        failures.push(
          `${path}: required contains undeclared properties: ${unknownRequired.join(", ")}`,
        );
      }
    }
  }

  for (const [key, value] of Object.entries(schema)) {
    auditStrictObjectSchemas(value, `${path}.${key}`, failures);
  }

  return failures;
}

test("Research Brain JSON schema is compatible with strict structured-output requirements", () => {
  const schema = getResearchBrainJsonSchema();
  const failures = auditStrictObjectSchemas(schema);

  assert.deepEqual(
    failures,
    [],
    `Strict JSON schema violations:\n${failures.join("\n")}`,
  );
});

test("Research Brain strict schema requires previously optional chart and lead fields", () => {
  const schema = getResearchBrainJsonSchema() as any;

  const coreRequired =
    schema.properties.chart_investigation_queue.properties.core.items.required;
  const optionalRequired =
    schema.properties.chart_investigation_queue.properties.optional.items.required;
  const investigationRequired =
    schema.properties.investigations.items.required;

  assert.ok(coreRequired.includes("overlay_or_comparison"));
  assert.ok(optionalRequired.includes("overlay_or_comparison"));
  assert.ok(investigationRequired.includes("leads_referenced"));
});
