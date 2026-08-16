const UNSUPPORTED_STRICT_SCHEMA_KEYWORDS = new Set([
  // OpenAI strict Structured Outputs rejects this JSON Schema keyword.
  // Keep uniqueness enforcement deterministic in application validation.
  "uniqueItems",
]);

/**
 * Convert the Desk's internal JSON Schema objects to the strict subset accepted
 * by the OpenAI Responses API. Internal schemas may retain stronger semantic
 * annotations; the provider adapter removes only keywords the API rejects.
 */
export function providerCompatibleJsonSchema<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => providerCompatibleJsonSchema(item)) as T;
  }
  if (!value || typeof value !== "object") return value;

  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (UNSUPPORTED_STRICT_SCHEMA_KEYWORDS.has(key)) continue;
    output[key] = providerCompatibleJsonSchema(child);
  }
  return output as T;
}
