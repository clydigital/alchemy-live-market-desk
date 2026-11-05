import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  BLUE_DESK_DOSSIER_CLEARANCE_V1,
  BLUE_DESK_PUBLIC_DOSSIER_CANDIDATE_V1,
  PUBLIC_DOSSIER_ROUTE_ENABLED,
  buildPublicDossierReviewCandidate,
  type DossierStoryEditorialClearance,
} from "../lib/blue-desk/contracts/public-dossier-candidate-v1.ts";
import type { DossierPresentationV1 } from "../lib/dossier-v2/presentation-adapter.ts";

const dossierId = "744bf6a3-7547-4ccb-ae94-18fa53a14f15";
const storyId = "6e2c8a8c-fdc7-45eb-bec6-b685b0311f3e";
const evidenceId = "c3776638-d2cb-40e1-acf7-36850d992edc";
const asOf = "2026-10-21T10:49:39.969Z";

/** Synthetic text and provenance, never an assertion about the real AI Story. */
const makeDossier = (): DossierPresentationV1 => ({
  dossierId, asOf,
  whatMattersNow: { stories: [{
    id: storyId, persistentStoryId: storyId,
    title: "Illustrative issuer release", whatChanged: "The issuer published a filing.",
    whyItMatters: "It supplies an observation for review.", evidenceRefs: [evidenceId],
  }] },
  diagnostics: { notes: ["private prompt"], omittedOrDemotedItems: ["private"], modelRepairUsed: true },
  decisionPacket: { private: "do not reveal" },
  creatorThemes: [{ private: "creator lead" }],
  rateRegime: { private: "nested research" },
} as unknown as DossierPresentationV1);

const makeClearance = (): DossierStoryEditorialClearance => ({
  contractVersion: BLUE_DESK_DOSSIER_CLEARANCE_V1,
  dossierId, asOf, analyticalStoryId: storyId,
  approvedText: {
    title: "Illustrative issuer release", whatChanged: "The issuer published a filing.",
    whyItMatters: "It supplies an observation for review.",
  },
  evidence: [{
    evidenceId, sourceName: "Illustrative issuer", originalSourceUrl: "https://example.org/filing",
    sourcePublishedAt: "2026-10-20T12:00:00Z", availableAt: "2026-10-20T13:00:00Z",
    sourceKind: "PRIMARY_ORIGINAL", redistributionRights: "PUBLIC_REDISTRIBUTION_CLEARED",
  }],
});

test("P−1b is only a candidate contract: no release flag or route", () => {
  assert.equal(PUBLIC_DOSSIER_ROUTE_ENABLED, false);
  assert.equal(BLUE_DESK_PUBLIC_DOSSIER_CANDIDATE_V1, "blue-desk-public-dossier-candidate/1");
  assert.deepEqual(buildPublicDossierReviewCandidate(null), {
    contractVersion: BLUE_DESK_PUBLIC_DOSSIER_CANDIDATE_V1,
    status: "UNAVAILABLE", published: false, dossier: null, story: null,
  });
  const empty = buildPublicDossierReviewCandidate(makeDossier());
  assert.equal(empty.status, "REVIEW_REQUIRED");
  assert.equal(empty.story, null);
  assert.equal(empty.published, false);
});

test("exact synthetic approval creates a minimal review-only source-backed candidate", () => {
  const candidate = buildPublicDossierReviewCandidate(makeDossier(), makeClearance());
  assert.equal(candidate.status, "REVIEWED_CANDIDATE");
  assert.equal(candidate.published, false);
  assert.deepEqual(Object.keys(candidate).sort(), ["contractVersion", "dossier", "published", "status", "story"]);
  assert.deepEqual(Object.keys(candidate.story!).sort(), [
    "analyticalStoryId", "marketReaction", "persistentStoryId", "sources", "title", "whatChanged", "whyItMatters",
  ]);
  assert.deepEqual(Object.keys(candidate.story!.sources[0]).sort(), [
    "availableAt", "evidenceId", "originalSourceUrl", "sourceName", "sourcePublishedAt",
  ]);
  assert.equal(candidate.story?.marketReaction, "UNVERIFIED");
  const json = JSON.stringify(candidate);
  for (const forbidden of ["diagnostics", "creatorThemes", "decisionPacket", "rateRegime", "memory",
    "technical", "owner", "private prompt", "sourceHealth", "researchNow", "thesisChanges"]) {
    assert.ok(!json.includes(forbidden), forbidden);
  }
});

