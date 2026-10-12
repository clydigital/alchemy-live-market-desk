import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultPresenterSegments,
  presenterSessionReadiness,
  readPresenterSessionDraft,
  PRESENTER_PREP_SESSION_VERSION,
} from "../lib/presenter-prep-session.ts";

const EDITION = "edition-2026-10-11";
const DOSSIER = "dossier-2026-10-11";

function saved() {
  return {
    version: PRESENTER_PREP_SESSION_VERSION,
    editionId: EDITION,
    dossierId: DOSSIER,
    segments: defaultPresenterSegments(),
  };
}

test("default presenter plan targets exactly 60 minutes without asserting evidence", () => {
  const segments = defaultPresenterSegments();
  const state = presenterSessionReadiness(segments);
  assert.equal(segments.length, 5);
  assert.equal(state.totalMinutes, 60);
  assert.equal(state.preparedCount, 0);
  assert.equal(state.readyForOnAir, false);
});

test("a presenter can complete the running order independently of market evidence", () => {
  const segments = defaultPresenterSegments().map((item) => ({ ...item, prepared: true }));
  const state = presenterSessionReadiness(segments);
  assert.equal(state.readyForOnAir, true);
  assert.equal(state.totalMinutes, 60);
});

test("a 59-minute draft is not a complete 60-minute running order", () => {
  const segments = defaultPresenterSegments().map((item) => ({ ...item, prepared: true }));
  segments[0]!.minutes = 0;
  assert.equal(presenterSessionReadiness(segments).readyForOnAir, false);
});

test("stored notes cannot cross immutable edition or Dossier identities", () => {
  assert.equal(readPresenterSessionDraft(saved(), "another-edition", DOSSIER), null);
  assert.equal(readPresenterSessionDraft(saved(), EDITION, "another-dossier"), null);
  assert.ok(readPresenterSessionDraft(saved(), EDITION, DOSSIER));
});

test("malformed, duplicated and unbounded blocks fail closed", () => {
  const malformed = saved();
  malformed.segments[0]!.minutes = 90;
  assert.equal(readPresenterSessionDraft(malformed, EDITION, DOSSIER), null);
  const repeated = saved();
  repeated.segments[1]!.id = repeated.segments[0]!.id;
  assert.equal(readPresenterSessionDraft(repeated, EDITION, DOSSIER), null);
});

test("presenter-owned order and notes survive validated restore", () => {
  const draft = saved();
  draft.segments.reverse();
  draft.segments[0]!.notes = "Discuss the event calendar without guessing a market outcome.";
  const restored = readPresenterSessionDraft(draft, EDITION, DOSSIER);
  assert.equal(restored?.[0]?.id, "talking-points-and-qa");
  assert.equal(restored?.[0]?.notes, draft.segments[0]!.notes);
  assert.deepEqual(defaultPresenterSegments().map((item) => item.minutes), [1, 20, 15, 10, 14]);
});
