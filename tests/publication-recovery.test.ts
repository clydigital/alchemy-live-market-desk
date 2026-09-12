import assert from "node:assert/strict";
import test from "node:test";

import { persistOrReuseCanonicalArtifact } from "../lib/intelligence/canonical-publication-idempotency.ts";
import { IntelligenceDatabaseError } from "../lib/intelligence/database-error.ts";
import {
  nextPublicationRecoveryStep,
  publicationFailureDisposition,
  resumePublicationAfterCompletedEngine,
  type CompletedEnginePublicationCheckpoint,
} from "../lib/intelligence/publication-recovery.ts";

function checkpoint(overrides: Partial<CompletedEnginePublicationCheckpoint> = {}): CompletedEnginePublicationCheckpoint {
  return {
    engineRunId: "engine-1",
    engineStatus: "completed",
    storiesPublished: 2,
    engineWarnings: [],
    storySnapshotCount: 0,
    baseEditionId: null,
    composedEditionId: null,
    ...overrides,
  };
}

test("completed engine resumes Story freeze and creates exactly one base without rerunning the engine", async () => {
  let engineRuns = 0;
  let storySnapshots = 0;
  let baseEditionId: string | null = null;
  let attempts = 0;
  const freezeAndPublishBase = async () => {
    attempts += 1;
    if (attempts === 1) throw new DOMException("The operation was aborted", "TimeoutError");
    storySnapshots = 2;
    baseEditionId ||= "base-1";
    return baseEditionId;
  };

  await assert.rejects(
    resumePublicationAfterCompletedEngine({
      checkpoint: checkpoint(),
      freezeAndPublishBase,
      compose: async () => "not-called",
    }),
    /aborted/,
  );
  const recovered = await resumePublicationAfterCompletedEngine({
    checkpoint: checkpoint({ storySnapshotCount: storySnapshots, baseEditionId }),
    freezeAndPublishBase,
    compose: async () => "not-called",
  });

  assert.equal(engineRuns, 0);
  assert.equal(storySnapshots, 2);
  assert.equal(baseEditionId, "base-1");
  assert.equal(recovered.status, "base_ready");
  assert.equal(attempts, 2);
});

test("a base persisted before outer state update is reused and recovery advances to composition", async () => {
  let baseWrites = 0;
  let compositions = 0;
  let durable = checkpoint();
  const first = await resumePublicationAfterCompletedEngine({
    checkpoint: durable,
    freezeAndPublishBase: async () => {
      baseWrites += 1;
      durable = checkpoint({ storySnapshotCount: 2, baseEditionId: "base-1" });
      return "base-1";
    },
    compose: async () => "not-called",
  });
  assert.equal(first.status, "base_ready");

  // Simulate process death before research_runs was updated, then re-read only
  // the durable artifacts on retry.
  const retried = await resumePublicationAfterCompletedEngine({
    checkpoint: durable,
    freezeAndPublishBase: async () => {
      baseWrites += 1;
      return "duplicate";
    },
    compose: async () => {
      compositions += 1;
      return "composed-1";
    },
  });
  assert.equal(baseWrites, 1);
  assert.equal(compositions, 1);
  assert.equal(retried.status, "complete");
  assert.equal(retried.baseEditionId, "base-1");
});

test("composition timeout leaves the base selectable and independently retryable", async () => {
  const durable = checkpoint({ storySnapshotCount: 2, baseEditionId: "base-1" });
  let compositionAttempts = 0;
  await assert.rejects(
    resumePublicationAfterCompletedEngine({
      checkpoint: durable,
      freezeAndPublishBase: async () => "not-called",
      compose: async () => {
        compositionAttempts += 1;
        throw new DOMException("composition timed out", "TimeoutError");
      },
    }),
    /timed out/,
  );
  assert.equal(durable.baseEditionId, "base-1");
  assert.equal(nextPublicationRecoveryStep(durable), "compose");
  assert.equal(publicationFailureDisposition(true), "resumable");

  const retried = await resumePublicationAfterCompletedEngine({
    checkpoint: durable,
    freezeAndPublishBase: async () => "not-called",
    compose: async () => {
      compositionAttempts += 1;
      return "composed-1";
    },
  });
  assert.equal(retried.status, "complete");
  assert.equal(compositionAttempts, 2);
});

test("racing base inserts converge on the single valid canonical artifact", async () => {
  let canonicalBase: { id: string; phase: string } | null = null;
  let successfulInserts = 0;
  let arrivals = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });

  const attempt = () => persistOrReuseCanonicalArtifact({
    readExisting: async () => canonicalBase,
    insert: async () => {
      arrivals += 1;
      if (arrivals === 2) release();
      await gate;
      if (canonicalBase) {
        throw new IntelligenceDatabaseError(409, "duplicate key value violates unique constraint");
      }
      successfulInserts += 1;
      canonicalBase = { id: "base-1", phase: "base" };
      return canonicalBase;
    },
    isValid: (row) => row.id === "base-1" && row.phase === "base",
    missingMessage: "base missing",
  });

  const [first, second] = await Promise.all([attempt(), attempt()]);
  assert.equal(successfulInserts, 1);
  assert.equal((canonicalBase as { id: string; phase: string } | null)?.id, "base-1");
  assert.deepEqual(new Set([first.value.id, second.value.id]), new Set(["base-1"]));
  assert.equal([first.reused, second.reused].filter(Boolean).length, 1);
});

test("failure before engine completion remains terminal and is not publication recovery", async () => {
  const failedCheckpoint = checkpoint({ engineRunId: null, engineStatus: "failed" });
  assert.equal(nextPublicationRecoveryStep(failedCheckpoint), "not_eligible");
  assert.equal(publicationFailureDisposition(false), "terminal");
  await assert.rejects(
    resumePublicationAfterCompletedEngine({
      checkpoint: failedCheckpoint,
      freezeAndPublishBase: async () => "base-1",
      compose: async () => "composed-1",
    }),
    /durably completed intelligence engine/,
  );
});

test("non-conflict database failures are not swallowed as idempotent success", async () => {
  await assert.rejects(
    persistOrReuseCanonicalArtifact({
      readExisting: async () => null,
      insert: async () => {
        throw new IntelligenceDatabaseError(503, "database unavailable");
      },
      isValid: () => true,
      missingMessage: "missing",
    }),
    /503/,
  );
});