test("wrong Dossier, as-of, evidence or Story identity fails closed", () => {
  for (const edit of [
    (c: DossierStoryEditorialClearance) => { c.dossierId = "00000000-0000-4000-8000-000000000001"; },
    (c: DossierStoryEditorialClearance) => { c.asOf = "2026-10-22T10:49:39.969Z"; },
    (c: DossierStoryEditorialClearance) => { c.analyticalStoryId = "not-a-stored-story"; },
    (c: DossierStoryEditorialClearance) => { c.evidence[0].evidenceId = "00000000-0000-4000-8000-000000000002"; },
    (c: DossierStoryEditorialClearance) => { c.evidence = []; },
  ]) {
    const c = makeClearance(); edit(c);
    const result = buildPublicDossierReviewCandidate(makeDossier(), c);
    assert.equal(result.status, "REVIEW_REQUIRED"); assert.equal(result.story, null);
  }
});

test("every narrative field is bound to the exact reviewed text", () => {
  for (const key of ["title", "whatChanged", "whyItMatters"] as const) {
    const c = makeClearance(); c.approvedText[key] += " New claim";
    assert.equal(buildPublicDossierReviewCandidate(makeDossier(), c).story, null);
  }
});

test("unreviewed contradicting, unresolved and additional references are blocked", () => {
  for (const key of ["confirmingEvidenceRefs", "contradictingEvidenceRefs", "unresolvedEvidenceRefs", "acceleratingEvidenceRefs"] as const) {
    const d = makeDossier();
    d.whatMattersNow.stories[0][key] = ["00000000-0000-4000-8000-000000000003"];
    assert.equal(buildPublicDossierReviewCandidate(d, makeClearance()).story, null);
  }
  const d = makeDossier(); d.whatMattersNow.stories[0].evidenceRefs = [evidenceId, evidenceId];
  assert.equal(buildPublicDossierReviewCandidate(d, makeClearance()).story, null);
});

test("creator, rights, secondary, unsafe URL and missing publication time fail closed", () => {
  for (const edit of [
    (c: DossierStoryEditorialClearance) => { c.evidence[0].sourceKind = "CREATOR_TRANSCRIPT"; },
    (c: DossierStoryEditorialClearance) => { c.evidence[0].sourceKind = "SECONDARY"; },
    (c: DossierStoryEditorialClearance) => { c.evidence[0].redistributionRights = "UNKNOWN"; },
    (c: DossierStoryEditorialClearance) => { c.evidence[0].originalSourceUrl = "https://youtube.com/watch?v=test"; },
    (c: DossierStoryEditorialClearance) => { c.evidence[0].originalSourceUrl = "https://m.youtube.com./watch?v=test"; },
    (c: DossierStoryEditorialClearance) => { c.evidence[0].originalSourceUrl = "https://example.org/filing?api_key=secret"; },
    (c: DossierStoryEditorialClearance) => { c.evidence[0].originalSourceUrl = "https://localhost/internal"; },
    (c: DossierStoryEditorialClearance) => { c.evidence[0].originalSourceUrl = "http://example.org/filing"; },
    (c: DossierStoryEditorialClearance) => { c.evidence[0].originalSourceUrl = "https://user:password@example.org/filing"; },
    (c: DossierStoryEditorialClearance) => { c.evidence[0].sourcePublishedAt = ""; },
  ]) {
    const c = makeClearance(); edit(c);
    assert.equal(buildPublicDossierReviewCandidate(makeDossier(), c).story, null);
  }
});

test("no source added after frozen as-of may enter an old Story", () => {
  for (const edit of [
    (c: DossierStoryEditorialClearance) => { c.evidence[0].availableAt = "2026-10-22T00:00:00Z"; },
    (c: DossierStoryEditorialClearance) => { c.evidence[0].sourcePublishedAt = "2026-10-22T00:00:00Z"; },
    (c: DossierStoryEditorialClearance) => { c.evidence[0].sourcePublishedAt = "2026-10-20T15:00:00Z"; },
  ]) {
    const c = makeClearance(); edit(c);
    assert.equal(buildPublicDossierReviewCandidate(makeDossier(), c).story, null);
  }
});

test("source-review projection is not wired into a new public endpoint", () => {
  const route = readFileSync(new URL("../app/api/dossier-v2/route.ts", import.meta.url), "utf8");
  const history = readFileSync(new URL("../app/api/dossier-v2/history/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(route, /public-dossier-candidate|buildPublicDossierReviewCandidate/);
  assert.doesNotMatch(history, /public-dossier-candidate|buildPublicDossierReviewCandidate/);
  assert.match(route, /getDossierV2PresentationSelection/);
});
