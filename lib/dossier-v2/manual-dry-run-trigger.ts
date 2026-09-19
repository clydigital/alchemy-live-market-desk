import {
  type ManualLiveTriggerAuthorization,
  verifyGitHubActionsManualLiveTrigger,
} from "../manual-live-trigger-auth.ts";
import {
  runManualDossierV2,
  type ManualDossierV2RunResult,
} from "./manual-run.ts";

type DryRunAuthorization = ManualLiveTriggerAuthorization;

type DryRunInput = {
  asOf?: unknown;
  lookbackHours?: unknown;
  evidenceLimit?: unknown;
};

type DryRunDependencies = {
  authorize?: (request: Request) => Promise<DryRunAuthorization>;
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

async function readInput(request: Request): Promise<DryRunInput | null> {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > 4_096) return null;
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    return body as DryRunInput;
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

export async function handleDossierV2DryRunWithDependencies(
  request: Request,
  dependencies: DryRunDependencies = {},
) {
  const authorization = await (
    dependencies.authorize ?? verifyGitHubActionsManualLiveTrigger
  )(request);

  if (!authorization.authorized) {
    return json({ error: "Unauthorized Dossier V2 dry-run trigger." }, 401);
  }

  const input = await readInput(request);
  if (!input) {
    return json({ error: "A JSON request body is required." }, 400);
  }

  // This endpoint is intentionally read-only. Any attempt to smuggle a persist
  // flag or unknown control field is rejected rather than ignored.
  const allowedKeys = new Set(["asOf", "lookbackHours", "evidenceLimit"]);
  const unknownKeys = Object.keys(input).filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length > 0) {
    return json(
      {
        error: "Unsupported dry-run input field.",
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
    event: "dossier_v2_dry_run_authorized",
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
          persist: false,
        }));

    const result = await run({
      asOf,
      lookbackHours,
      evidenceLimit,
    });

    if (result.mode !== "dry_run") {
      throw new Error("Dossier V2 dry-run endpoint received a non-dry-run result.");
    }

    return json({
      status: "completed",
      mode: result.mode,
      persistenceAvailable: result.persistence_available,
      previousDossierId: result.previous_dossier_id,
      snapshotDiagnostics: result.snapshot_diagnostics,
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
      event: "dossier_v2_dry_run_failed",
      actor: authorization.actor,
      githubRunId: authorization.githubRunId,
      error: error instanceof Error ? error.message : String(error),
    });

    return json(
      {
        status: "failed",
        error: "Dossier V2 dry-run failed.",
        detail: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}
