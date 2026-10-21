import assert from "node:assert/strict";
import test from "node:test";

import {
  composeAlchemyReportHtml,
  ReportComposerError,
} from "../lib/report-composer.ts";

function canonicalReasoning(storyId: string, versionId: string, versionNumber: number, title: string) {
  const edgeId = `edge:${storyId}`;
  return {
    contractVersion: "canonical-story-reasoning/v1",
    storyId,
    storyVersionId: versionId,
    versionNumber,
    effectiveAt: `2026-08-24T0${versionNumber}:00:00.000Z`,
    title,
    centralQuestion: `What decides ${title}?`,
    lifecycle: "developing",
    confidence: 70 + versionNumber,
    thesis: `${title} canonical thesis`,
    whatChanged: `${title} canonical change`,
    previousState: `${title} prior state`,
    currentState: `${title} current state`,
    marketReaction: `${title} market reaction`,
    acceptedExplanation: `${title} accepted mechanism`,
    claims: [
      { id: `claim:${storyId}`, type: "thesis", text: `${title} persisted claim`, evidenceIds: [`evidence:${storyId}`] },
    ],
    causalChain: [{
      id: edgeId,
      sourceHypothesisId: `hypothesis:${storyId}`,
      from: `${title} driver`,
      relationship: "transmits through",
      to: `${title} outcome`,
      evidenceState: "strongly_supported",
      evidenceIds: [`evidence:${storyId}`],
    }],
    countercase: {
      strongest: `${title} countercase`,
      evidenceIds: [`counter:${storyId}`],
      weakestLink: `${title} weakest link`,
      marketMayBeRight: `${title} market-right case`,
    },
    overlookedVariable: {
      text: `${title} overlooked variable`,
      evidenceState: "inferred",
      evidenceIds: [`overlooked:${storyId}`],
    },
    assetImplications: [{
      asset: `ASSET-${storyId}`,
      bias: "mixed",
      conviction: 61,
      baseCase: `${title} asset base case`,
      evidenceIds: [`asset-evidence:${storyId}`],
      confirmation: `${title} asset confirmation`,
      invalidation: `${title} asset invalidation`,
    }],
    confirmation: [`${title} confirmation`],
    invalidation: [`${title} invalidation`],
    nextTest: {
      id: `test:${storyId}`,
      label: `${title} next test`,
      status: "upcoming",
      catalystRef: `catalyst:${storyId}`,
      dueAt: "2026-08-25T12:00:00.000Z",
      expiresAt: null,
      evidenceIds: [`next-test:${storyId}`],
      resolutionEvidenceIds: [],
    },
    visualPlan: [{
      id: `visual:${storyId}`,
      title: `${title} canonical chain`,
      type: "linear_chain",
      edgeIds: [edgeId],
    }],
  };
}

function storyFixture(position: number, storyId: string, title: string) {
  const versionId = `version:${storyId}`;
  const snapshotId = `snapshot:${storyId}`;
  const thesisVersion = {
    id: versionId,
    version: position,
    effectiveAt: `2026-08-24T0${position}:00:00.000Z`,
    changeReason: "canonical_fixture",
  };
  const state = {
    id: storyId,
    title: `${title} immutable presentation`,
    featuredRank: position,
    thesisVersion,
    nonCanonicalTemptation: `${title} STATE SHOULD NOT RENDER`,
  };
  return {
    manifest: { position, snapshotId, storyId, state },
    snapshot: {
      id: snapshotId,
      research_run_id: "run-current",
      story_id: storyId,
      story_thesis_version_id: versionId,
      supersedes_snapshot_id: null,
      snapshot_type: "story",
      public_summary: title,
      payload: {
        canonicalStoryState: structuredClone(state),
        canonicalStoryReasoning: canonicalReasoning(storyId, versionId, position, title),
        fallbackNarrative: `${title} SNAPSHOT FALLBACK SHOULD NOT RENDER`,
      },
      source_record_refs: [],
      confidence: 70 + position,
      published_at: `2026-08-24T0${position}:00:00.000Z`,
      expires_at: null,
    },
  };
}

