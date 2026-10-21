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
    gapKey: `gap:test:${workId}`,
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
    sourceCounts: { researchGaps: 0, researchNow: 0, investigations: 0, marketMotion: 0 },
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

test("Primary Motion can compete for a Gap slot but does not outrank a material blocker by attention alone", () => {
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
  const motionCandidate = candidate("motion", "market_motion", {
    linkedStoryIds: ["story:rates"],
    evidenceNeeded: ["Check whether the long-end move persists."],
    nativeSignals: {
      severity: null,
      gapClass: null,
      expectedInformationGain: null,
      researchNowRank: null,
      investigationStatus: null,
      divergence: null,
      motionAttentionTier: "PRIMARY",
      motionAttentionScore: 95,
      motionWritingPotential: "HIGH",
    },
  });

  const scored = scoreResearchGapCandidate(motionCandidate);
  assert.equal(scored.scoreBreakdown.motionAttention, 24);
  assert.ok(scored.selectionReason.includes("Primary Market Motion with unresolved next test"));

  const result = prioritiseResearchGapWork(queue([motionCandidate, blocker]));
  assert.equal(result.selected[0]?.workId, "blocker");
  assert.equal(result.selected[1]?.workId, "motion");
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


test("distinct Research Now actions sharing one investigation are not collapsed", () => {
  const first = candidate("rn-duration-1", "research_now", {
    linkedInvestigationIds: ["inv:duration"],
    nativeSignals: {
      severity: null,
      gapClass: null,
      expectedInformationGain: "High",
      researchNowRank: 1,
      investigationStatus: null,
      divergence: null,
    },
  });
  const second = candidate("rn-duration-2", "research_now", {
    linkedInvestigationIds: ["inv:duration"],
    nativeSignals: {
      severity: null,
      gapClass: null,
      expectedInformationGain: "High",
      researchNowRank: 2,
      investigationStatus: null,
      divergence: null,
    },
  });

  const result = prioritiseResearchGapWork(queue([first, second]));
  assert.deepEqual(result.selected.map((item) => item.workId), ["rn-duration-1", "rn-duration-2"]);
  assert.equal(result.suppressed.length, 0);
});


test("an unresolved original WTI/ICE Brent settlement requirement gets one bounded slot, not silently dropped", () => {
  const nonBlocking = [1, 2, 3].map(rank => candidate("rates-" + rank, "research_now", {
    linkedStoryIds: ["story:rates"],
    evidenceNeeded: ["Rates verification"],
    nativeSignals: {
      severity: null, gapClass: null, expectedInformationGain: "High",
      researchNowRank: rank, investigationStatus: null, divergence: null,
    },
  }));
  const oil = candidate("oil-original-f1-f2", "research_now", {
    linkedStoryIds: ["story:energy-product-draw"],
    evidenceNeeded: [
      "WTI NYMEX original dated FINAL CL F1/F2 settlement pair, same trade date, retained source hash",
      "ICE Brent original dated FINAL F1/F2 settlement pair, same trade date, retained source hash",
    ],
    nativeSignals: {
      severity: null, gapClass: null, expectedInformationGain: "Medium",
      researchNowRank: 3, investigationStatus: null, divergence: null,
    },
  });
  const result = prioritiseResearchGapWork(queue([...nonBlocking, oil]));
  assert.equal(result.selected.length, 3);
  assert.deepEqual(result.selected.slice(0, 2).map(x => x.workId), ["rates-1", "rates-2"]);
  assert.equal(result.selected[2]?.workId, "oil-original-f1-f2",
    "Protect one slot for missing original settlement of a persistent energy Story");
  assert.ok(result.selected[2]?.selectionReason.includes("reserve last slot for linked original oil settlement blocker"));
  assert.deepEqual(result.suppressed.map(x=>x.workId), ["rates-3"]);
  assert.ok(result.diagnostics.policy.some(x=>x.includes("reserved_last_slot")));
  const repeated = prioritiseResearchGapWork(queue([...nonBlocking, oil]));
  assert.deepEqual(result, repeated, "One Dossier produces deterministic source selection");
});

test("original oil source debt cannot displace a material main-thread or regime blocker", () => {
  const important = [1, 2, 3].map(rank => candidate("material-" + rank, "research_gap", {
    blockingRefs: [rank === 3 ? "REGIME:CURRENT" : "MAIN_THREAD"],
    nativeSignals: {
      severity: "MATERIAL", gapClass: "BLOCKER",
      expectedInformationGain: "High", researchNowRank: null,
      investigationStatus: null, divergence: null,
    },
  }));
  const oil = candidate("oil-original", "research_now", {
    linkedStoryIds: ["story:oil"],
    evidenceNeeded: ["WTI NYMEX original dated FINAL CL F1/F2 settlement pair"],
    nativeSignals: {
      severity: null, gapClass: null, expectedInformationGain: "Low",
      researchNowRank: 3, investigationStatus: null, divergence: null,
    },
  });
  const result = prioritiseResearchGapWork(queue([...important, oil]));
  assert.deepEqual(result.selected.map(x=>x.workId), important.map(x=>x.workId));
  assert.equal(result.suppressed.find(x=>x.workId==="oil-original")?.reason, "below_selection_cutoff");
  assert.ok(result.diagnostics.policy.some(x=>x.includes("blocked_by_material_priority")));
});

test("old or unlinked oil chatter does not steal a scheduled Research Gap slot", () => {
  const top = [1,2,3].map(rank => candidate("priority-"+rank, "research_now", {
    nativeSignals: {severity:null,gapClass:null,expectedInformationGain:"High",
      researchNowRank:rank,investigationStatus:null,divergence:null},
  }));
  const excluded = candidate("unlinked-source", "research_now", {
    evidenceNeeded: ["WTI NYMEX original dated FINAL CL F1/F2 settlement pair"],
    linkedStoryIds: [],
  });
  const generic = candidate("generic-energy", "research_now", {
    evidenceNeeded: ["review WTI market commentary"],
    linkedStoryIds: ["story:energy"],
  });
  const result = prioritiseResearchGapWork(queue([...top, excluded, generic]));
  assert.deepEqual(result.selected.map(x=>x.workId), top.map(x=>x.workId));
  assert.ok(result.diagnostics.policy.some(x=>x.includes("not_needed")));
  const capped = prioritiseResearchGapWork(queue([...top, excluded, generic]), 2);
  assert.equal(capped.selected.length, 2);
});
