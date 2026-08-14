export type Criticality = "critical" | "important" | "supporting";

export type ResearchState = "SUPPORTED" | "DEVELOPING" | "CONTESTED" | "EARLY";

export interface ResearchStateResult {
  researchState: ResearchState;
  researchCompleteness: number;
  missingCritical: boolean;
  missingImportant: boolean;
  missingSupporting: boolean;
  missingRequirementIds: StableRequirementId[];
  missingCriticalRequirementIds: StableRequirementId[];
  missingImportantRequirementIds: StableRequirementId[];
  missingSupportingRequirementIds: StableRequirementId[];
  missingEvidence: string[];
  unknownRequirementIds: string[];
  outOfScopeRequirementIds: string[];
  decisiveEvidenceCount: number;
  independentSourceGroupCount: number;
  hasTierOneOrTwoSource: boolean;
  challengerVerdict: string | null;
  warnings: string[];
}

export type CandidateIntegrityResult = {
  publishable: boolean;
  structuralReasons: string[];
};

// Canonical research policy keyed by public.research_story_requirements.requirement_key.
// Every active required database key must have an explicit criticality policy before Challenger can use it.
// Criticality describes research priority, never permission to publish.
export const STABLE_REQUIREMENTS = {
  "contradiction-recheck": { name: "Re-evaluate strongest contradiction", criticality: "important" },
  "next-test-recheck": { name: "Re-evaluate next deciding test", criticality: "important" },
  "front-end-yields": { name: "US front-end yield confirmation", criticality: "critical" },
  "july-cpi": { name: "July CPI actual vs forecast vs previous", criticality: "critical" },
  "policy-pricing": { name: "September Fed policy pricing", criticality: "critical" },
  "labour-confirmation": { name: "Labour deterioration confirmation", criticality: "important" },
  "attack-incidents": { name: "Tanker / commercial shipping attack incidence", criticality: "critical" },
  "carrier-resumptions": { name: "Major carrier resumptions / suspensions", criticality: "critical" },
  "formal-deal-terms": { name: "Formal Iran-Oman / US-linked agreement terms", criticality: "critical" },
  "hormuz-commercial-transits": { name: "Hormuz commercial vessel transits", criticality: "critical" },
  "eia-weekly-balance": { name: "EIA weekly petroleum balance", criticality: "important" },
  "freight-insurance-premia": { name: "Hormuz freight and insurance premia", criticality: "important" },
  "diesel-crack": { name: "Diesel crack spread", criticality: "critical" },
  "gasoline-crack": { name: "Gasoline crack spread", criticality: "critical" },
  "crude-benchmark": { name: "WTI / Brent benchmark direction", criticality: "important" },
  "hormuz-flow-link": { name: "Hormuz flow confirmation", criticality: "important" },
  "product-inventories": { name: "US gasoline and distillate inventories", criticality: "important" },
  "refinery-runs": { name: "US refinery utilisation / runs", criticality: "important" },
  "mof-intervention": { name: "Japan MOF intervention / rate-check communication", criticality: "critical" },
  "us-japan-2y-spread": { name: "US-Japan 2Y yield spread", criticality: "critical" },
  "usd-jpy-price": { name: "USDJPY trend / persistence", criticality: "critical" },
  "boj-policy": { name: "BoJ policy / communication", criticality: "important" },
  "japan-securities-flows": { name: "Japan securities / repatriation flows", criticality: "important" },
  "yen-cross-breadth": { name: "JPY cross breadth: AUDJPY / GBPJPY / others", criticality: "critical" },
} as const satisfies Record<string, { name: string; criticality: Criticality }>;

export type StableRequirementId = keyof typeof STABLE_REQUIREMENTS;

export type ResearchRequirement = {
  requirementId: StableRequirementId;
  name: string;
  criticality: Criticality;
  storyId: string;
  storySlug: string;
};

export type CanonicalRequirementRecord = {
  requirementId: string;
  name: string;
  storyId: string;
  storySlug: string;
};

export const STABLE_REQUIREMENT_IDS = Object.keys(STABLE_REQUIREMENTS) as StableRequirementId[];

export function isStableRequirementId(value: string): value is StableRequirementId {
  return Object.prototype.hasOwnProperty.call(STABLE_REQUIREMENTS, value);
}

