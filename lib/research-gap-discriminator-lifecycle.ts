import {
  RESEARCH_GAP_CAUSAL_DISCRIMINATOR_VERSION,
  type ResearchGapCausalDiscriminatorPlan,
} from "./research-gap-worker.ts";

export const RESEARCH_GAP_DISCRIMINATOR_LIFECYCLE_VERSION =
  "research-gap-discriminator-lifecycle/1" as const;

export type ResearchGapDiscriminatorLifecycleSnapshot = {
  contractVersion: typeof RESEARCH_GAP_DISCRIMINATOR_LIFECYCLE_VERSION;
  planSignature: string;
  baseEvidenceNeeded: string[];
  discriminators: string[];
  activeIndex: number;
  activeDiscriminator: string;
};

export type ResearchGapDiscriminatorTransition =
  | "INITIAL"
  | "PRESERVE"
  | "ADVANCE"
  | "EXHAUST"
  | "REOPEN_CHANGED_PLAN";

export type ResearchGapDiscriminatorDecision = {
  transition: ResearchGapDiscriminatorTransition;
  lifecycle: ResearchGapDiscriminatorLifecycleSnapshot;
  evidenceNeeded: string[];
  shouldRequeue: boolean;
  shouldClose: boolean;
  reason: string;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function strings(value: unknown, limit = 24) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(clean).filter(Boolean))].slice(0, limit);
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function integer(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function lifecycleFromPlan(
  plan: ResearchGapCausalDiscriminatorPlan,
  activeIndex: number,
): ResearchGapDiscriminatorLifecycleSnapshot {
  const boundedIndex = Math.max(0, Math.min(activeIndex, plan.discriminators.length - 1));
  const activeDiscriminator = plan.discriminators[boundedIndex]!;
  return {
    contractVersion: RESEARCH_GAP_DISCRIMINATOR_LIFECYCLE_VERSION,
    planSignature: plan.planSignature,
    baseEvidenceNeeded: [...plan.baseEvidenceNeeded],
    discriminators: [...plan.discriminators],
    activeIndex: boundedIndex,
    activeDiscriminator,
  };
}

function decision(
  transition: ResearchGapDiscriminatorTransition,
  lifecycle: ResearchGapDiscriminatorLifecycleSnapshot,
  input: {
    shouldRequeue?: boolean;
    shouldClose?: boolean;
    reason: string;
  },
): ResearchGapDiscriminatorDecision {
  return {
    transition,
    lifecycle,
    evidenceNeeded: [
      ...lifecycle.baseEvidenceNeeded,
      lifecycle.activeDiscriminator,
    ].filter((value, index, all) => all.indexOf(value) === index),
    shouldRequeue: input.shouldRequeue ?? false,
    shouldClose: input.shouldClose ?? false,
    reason: input.reason,
  };
}

export function researchGapDiscriminatorLifecycleFromPlan(
  researchPlan: unknown,
): ResearchGapDiscriminatorLifecycleSnapshot | null {
  const plan = record(researchPlan);
  const raw = record(plan?.causalDiscriminator);
  if (!raw) return null;
  if (raw.contractVersion !== RESEARCH_GAP_DISCRIMINATOR_LIFECYCLE_VERSION) return null;

  const planSignature = clean(raw.planSignature);
  const baseEvidenceNeeded = strings(raw.baseEvidenceNeeded, 12);
  const discriminators = strings(raw.discriminators, 4);
  const activeIndex = integer(raw.activeIndex);
  const activeDiscriminator = clean(raw.activeDiscriminator);
  if (
    !planSignature
    || discriminators.length === 0
    || activeIndex === null
    || activeIndex < 0
    || activeIndex >= discriminators.length
    || discriminators[activeIndex] !== activeDiscriminator
  ) return null;

  return {
    contractVersion: RESEARCH_GAP_DISCRIMINATOR_LIFECYCLE_VERSION,
    planSignature,
    baseEvidenceNeeded,
    discriminators,
    activeIndex,
    activeDiscriminator,
  };
}

export function selectResearchGapDiscriminatorLifecycleSource(input: {
  existingResearchPlan?: unknown;
  latestOccurrenceSnapshot?: unknown;
}) {
  if (researchGapDiscriminatorLifecycleFromPlan(input.existingResearchPlan)) {
    return input.existingResearchPlan ?? null;
  }
  if (researchGapDiscriminatorLifecycleFromPlan(input.latestOccurrenceSnapshot)) {
    return input.latestOccurrenceSnapshot ?? null;
  }
  return null;
}

export function validateResearchGapCausalDiscriminatorPlan(
  value: unknown,
): value is ResearchGapCausalDiscriminatorPlan {
  const plan = record(value);
  if (!plan) return false;
  const baseEvidenceNeeded = strings(plan.baseEvidenceNeeded, 12);
  const discriminators = strings(plan.discriminators, 4);
  return (
    plan.contractVersion === RESEARCH_GAP_CAUSAL_DISCRIMINATOR_VERSION
    && Boolean(clean(plan.planSignature))
    && discriminators.length >= 1
    && discriminators.length <= 4
    && Array.isArray(plan.baseEvidenceNeeded)
    && baseEvidenceNeeded.length === (plan.baseEvidenceNeeded as unknown[]).length
  );
}

export function decideResearchGapDiscriminatorLifecycle(input: {
  candidatePlan: ResearchGapCausalDiscriminatorPlan;
  existingStatus?: string | null;
  existingResearchPlan?: unknown;
  canonicalHandoffAdmitted?: boolean;
}): ResearchGapDiscriminatorDecision {
  if (!validateResearchGapCausalDiscriminatorPlan(input.candidatePlan)) {
    throw new Error("Invalid Research Gap causal discriminator plan.");
  }

  const current = input.candidatePlan;
  const status = clean(input.existingStatus).toUpperCase();
  const prior = researchGapDiscriminatorLifecycleFromPlan(input.existingResearchPlan);

  if (!status) {
    return decision("INITIAL", lifecycleFromPlan(current, 0), {
      reason: "New Investigation case starts with the first bounded causal discriminator.",
    });
  }

  if (status === "HANDED_OFF") {
    if (!prior) {
      return decision("PRESERVE", lifecycleFromPlan(current, 0), {
        reason: "Legacy handed-off case has no frozen discriminator lifecycle; fail closed rather than infer progress.",
      });
    }
    if (!input.canonicalHandoffAdmitted) {
      return decision("PRESERVE", prior, {
        reason: "Handed-off work cannot advance until the exact case UUID is present in admitted canonical Evidence.",
      });
    }
    if (prior.planSignature !== current.planSignature) {
      return decision("REOPEN_CHANGED_PLAN", lifecycleFromPlan(current, 0), {
        shouldRequeue: true,
        reason: "Canonical handoff closed the prior attempt, and the current Dossier now carries a materially changed discriminator plan.",
      });
    }
    const nextIndex = prior.activeIndex + 1;
    if (nextIndex >= current.discriminators.length) {
      return decision("EXHAUST", prior, {
        shouldClose: true,
        reason: "All bounded causal discriminators were returned through canonical handoff and the Investigation remains unresolved.",
      });
    }
    return decision("ADVANCE", lifecycleFromPlan(current, nextIndex), {
      shouldRequeue: true,
      reason: "Exact canonical handoff admitted the active discriminator; advance to the next bounded discriminator.",
    });
  }

  if (status === "CLOSED") {
    if (prior?.planSignature === current.planSignature) {
      return decision("EXHAUST", prior, {
        shouldClose: true,
        reason: "The same exhausted discriminator plan remains current; do not reopen it.",
      });
    }
    return decision("REOPEN_CHANGED_PLAN", lifecycleFromPlan(current, 0), {
      shouldRequeue: true,
      reason: "A materially changed Dossier discriminator plan may reopen an exhausted case.",
    });
  }

  if (prior && ["CLAIMED", "RESEARCHING", "COMPLETED"].includes(status)) {
    return decision("PRESERVE", prior, {
      reason: "In-flight or completed-but-not-handed-off work preserves the exact frozen discriminator it researched.",
    });
  }

  if (prior?.planSignature === current.planSignature) {
    return decision("PRESERVE", prior, {
      reason: "Queued work preserves the active discriminator already frozen into its research plan.",
    });
  }

  return decision(prior ? "REOPEN_CHANGED_PLAN" : "INITIAL", lifecycleFromPlan(current, 0), {
    shouldRequeue: status === "CLOSED",
    reason: prior
      ? "The queued Dossier plan changed before execution; restart from its first discriminator."
      : "No prior discriminator lifecycle is frozen; start at the first bounded discriminator.",
  });
}
