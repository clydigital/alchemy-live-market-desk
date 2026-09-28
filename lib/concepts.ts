import { getRegimeExplanation, type RegimeConcept } from "./regime-explanations.ts";
import { REGIME_DEFINITIONS, type RegimeSlug } from "./regimes.ts";

export type ConceptStatus = "active" | "deprecated";

export type CanonicalConcept = RegimeConcept & {
  version: number;
  status: ConceptStatus;
  aliases: string[];
  regimes: RegimeSlug[];
};

const EXTRA_ALIASES: Partial<Record<string, string[]>> = {
  "term-premium": ["term premium"],
  "real-yield": ["real yields", "tips real yield"],
  "treasury-buyback": ["treasury buybacks"],
  "rollover-risk": ["refinancing risk", "rollover risk"],
  "discount-rate": ["discount rate"],
  inference: ["ai inference"],
  hbm: ["high bandwidth memory", "high-bandwidth memory"],
  "training-v-inference": ["training vs inference", "training versus inference"],
  "ai-roic": ["ai infrastructure roic", "ai return on invested capital"],
  "export-controls": ["chip export controls"],
  "crack-spread": ["crack spreads"],
  distillates: ["diesel distillates"],
  "lng-benchmarks": ["ttf", "jkm", "ttf jkm"],
  chokepoint: ["chokepoint risk"],
  "reserve-diversification": ["reserve diversification"],
  "official-sector": ["official sector demand"],
  "gold-opportunity-cost": ["gold opportunity cost", "opportunity cost"],
  "market-breadth": ["breadth", "market participation"],
  "equal-weight": ["equal weight", "rsp"],
  "earnings-revisions": ["earnings revisions"],
  "duration-equity": ["long duration equity", "long-duration equities"],
};

function normaliseAlias(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sameDefinition(left: RegimeConcept, right: RegimeConcept) {
  return left.label === right.label
    && left.definition === right.definition
    && left.whyItMatters === right.whyItMatters
    && JSON.stringify(left.watch) === JSON.stringify(right.watch);
}

const conceptMap = new Map<string, CanonicalConcept>();

for (const regime of REGIME_DEFINITIONS) {
  const explanation = getRegimeExplanation(regime.slug);
  for (const concept of explanation?.concepts || []) {
    const existing = conceptMap.get(concept.key);
    if (existing) {
      if (!sameDefinition(existing, concept)) {
        throw new Error(`Conflicting Concept definition for ${concept.key}`);
      }
      if (!existing.regimes.includes(regime.slug)) existing.regimes.push(regime.slug);
      continue;
    }

    conceptMap.set(concept.key, {
      ...concept,
      version: 1,
      status: "active",
      aliases: [...new Set(EXTRA_ALIASES[concept.key] || [])],
      regimes: [regime.slug],
    });
  }
}

const aliasMap = new Map<string, string>();

for (const concept of conceptMap.values()) {
  for (const alias of [concept.key, concept.label, ...concept.aliases]) {
    const normalised = normaliseAlias(alias);
    if (!normalised) continue;
    const existing = aliasMap.get(normalised);
    if (existing && existing !== concept.key) {
      throw new Error(`Concept alias collision: ${alias}`);
    }
    aliasMap.set(normalised, concept.key);
  }
}

export function listConcepts(): CanonicalConcept[] {
  return [...conceptMap.values()]
    .map((concept) => ({ ...concept, aliases: [...concept.aliases], regimes: [...concept.regimes] }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function getConcept(value: string): CanonicalConcept | null {
  const key = aliasMap.get(normaliseAlias(value));
  if (!key) return null;
  const concept = conceptMap.get(key);
  return concept ? { ...concept, aliases: [...concept.aliases], regimes: [...concept.regimes] } : null;
}
