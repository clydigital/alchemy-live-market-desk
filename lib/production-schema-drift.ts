import { createSupabaseAdminClient } from "./supabase/admin.ts";
import {
  verifyGitHubActionsProductionSchemaGuard,
  type ProductionSchemaGuardAuthorization,
} from "./production-schema-drift-auth.ts";

export const PRODUCTION_SCHEMA_ENFORCEMENT_START = "20261001000000";

export const REQUIRED_PRODUCTION_SCHEMA_INVARIANTS = [
  "research_schedule_slots",
  "story_maintenance_evidence_provenance",
] as const;

type ExpectedMigration = {
  version: string;
  name: string;
};

type AppliedMigration = {
  version: string;
  name: string;
};

export type ProductionSchemaInvariant = {
  invariant_key: string;
  healthy: boolean;
  detail: unknown;
};

type Dependencies = {
  authorize?: (request: Request) => Promise<ProductionSchemaGuardAuthorization>;
  loadAppliedMigrations?: () => Promise<AppliedMigration[]>;
  loadSchemaInvariants?: () => Promise<ProductionSchemaInvariant[]>;
  deploymentSha?: () => string | null;
  logger?: (event: Record<string, unknown>) => void;
};

function validVersion(value: unknown): value is string {
  return typeof value === "string" && /^\d{14}$/.test(value);
}

function validName(value: unknown): value is string {
  return typeof value === "string"
    && /^[a-z0-9][a-z0-9_]{1,127}$/i.test(value);
}

function parseExpectedMigrations(value: unknown): ExpectedMigration[] | null {
  if (!Array.isArray(value) || value.length > 256) return null;

  const migrations: ExpectedMigration[] = [];
  const names = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const version = (item as { version?: unknown }).version;
    const name = (item as { name?: unknown }).name;
    if (!validVersion(version) || !validName(name)) return null;
    if (version < PRODUCTION_SCHEMA_ENFORCEMENT_START) continue;
    if (names.has(name)) return null;
    names.add(name);
    migrations.push({ version, name });
  }
  return migrations.sort((left, right) => (
    left.version.localeCompare(right.version)
    || left.name.localeCompare(right.name)
  ));
}

export function assessProductionSchemaDrift(
  expected: ExpectedMigration[],
  applied: AppliedMigration[],
) {
  // The repository timestamp is the enforcement boundary. Historical production
  // tooling sometimes re-stamped the same migration name when applying it, so
  // remote timestamps are not reliable enough to filter applied history.
  const appliedNames = new Set(applied.map((migration) => migration.name));
  const missing = expected.filter((migration) => !appliedNames.has(migration.name));
  const appliedExpectedCount = expected.length - missing.length;

  return {
    healthy: missing.length === 0,
    missing,
    unexpected: [] as AppliedMigration[],
    expectedCount: expected.length,
    appliedCount: appliedExpectedCount,
    productionHistoryCount: applied.length,
  };
}

export function assessProductionSchemaInvariants(
  observed: ProductionSchemaInvariant[],
) {
  const byKey = new Map(observed.map((item) => [item.invariant_key, item]));
  const invariants = REQUIRED_PRODUCTION_SCHEMA_INVARIANTS.map((invariantKey) => {
    const item = byKey.get(invariantKey);
    return item ?? {
      invariant_key: invariantKey,
      healthy: false,
      detail: { reason: "missing_invariant" },
    };
  });
  const invariantFailures = invariants.filter((item) => !item.healthy);

  return {
    healthy: invariantFailures.length === 0,
    invariants,
    invariantFailures,
  };
}

export async function loadAppliedProductionMigrations(): Promise<AppliedMigration[]> {
  const client = createSupabaseAdminClient();
  const { data, error } = await client.rpc("live_desk_applied_migrations");
  if (error) {
    throw new Error(`Could not read production migration history: ${error.message}`);
  }
  if (!Array.isArray(data)) {
    throw new Error("Production migration history returned an invalid payload.");
  }
  return data.map((row) => {
    const version = (row as { version?: unknown }).version;
    const name = (row as { name?: unknown }).name;
    if (!validVersion(version) || !validName(name)) {
      throw new Error("Production migration history contains an invalid row.");
    }
    return { version, name };
  });
}

