import type { DivergenceEvidenceRecruitment } from "./divergence-evidence-recruitment.ts";

export const DIVERGENCE_RECRUITMENT_LIFECYCLE_VERSION =
  "divergence-recruitment-lifecycle/1" as const;

export type DivergenceRecruitmentDebtState = {
  id: string;
  debtKey: string;
  status: string;
  metadata: Record<string, unknown> | null;
};

export type DivergenceRecruitmentHandoffCase = {
  id: string;
  sourceRef: string;
  status: string;
  handedOffAt: string | null;
  evidenceNeeded: string[];
};

export type DivergenceRecruitmentLifecycleAction =
  | {
      contractVersion: typeof DIVERGENCE_RECRUITMENT_LIFECYCLE_VERSION;
      kind: "RESOLVE";
      debtId: string;
      debtKey: string;
      caseId: string;
      resolutionNote: string;
      processedCaseIds: string[];
      terminalState: "RESOLVED_BY_CANONICAL_EVIDENCE";
      terminalPlanSignature: string | null;
    }
  | {
      contractVersion: typeof DIVERGENCE_RECRUITMENT_LIFECYCLE_VERSION;
      kind: "ADVANCE";
      debtId: string;
      debtKey: string;
      caseId: string;
      planSignature: string;
      activeEvidenceIndex: number;
      activeEvidenceNeeded: string[];
      remainingEvidenceNeeded: string[];
      processedCaseIds: string[];
      nextAction: string;
    }
  | {
      contractVersion: typeof DIVERGENCE_RECRUITMENT_LIFECYCLE_VERSION;
      kind: "EXHAUST";
      debtId: string;
      debtKey: string;
      caseId: string;
      resolutionNote: string;
      processedCaseIds: string[];
      terminalState: "BOUNDED_EXHAUSTED";
      terminalPlanSignature: string;
    };

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function strings(value: unknown, limit = 24) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(clean).filter(Boolean))].slice(0, limit);
}

function integer(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : fallback;
}

function metadataOf(debt: DivergenceRecruitmentDebtState) {
  return debt.metadata && typeof debt.metadata === "object" && !Array.isArray(debt.metadata)
    ? debt.metadata
    : {};
}

function sameEvidenceNeed(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function eligibleHandoffCases(input: {
  debt: DivergenceRecruitmentDebtState;
  cases: DivergenceRecruitmentHandoffCase[];
  canonicalHandoffCaseIds: ReadonlySet<string>;
}) {
  const metadata = metadataOf(input.debt);
  const processed = new Set(strings(metadata.processedCaseIds));
  const activeEvidenceNeeded = strings(metadata.activeEvidenceNeeded, 1);

  return input.cases
    .filter((item) =>
      item.sourceRef === input.debt.debtKey
      && item.status === "HANDED_OFF"
      && input.canonicalHandoffCaseIds.has(item.id)
      && !processed.has(item.id)
      && (
        activeEvidenceNeeded.length === 0
        || sameEvidenceNeed(item.evidenceNeeded, activeEvidenceNeeded)
      )
    )
    .sort((left, right) => {
      const leftAt = Date.parse(left.handedOffAt ?? "");
      const rightAt = Date.parse(right.handedOffAt ?? "");
      if (Number.isFinite(leftAt) && Number.isFinite(rightAt) && leftAt !== rightAt) {
        return leftAt - rightAt;
      }
      if (Number.isFinite(leftAt) !== Number.isFinite(rightAt)) {
        return Number.isFinite(leftAt) ? -1 : 1;
      }
      return left.id.localeCompare(right.id);
    });
}

export function planDivergenceRecruitmentLifecycle(input: {
  debts: DivergenceRecruitmentDebtState[];
  handoffCases: DivergenceRecruitmentHandoffCase[];
  canonicalHandoffCaseIds: ReadonlySet<string>;
  currentPlans: DivergenceEvidenceRecruitment[];
}): DivergenceRecruitmentLifecycleAction[] {
  const planByDebtKey = new Map(input.currentPlans.map((plan) => [plan.debtKey, plan]));
  const actions: DivergenceRecruitmentLifecycleAction[] = [];

  for (const debt of input.debts) {
    if (debt.status !== "open" || !debt.debtKey.startsWith("divergence:")) continue;
    const metadata = metadataOf(debt);
    if (metadata.kind !== "canonical_divergence_recruitment") continue;

    const [handoff] = eligibleHandoffCases({
      debt,
      cases: input.handoffCases,
      canonicalHandoffCaseIds: input.canonicalHandoffCaseIds,
    });
    if (!handoff) continue;

    const processedCaseIds = [...new Set([
      ...strings(metadata.processedCaseIds),
      handoff.id,
    ])].slice(0, 24);
    const currentPlan = planByDebtKey.get(debt.debtKey) ?? null;

    if (!currentPlan) {
      actions.push({
        contractVersion: DIVERGENCE_RECRUITMENT_LIFECYCLE_VERSION,
        kind: "RESOLVE",
        debtId: debt.id,
        debtKey: debt.debtKey,
        caseId: handoff.id,
        resolutionNote:
          "Returned Research Gap evidence was admitted as canonical evidence and the current Hypothesis stage no longer requires bounded divergence recruitment.",
        processedCaseIds,
        terminalState: "RESOLVED_BY_CANONICAL_EVIDENCE",
        terminalPlanSignature: clean(metadata.planSignature) || null,
      });
      continue;
    }

    const debtPlanSignature = clean(metadata.planSignature);
    if (debtPlanSignature && debtPlanSignature !== currentPlan.planSignature) {
      continue;
    }

    const activeEvidenceIndex = integer(metadata.activeEvidenceIndex, 0);
    const nextIndex = activeEvidenceIndex + 1;
    const nextEvidence = clean(currentPlan.evidenceNeeded[nextIndex]);

    if (nextEvidence) {
      const remainingEvidenceNeeded = currentPlan.evidenceNeeded.slice(nextIndex + 1);
      actions.push({
        contractVersion: DIVERGENCE_RECRUITMENT_LIFECYCLE_VERSION,
        kind: "ADVANCE",
        debtId: debt.id,
        debtKey: debt.debtKey,
        caseId: handoff.id,
        planSignature: currentPlan.planSignature,
        activeEvidenceIndex: nextIndex,
        activeEvidenceNeeded: [nextEvidence],
        remainingEvidenceNeeded,
        processedCaseIds,
        nextAction: remainingEvidenceNeeded.length
          ? `Recruit only ${nextEvidence}; if still unresolved, then recruit ${remainingEvidenceNeeded[0]}.`
          : `Recruit only ${nextEvidence}; this is the final bounded discriminator for this plan.`,
      });
      continue;
    }

    actions.push({
      contractVersion: DIVERGENCE_RECRUITMENT_LIFECYCLE_VERSION,
      kind: "EXHAUST",
      debtId: debt.id,
      debtKey: debt.debtKey,
      caseId: handoff.id,
      resolutionNote:
        "All bounded discriminators for this divergence recruitment plan returned through canonical evidence, but the current Hypothesis stage still cannot resolve the mechanism. Automatic recruitment is exhausted for this unchanged plan.",
      processedCaseIds,
      terminalState: "BOUNDED_EXHAUSTED",
      terminalPlanSignature: currentPlan.planSignature,
    });
  }

  return actions;
}
