import assert from "node:assert/strict";
import test from "node:test";

import {
  enqueueDossierMotionStoryRefreshRequests,
} from "../lib/dossier-v2/motion-story-refresh-queue.ts";
import {
  DOSSIER_MOTION_STORY_REFRESH_REQUEST_VERSION,
  type DossierMotionStoryRefreshRequest,
} from "../lib/dossier-v2/motion-story-refresh-request.ts";

const MOTION_ID = "11111111-1111-4111-8111-111111111111";
const STORY_ID = "22222222-2222-4222-8222-222222222222";
const RUN_ID = "33333333-3333-4333-8333-333333333333";
const EVIDENCE_ID = "44444444-4444-4444-8444-444444444444";
const PACKET_EVIDENCE_ID = "research-intake:exact-item";

function request(
  overrides: Partial<DossierMotionStoryRefreshRequest> = {},
): DossierMotionStoryRefreshRequest {
  return {
    contract_version: DOSSIER_MOTION_STORY_REFRESH_REQUEST_VERSION,
    dossier_id: "55555555-5555-4555-8555-555555555555",
    request_kind: "REASSESS_STORY",
    authority: "REEVALUATION_REQUEST_ONLY",
    motion_id: MOTION_ID,
    story_id: STORY_ID,
    packet_evidence_id: PACKET_EVIDENCE_ID,
    decision: "ACCEPT",
    reason: "System 2 accepted the exact Story implication.",
    evidence_references: [PACKET_EVIDENCE_ID],
    story_implication: "Reassess the exact linked Story.",
    regime_implication: "Keep the exact Regime implication under review.",
    investigation_next: null,
    refined_motion: null,
    priority_signals: {
      materiality: 94,
      relevance: 92,
      novelty: 80,
    },
    ...overrides,
  };
}

type Row = Record<string, unknown>;

function fakeClient(input: {
  motions?: Row[];
  evidence?: Row[];
  stories?: Row[];
  existing?: Row[];
  failTable?: string;
}) {
  const inserted: Row[] = [];
  const calls: Array<{ table: string; op: string; args: unknown[] }> = [];

  function resultFor(table: string) {
    if (input.failTable === table) {
      return { data: null, error: { message: `forced ${table} failure` } };
    }
    if (table === "market_motion_items") return { data: input.motions ?? [], error: null };
    if (table === "intelligence_evidence") return { data: input.evidence ?? [], error: null };
    if (table === "stories") return { data: input.stories ?? [], error: null };
    if (table === "intelligence_reevaluation_queue") return { data: input.existing ?? [], error: null };
    throw new Error(`unexpected table ${table}`);
  }

  const client = {
    from(table: string) {
      const query = {
        select(...args: unknown[]) {
          calls.push({ table, op: "select", args });
          return query;
        },
        eq(...args: unknown[]) {
          calls.push({ table, op: "eq", args });
          return query;
        },
        in(...args: unknown[]) {
          calls.push({ table, op: "in", args });
          return query;
        },
        limit(...args: unknown[]) {
          calls.push({ table, op: "limit", args });
          return query;
        },
        insert(rows: Row[]) {
          calls.push({ table, op: "insert", args: [rows] });
          inserted.push(...rows);
          return Promise.resolve(
            input.failTable === table
              ? { data: null, error: { message: `forced ${table} failure` } }
              : { data: rows, error: null },
          );
        },
        then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve(resultFor(table)).then(resolve, reject);
        },
      };
      return query;
    },
  };

  return { client, calls, inserted };
}

function exactMotion(overrides: Row = {}) {
  return {
    id: MOTION_ID,
    research_run_id: RUN_ID,
    primary_story_id: STORY_ID,
    metadata: { itemKey: "exact-item" },
    ...overrides,
  };
}

function exactEvidence(overrides: Row = {}) {
  return {
    id: EVIDENCE_ID,
    external_evidence_id: PACKET_EVIDENCE_ID,
    research_run_id: RUN_ID,
    structured_payload: { itemKey: "exact-item" },
    ...overrides,
  };
}

test("C1.2a queues only the exact Motion-run-itemKey-evidence-Story tuple", async () => {
  const fake = fakeClient({
    motions: [exactMotion()],
    evidence: [
      exactEvidence(),
      {
        id: "66666666-6666-4666-8666-666666666666",
        external_evidence_id: "research-intake:other",
        research_run_id: RUN_ID,
        structured_payload: { itemKey: "exact-item" },
      },
    ],
    stories: [{ id: STORY_ID, status: "published" }],
  });

  const result = await enqueueDossierMotionStoryRefreshRequests({
    client: fake.client as never,
    requests: [request()],
    availableAt: "2026-10-04T00:30:00.000Z",
  });

  assert.equal(result.status, "queued");
  assert.equal(result.resolved, 1);
  assert.equal(result.enqueued, 1);
  assert.equal(result.skipped_existing, 0);
  assert.deepEqual(result.rejected, []);
  assert.equal(result.queue_rows[0]?.evidence_id, EVIDENCE_ID);
  assert.equal(result.queue_rows[0]?.story_id, STORY_ID);
  assert.match(result.queue_rows[0]?.reason || "", /^dossier_motion_refresh:/);

  assert.equal(fake.inserted.length, 1);
  assert.deepEqual(fake.inserted[0], {
    target_kind: "story",
    target_id: STORY_ID,
    requested_by_evidence_id: EVIDENCE_ID,
    reason: `dossier_motion_refresh:${request().dossier_id}:${MOTION_ID}:ACCEPT`,
    priority: result.queue_rows[0]?.priority,
    status: "pending",
    available_at: "2026-10-04T00:30:00.000Z",
  });
});

