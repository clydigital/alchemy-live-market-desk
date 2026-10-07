import {
  verifyGitHubActionsManualLiveTrigger,
  type ManualLiveTriggerAuthorization,
} from "./manual-live-trigger-auth.ts";
import {
  claimResearchGapCases,
  closeLegacyQueuedDossierStoryD7ResearchGapCases,
  completeResearchGapCase,
  releaseResearchGapCase,
  startResearchGapCase,
  type ClaimedResearchGapCase,
  type ResearchGapCaseRow,
} from "./research-gap-lifecycle.ts";
import { loadResearchGapPlanContext } from "./research-gap-context.ts";
import {
  buildResearchGapPlan,
  evaluateResearchGapEvidence,
  type ResearchGapPlan,
  type ResearchGapVerdict,
} from "./research-gap-plan.ts";
import {
  executeResearchGapWebPlan,
  type ResearchGapWebExecutionResult,
} from "./research-gap-web-executor.ts";

type Dependencies = {
  authorize?: (request: Request) => Promise<ManualLiveTriggerAuthorization>;
  closeLegacyDossierStoryWork?: typeof closeLegacyQueuedDossierStoryD7ResearchGapCases;
  claim?: (input: { workerId: string; batchSize: number; leaseSeconds: number }) => Promise<ClaimedResearchGapCase[]>;
  loadContext?: typeof loadResearchGapPlanContext;
  buildPlan?: typeof buildResearchGapPlan;
  start?: typeof startResearchGapCase;
  research?: (plan: ResearchGapPlan) => Promise<ResearchGapWebExecutionResult>;
  complete?: typeof completeResearchGapCase;
  release?: typeof releaseResearchGapCase;
  now?: () => Date;
  logger?: (event: Record<string, unknown>) => void;
};

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 1_000) : String(error).slice(0, 1_000);
}

export async function handleManualResearchGapWebRun(
  request: Request,
  dependencies: Dependencies = {},
) {
  const authorize = dependencies.authorize ?? verifyGitHubActionsManualLiveTrigger;
  const authorization = await authorize(request);
  if (!authorization.authorized) {
    return json({ status: "unauthorized", error: "Manual Research Gap authorization failed." }, 401);
  }

  const closeLegacyDossierStoryWork =
    dependencies.closeLegacyDossierStoryWork
    ?? (() => closeLegacyQueuedDossierStoryD7ResearchGapCases());
  const claim = dependencies.claim ?? ((input) => claimResearchGapCases(input));
  const loadContext = dependencies.loadContext ?? loadResearchGapPlanContext;
  const buildPlan = dependencies.buildPlan ?? buildResearchGapPlan;
  const start = dependencies.start ?? startResearchGapCase;
  const research = dependencies.research ?? executeResearchGapWebPlan;
  const complete = dependencies.complete ?? completeResearchGapCase;
  const release = dependencies.release ?? releaseResearchGapCase;
  const now = dependencies.now ?? (() => new Date());
  const logger = dependencies.logger ?? ((event) => console.info(JSON.stringify(event)));

  const workerId = `github-gap:${authorization.githubRunId}`;
  let claimed: ClaimedResearchGapCase | null = null;
  let completed: ResearchGapCaseRow | null = null;
  let verdict: ResearchGapVerdict | null = null;

  try {
    const closedLegacyD7 = await closeLegacyDossierStoryWork();
    if (closedLegacyD7.length > 0) {
      logger({
        event: "research_gap_legacy_dossier_story_work_closed",
        actor: authorization.actor,
        githubRunId: authorization.githubRunId,
        count: closedLegacyD7.length,
        cases: closedLegacyD7.map((item) => ({
          id: item.id,
          gapKey: item.gap_key,
          sourceRef: item.source_ref,
        })),
      });
    }

    const cases = await claim({
      workerId,
      batchSize: 1,
      leaseSeconds: 1800,
    });
    claimed = cases[0] ?? null;
    if (!claimed) {
      return json({
        status: "empty",
        detail: "No queued Research Gap case is currently claimable.",
      });
    }

    const planNow = now();
    const context = await loadContext(claimed, undefined, planNow);
    const plan = buildPlan(claimed, planNow, context);
    const started = await start({
      caseId: claimed.id,
      claimToken: claimed.claim_token,
      planVersion: plan.contractVersion,
      plan,
      startedAt: plan.generatedAt,
    });
    if (!started) {
      throw new Error("Research Gap start lost claim ownership or the lease expired.");
    }

    logger({
      event: "research_gap_manual_web_start",
      actor: authorization.actor,
      githubRunId: authorization.githubRunId,
      caseId: claimed.id,
      gapKey: claimed.gap_key,
      planId: plan.planId,
      maxSources: plan.budget.maxSources,
      maxBranches: plan.budget.maxBranches,
      requirementCount: plan.requirements.length,
    });

    const result = await research(plan);
    verdict = evaluateResearchGapEvidence({
      plan,
      evidence: result.evidence,
      branchCount: result.branchCount,
      now: now(),
    });

    if (!verdict.shouldStop) {
      throw new Error(
        `Research Gap executor returned without exhausting or resolving the bounded plan: ${verdict.stopReason}.`,
      );
    }

    completed = await complete({
      caseId: claimed.id,
      claimToken: claimed.claim_token,
      outcome: verdict.outcome,
      verdictVersion: verdict.contractVersion,
      verdict,
      completedAt: verdict.evaluatedAt,
    });
    if (!completed) {
      throw new Error("Research Gap completion lost claim ownership or the lease expired.");
    }

    logger({
      event: "research_gap_manual_web_completed",
      actor: authorization.actor,
      githubRunId: authorization.githubRunId,
      caseId: claimed.id,
      gapKey: claimed.gap_key,
      outcome: verdict.outcome,
      stopReason: verdict.stopReason,
      evidenceCount: verdict.evidenceSnapshot.length,
      eligibleEvidenceCount: verdict.eligibleEvidenceIds.length,
      sourceCount: verdict.sourceCount,
      branchCount: verdict.branchCount,
      missingRequirementIds: verdict.missingRequirementIds,
      handoffAttempted: false,
    });

    return json({
      status: "completed",
      caseId: claimed.id,
      gapKey: claimed.gap_key,
      question: claimed.question,
      outcome: verdict.outcome,
      stopReason: verdict.stopReason,
      confidence: verdict.confidence,
      evidenceCount: verdict.evidenceSnapshot.length,
      eligibleEvidenceCount: verdict.eligibleEvidenceIds.length,
      sourceCount: verdict.sourceCount,
      branchCount: verdict.branchCount,
      missingRequirementIds: verdict.missingRequirementIds,
      verdictVersion: verdict.contractVersion,
      evidenceSnapshotVersion: verdict.evidenceSnapshotVersion,
      handoff: "not_attempted_portion_9b",
    });
  } catch (error) {
    let released = false;
    if (claimed && !completed) {
      try {
        released = await release({
          caseId: claimed.id,
          claimToken: claimed.claim_token,
        });
      } catch {
        released = false;
      }
    }
    logger({
      event: "research_gap_manual_web_failed",
      actor: authorization.actor,
      githubRunId: authorization.githubRunId,
      caseId: claimed?.id ?? null,
      gapKey: claimed?.gap_key ?? null,
      released,
      error: errorText(error),
    });
    return json({
      status: "failed",
      error: "Manual Research Gap web execution failed.",
      detail: errorText(error),
      caseId: claimed?.id ?? null,
      gapKey: claimed?.gap_key ?? null,
      released,
    }, 500);
  }
}
