import type { ResearchGapCausalDiscriminatorPlan } from "./research-gap-worker.ts";

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

export type ResearchGapDiscriminatorDecision = {
  transition:
    | "INITIAL"
    | "PRESERVE"
    | "ADVANCE"
    | "EXHAUST"
    | "REOPEN_CHANGED_PLAN";
  lifecycle: ResearchGapDiscriminatorLifecycleSnapshot;
  evidenceNeeded: string[];
  shouldRequeue: boolean;
  shouldClose: boolean;
  reason: string;
};

function lifecycleAt(
  plan: ResearchGapCausalDiscriminatorPlan,
  activeIndex: number,
): ResearchGapDiscriminatorLifecycleSnapshot {
  const index = Math.max(0, Math.min(activeIndex, plan.discriminators.length - 1));
  return {
    contractVersion: RESEARCH_GAP_DISCRIMINATOR_LIFECYCLE_VERSION,
    planSignature: plan.planSignature,
    baseEvidenceNeeded: [...plan.baseEvidenceNeeded],
    discriminators: [...plan.discriminators],
    activeIndex: index,
    activeDiscriminator: plan.discriminators[index]!,
  };
}

function result(
  transition: ResearchGapDiscriminatorDecision["transition"],
  lifecycle: ResearchGapDiscriminatorLifecycleSnapshot,
  options: {
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
    shouldRequeue: options.shouldRequeue ?? false,
    shouldClose: options.shouldClose ?? false,
    reason: options.reason,
  };
}

export function decideResearchGapDiscriminatorLifecycle(input: {
  candidatePlan: ResearchGapCausalDiscriminatorPlan;
  existingStatus?: string | null;
  priorLifecycle?: ResearchGapDiscriminatorLifecycleSnapshot | null;
  canonicalHandoffAdmitted?: boolean;
}): ResearchGapDiscriminatorDecision {
  const plan = input.candidatePlan;
  if (!plan.planSignature || plan.discriminators.length === 0 || plan.discriminators.length > 4) {
    throw new Error("Invalid bounded causal-discriminator plan.");
  }

  const status = (input.existingStatus ?? "").trim().toUpperCase();
  const prior = input.priorLifecycle ?? null;

  if (!status) {
    return result("INITIAL", lifecycleAt(plan, 0), {
      reason: "New Investigation research begins with discriminator #1.",
    });
  }

  if (status === "HANDED_OFF") {
    if (!prior) {
      return result("PRESERVE", lifecycleAt(plan, 0), {
        reason: "Legacy handed-off work has no frozen discriminator lifecycle; fail closed.",
      });
    }

    if (!input.canonicalHandoffAdmitted) {
      return result("PRESERVE", prior, {
        reason: "Do not advance until the exact handed-off Research Gap case is admitted as canonical evidence.",
      });
    }

    if (prior.planSignature !== plan.planSignature) {
      return result("REOPEN_CHANGED_PLAN", lifecycleAt(plan, 0), {
        shouldRequeue: true,
        reason: "The current Dossier carries a materially changed discriminator plan.",
      });
    }

    const nextIndex = prior.activeIndex + 1;
    if (nextIndex >= plan.discriminators.length) {
      return result("EXHAUST", prior, {
        shouldClose: true,
        reason: "All bounded discriminators returned through canonical handoff while the Investigation remains unresolved.",
      });
    }

    return result("ADVANCE", lifecycleAt(plan, nextIndex), {
      shouldRequeue: true,
      reason: "Exact canonical handoff admitted the active discriminator; advance by one.",
    });
  }

  if (status === "CLOSED") {
    if (prior?.planSignature === plan.planSignature) {
      return result("EXHAUST", prior, {
        shouldClose: true,
        reason: "The same exhausted plan remains current; do not reopen it.",
      });
    }

    return result("REOPEN_CHANGED_PLAN", lifecycleAt(plan, 0), {
      shouldRequeue: true,
      reason: "A changed causal-discriminator plan may reopen a previously exhausted case.",
    });
  }

  if (prior && ["CLAIMED", "RESEARCHING", "COMPLETED"].includes(status)) {
    return result("PRESERVE", prior, {
      reason: "In-flight work preserves the exact discriminator it started with.",
    });
  }

  if (prior?.planSignature === plan.planSignature) {
    return result("PRESERVE", prior, {
      reason: "Queued work preserves its frozen active discriminator.",
    });
  }

  return result(prior ? "REOPEN_CHANGED_PLAN" : "INITIAL", lifecycleAt(plan, 0), {
    reason: prior
      ? "The plan changed before execution; restart from discriminator #1."
      : "No prior lifecycle exists; start from discriminator #1.",
  });
}
