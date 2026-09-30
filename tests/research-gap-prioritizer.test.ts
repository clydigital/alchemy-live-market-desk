import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  prioritiseResearchGapWork,
  scoreResearchGapCandidate,
} from "../lib/research-gap-prioritizer.ts";
import type {
  ResearchGapWorkCandidate,
  ResearchGapWorkQueue,
} from "../lib/research-gap-worker.ts";

function candidate(
  workId: string,
  sourceKind: ResearchGapWorkCandidate["sourceKind"],
  overrides: Partial<ResearchGapWorkCandidate> = {},
): ResearchGapWorkCandidate {
  return {
    workId,
    sourceKind,
    sourceRef: workId,
    dossierId: "11111111-1111-4111-8111-111111111111",
    dossierAsOf: "2026-10-01T00:00:00.000Z",
    question: null,
    action: workId,
    reason: null,
    evidenceNeeded: [],
    linkedInvestigationIds: [],
    linkedStoryIds: [],
    blockingRefs: [],
    nativeSignals: {
      severity: null,
      gapClass: null,
      expectedInformationGain: null,
      researchNowRank: null,
      investigationStatus: null,
      divergence: null,
    },
    ...overrides,
  };
}

function queue(candidates: ResearchGapWorkCandidate[]): ResearchGapWorkQueue {
  return {
    contractVersion: "research-gap-work-queue/1",
    generatedAt: "2026-10-01T00:05:00.000Z",
    dossierId: "11111111-1111-4111-8111-111111111111",
    dossierAsOf: "2026-10-01T00:00:00.000Z",
    candidates,
    sourceCounts: { researchGaps: 0, researchNow: 0, investigations: 0 },
    diagnostics: {
      needsPrioritisation: true,
      truncated: false,
      omittedCandidates: 0,
      excludedResolvedInvestigations: 0,
      notes: [],
    },
  };
}

test("material blockers outrank high-information nonblocking work", () => {
  const blocker = candidate("blocker", "research_gap", {
    blockingRefs: ["REGIME:CURRENT"],
    linkedStoryIds: ["story:rates"],
    nativeSignals: {
      severity: "MATERIAL",
      gapClass: "BLOCKER",
      expectedInformationGain: null,
      researchNowRank: null,
      investigationStatus: null,
      divergence: null,
    },
  });
  const highInfo = candidate("high-info", "research_now", {
    linkedStoryIds: ["story:rates"],
    evidenceNeeded: ["MOVE", "VIX"],
    nativeSignals: {
      severity: null,
      gapClass: null,
      expectedInformationGain: "High",
      researchNowRank: 1,
      investigationStatus: null,
      divergence: null,
    },
  });

  const result = prioritiseResearchGapWork(queue([highInfo, blocker]));
  assert.equal(result.selected[0]?.workId, "blocker");
  assert.ok((result.selected[0]?.priorityScore ?? 0) > (result.selected[1]?.priorityScore ?? 0));
  assert.ok(result.selected[0]?.selectionReason.includes("material blocker"));
});

test("Research Now rank and information gain produce transparent score components", () => {
  const scored = scoreResearchGapCandidate(candidate("rn1", "research_now", {
    linkedInvestigationIds: ["inv:duration"],
    linkedStoryIds: ["story:rates"],
    evidenceNeeded: ["Bund", "JGB"],
    nativeSignals: {
      severity: null,
      gapClass: null,
      expectedInformationGain: "High",
      researchNowRank: 1,
      investigationStatus: null,
      divergence: null,
    },
  }));

  assert.equal(scored.scoreBreakdown.informationGain, 28);
  assert.equal(scored.scoreBreakdown.nativeRank, 15);
  assert.equal(scored.scoreBreakdown.linkage, 8);
  assert.equal(scored.scoreBreakdown.evidenceNeed, 4);
  assert.equal(scored.priorityScore, 55);
});

test("selected Research Now work suppresses lower-scoring investigation duplicate", () => {
  const researchNow = candidate("rn-duration", "research_now", {
    linkedInvestigationIds: ["inv:duration"],
    linkedStoryIds: ["story:rates"],
    nativeSignals: {
      severity: null,
      gapClass: null,
      expectedInformationGain: "High",
      researchNowRank: 1,
      investigationStatus: null,
      divergence: null,
    },
  });
  const investigation = candidate("inv-duration", "investigation", {
    linkedInvestigationIds: ["inv:duration"],
    linkedStoryIds: ["story:rates"],
    evidenceNeeded: ["MOVE", "VIX", "HY", "IG"],
    nativeSignals: {
      severity: null,
      gapClass: null,
      expectedInformationGain: null,
      researchNowRank: null,
      investigationStatus: "open",
      divergence: "UNRESOLVED",
    },
  });

  const result = prioritiseResearchGapWork(queue([investigation, researchNow]));
  assert.deepEqual(result.selected.map((item) => item.workId), ["rn-duration"]);
  assert.equal(result.suppressed.length, 1);
  assert.equal(result.suppressed[0]?.reason, "duplicate_investigation_coverage");
  assert.equal(result.suppressed[0]?.coveredByWorkId, "rn-duration");
});

test("selection is bounded to three and remaining distinct work is explicit cutoff suppression", () => {
  const candidates = [1, 2, 3, 4, 5].map((rank) => candidate(`rn-${rank}`, "research_now", {
    linkedInvestigationIds: [`inv-${rank}`],
    nativeSignals: {
      severity: null,
      gapClass: null,
      expectedInformationGain: rank <= 2 ? "High" : "Medium",
      researchNowRank: rank,
      investigationStatus: null,
      divergence: null,
    },
  }));

  const result = prioritiseResearchGapWork(queue(candidates));
  assert.equal(result.selected.length, 3);
  assert.equal(result.suppressed.filter((item) => item.reason === "below_selection_cutoff").length, 2);
  assert.deepEqual(result.selected.map((item) => item.priorityRank), [1, 2, 3]);
});

test("machine-authenticated priority endpoint is whitelisted before dashboard auth", () => {
  const config = readFileSync(new URL("../lib/supabase/config.ts", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/research-gap/priorities/route.ts", import.meta.url), "utf8");
  assert.match(config, /MACHINE_AUTH_PATHS[\s\S]*"\/api\/research-gap\/priorities"/);
  assert.match(route, /loadPrioritisedResearchGapWork/);
  assert.match(route, /acceptsResearchAuthorization/);
});
