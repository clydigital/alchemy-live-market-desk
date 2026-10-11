import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPresenterPrepSourceProjection,
  type PresenterPrepSourceInput,
} from "../lib/presenter-prep-source-projection.ts";

const DOSSIER_ID = "bd4979a1-4b34-45e0-9252-a92e5ee6db6a";
const DOSSIER_AS_OF = "2026-10-11T08:00:00.000Z";
const CURRENT_ID = "edition-current";
const OLD_ID = "edition-old";

function fixture(historical = false): PresenterPrepSourceInput {
  const editionId = historical ? OLD_ID : CURRENT_ID;
  return {
    requestedEditionId: historical ? OLD_ID : null,
    selectedEditionId: editionId,
    currentEditionId: CURRENT_ID,
    editionSelectionStatus: historical ? "historical" : "current",
    exactDossier: { id: DOSSIER_ID, asOf: DOSSIER_AS_OF },
    selectedEdition: {
      id: editionId,
      publishedAt: "2026-10-11T09:00:00.000Z",
      payload: {
        presenterDossierContext: {
          contractVersion: "presenter-dossier-edition-context/1",
          status: "BOUND",
          dossierId: DOSSIER_ID,
          dossierAsOf: DOSSIER_AS_OF,
        },
        canonicalStoryManifest: [{
          storyId: "story-1",
          snapshotId: "story-snapshot-1",
          thesisVersionId: "thesis-1",
          state: { slug: "rates" },
          reasoning: {
            contractVersion: "canonical-story-reasoning/v1",
            storyId: "story-1",
            storyVersionId: "thesis-1",
            title: "The cost of capital",
          },
        }],
        marketMotion: {
          contractVersion: "market-motion-edition/v1",
          items: [{
            id: "motion-1",
            storyId: "story-1",
            storySlug: "rates",
            headline: "Yields moved",
            regimeSlug: "us-rate-regime",
            verificationState: "VERIFIED",
            lifecycleState: "PROMOTED",
            sourceName: "Primary source",
            sourceUrl: "https://example.com/release",
          }],
        },
        journey: {
          contractVersion: "journey-briefing/v1",
          chronology: [{
            id: "event-row-1",
            eventId: "event-1",
            title: "Treasury auction",
          }],
          horizon: { today: [], tonight: [], later: [] },
        },
      },
    },
    researchGapStatus: {
      contractVersion: "hybrid-research-gap-status/2",
      dossierId: DOSSIER_ID,
      dossierAsOf: DOSSIER_AS_OF,
      items: [{
        gapKey: "gap-1",
        lifecycleStatus: "HANDED_OFF",
        researchOutcome: "CONFIRMING",
        caseMatchesSelectedDossier: true,
        measurementVerification: "VERIFIED",
      }, {
        gapKey: "stale-gap",
        lifecycleStatus: "HANDED_OFF",
        researchOutcome: "CONFIRMING",
        caseMatchesSelectedDossier: false,
      }],
    },
  };
}

test("valid current edition pins the Dossier and exact Journey URL", () => {
  const result = buildPresenterPrepSourceProjection(fixture());
  assert.equal(result.status, "READY");
  assert.equal(result.scope, "CURRENT");
  assert.equal(result.pinned?.dossierId, DOSSIER_ID);
  assert.match(result.journeyHref || "", /edition=edition-current/);
  assert.deepEqual(result.stories.map((item) => item.storyId), ["story-1"]);
  assert.deepEqual(result.motions.map((item) => item.motionId), ["motion-1"]);
  assert.deepEqual(result.events.map((item) => item.eventId), ["event-1"]);
  assert.deepEqual(result.regimes, ["us-rate-regime"]);
});

test("historical edition binds frozen Dossier and links back to its own snapshot", () => {
  const input = fixture(true);
  input.focus = { story: "rates", motion: "motion-1", regime: "us-rate-regime", event: "event-1" };
  const result = buildPresenterPrepSourceProjection(input);
  assert.equal(result.status, "READY");
  assert.equal(result.scope, "HISTORICAL");
  assert.match(result.journeyHref || "", /edition=edition-old/);
  assert.match(result.journeyHref || "", /motion=motion-1/);
  assert.match(result.journeyHref || "", /event=event-1/);
});

