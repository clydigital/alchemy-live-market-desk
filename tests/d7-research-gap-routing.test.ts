import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { D7CrossLayerDivergenceSnapshot } from "../lib/dossier-v2/cross-layer-divergence.ts";
import {
  appendD7ResearchGapCandidates,
  buildD7ResearchGapCandidates,
} from "../lib/d7-research-gap-routing.ts";
import { prioritiseResearchGapWork } from "../lib/research-gap-prioritizer.ts";
import type { ResearchGapWorkQueue } from "../lib/research-gap-worker.ts";

function snapshot(
  cases: D7CrossLayerDivergenceSnapshot["cases"],
): D7CrossLayerDivergenceSnapshot {
  return {
    contractVersion: "d7-cross-layer-divergence/1",
    asOf: "2026-10-06T00:00:00.000Z",
    cases,
    summary: {
      ALIGNMENT: 0,
      CONTRADICTION: cases.filter((item) => item.state === "CONTRADICTION").length,
      LAG: cases.filter((item) => item.state === "LAG").length,
      UNRESOLVED: 0,
    },
    mutationBoundary: {
      mode: "READ_ONLY",
      statement: "test",
    },
  };
}

function d7Case(
  overrides: Partial<D7CrossLayerDivergenceSnapshot["cases"][number]> = {},
): D7CrossLayerDivergenceSnapshot["cases"][number] {
  return {
    id: "d7:dossier-story:story:rates",
    pair: "DOSSIER_STORY",
    state: "CONTRADICTION",
    severity: "HIGH",
    reason: "Dossier and Story point in opposite directions.",
    analyticalStoryId: "story:rates",
    persistentStoryId: "11111111-1111-4111-8111-111111111111",
    investigationId: null,
    regimeSlug: null,
    evidenceRefs: ["ev:one", "ev:two"],
    researchEligible: true,
    ...overrides,
  };
}

function queue(): ResearchGapWorkQueue {
  return {
    contractVersion: "research-gap-work-queue/1",
    generatedAt: "2026-10-06T00:00:00.000Z",
    dossierId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    dossierAsOf: "2026-10-06T00:00:00.000Z",
    candidates: [],
    sourceCounts: {
      researchGaps: 0,
      researchNow: 0,
      investigations: 0,
      marketMotion: 0,
    },
    diagnostics: {
      needsPrioritisation: true,
      truncated: false,
      omittedCandidates: 0,
      excludedResolvedInvestigations: 0,
      notes: [],
    },
  };
}

test("D7 HIGH contradiction enters the ordinary Research Gap contract with stable identity", () => {
  const first = buildD7ResearchGapCandidates({
    dossierId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    dossierAsOf: "2026-10-06T00:00:00.000Z",
    snapshot: snapshot([d7Case()]),
  });
  const next = buildD7ResearchGapCandidates({
    dossierId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    dossierAsOf: "2026-10-06T12:00:00.000Z",
    snapshot: snapshot([d7Case()]),
  });

  assert.equal(first.length, 1);
  assert.equal(first[0].sourceKind, "research_gap");
  assert.match(first[0].sourceRef, /^d7:/);
  assert.equal(first[0].gapKey, next[0].gapKey);
  assert.notEqual(first[0].workId, next[0].workId);
  assert.equal(first[0].nativeSignals.severity, "MATERIAL");
  assert.equal(first[0].nativeSignals.gapClass, "BLOCKER");
});

test("D7 known evidence stays context-only and is not re-requested as missing evidence", () => {
  const [candidate] = buildD7ResearchGapCandidates({
    dossierId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    dossierAsOf: "2026-10-06T00:00:00.000Z",
    snapshot: snapshot([d7Case()]),
  });

  assert.equal(candidate.evidenceNeeded.length, 1);
  assert.doesNotMatch(candidate.evidenceNeeded[0], /ev:one|ev:two/);
  assert.deepEqual(
    candidate.blockingRefs.filter((ref) => ref.startsWith("EVIDENCE:")),
    ["EVIDENCE:ev:one", "EVIDENCE:ev:two"],
  );
});

