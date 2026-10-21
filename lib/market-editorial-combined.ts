import type { EditorialCandidate } from "./market-editorial-v1.ts";

/**
 * Extend the existing Dossier model's single strict-JSON response with a
 * bounded editorial array. The Dossier opening/storylines/order contract is
 * unchanged. No new provider stage or reasoning engine is created.
 */
export function augmentDossierWithEditorial(input: {
  stageKey: string;
  instructions: string;
  input: unknown;
  schema: Record<string, unknown>;
  maxOutputTokens?: number;
  maxAttempts?: number;
}, options: {
  editorialSchema: Record<string, unknown>;
  editorialInstructions: string;
  candidates: readonly EditorialCandidate[];
  candidateInput: (candidate: EditorialCandidate) => Record<string, unknown>;
}) {
  if (input.stageKey !== "dossier_storyline_composer") {
    throw new Error("Combined editorial output is permitted only inside the existing Dossier composer stage.");
  }
  const root = input.input;
  if (!root || typeof root !== "object" || Array.isArray(root)) {
    throw new Error("Dossier model input is not a JSON object.");
  }
  const sourceProperties = input.schema.properties;
  const editorialProperties = options.editorialSchema.properties;
  const articles = editorialProperties && typeof editorialProperties === "object"
    && !Array.isArray(editorialProperties)
    ? (editorialProperties as Record<string, unknown>).articles : null;
  if (!sourceProperties || typeof sourceProperties !== "object" || Array.isArray(sourceProperties)
    || !articles || options.candidates.length === 0 || options.candidates.length > 2) {
    throw new Error("Combined Dossier/editorial schema or article budget is invalid.");
  }
  const required = Array.isArray(input.schema.required)
    ? input.schema.required.filter((value): value is string => typeof value === "string")
    : [];
  return {
    ...input,
    instructions: input.instructions + "\n\nSECONDARY EDITORIAL OUTPUT — DO NOT CHANGE DOSSIER ADJUDICATION:\n"
      + options.editorialInstructions
      + "\nReturn the regular Dossier fields unchanged in meaning and an extra 'articles' array."
      + " If editorial support is insufficient, set articles to an empty array; never invent facts.",
    input: {
      ...(root as Record<string, unknown>),
      editorialCandidates: options.candidates.map(options.candidateInput),
    },
    schema: {
      ...input.schema,
      required: [...new Set([...required, "articles"])],
      properties: { ...(sourceProperties as Record<string, unknown>), articles },
    },
    // Keep the existing complex model; editorial consumes unused output
    // headroom, not another stage. Limit to 1-2 articles per invocation.
    maxOutputTokens: Math.min(7_500, Math.max(6_500, input.maxOutputTokens || 5_000)),
    maxAttempts: 1,
  };
}