export function researchRequirementRegistry(records: CanonicalRequirementRecord[]): ResearchRequirement[] {
  const seen = new Set<string>();
  return records.map((record) => {
    if (!isStableRequirementId(record.requirementId)) {
      throw new Error(`No research criticality policy exists for canonical requirement key: ${record.requirementId}`);
    }
    const identity = `${record.storyId}:${record.requirementId}`;
    if (seen.has(identity)) throw new Error(`Duplicate canonical Story requirement: ${identity}`);
    seen.add(identity);
    return {
      ...record,
      requirementId: record.requirementId,
      name: record.name || STABLE_REQUIREMENTS[record.requirementId].name,
      criticality: STABLE_REQUIREMENTS[record.requirementId].criticality,
    };
  });
}

export function validateRequirementIds(
  ids: readonly string[],
  knownIds: ReadonlySet<string> = new Set(STABLE_REQUIREMENT_IDS),
) {
  const known: StableRequirementId[] = [];
  const unknown: string[] = [];
  for (const id of [...new Set(ids.map((value) => value.trim()).filter(Boolean))]) {
    if (knownIds.has(id) && isStableRequirementId(id)) known.push(id);
    else unknown.push(id);
  }
  return { known, unknown };
}

export function validateScopedRequirementIds(
  ids: readonly string[],
  knownIds: ReadonlySet<string>,
  allowedIds: ReadonlySet<string>,
) {
  const validated = validateRequirementIds(ids, knownIds);
  return {
    known: validated.known.filter((id) => allowedIds.has(id)),
    unknown: validated.unknown,
    outOfScope: validated.known.filter((id) => !allowedIds.has(id)),
  };
}

export function getRequirementCriticality(requirementId: string): Criticality | null {
  return isStableRequirementId(requirementId) ? STABLE_REQUIREMENTS[requirementId].criticality : null;
}

function descriptiveState({
  challengerVerdict,
  missingCritical,
  missingImportant,
  decisiveEvidenceCount,
  independentSourceGroupCount,
}: {
  challengerVerdict: string | null;
  missingCritical: boolean;
  missingImportant: boolean;
  decisiveEvidenceCount: number;
  independentSourceGroupCount: number;
}): ResearchState {
  if (challengerVerdict === "reject" || challengerVerdict === "downgrade") return "CONTESTED";
  if (challengerVerdict === "watch" || missingCritical || missingImportant) return "DEVELOPING";
  if (!challengerVerdict || decisiveEvidenceCount < 2 || independentSourceGroupCount < 2) return "EARLY";
  return "SUPPORTED";
}

export function evaluateResearchState({
  decisiveEvidenceCount,
  independentSourceGroupCount,
  hasTierOneOrTwoSource,
  challengerVerdict,
  missingRequirements = [],
  missingEvidence = [],
  unknownRequirementIds = [],
  outOfScopeRequirementIds = [],
}: {
  decisiveEvidenceCount: number;
  independentSourceGroupCount: number;
  hasTierOneOrTwoSource: boolean;
  challengerVerdict: string | null;
  missingRequirements?: Array<{ requirementId: string }>;
  missingEvidence?: string[];
  unknownRequirementIds?: string[];
  outOfScopeRequirementIds?: string[];
}): ResearchStateResult {
  const warnings: string[] = [];
  const validated = validateRequirementIds(missingRequirements.map((requirement) => requirement.requirementId));
  const unknown = [...new Set([...validated.unknown, ...unknownRequirementIds.map((id) => id.trim()).filter(Boolean)])];
  const outOfScope = [...new Set(outOfScopeRequirementIds.map((id) => id.trim()).filter(Boolean))];
  const totalKnownObligations = decisiveEvidenceCount + validated.known.length;
  const researchCompleteness = totalKnownObligations > 0
    ? Math.round((decisiveEvidenceCount / totalKnownObligations) * 100)
    : 100;

  const missingCriticalRequirementIds = validated.known.filter((id) => STABLE_REQUIREMENTS[id].criticality === "critical");
  const missingImportantRequirementIds = validated.known.filter((id) => STABLE_REQUIREMENTS[id].criticality === "important");
  const missingSupportingRequirementIds = validated.known.filter((id) => getRequirementCriticality(id) === "supporting");
  const missingCritical = missingCriticalRequirementIds.length > 0;
  const missingImportant = missingImportantRequirementIds.length > 0;
  const missingSupporting = missingSupportingRequirementIds.length > 0;

  if (unknown.length) warnings.push(`unknown requirement IDs returned by Challenger: ${unknown.join(", ")}`);
  if (outOfScope.length) warnings.push(`ignored canonical requirement IDs outside this hypothesis Story scope: ${outOfScope.join(", ")}`);
  if (missingCritical) warnings.push(`missing critical research: ${missingCriticalRequirementIds.join(", ")}`);
  if (missingImportant) warnings.push(`missing important research: ${missingImportantRequirementIds.join(", ")}`);
  if (missingSupporting) warnings.push(`missing supporting research: ${missingSupportingRequirementIds.join(", ")}`);
  if (challengerVerdict && challengerVerdict !== "promote") warnings.push(`Challenger verdict is ${challengerVerdict}; the verdict informs research state but does not decide publication`);
  if (decisiveEvidenceCount < 3) warnings.push(`source depth: ${decisiveEvidenceCount} decisive evidence record(s)`);
  if (independentSourceGroupCount < 3) warnings.push(`corroboration depth: ${independentSourceGroupCount} independent source group(s)`);
  if (!hasTierOneOrTwoSource) warnings.push("source depth: no Tier 1-2 source is present");

  return {
    researchState: descriptiveState({
      challengerVerdict,
      missingCritical,
      missingImportant,
      decisiveEvidenceCount,
      independentSourceGroupCount,
    }),
    researchCompleteness,
    missingCritical,
    missingImportant,
    missingSupporting,
    missingRequirementIds: validated.known,
    missingCriticalRequirementIds,
    missingImportantRequirementIds,
    missingSupportingRequirementIds,
    missingEvidence: [...new Set(missingEvidence.map((value) => value.trim()).filter(Boolean))],
    unknownRequirementIds: unknown,
    outOfScopeRequirementIds: outOfScope,
    decisiveEvidenceCount,
    independentSourceGroupCount,
    hasTierOneOrTwoSource,
    challengerVerdict,
    warnings,
  };
}