test("D7 MEDIUM lag routes only when it is anchored to active Story or Regime identity", () => {
  const anchored = buildD7ResearchGapCandidates({
    dossierId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    dossierAsOf: "2026-10-06T00:00:00.000Z",
    snapshot: snapshot([
      d7Case({
        id: "d7:story-regime:story-1",
        pair: "STORY_REGIME",
        state: "LAG",
        severity: "MEDIUM",
      }),
    ]),
  });
  const unanchored = buildD7ResearchGapCandidates({
    dossierId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    dossierAsOf: "2026-10-06T00:00:00.000Z",
    snapshot: snapshot([
      d7Case({
        id: "d7:expectation-market:inv-1",
        pair: "EXPECTATION_MARKET",
        state: "LAG",
        severity: "MEDIUM",
        persistentStoryId: null,
        regimeSlug: null,
      }),
    ]),
  });

  assert.equal(anchored.length, 1);
  assert.equal(unanchored.length, 0);
});

test("D7 LOW or non-research-eligible cases do not create operational work", () => {
  const candidates = buildD7ResearchGapCandidates({
    dossierId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    dossierAsOf: "2026-10-06T00:00:00.000Z",
    snapshot: snapshot([
      d7Case({ severity: "LOW" }),
      d7Case({
        id: "d7:alignment",
        state: "ALIGNMENT",
        researchEligible: false,
      }),
    ]),
  });

  assert.deepEqual(candidates, []);
});

test("appending D7 work is idempotent and keeps the existing 20-candidate cap", () => {
  const base = queue();
  const candidates = buildD7ResearchGapCandidates({
    dossierId: base.dossierId,
    dossierAsOf: base.dossierAsOf,
    snapshot: snapshot([d7Case()]),
  });

  const once = appendD7ResearchGapCandidates(base, candidates);
  const twice = appendD7ResearchGapCandidates(once, candidates);

  assert.equal(once.candidates.length, 1);
  assert.equal(twice.candidates.length, 1);
  assert.equal(once.sourceCounts.researchGaps, 1);
  assert.equal(twice.sourceCounts.researchGaps, 1);
});

test("D7 blocker competes inside the existing top-three prioritiser rather than bypassing it", () => {
  const base = queue();
  base.candidates.push({
    workId: "gap-work:ordinary",
    gapKey: "gap:native:ordinary",
    sourceKind: "research_gap",
    sourceRef: "ordinary",
    dossierId: base.dossierId,
    dossierAsOf: base.dossierAsOf,
    question: "Minor refinement?",
    action: "Check minor refinement.",
    reason: "Informational.",
    evidenceNeeded: [],
    linkedInvestigationIds: [],
    linkedStoryIds: [],
    blockingRefs: [],
    nativeSignals: {
      severity: "INFORMATIONAL",
      gapClass: "REFINEMENT",
      expectedInformationGain: "Low",
      researchNowRank: null,
      investigationStatus: null,
      divergence: null,
      motionAttentionTier: null,
      motionAttentionScore: null,
      motionWritingPotential: null,
    },
  });

  const d7 = buildD7ResearchGapCandidates({
    dossierId: base.dossierId,
    dossierAsOf: base.dossierAsOf,
    snapshot: snapshot([d7Case()]),
  });
  const priority = prioritiseResearchGapWork(
    appendD7ResearchGapCandidates(base, d7),
  );

  assert.equal(priority.selected[0].sourceRef, d7[0].sourceRef);
  assert.ok(priority.selected[0].selectionReason.includes("material blocker"));
});

test("Dossier persistence uses backend D7-aware Research Gap sync and not Presenter/UI execution", () => {
  const trigger = readFileSync(
    new URL("../lib/dossier-v2/manual-persist-trigger.ts", import.meta.url),
    "utf8",
  );
  const runtime = readFileSync(
    new URL("../lib/d7-research-gap-runtime.ts", import.meta.url),
    "utf8",
  );

  assert.match(trigger, /syncLatestPrioritisedResearchGapCasesWithD7/);
  assert.match(runtime, /runtime\.dossierId === baseQueue\.dossierId/);
  assert.match(runtime, /runtime\.dossierAsOf === baseQueue\.dossierAsOf/);
  assert.doesNotMatch(runtime, /story_thesis_versions|intelligence_reevaluation_queue|\.insert\(/i);
});