export async function loadProductionSchemaInvariants(): Promise<ProductionSchemaInvariant[]> {
  const client = createSupabaseAdminClient();
  const { data, error } = await client.rpc("live_desk_schema_invariants");
  if (error) {
    throw new Error(`Could not read production schema invariants: ${error.message}`);
  }
  if (!Array.isArray(data)) {
    throw new Error("Production schema invariants returned an invalid payload.");
  }

  const keys = new Set<string>();
  return data.map((row) => {
    const invariantKey = (row as { invariant_key?: unknown }).invariant_key;
    const healthy = (row as { healthy?: unknown }).healthy;
    const detail = (row as { detail?: unknown }).detail;
    if (!validName(invariantKey) || typeof healthy !== "boolean") {
      throw new Error("Production schema invariants contain an invalid row.");
    }
    if (keys.has(invariantKey)) {
      throw new Error(`Production schema invariant ${invariantKey} was returned more than once.`);
    }
    keys.add(invariantKey);
    return {
      invariant_key: invariantKey,
      healthy,
      detail: detail ?? null,
    };
  });
}

export async function handleProductionSchemaDriftWithDependencies(
  request: Request,
  dependencies: Dependencies = {},
) {
  const authorize =
    dependencies.authorize ?? verifyGitHubActionsProductionSchemaGuard;
  const authorization = await authorize(request);
  if (!authorization.authorized) {
    return Response.json(
      { status: "unauthorized", error: "Production schema guard authorization failed." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json(
      { status: "invalid", error: "Expected a JSON request body." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!input || typeof input !== "object") {
    return Response.json(
      { status: "invalid", error: "Expected a JSON object." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const expectedDeploymentSha =
    (input as { expectedDeploymentSha?: unknown }).expectedDeploymentSha;
  if (
    typeof expectedDeploymentSha !== "string"
    || !/^[a-f0-9]{40}$/i.test(expectedDeploymentSha)
  ) {
    return Response.json(
      { status: "invalid", error: "expectedDeploymentSha must be a 40-character Git SHA." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const migrations = parseExpectedMigrations(
    (input as { migrations?: unknown }).migrations,
  );
  if (!migrations) {
    return Response.json(
      { status: "invalid", error: "migrations must be a unique bounded migration manifest." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const deploymentSha =
    (dependencies.deploymentSha ?? (() => process.env.VERCEL_GIT_COMMIT_SHA || null))();
  if (deploymentSha !== expectedDeploymentSha) {
    return Response.json({
      status: "deployment_pending",
      expectedDeploymentSha,
      deploymentSha,
      enforcementStart: PRODUCTION_SCHEMA_ENFORCEMENT_START,
    }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const [applied, observedInvariants] = await Promise.all([
      (dependencies.loadAppliedMigrations ?? loadAppliedProductionMigrations)(),
      (dependencies.loadSchemaInvariants ?? loadProductionSchemaInvariants)(),
    ]);
    const migrationAssessment = assessProductionSchemaDrift(migrations, applied);
    const invariantAssessment = assessProductionSchemaInvariants(observedInvariants);
    const healthy = migrationAssessment.healthy && invariantAssessment.healthy;
    const logger = dependencies.logger ?? ((event) => console.info(JSON.stringify(event)));
    logger({
      event: "production_schema_drift_checked",
      actor: authorization.actor,
      githubRunId: authorization.githubRunId,
      workflowSha: authorization.workflowSha,
      deploymentSha,
      enforcementStart: PRODUCTION_SCHEMA_ENFORCEMENT_START,
      expectedCount: migrationAssessment.expectedCount,
      appliedCount: migrationAssessment.appliedCount,
      missing: migrationAssessment.missing.map((migration) => migration.name),
      unexpected: migrationAssessment.unexpected.map((migration) => migration.name),
      invariantFailures: invariantAssessment.invariantFailures.map(
        (item) => item.invariant_key,
      ),
      healthy,
    });

    return Response.json({
      status: healthy ? "healthy" : "drift",
      deploymentSha,
      enforcementStart: PRODUCTION_SCHEMA_ENFORCEMENT_START,
      ...migrationAssessment,
      healthy,
      schemaInvariants: invariantAssessment.invariants,
      invariantFailures: invariantAssessment.invariantFailures,
    }, {
      status: healthy ? 200 : 409,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json({
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      deploymentSha,
      enforcementStart: PRODUCTION_SCHEMA_ENFORCEMENT_START,
    }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