function sourceFixture() {
  const first = storyFixture(1, "story-a", "Alpha");
  const second = storyFixture(2, "story-b", "Bravo");
  return {
    edition: {
      id: "edition-current",
      snapshotId: "edition-current",
      generatedAt: "2026-08-24T03:00:00.000Z",
      immutable: true,
      mode: "current_canonical",
      summary: "Persisted edition summary",
      payload: {
        contractVersion: 2,
        regime: "Persisted canonical regime",
        warnings: ["Persisted research caveat"],
        canonicalStoryManifest: [second.manifest, first.manifest],
      },
      selected: {
        requestedSnapshotId: null,
        snapshotId: "edition-current",
        status: "current",
        exactStoryReplay: false,
        limitation: null,
      },
    },
    canonical: {
      snapshotId: "edition-current",
      storyStates: [second.manifest.state, first.manifest.state],
      featuredStoryStates: [first.manifest.state],
      liveDeskPulse: { regime: "NON-IMMUTABLE LIVE REGIME MUST NOT RENDER" },
    },
    publication: {
      selectedEdition: {
        snapshotId: "edition-current",
        status: "current",
      },
      latestSnapshots: [second.snapshot, first.snapshot],
    },
    research: {
      debt: { items: [{ summary: "CURRENT RESEARCH DEBT MUST NOT RENDER" }] },
    },
    stories: [{ title: "LEGACY STORY FALLBACK MUST NOT RENDER" }],
  };
}

function firstReasoning(source: ReturnType<typeof sourceFixture>) {
  return source.publication.latestSnapshots.find((snapshot) => snapshot.story_id === "story-a")!.payload.canonicalStoryReasoning;
}

test("composer emits deterministic HTML in persisted manifest order", () => {
  const source = sourceFixture();
  const first = composeAlchemyReportHtml(source);
  const reorderedTransport = structuredClone(source);
  reorderedTransport.publication.latestSnapshots.reverse();
  const second = composeAlchemyReportHtml(reorderedTransport);

  assert.equal(first, second);
  assert.ok(first.indexOf("Alpha canonical thesis") < first.indexOf("Bravo canonical thesis"));
  assert.match(first, /data-edition-snapshot-id="edition-current"/);
  assert.match(first, /data-story-version-id="version:story-a"/);
  assert.match(first, /data-story-version-id="version:story-b"/);
});

test("composer renders only immutable reasoning and persisted edition presenter fields", () => {
  const html = composeAlchemyReportHtml(sourceFixture());

  for (const expected of [
    "Persisted edition summary",
    "Persisted canonical regime",
    "Persisted research caveat",
    "Alpha canonical thesis",
    "Alpha accepted mechanism",
    "Alpha countercase",
    "Alpha asset base case",
    "Alpha next test",
    "Alpha canonical chain",
  ]) assert.match(html, new RegExp(expected));

  for (const forbidden of [
    "STATE SHOULD NOT RENDER",
    "SNAPSHOT FALLBACK SHOULD NOT RENDER",
    "NON-IMMUTABLE LIVE REGIME MUST NOT RENDER",
    "CURRENT RESEARCH DEBT MUST NOT RENDER",
    "LEGACY STORY FALLBACK MUST NOT RENDER",
  ]) assert.doesNotMatch(html, new RegExp(forbidden));
});

