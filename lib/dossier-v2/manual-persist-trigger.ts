import {
  type ManualLiveTriggerAuthorization,
  verifyGitHubActionsManualLiveTrigger,
} from "../manual-live-trigger-auth.ts";
import {
  runManualDossierV2,
  type ManualDossierV2RunResult,
} from "./manual-run.ts";

type PersistAuthorization = ManualLiveTriggerAuthorization;

type PersistInput = {
  asOf?: unknown;
  lookbackHours?: unknown;
  evidenceLimit?: unknown;
};

type PersistDependencies = {
  authorize?: (request: Request) => Promise<PersistAuthorization>;
  run?: (options: {
    asOf: string;
    lookbackHours: number;
    evidenceLimit: number;
  }) => Promise<ManualDossierV2RunResult>;
  now?: () => Date;
  logger?: (event: Record<string, unknown>) => void;
};

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function readInput(request: Request): Promise<PersistInput | null> {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > 4_096) return null;
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    return body as PersistInput;
  } catch {
    return null;
  }
}

function boundedPositiveInt(
  value: unknown,
  fallback: number,
  max: number,
): number | null {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed =
    typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > max) return null;
  return parsed;
}

function resolveAsOf(value: unknown, now: () => Date): string | null {
  if (value === undefined || value === null || value === "") {
    return now().toISOString();
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

export async function handleDossierV2PersistRunWithDependencies(
  request: Request,
  dependencies: PersistDependencies = {},
) {
  const authorization = await (
    dependencies.authorize ?? verifyGitHubActionsManualLiveTrigger
  )(request);

  if (!authorization.authorized) {
    return json({ error: "Unauthorized Dossier V2 persistence trigger." }, 401);
  }

  const input = await readInput(request);
  if (!input) {
    return json({ error: "A JSON request body is required." }, 400);
  }

  // Persistence is fixed by the endpoint itself. Reject control fields so an
  // audited production run cannot silently change execution semantics.
  const allowedKeys = new Set(["asOf", "lookbackHours", "evidenceLimit"]);
  const unknownKeys = Object.keys(input).filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length > 0) {
    return json(
      {
        error: "Unsupported persistence input field.",
        fields: unknownKeys,
      },
      400,
    );
  }

  const now = dependencies.now ?? (() => new Date());
  const asOf = resolveAsOf(input.asOf, now);
  const lookbackHours = boundedPositiveInt(input.lookbackHours, 168, 24 * 30);
  const evidenceLimit = boundedPositiveInt(input.evidenceLimit, 180, 500);

  if (!asOf || lookbackHours === null || evidenceLimit === null) {
    return json(
      {
        error:
          "asOf must be an ISO timestamp; lookbackHours must be 1-720; evidenceLimit must be 1-500.",
      },
      400,
    );
  }

  const logger =
    dependencies.logger ?? ((event) => console.info(JSON.stringify(event)));

  logger({
    event: "dossier_v2_persist_run_authorized",
    actor: authorization.actor,
    githubRunId: authorization.githubRunId,
    workflowSha: authorization.workflowSha,
    asOf,
    lookbackHours,
    evidenceLimit,
    vercelRequestId: request.headers.get("x-vercel-id") || undefined,
  });

  try {
    const run =
      dependencies.run ??
      (async (options: {
        asOf: string;
        lookbackHours: number;
        evidenceLimit: number;
      }) =>
        runManualDossierV2({
          ...options,
          persist: true,
        }));

    const result = await run({
      asOf,
      lookbackHours,
      evidenceLimit,
    });

    if (result.mode !== "persisted" || !result.dossier) {
      throw new Error(
        "Dossier V2 persistence endpoint received a non-persisted result.",
      );
    }

    return json({
      status: "completed",
      mode: result.mode,
      persistenceAvailable: result.persistence_available,
      previousDossierId: result.previous_dossier_id,
      persistedDossier: {
        id: result.dossier.id,
        previousDossierId: result.dossier.previous_dossier_id,
        asOf: result.dossier.as_of,
        createdAt: result.dossier.created_at,
      },
      snapshotDiagnostics: result.snapshot_diagnostics,
      storyRefreshAgenda: result.story_refresh_agenda ?? null,
      packetSummary: {
        packetId: result.packet.packet_id,
        asOf: result.packet.as_of,
        observedEvidence: result.packet.observed_evidence.length,
        researchLeads: result.packet.research_leads.length,
        developmentClusters: result.packet.development_clusters.length,
        catalysts: result.packet.catalysts.length,
        creatorThemes: result.packet.creator_themes.length,
        freshnessWarnings: result.packet.freshness_warnings,
        researchGaps: result.packet.research_gaps,
        diagnostics: result.packet.diagnostics,
      },
      analyticalOutput: result.analytical_output,
    });
  } catch (error) {
    logger({
      event: "dossier_v2_persist_run_failed",
      actor: authorization.actor,
      githubRunId: authorization.githubRunId,
      error: error instanceof Error ? error.message : String(error),
    });

    return json(
      {
        status: "failed",
        error: "Dossier V2 persistence run failed.",
        detail: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}
