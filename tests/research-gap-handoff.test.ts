import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  attachResearchGapHandoffToItems,
  encodeResearchGapHandoffContext,
  gapHandoffSourceIsCarrier,
  parseResearchGapHandoffContext,
  researchGapHandoffRunKey,
  type ResearchGapHandoffInput,
} from "../lib/research-gap-handoff.ts";
import { validateResearchRun, type IntakeItemInput, type ResearchRunInput } from "../lib/research-update.ts";

const handoff: ResearchGapHandoffInput = {
  kind: "research_gap_gate",
  gateRunId: "2026-09-30T1200Z",
  gapId: "rates-duration-confirmation",
  investigationId: "inv-duration-01",
  pulseRefs: ["pulse-2026-09-30-1", "pulse-2026-09-30-2"],
  affectedStorySlugs: ["us-rates-duration"],
  researchQuestion: "Has duration stress broadened beyond the next Fed meeting?",
  priorExpectation: "A front-end-only repricing should leave the long end comparatively contained.",
  finding: "The 20Y and 30Y remained elevated while the 2Y response was smaller.",
  confidence: 78,
  outcome: "CONFIRMING",
  remainsUnknown: ["How much of the long-end move is term premium versus inflation compensation?"],
  liveImplication: "Treat the move as broader duration stress rather than only a next-meeting repricing.",
  nextTest: "Compare real yields, breakevens and auction demand at the next Treasury supply window.",
};

function sourceItem(overrides: Partial<IntakeItemInput> = {}): IntakeItemInput {
  return {
    itemKey: "gap-source:treasury-1",
    itemType: "news",
    publisher: "U.S. Department of the Treasury",
    title: "Daily Treasury Par Yield Curve Rates",
    url: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates",
    publishedAt: "2026-09-30T12:00:00.000Z",
    transcriptStatus: "not_applicable",
    summary: "Treasury curve evidence used to test whether duration stress broadened.",
    sourceQuality: 100,
    relevance: 96,
    novelty: 72,
    materiality: 88,
    recommendedAction: "collect_evidence",
    evidence: [{
      title: "Daily Treasury Par Yield Curve Rates",
      url: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates",
      publisher: "U.S. Department of the Treasury",
      publishedAt: "2026-09-30T12:00:00.000Z",
      claim: "Underlying official curve evidence for the Research Gap investigation.",
    }],
    ...overrides,
  };
}

function gapRun(overrides: Partial<ResearchRunInput> = {}): ResearchRunInput {
  return {
    runKey: researchGapHandoffRunKey(handoff),
    scheduleSlot: "manual",
    scheduledFor: "2026-09-30T12:00:00.000Z",
    sourceChecks: [],
    handoff,
    items: attachResearchGapHandoffToItems(handoff, [sourceItem()]),
    ...overrides,
  };
}

test("Research Gap handoff has a deterministic idempotence key and round-trippable context", () => {
  assert.equal(researchGapHandoffRunKey(handoff), "gap-gate:2026-09-30T1200Z:rates-duration-confirmation");
  const encoded = encodeResearchGapHandoffContext(handoff, "Underlying Treasury curve check.");
  const parsed = parseResearchGapHandoffContext(encoded);
  assert.equal(parsed?.outcome, "CONFIRMING");
  assert.equal(parsed?.gateRunId, handoff.gateRunId);
  assert.deepEqual(parsed?.affectedStorySlugs, ["us-rates-duration"]);
  assert.equal(parsed?.itemNote, "Underlying Treasury curve check.");
});

test("Research Gap handoff validation accepts underlying evidence without scheduled source checks", () => {
  const validation = validateResearchRun(gapRun());
  assert.deepEqual(validation.errors, []);
  assert.equal(validation.sourceCoverageAvailable, true);
  assert.equal(validation.scoredItems[0]?.affectedStorySlugs?.[0], "us-rates-duration");
});

test("normal research runs still require the canonical scheduled source sweep", () => {
  const validation = validateResearchRun({
    ...gapRun(),
    handoff: undefined,
    runKey: "manual:ordinary-run",
  });
  assert.match(validation.errors.join(" "), /sourceChecks must contain exactly/);
});

test("Research Gap handoff rejects carrier pages as canonical evidence", () => {
  assert.equal(gapHandoffSourceIsCarrier("MacroPulse", "https://www.notion.so/example"), true);
  const validation = validateResearchRun(gapRun({
    items: attachResearchGapHandoffToItems(handoff, [sourceItem({
      publisher: "MacroPulse",
      url: "https://www.notion.so/example",
    })]),
  }));
  assert.match(validation.errors.join(" "), /underlying source/);
});

test("NO_CHANGE can add evidence but cannot caller-force recalibration", () => {
  const noChange: ResearchGapHandoffInput = { ...handoff, outcome: "NO_CHANGE" };
  const validation = validateResearchRun({
    ...gapRun(),
    handoff: noChange,
    runKey: researchGapHandoffRunKey(noChange),
    items: attachResearchGapHandoffToItems(noChange, [sourceItem({ recommendedAction: "recalibrate_story" })]),
  });
  assert.match(validation.errors.join(" "), /cannot be recalibrate_story/);
});

test("Research Gap integration remains bounded to the canonical research route and evidence payload", () => {
  const route = readFileSync(new URL("../app/api/research-update/route.ts", import.meta.url), "utf8");
  const runtime = readFileSync(new URL("../lib/intelligence/runtime.ts", import.meta.url), "utf8");

  assert.match(route, /attachResearchGapHandoffToItems/);
  assert.match(route, /replayed: true/);
  assert.match(route, /gapHandoff \? \[\] : buildHighImpactCalendarIntake/);
  assert.match(route, /if \(!gapHandoff\) \{[\s\S]*acquireRatesResearch/);
  assert.match(runtime, /researchGapHandoff: gapHandoff/);
  assert.match(runtime, /evidenceNature: gapHandoff \? "research_gap_handoff"/);
});