test("composer does not fabricate optional canonical report sections", () => {
  const source = sourceFixture();
  delete (source.edition.payload as Partial<typeof source.edition.payload>).regime;
  delete (source.edition.payload as Partial<typeof source.edition.payload>).warnings;
  for (const snapshot of source.publication.latestSnapshots) {
    const reasoning = snapshot.payload.canonicalStoryReasoning as unknown as Record<string, unknown>;
    reasoning.whatChanged = null;
    reasoning.previousState = null;
    reasoning.currentState = null;
    reasoning.marketReaction = null;
    reasoning.acceptedExplanation = null;
    reasoning.claims = [];
    reasoning.causalChain = [];
    reasoning.countercase = { strongest: null, evidenceIds: [], weakestLink: null, marketMayBeRight: null };
    reasoning.overlookedVariable = { text: null, evidenceState: null, evidenceIds: [] };
    reasoning.assetImplications = [];
    reasoning.confirmation = [];
    reasoning.invalidation = [];
    reasoning.nextTest = null;
    reasoning.visualPlan = [];
  }
  const html = composeAlchemyReportHtml(source);

  for (const absent of [
    "Macro and regime",
    "Research debt and caveats",
    "Evidence and mechanism",
    "Causal chain",
    "Countercase",
    "Overlooked variable",
    "Asset implications",
    "Next catalyst",
    "Confirmation and invalidation",
    "Canonical visual plans",
  ]) assert.doesNotMatch(html, new RegExp(`>${absent}<`));
  assert.doesNotMatch(html, /pending|not available|no canonical|fallback/i);
});

test("composer fails closed when a required canonical reasoning section is missing", () => {
  const source = sourceFixture();
  delete (firstReasoning(source) as Partial<ReturnType<typeof canonicalReasoning>>).countercase;
  assert.throws(
    () => composeAlchemyReportHtml(source),
    (error) => error instanceof ReportComposerError && /countercase must be an object/i.test(error.message),
  );
});

test("composer rejects non-canonical enums and duplicate reasoning identifiers", async (t) => {
  await t.test("non-canonical lifecycle", () => {
    const source = sourceFixture();
    (firstReasoning(source) as unknown as Record<string, unknown>).lifecycle = "hot_take";
    assert.throws(() => composeAlchemyReportHtml(source), /lifecycle is not canonical/i);
  });

  await t.test("duplicate claim identity", () => {
    const source = sourceFixture();
    const reasoning = firstReasoning(source);
    reasoning.claims.push(structuredClone(reasoning.claims[0]!));
    assert.throws(() => composeAlchemyReportHtml(source), /claims contains duplicate identifiers/i);
  });
});

test("composer fails closed instead of accepting an invalid edition fallback", () => {
  const source = sourceFixture();
  source.edition.selected.status = "invalid_fallback_current";
  source.publication.selectedEdition.status = "invalid_fallback_current";
  assert.throws(() => composeAlchemyReportHtml(source), /did not resolve exactly/i);
});

test("composer enforces immutable edition, Story snapshot, and thesis-version linkage", async (t) => {
  await t.test("canonical envelope snapshot mismatch", () => {
    const source = sourceFixture();
    source.canonical.snapshotId = "different-edition";
    assert.throws(() => composeAlchemyReportHtml(source), /Canonical snapshot ID mismatch/i);
  });

  await t.test("manifest state differs from immutable Story publication", () => {
    const source = sourceFixture();
    source.edition.payload.canonicalStoryManifest[1]!.state.title = "Mutated state";
    assert.throws(() => composeAlchemyReportHtml(source), /not the exact immutable Story publication state/i);
  });

  await t.test("reasoning points at another thesis version", () => {
    const source = sourceFixture();
    firstReasoning(source).storyVersionId = "version:other";
    assert.throws(() => composeAlchemyReportHtml(source), /reasoning version ID mismatch/i);
  });

  await t.test("manifest Story snapshot is unavailable", () => {
    const source = sourceFixture();
    source.publication.latestSnapshots = source.publication.latestSnapshots.filter((snapshot) => snapshot.story_id !== "story-a");
    assert.throws(() => composeAlchemyReportHtml(source), /not present in the canonical publication snapshots/i);
  });
});

test("composer escapes canonical text without changing its analytical content", () => {
  const source = sourceFixture();
  firstReasoning(source).thesis = "Rates < growth & liquidity > positioning";
  const html = composeAlchemyReportHtml(source);
  assert.match(html, /Rates &lt; growth &amp; liquidity &gt; positioning/);
  assert.doesNotMatch(html, /Rates < growth/);
});
