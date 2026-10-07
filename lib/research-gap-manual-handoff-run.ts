import {
  handleAutomaticResearchGapHandoff,
  type CompletedResearchGapResult,
} from "./research-gap-auto-handoff.ts";
import {
  closeSupersededCompletedD7ResearchGapCase,
  getResearchGapCaseById,
  listResearchGapCases,
  type ResearchGapCaseRow,
} from "./research-gap-lifecycle.ts";
import {
  completedResearchGapResultFromSnapshot,
} from "./research-gap-snapshot-handoff.ts";
import {
  verifyGitHubActionsManualLiveTrigger,
  type ManualLiveTriggerAuthorization,
} from "./manual-live-trigger-auth.ts";

type Dependencies = {
  authorize?: (request: Request) => Promise<ManualLiveTriggerAuthorization>;
  listCases?: () => Promise<ResearchGapCaseRow[]>;
  loadCase?: (caseId: string) => Promise<ResearchGapCaseRow | null>;
  buildResult?: (row: ResearchGapCaseRow) => CompletedResearchGapResult;
  submit?: (request: Request, result: CompletedResearchGapResult) => Promise<Response>;
  loadCurrentD7?: () => Promise<{
    dossierId: string;
    dossierAsOf: string;
    snapshot: {
      cases: Array<{
        id: string;
        state: string;
        reason: string;
        researchEligible: boolean;
      }>;
    };
  } | null>;
  closeSupersededD7?: typeof closeSupersededCompletedD7ResearchGapCase;
  logger?: (event: Record<string, unknown>) => void;
};

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 1_000) : String(error).slice(0, 1_000);
}

async function requestedCaseId(request: Request) {
  try {
    const text = await request.text();
    if (!text.trim()) return null;
    const body = JSON.parse(text) as { caseId?: unknown };
    return clean(body?.caseId) || null;
  } catch {
    throw new Error("Request body must be empty or valid JSON containing an optional caseId.");
  }
}

async function loadCurrentD7ForHandoff() {
  const { loadCurrentD7RuntimeSnapshot } = await import("./d7-runtime.ts");
  return loadCurrentD7RuntimeSnapshot();
}

async function submitPersistedGapHandoff(
  request: Request,
  result: CompletedResearchGapResult,
) {
  const token = process.env.RESEARCH_UPDATE_TOKEN?.trim()
    || process.env.CRON_SECRET?.trim();
  if (!token) throw new Error("Canonical Research Gap handoff authorization is not configured.");

  const target = new URL("/api/research-gap/handoff", request.url);
  const internal = new Request(target, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "x-alchemy-gap-snapshot-handoff": "1",
    },
    body: JSON.stringify(result),
  });
  return handleAutomaticResearchGapHandoff(internal);
}

