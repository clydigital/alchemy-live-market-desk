export const DIVERGENCE_EVIDENCE_RECRUITMENT_VERSION =
  "divergence-evidence-recruitment/1" as const;

export type DivergenceRecruitmentBelief = {
  id: string;
  statement: string;
  affectedAssets: string[];
  primaryCategory: string | null;
  themes: string[];
};

export type DivergenceRecruitmentDivergence = {
  id: string;
  marketBeliefId: string;
  observedChange: string;
  expectedChange: string | null;
  magnitude: number;
  persistenceScore: number;
};

export type DivergenceRecruitmentHypothesis = {
  id: string;
  divergenceId: string | null;
  confidence: number;
  evidenceForIds: string[];
  evidenceAgainstIds: string[];
};

export type DivergenceRecruitmentContext = {
  divergences: DivergenceRecruitmentDivergence[];
  beliefs: DivergenceRecruitmentBelief[];
  hypotheses: DivergenceRecruitmentHypothesis[];
};

export function mergeDivergenceRecruitmentContext(
  persisted: DivergenceRecruitmentContext,
  current: DivergenceRecruitmentContext,
): DivergenceRecruitmentContext {
  const mergeById = <T extends { id: string }>(older: T[], newer: T[]) => {
    const rows = new Map<string, T>(
      older.map((row) => [row.id, row] as const),
    );
    for (const row of newer) rows.set(row.id, row);
    return [...rows.values()];
  };

  return {
    divergences: mergeById(persisted.divergences, current.divergences),
    beliefs: mergeById(persisted.beliefs, current.beliefs),
    hypotheses: mergeById(persisted.hypotheses, current.hypotheses),
  };
}

export type DivergenceEvidenceRecruitment = {
  contractVersion: typeof DIVERGENCE_EVIDENCE_RECRUITMENT_VERSION;
  divergenceId: string;
  marketBeliefId: string;
  debtKey: string;
  severity: "high";
  question: string;
  reason: string;
  nextAction: string;
  evidenceNeeded: string[];
  magnitude: number;
  persistenceScore: number;
  resolutionState:
    | "NO_CAUSAL_HYPOTHESIS"
    | "COMPETING_HYPOTHESES"
    | "LOW_CONFIDENCE"
    | "CONFLICTED_EVIDENCE";
};

function clean(value: string | null | undefined) {
  return (value ?? "").trim();
}

function normalise(value: string) {
  return value.trim().toLowerCase();
}

function material(divergence: DivergenceRecruitmentDivergence) {
  return divergence.magnitude >= 65
    || (divergence.magnitude >= 50 && divergence.persistenceScore >= 65);
}

function resolutionState(
  divergence: DivergenceRecruitmentDivergence,
  hypotheses: DivergenceRecruitmentHypothesis[],
): DivergenceEvidenceRecruitment["resolutionState"] | null {
  const linked = hypotheses.filter((hypothesis) => hypothesis.divergenceId === divergence.id);

  if (!linked.length) return "NO_CAUSAL_HYPOTHESIS";
  if (linked.length > 1) return "COMPETING_HYPOTHESES";

  const hypothesis = linked[0]!;
  if (hypothesis.evidenceAgainstIds.length > 0) return "CONFLICTED_EVIDENCE";
  if (hypothesis.confidence < 70) return "LOW_CONFIDENCE";

  return null;
}

function domainFor(belief: DivergenceRecruitmentBelief) {
  const haystack = [
    belief.primaryCategory ?? "",
    ...belief.themes,
    ...belief.affectedAssets,
  ].map(normalise).join(" ");

  if (/(credit|hyg|lqd|high yield|investment grade|spread|funding)/.test(haystack)) {
    return "credit" as const;
  }
  if (/(wti|brent|crude|oil|xle|energy|diesel|gasoline)/.test(haystack)) {
    return "oil" as const;
  }
  if (/(xau|gold|precious)/.test(haystack)) {
    return "gold" as const;
  }
  if (/(treasury|rates|yield|us02y|us2y|us05y|us5y|us10y|us20y|us30y|fed|duration)/.test(haystack)) {
    return "rates" as const;
  }
  if (/(fx|forex|dxy|usd|eur|gbp|jpy|aud|cad|chf|nzd|cny|cnh)/.test(haystack)) {
    return "fx" as const;
  }
  if (/(equity|equities|spx|s&p|qqq|nasdaq|ndx|dow|russell|iwm|stock|stocks|growth)/.test(haystack)) {
    return "equity" as const;
  }
  return "cross_asset" as const;
}

function boundedEvidenceNeeds(domain: ReturnType<typeof domainFor>): string[] {
  switch (domain) {
    case "rates":
      return [
        "real yields and breakevens around the divergence window",
        "curve, term-premium or meeting-pricing context only if the first test remains unresolved",
      ];
    case "gold":
      return [
        "real yields, DXY and reaction timing around the divergence window",
        "open interest, positioning or safe-haven confirmation only if the first test remains unresolved and a reliable source exists",
      ];
    case "equity":
      return [
        "VIX and index breadth around the divergence window",
        "equal-weight, sector leadership or options/expiry context only if the first test remains unresolved",
      ];
    case "oil":
      return [
        "refined-product cracks, curve shape and inventory confirmation around the divergence window",
        "tanker, insurance or physical-flow evidence only if the first test remains unresolved",
      ];
    case "fx":
      return [
        "rate differentials and policy repricing around the divergence window",
        "risk sentiment, positioning or commodity linkage only if the first test remains unresolved",
      ];
    case "credit":
      return [
        "credit spreads and funding stress around the divergence window",
        "issuance, refinancing or equity confirmation only if the first test remains unresolved",
      ];
    default:
      return [
        "cross-asset confirmation and reaction timing around the divergence window",
      ];
  }
}

function stablePart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export function planDivergenceEvidenceRecruitment(input: {
  divergences: DivergenceRecruitmentDivergence[];
  beliefs: DivergenceRecruitmentBelief[];
  hypotheses: DivergenceRecruitmentHypothesis[];
}): DivergenceEvidenceRecruitment[] {
  const beliefById = new Map(input.beliefs.map((belief) => [belief.id, belief]));

  return input.divergences.flatMap((divergence) => {
    if (!material(divergence)) return [];

    const state = resolutionState(divergence, input.hypotheses);
    if (!state) return [];

    const belief = beliefById.get(divergence.marketBeliefId);
    if (!belief) return [];

    const evidenceNeeded = boundedEvidenceNeeds(domainFor(belief)).slice(0, 2);
    const expected = clean(divergence.expectedChange);
    const observed = clean(divergence.observedChange);
    const question = expected
      ? `Why did the observed reaction (${observed}) diverge from the expected reaction (${expected})?`
      : `What mechanism best explains the material observed reaction (${observed})?`;
    const reason = `Material canonical divergence remains causally unresolved after Hypothesis: ${state}.`;
    const nextAction = evidenceNeeded.length > 1
      ? `Recruit only ${evidenceNeeded[0]}; if still unresolved, then recruit ${evidenceNeeded[1]}.`
      : `Recruit only ${evidenceNeeded[0]}.`;

    return [{
      contractVersion: DIVERGENCE_EVIDENCE_RECRUITMENT_VERSION,
      divergenceId: divergence.id,
      marketBeliefId: divergence.marketBeliefId,
      debtKey: `divergence:${stablePart(divergence.id)}`,
      severity: "high" as const,
      question,
      reason,
      nextAction,
      evidenceNeeded,
      magnitude: divergence.magnitude,
      persistenceScore: divergence.persistenceScore,
      resolutionState: state,
    }];
  }).slice(0, 4);
}