test("C1.2a refuses a Story target that does not equal the immutable Motion Story ID", async () => {
  const fake = fakeClient({
    motions: [exactMotion({ primary_story_id: "77777777-7777-4777-8777-777777777777" })],
    evidence: [exactEvidence()],
    stories: [{ id: STORY_ID, status: "published" }],
  });

  const result = await enqueueDossierMotionStoryRefreshRequests({
    client: fake.client as never,
    requests: [request()],
    availableAt: "2026-10-04T00:30:00.000Z",
  });

  assert.equal(result.enqueued, 0);
  assert.equal(result.rejected[0]?.reason, "MOTION_STORY_MISMATCH");
  assert.equal(fake.inserted.length, 0);
});

test("C1.2a refuses packet evidence that does not resolve through the exact Motion run and itemKey", async () => {
  const fake = fakeClient({
    motions: [exactMotion()],
    evidence: [exactEvidence({
      structured_payload: { itemKey: "different-item" },
    })],
    stories: [{ id: STORY_ID, status: "published" }],
  });

  const result = await enqueueDossierMotionStoryRefreshRequests({
    client: fake.client as never,
    requests: [request()],
    availableAt: "2026-10-04T00:30:00.000Z",
  });

  assert.equal(result.enqueued, 0);
  assert.equal(result.rejected[0]?.reason, "CANONICAL_EVIDENCE_NOT_FOUND");
});

test("C1.2a fails closed when exact Motion identity maps to more than one canonical evidence UUID", async () => {
  const fake = fakeClient({
    motions: [exactMotion()],
    evidence: [
      exactEvidence(),
      exactEvidence({ id: "88888888-8888-4888-8888-888888888888" }),
    ],
    stories: [{ id: STORY_ID, status: "published" }],
  });

  const result = await enqueueDossierMotionStoryRefreshRequests({
    client: fake.client as never,
    requests: [request()],
    availableAt: "2026-10-04T00:30:00.000Z",
  });

  assert.equal(result.enqueued, 0);
  assert.equal(result.rejected[0]?.reason, "CANONICAL_EVIDENCE_AMBIGUOUS");
});

test("C1.2a refuses discarded Stories even when Motion and evidence identities are exact", async () => {
  const fake = fakeClient({
    motions: [exactMotion()],
    evidence: [exactEvidence()],
    stories: [{ id: STORY_ID, status: "discarded" }],
  });

  const result = await enqueueDossierMotionStoryRefreshRequests({
    client: fake.client as never,
    requests: [request()],
    availableAt: "2026-10-04T00:30:00.000Z",
  });

  assert.equal(result.enqueued, 0);
  assert.equal(result.rejected[0]?.reason, "STORY_DISCARDED");
});

test("C1.2a dedupes an already active exact Story-evidence reevaluation", async () => {
  const fake = fakeClient({
    motions: [exactMotion()],
    evidence: [exactEvidence()],
    stories: [{ id: STORY_ID, status: "published" }],
    existing: [{
      target_id: STORY_ID,
      requested_by_evidence_id: EVIDENCE_ID,
      status: "pending",
    }],
  });

  const result = await enqueueDossierMotionStoryRefreshRequests({
    client: fake.client as never,
    requests: [request()],
    availableAt: "2026-10-04T00:30:00.000Z",
  });

  assert.equal(result.status, "queued");
  assert.equal(result.resolved, 1);
  assert.equal(result.enqueued, 0);
  assert.equal(result.skipped_existing, 1);
  assert.equal(fake.inserted.length, 0);
});

test("C1.2a invalid UUIDs fail before any queue insert", async () => {
  const fake = fakeClient({});

  const result = await enqueueDossierMotionStoryRefreshRequests({
    client: fake.client as never,
    requests: [request({ motion_id: "not-a-uuid" })],
    availableAt: "2026-10-04T00:30:00.000Z",
  });

  assert.equal(result.status, "empty");
  assert.equal(result.rejected[0]?.reason, "INVALID_ID");
  assert.equal(fake.inserted.length, 0);
});

test("C1.2a database failure is returned as failed instead of mutating another surface", async () => {
  const fake = fakeClient({
    motions: [exactMotion()],
    failTable: "market_motion_items",
  });

  const result = await enqueueDossierMotionStoryRefreshRequests({
    client: fake.client as never,
    requests: [request()],
    availableAt: "2026-10-04T00:30:00.000Z",
  });

  assert.equal(result.status, "failed");
  assert.match(result.error || "", /forced market_motion_items failure/);
  assert.equal(fake.inserted.length, 0);
});