export async function handleManualResearchGapSnapshotHandoff(
  request: Request,
  dependencies: Dependencies = {},
) {
  const authorize = dependencies.authorize ?? verifyGitHubActionsManualLiveTrigger;
  const authorization = await authorize(request);
  if (!authorization.authorized) {
    return json({ status: "unauthorized", error: "Manual Research Gap handoff authorization failed." }, 401);
  }

  const listCases = dependencies.listCases ?? (() => listResearchGapCases(undefined, 100));
  const loadCase = dependencies.loadCase ?? ((caseId) => getResearchGapCaseById(caseId));
  const buildResult = dependencies.buildResult ?? completedResearchGapResultFromSnapshot;
  const submit = dependencies.submit ?? submitPersistedGapHandoff;
  const loadCurrentD7 = dependencies.loadCurrentD7 ?? loadCurrentD7ForHandoff;
  const closeSupersededD7 = dependencies.closeSupersededD7 ?? closeSupersededCompletedD7ResearchGapCase;
  const logger = dependencies.logger ?? ((event) => console.info(JSON.stringify(event)));

  try {
    const caseId = await requestedCaseId(request);
    let selected: ResearchGapCaseRow | null = null;

    if (caseId) {
      selected = await loadCase(caseId);
      if (!selected) {
        return json({ status: "not_found", caseId }, 404);
      }
      if (!["COMPLETED", "HANDED_OFF"].includes(selected.status)) {
        return json({
          status: "not_ready",
          caseId,
          lifecycleStatus: selected.status,
          detail: "Research Gap case must be completed before canonical handoff.",
        }, 409);
      }
    } else {
      const cases = await listCases();
      selected = cases.find((item) => item.status === "COMPLETED") ?? null;
      if (!selected) {
        return json({
          status: "empty",
          detail: "No completed Research Gap case is waiting for canonical handoff.",
        });
      }
    }

    if (
      selected.status === "COMPLETED"
      && selected.source_kind === "research_gap"
      && selected.source_ref.startsWith("d7:")
    ) {
      const currentD7 = await loadCurrentD7();
      const currentCase = currentD7?.snapshot.cases.find(
        (item) => `d7:${item.id}` === selected!.source_ref,
      ) ?? null;

      if (!currentD7 || !currentCase) {
        return json({
          status: "preflight_unavailable",
          caseId: selected.id,
          gapKey: selected.gap_key,
          detail: "Current D7 state could not prove whether this completed D7 case is still research-eligible; canonical handoff is blocked fail-closed.",
        }, 409);
      }

      if (!currentCase.researchEligible) {
        const closed = await closeSupersededD7({
          caseId: selected.id,
          sourceRef: selected.source_ref,
        });
        if (!closed) {
          return json({
            status: "state_changed",
            caseId: selected.id,
            gapKey: selected.gap_key,
            detail: "The D7 case changed lifecycle state before superseded-work closure completed.",
          }, 409);
        }

        logger({
          event: "research_gap_d7_superseded_closed",
          actor: authorization.actor,
          githubRunId: authorization.githubRunId,
          caseId: selected.id,
          gapKey: selected.gap_key,
          sourceRef: selected.source_ref,
          d7State: currentCase.state,
          d7Reason: currentCase.reason,
        });

        return json({
          status: "closed_superseded",
          caseId: selected.id,
          gapKey: selected.gap_key,
          lifecycleStatus: closed.status,
          d7State: currentCase.state,
          detail: currentCase.reason,
        });
      }
    }

    const result = buildResult(selected);
    logger({
      event: "research_gap_snapshot_handoff_start",
      actor: authorization.actor,
      githubRunId: authorization.githubRunId,
      caseId: selected.id,
      gapKey: selected.gap_key,
      outcome: selected.research_outcome,
      evidenceCount: result.evidence.length,
      retry: selected.status === "HANDED_OFF",
    });

    const downstream = await submit(request, result);
    const raw = await downstream.text();
    let body: any = null;
    try {
      body = raw.trim() ? JSON.parse(raw) : null;
    } catch {
      body = { error: "Canonical Research Gap handoff returned a non-JSON response." };
    }

    const lifecycleStatus = body?.lifecycle?.lifecycleStatus
      || body?.lifecycle?.status
      || null;
    logger({
      event: downstream.ok
        ? "research_gap_snapshot_handoff_completed"
        : "research_gap_snapshot_handoff_failed",
      actor: authorization.actor,
      githubRunId: authorization.githubRunId,
      caseId: selected.id,
      gapKey: selected.gap_key,
      downstreamStatus: downstream.status,
      runKey: body?.runKey ?? null,
      lifecycleStatus,
      canonicalStatus: body?.canonicalStatus ?? null,
    });

    return json({
      status: downstream.ok ? "handed_off" : "failed",
      caseId: selected.id,
      gapKey: selected.gap_key,
      outcome: selected.research_outcome,
      evidenceCount: result.evidence.length,
      runKey: body?.runKey ?? null,
      canonicalStatus: body?.canonicalStatus ?? downstream.status,
      canonicalBody: body?.canonicalBody ?? null,
      lifecycle: body?.lifecycle ?? null,
      error: downstream.ok ? null : body?.error ?? "Canonical Research Gap handoff failed.",
      detail: downstream.ok ? null : body,
    }, downstream.status);
  } catch (error) {
    logger({
      event: "research_gap_snapshot_handoff_failed",
      actor: authorization.actor,
      githubRunId: authorization.githubRunId,
      error: errorText(error),
    });
    return json({
      status: "failed",
      error: "Manual Research Gap snapshot handoff failed.",
      detail: errorText(error),
    }, 500);
  }
}
