import type { JsonSchema } from "./openai.ts";
import { STORY_SYNTHESIS_SCHEMA, type StorySynthesisOutput } from "./schemas.ts";
import type { VisualPlanV1 } from "./story-reasoning.ts";
import type { StorySynthesisNextTestSelectionV1 } from "./story-synthesis-plan.ts";

export type StorySynthesisWithPlanOutputV1 = {
  candidates: Array<StorySynthesisOutput["candidates"][number] & {
    nextTestSelection: StorySynthesisNextTestSelectionV1;
    visualPlan: VisualPlanV1[];
  }>;
};

const nullableString = { type: ["string", "null"] };
const stringArray = { type: "array", items: { type: "string" } };

const canonicalSeriesRefSchema = {
  type: "object",
  additionalProperties: false,
  required: ["seriesId", "label", "geography", "transform", "role"],
  properties: {
    seriesId: { type: "string" },
    label: { type: "string" },
    geography: nullableString,
    transform: { type: "string", enum: ["level", "change", "yoy", "mom", "return", "spread", "indexed"] },
    role: { type: "string", enum: ["driver", "asset", "benchmark", "observed", "expected", "spread"] },
  },
};

const canonicalEntityRefSchema = {
  type: "object",
  additionalProperties: false,
  required: ["entityId", "label", "geography", "evidenceIds"],
  properties: {
    entityId: { type: "string" },
    label: { type: "string" },
    geography: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["kind", "countryCode"],
          properties: {
            kind: { type: "string", enum: ["country"] },
            countryCode: { type: "string" },
          },
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["kind", "lat", "lon"],
          properties: {
            kind: { type: "string", enum: ["coordinate"] },
            lat: { type: "number", minimum: -90, maximum: 90 },
            lon: { type: "number", minimum: -180, maximum: 180 },
          },
        },
      ],
    },
    evidenceIds: stringArray,
  },
};

const conditionRefSchema = {
  anyOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "index"],
      properties: {
        kind: { type: "string", enum: ["confirmation"] },
        index: { type: "integer", minimum: 0 },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind", "index"],
      properties: {
        kind: { type: "string", enum: ["invalidation"] },
        index: { type: "integer", minimum: 0 },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["kind"],
      properties: {
        kind: { type: "string", enum: ["next_test"] },
      },
    },
  ],
};

const visualPlanItemSchema = {
  anyOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["id", "title", "type", "edgeIds"],
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        type: { type: "string", enum: ["linear_chain"] },
        edgeIds: stringArray,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["id", "title", "type", "edgeIds", "loopClosureEdgeId"],
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        type: { type: "string", enum: ["feedback_loop"] },
        edgeIds: stringArray,
        loopClosureEdgeId: { type: "string" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["id", "title", "type", "edgeIds", "entities", "flowLabel"],
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        type: { type: "string", enum: ["money_or_commodity_flow"] },
        edgeIds: stringArray,
        entities: { type: "array", items: canonicalEntityRefSchema },
        flowLabel: { type: "string" },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["id", "title", "type", "entities", "connectionEdgeIds"],
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        type: { type: "string", enum: ["entity_map"] },
        entities: { type: "array", items: canonicalEntityRefSchema },
        connectionEdgeIds: stringArray,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["id", "title", "type", "series", "expectedRelationship", "evidenceIds", "window"],
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        type: { type: "string", enum: ["divergence_chart"] },
        series: { type: "array", items: canonicalSeriesRefSchema },
        expectedRelationship: { type: "string", enum: ["positive", "inverse", "divergent", "none_asserted"] },
        evidenceIds: stringArray,
        window: {
          type: "object",
          additionalProperties: false,
          required: ["start", "end", "observations"],
          properties: {
            start: nullableString,
            end: nullableString,
            observations: { type: ["integer", "null"], minimum: 0 },
          },
        },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["id", "title", "type", "beforeClaimIds", "afterClaimIds", "changeEvidenceIds", "series"],
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        type: { type: "string", enum: ["before_after"] },
        beforeClaimIds: stringArray,
        afterClaimIds: stringArray,
        changeEvidenceIds: stringArray,
        series: { type: "array", items: canonicalSeriesRefSchema },
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["id", "title", "type", "rootClaimId", "branches"],
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        type: { type: "string", enum: ["decision_tree"] },
        rootClaimId: { type: "string" },
        branches: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["conditionRef", "outcomeClaimIds"],
            properties: {
              conditionRef: conditionRefSchema,
              outcomeClaimIds: stringArray,
            },
          },
        },
      },
    },
  ],
};

const base = STORY_SYNTHESIS_SCHEMA as Record<string, any>;
const candidates = base.properties.candidates as Record<string, any>;
const candidate = candidates.items as Record<string, any>;

export const STORY_SYNTHESIS_WITH_PLAN_SCHEMA: JsonSchema = {
  ...base,
  properties: {
    ...base.properties,
    candidates: {
      ...candidates,
      items: {
        ...candidate,
        required: [...candidate.required, "nextTestSelection", "visualPlan"],
        properties: {
          ...candidate.properties,
          title: {
            ...candidate.properties.title,
            description: "Durable persistent Story identity, not the latest event headline. Name the continuing market theme or question broadly enough to accept future developments. Put the newest event-specific wording in whatChanged and the append-only Story event instead.",
          },
          nextTestSelection: {
            anyOf: [
              {
                type: "object",
                additionalProperties: false,
                required: ["label", "catalystRef"],
                properties: {
                  label: { type: "string" },
                  catalystRef: nullableString,
                },
              },
              { type: "null" },
            ],
          },
          visualPlan: {
            type: "array",
            maxItems: 4,
            items: visualPlanItemSchema,
          },
        },
      },
    },
  },
} as JsonSchema;
