import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { generateKeyPair, SignJWT } from "jose";

import {
  PRODUCTION_SCHEMA_GUARD_AUDIENCE,
  verifyGitHubActionsProductionSchemaGuard,
} from "../lib/production-schema-drift-auth.ts";
import {
  PRODUCTION_SCHEMA_ENFORCEMENT_START,
  assessProductionSchemaDrift,
  assessProductionSchemaInvariants,
  handleProductionSchemaDriftWithDependencies,
} from "../lib/production-schema-drift.ts";

const deployedSha = "a".repeat(40);

const authorized = async () => ({
  authorized: true as const,
  actor: "clydigital",
  githubRunId: "12345",
  workflowSha: deployedSha,
});

function request(body: unknown) {
  return new Request("https://example.com/api/admin/system/schema-drift", {
    method: "POST",
    headers: {
      authorization: "Bearer oidc-token",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function healthySchemaInvariants() {
  return [
    {
      invariant_key: "research_schedule_slots",
      healthy: true,
      detail: { morning: "09:30:00", evening: "21:30:00" },
    },
    {
      invariant_key: "story_maintenance_evidence_provenance",
      healthy: true,
      detail: { functionExists: true, triggerExists: true },
    },
  ];
}

function manifest() {
  return [
    { version: "20260930120000", name: "legacy_before_guard" },
    { version: "20261001012000", name: "market_motion_v1" },
    { version: "20261001061000", name: "research_gap_lifecycle" },
    { version: "20261001143000", name: "transcript_motion_leads" },
    { version: "20261002024600", name: "production_schema_drift_guard" },
  ];
}

test("schema drift assessment uses names after the enforcement baseline", () => {
  const assessment = assessProductionSchemaDrift(
    manifest().filter((item) => item.version >= PRODUCTION_SCHEMA_ENFORCEMENT_START),
    [
      { version: "20260930181142", name: "market_motion_v1" },
      { version: "20260930224033", name: "research_gap_lifecycle" },
      { version: "20261001185600", name: "transcript_motion_leads" },
      { version: "20261002010000", name: "production_schema_drift_guard" },
    ],
  );

  assert.equal(assessment.healthy, true);
  assert.deepEqual(assessment.missing, []);
  assert.deepEqual(assessment.unexpected, []);
});

test("schema guard fails closed when a checked-in migration is missing", async () => {
  const response = await handleProductionSchemaDriftWithDependencies(
    request({ expectedDeploymentSha: deployedSha, migrations: manifest() }),
    {
      authorize: authorized,
      deploymentSha: () => deployedSha,
      loadAppliedMigrations: async () => [
        { version: "20260930181142", name: "market_motion_v1" },
        { version: "20260930224033", name: "research_gap_lifecycle" },
        { version: "20261002010000", name: "production_schema_drift_guard" },
      ],
      loadSchemaInvariants: async () => healthySchemaInvariants(),
      logger: () => undefined,
    },
  );

  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.status, "drift");
  assert.deepEqual(body.missing.map((item: { name: string }) => item.name), [
    "transcript_motion_leads",
  ]);
});

test("schema guard does not infer unexpected migrations from unreliable remote timestamps", async () => {
  const response = await handleProductionSchemaDriftWithDependencies(
    request({ expectedDeploymentSha: deployedSha, migrations: manifest() }),
    {
      authorize: authorized,
      deploymentSha: () => deployedSha,
      loadAppliedMigrations: async () => [
        { version: "20260930181142", name: "market_motion_v1" },
        { version: "20260930224033", name: "research_gap_lifecycle" },
        { version: "20261001185600", name: "transcript_motion_leads" },
        { version: "20261002010000", name: "production_schema_drift_guard" },
        { version: "20261002020000", name: "dashboard_hotfix_not_in_git" },
      ],
      loadSchemaInvariants: async () => healthySchemaInvariants(),
      logger: () => undefined,
    },
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, "healthy");
  assert.deepEqual(body.unexpected, []);
  assert.equal(body.productionHistoryCount, 5);
});

test("schema invariant assessment fails closed when a required invariant is unhealthy", () => {
  const assessment = assessProductionSchemaInvariants([
    ...healthySchemaInvariants().map((item) => ({ ...item })),
  ]);
  assert.equal(assessment.healthy, true);

  const drifted = assessProductionSchemaInvariants([
    {
      invariant_key: "research_schedule_slots",
      healthy: false,
      detail: { morning: "09:15:00", evening: "21:15:00" },
    },
    {
      invariant_key: "story_maintenance_evidence_provenance",
      healthy: true,
      detail: { functionExists: true, triggerExists: true },
    },
  ]);
  assert.equal(drifted.healthy, false);
  assert.deepEqual(
    drifted.invariantFailures.map((item) => item.invariant_key),
    ["research_schedule_slots"],
  );
});

test("schema invariant assessment fails closed when a required invariant is missing", () => {
  const assessment = assessProductionSchemaInvariants([
    {
      invariant_key: "research_schedule_slots",
      healthy: true,
      detail: { morning: "09:30:00", evening: "21:30:00" },
    },
  ]);

  assert.equal(assessment.healthy, false);
  assert.deepEqual(
    assessment.invariantFailures.map((item) => item.invariant_key),
    ["story_maintenance_evidence_provenance"],
  );
  assert.deepEqual(assessment.invariantFailures[0].detail, {
    reason: "missing_invariant",
  });
});

test("schema guard returns drift when production state invariants fail", async () => {
  const response = await handleProductionSchemaDriftWithDependencies(
    request({ expectedDeploymentSha: deployedSha, migrations: manifest() }),
    {
      authorize: authorized,
      deploymentSha: () => deployedSha,
      loadAppliedMigrations: async () => [
        { version: "20260930181142", name: "market_motion_v1" },
        { version: "20260930224033", name: "research_gap_lifecycle" },
        { version: "20261001185600", name: "transcript_motion_leads" },
        { version: "20261002010000", name: "production_schema_drift_guard" },
      ],
      loadSchemaInvariants: async () => [
        {
          invariant_key: "research_schedule_slots",
          healthy: true,
          detail: { morning: "09:30:00", evening: "21:30:00" },
        },
        {
          invariant_key: "story_maintenance_evidence_provenance",
          healthy: false,
          detail: { functionExists: true, triggerExists: false },
        },
      ],
      logger: () => undefined,
    },
  );

  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.status, "drift");
  assert.deepEqual(
    body.invariantFailures.map((item: { invariant_key: string }) => item.invariant_key),
    ["story_maintenance_evidence_provenance"],
  );
});

test("schema guard waits for the exact production deployment before inspecting schema", async () => {
  let loadCalls = 0;
  const response = await handleProductionSchemaDriftWithDependencies(
    request({ expectedDeploymentSha: deployedSha, migrations: manifest() }),
    {
      authorize: authorized,
      deploymentSha: () => "b".repeat(40),
      loadAppliedMigrations: async () => {
        loadCalls += 1;
        return [];
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(loadCalls, 0);
  assert.equal((await response.json()).status, "deployment_pending");
});

test("schema guard rejects unauthorised callers", async () => {
  const response = await handleProductionSchemaDriftWithDependencies(
    request({ expectedDeploymentSha: deployedSha, migrations: manifest() }),
    {
      authorize: async () => ({ authorized: false }),
      deploymentSha: () => deployedSha,
      loadAppliedMigrations: async () => [],
    },
  );
  assert.equal(response.status, 401);
});

async function signedSchemaRequest(overrides: Record<string, string> = {}) {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const subject =
    "repo:clydigital@184374203/alchemy-live-market-desk@1317040018:ref:refs/heads/main";
  const claims = {
    repository: "clydigital/alchemy-live-market-desk",
    repository_id: "1317040018",
    workflow_ref:
      "clydigital/alchemy-live-market-desk/.github/workflows/verify-production-schema.yml@refs/heads/main",
    workflow_sha: deployedSha,
    event_name: "push",
    ref: "refs/heads/main",
    ref_type: "branch",
    actor: "clydigital",
    run_id: "54321",
    ...overrides,
  };
  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: "test-key" })
    .setIssuer("https://token.actions.githubusercontent.com")
    .setAudience(PRODUCTION_SCHEMA_GUARD_AUDIENCE)
    .setSubject(subject)
    .setJti("schema-guard-token")
    .setIssuedAt()
    .setNotBefore("-1s")
    .setExpirationTime("5m")
    .sign(privateKey);

  return {
    request: new Request("https://example.com/api/admin/system/schema-drift", {
      headers: { authorization: `Bearer ${token}` },
    }),
    publicKey,
  };
}

test("schema OIDC accepts only the dedicated production verification workflow", async () => {
  const { request: validRequest, publicKey } = await signedSchemaRequest();
  assert.deepEqual(
    await verifyGitHubActionsProductionSchemaGuard(validRequest, publicKey),
    {
      authorized: true,
      actor: "clydigital",
      githubRunId: "54321",
      workflowSha: deployedSha,
    },
  );

  const { request: wrongWorkflow, publicKey: otherKey } = await signedSchemaRequest({
    workflow_ref:
      "clydigital/alchemy-live-market-desk/.github/workflows/run-live-research.yml@refs/heads/main",
  });
  assert.deepEqual(
    await verifyGitHubActionsProductionSchemaGuard(wrongWorkflow, otherKey),
    { authorized: false },
  );
});

test("production schema guard wiring remains read-only and post-deploy", () => {
  const workflow = readFileSync(
    ".github/workflows/verify-production-schema.yml",
    "utf8",
  );
  const migration = readFileSync(
    "supabase/migrations/20261002024600_production_schema_drift_guard.sql",
    "utf8",
  );
  const invariantMigration = readFileSync(
    "supabase/migrations/20261006055000_production_schema_state_invariants.sql",
    "utf8",
  );
  const route = readFileSync(
    "app/api/admin/system/schema-drift/route.ts",
    "utf8",
  );

  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- main/);
  assert.match(workflow, /expectedDeploymentSha/);
  assert.match(workflow, /deployment_pending/);
  assert.match(workflow, /api\/admin\/system\/schema-drift/);
  assert.match(migration, /security invoker/i);
  assert.ok(migration.includes("revoke all on function public.live_desk_applied_migrations()"));
  assert.doesNotMatch(migration, /security definer/i);
  assert.match(invariantMigration, /live_desk_schema_invariants/);
  assert.match(invariantMigration, /09:30:00/);
  assert.match(invariantMigration, /21:30:00/);
  assert.match(invariantMigration, /stories_enrich_maintenance_evidence_context/);
  assert.match(invariantMigration, /security invoker/i);
  assert.match(route, /handleProductionSchemaDriftWithDependencies/);
});