export function evaluateRuntimeResearchState({
  decisiveEvidenceCount,
  independentSourceGroupCount,
  hasTierOneOrTwoSource,
  challenger,
}: {
  decisiveEvidenceCount: number;
  independentSourceGroupCount: number;
  hasTierOneOrTwoSource: boolean;
  challenger: {
    verdict: string;
    missingRequirementIds: string[];
    allowedRequirementIds: string[];
    unknownRequirementIds?: string[];
    outOfScopeRequirementIds?: string[];
    missingEvidence?: string[];
  } | null | undefined;
}) {
  const knownIds = new Set(STABLE_REQUIREMENT_IDS);
  const allowedIds = new Set(challenger?.allowedRequirementIds ?? []);
  const validated = validateScopedRequirementIds(challenger?.missingRequirementIds ?? [], knownIds, allowedIds);
  return evaluateResearchState({
    decisiveEvidenceCount,
    independentSourceGroupCount,
    hasTierOneOrTwoSource,
    challengerVerdict: challenger?.verdict ?? null,
    missingRequirements: validated.known.map((requirementId) => ({ requirementId })),
    missingEvidence: challenger?.missingEvidence ?? [],
    unknownRequirementIds: [...validated.unknown, ...(challenger?.unknownRequirementIds ?? [])],
    outOfScopeRequirementIds: [...validated.outOfScope, ...(challenger?.outOfScopeRequirementIds ?? [])],
  });
}

export function evaluateCandidateIntegrity({
  decisiveEvidenceCount,
  noveltyClass,
}: {
  decisiveEvidenceCount: number;
  noveltyClass: string;
}): CandidateIntegrityResult {
  const structuralReasons: string[] = [];
  if (decisiveEvidenceCount < 1) structuralReasons.push("no usable traceable decisive evidence");
  if (noveltyClass === "duplicate" || noveltyClass === "insufficient_novelty") {
    structuralReasons.push("duplicate or no material new state");
  }
  return { publishable: structuralReasons.length === 0, structuralReasons };
}
export function evaluateIntakeStatus(item: {
  itemType: string;
  transcriptStatus?: "ready" | "missing" | "unavailable" | "not_applicable";
  recommendedAction: string;
  evidence?: unknown[];
}): "rejected" | "blocked" | "published" | "accepted" {
  if (item.recommendedAction === "ignore") return "rejected";
  if (item.itemType === "video" && item.transcriptStatus !== "ready") return "blocked";
  if (item.recommendedAction === "recalibrate_story" && item.evidence?.length) return "published";
  return "accepted";
}