test("invalid edition fallback cannot leak current-source segments", () => {
  const input = fixture();
  input.requestedEditionId = OLD_ID;
  input.editionSelectionStatus = "invalid_fallback_current";
  const result = buildPresenterPrepSourceProjection(input);
  assert.equal(result.status, "UNAVAILABLE");
  assert.equal(result.reason, "INVALID_EDITION");
  assert.deepEqual(result.stories, []);
  assert.deepEqual(result.motions, []);
  assert.equal(result.journeyHref, null);
});

test("a valid-looking requested edition mismatched to actual selection fails closed", () => {
  const input = fixture();
  input.requestedEditionId = OLD_ID;
  const result = buildPresenterPrepSourceProjection(input);
  assert.equal(result.reason, "INVALID_EDITION");
  assert.deepEqual(result.events, []);
});

test("selected edition metadata and payload must match", () => {
  const input = fixture();
  input.selectedEditionId = "different";
  const result = buildPresenterPrepSourceProjection(input);
  assert.equal(result.reason, "EDITION_IDENTITY_UNAVAILABLE");
});

test("historical edition without exact frozen Dossier is unavailable", () => {
  const input = fixture(true);
  input.exactDossier = null;
  const result = buildPresenterPrepSourceProjection(input);
  assert.equal(result.reason, "EXACT_DOSSIER_READ_UNAVAILABLE");
  assert.equal(result.pinned, null);
  assert.deepEqual(result.stories, []);
});

test("missing frozen context and mismatched Dossier as-of both fail closed", () => {
  const noContext = fixture();
  delete noContext.selectedEdition!.payload.presenterDossierContext;
  assert.equal(buildPresenterPrepSourceProjection(noContext).reason, "FROZEN_DOSSIER_UNAVAILABLE");
  const wrongVintage = fixture(true);
  wrongVintage.exactDossier = { id: DOSSIER_ID, asOf: "2026-10-12T08:00:00Z" };
  assert.equal(buildPresenterPrepSourceProjection(wrongVintage).reason, "DOSSIER_IDENTITY_MISMATCH");
});

test("invalid Story, Motion, Regime and Event references each suppress all segments", () => {
  for (const focus of [
    { story: "unrelated-story" },
    { motion: "unrelated-motion" },
    { regime: "unrelated-regime" },
    { event: "unrelated-event" },
  ]) {
    const input = fixture(true);
    input.focus = focus;
    const result = buildPresenterPrepSourceProjection(input);
    assert.equal(result.status, "UNAVAILABLE", JSON.stringify(focus));
    assert.deepEqual(result.stories, []);
    assert.deepEqual(result.motions, []);
    assert.equal(result.journeyHref, null);
  }
});

test("Research Gap handoff is never promoted into verified market evidence", () => {
  const result = buildPresenterPrepSourceProjection(fixture());
  assert.deepEqual(result.researchGaps, [{
    gapKey: "gap-1",
    lifecycleStatus: "HANDED_OFF",
    researchOutcome: "CONFIRMING",
    measurementVerification: "NOT_PROVEN",
  }]);
  const mismatch = fixture();
  mismatch.researchGapStatus!.dossierId = "other-dossier";
  assert.deepEqual(buildPresenterPrepSourceProjection(mismatch).researchGaps, []);
});

test("empty news day remains valid with zero source-derived items", () => {
  const input = fixture();
  input.selectedEdition!.payload.canonicalStoryManifest = [];
  input.selectedEdition!.payload.marketMotion = {
    contractVersion: "market-motion-edition/v1",
    items: [],
  };
  input.selectedEdition!.payload.journey = {
    contractVersion: "journey-briefing/v1",
    chronology: [],
    horizon: { today: [], tonight: [], later: [] },
  };
  input.researchGapStatus = null;
  const result = buildPresenterPrepSourceProjection(input);
  assert.equal(result.status, "READY");
  assert.equal(result.stories.length, 0);
  assert.equal(result.motions.length, 0);
  assert.equal(result.events.length, 0);
  assert.equal(result.researchGaps.length, 0);
});
