export type Criticality = "critical" | "important" | "supporting";

export interface PublicationGateResult {
  publicationEligible: boolean;
  researchCompleteness: number;
  missingCritical: boolean;
  missingImportant: boolean;
  missingSupporting: boolean;
  unknownRequirementIds: string[];
  outOfScopeRequirementIds: string[];
  reasons: string[];
  warnings: string[];
}

// Canonical publication policy keyed by public.research_story_requirements.requirement_key.
// Every active required database key must have an explicit policy before Challenger can use it.
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

export type PublicationRequirement = {
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

export function publicationRequirementRegistry(records: CanonicalRequirementRecord[]): PublicationRequirement[] {
  const seen = new Set<string>();
  return records.map((record) => {
    if (!isStableRequirementId(record.requirementId)) {
      throw new Error(`No publication criticality policy exists for canonical requirement key: ${record.requirementId}`);
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

export function evaluatePublicationGate({
  candidate,
  decisiveCount,
  independenceGroupsCount,
  hasHighGradeSource,
  challengerVerdict,
  missingRequirements = [],
  unknownRequirementIds = [],
  outOfScopeRequirementIds = [],
}: {
  candidate: {
    confidence: number;
    qualificationScore: number;
    publicationEligible: boolean;
  };
  decisiveCount: number;
  independenceGroupsCount: number;
  hasHighGradeSource: boolean;
  challengerVerdict: string | null;
  missingRequirements?: Array<{ requirementId: string }>;
  unknownRequirementIds?: string[];
  outOfScopeRequirementIds?: string[];
}): PublicationGateResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const validated = validateRequirementIds(missingRequirements.map((requirement) => requirement.requirementId));
  const unknown = [...new Set([...validated.unknown, ...unknownRequirementIds.map((id) => id.trim()).filter(Boolean)])];
  const outOfScope = [...new Set(outOfScopeRequirementIds.map((id) => id.trim()).filter(Boolean))];
  const totalObligations = decisiveCount + validated.known.length + unknown.length;
  const researchCompleteness = totalObligations > 0
    ? Math.round((decisiveCount / totalObligations) * 100)
    : 100;

  const missingCriticalDetails: string[] = [];
  const missingImportantDetails: string[] = [];
  const missingSupportingDetails: string[] = [];

  for (const requirementId of validated.known) {
    const requirement = STABLE_REQUIREMENTS[requirementId];
    const detail = `${requirement.name} (ID: ${requirementId})`;
    if (requirement.criticality === "critical") missingCriticalDetails.push(detail);
    else if (requirement.criticality === "important") missingImportantDetails.push(detail);
    else missingSupportingDetails.push(detail);
  }

  const missingCritical = missingCriticalDetails.length > 0;
  const missingImportant = missingImportantDetails.length > 0;
  const missingSupporting = missingSupportingDetails.length > 0;

  if (unknown.length) reasons.push(`unknown requirement IDs returned by Challenger: ${unknown.join(", ")}`);
  if (outOfScope.length) warnings.push(`ignored canonical requirement IDs outside this hypothesis Story scope: ${outOfScope.join(", ")}`);
  if (missingCritical) reasons.push(`missing critical evidence: ${missingCriticalDetails.join("; ")}`);
  if (candidate.qualificationScore < 70) reasons.push("qualification below 70");
  if (candidate.confidence < 60) reasons.push("confidence below 60");
  if (challengerVerdict !== "promote") reasons.push("Challenger did not promote the hypothesis");
  if (!candidate.publicationEligible) reasons.push("model marked publication ineligible");
  if (decisiveCount < 3) reasons.push("needs 3 decisive evidence records");
  if (independenceGroupsCount < 3) reasons.push("needs 3 independent source groups");
  if (!hasHighGradeSource) reasons.push("needs at least one Tier 1-2 source");

  return {
    publicationEligible: reasons.length === 0,
    researchCompleteness,
    missingCritical,
    missingImportant,
    missingSupporting,
    unknownRequirementIds: unknown,
    outOfScopeRequirementIds: outOfScope,
    reasons,
    warnings,
  };
}

export function evaluateRuntimePublicationGate({
  candidate,
  decisiveCount,
  independenceGroupsCount,
  hasHighGradeSource,
  challenger,
}: {
  candidate: {
    confidence: number;
    qualificationScore: number;
    publicationEligible: boolean;
  };
  decisiveCount: number;
  independenceGroupsCount: number;
  hasHighGradeSource: boolean;
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
  return evaluatePublicationGate({
    candidate,
    decisiveCount,
    independenceGroupsCount,
    hasHighGradeSource,
    challengerVerdict: challenger?.verdict ?? null,
    missingRequirements: validated.known.map((requirementId) => ({ requirementId })),
    unknownRequirementIds: [...validated.unknown, ...(challenger?.unknownRequirementIds ?? [])],
    outOfScopeRequirementIds: [...validated.outOfScope, ...(challenger?.outOfScopeRequirementIds ?? [])],
  });
}

export function evaluateIntakeStatus(
  item: {
    itemType: string;
    transcriptStatus?: "ready" | "missing" | "unavailable" | "not_applicable";
    recommendedAction: string;
  },
  publishGateOpen: boolean,
): "rejected" | "blocked" | "published" | "accepted" {
  if (item.recommendedAction === "ignore") return "rejected";
  if (item.itemType === "video" && item.transcriptStatus !== "ready") return "blocked";
  if (item.recommendedAction === "recalibrate_story" && !publishGateOpen) return "blocked";
  if (item.recommendedAction === "recalibrate_story") return "published";
  return "accepted";
}