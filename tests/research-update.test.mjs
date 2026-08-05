import assert from "node:assert/strict";
import test from "node:test";

import {
  DESK_RESEARCH_SOURCES,
  VIDEO_RESEARCH_SOURCES,
  requiredSourcesForSlot,
  validateResearchRun,
} from "../lib/research-update.ts";

const videoSteps = ["discover", "transcribe", "review_video", "extract_claims", "research_jargon", "cross_assess"];
const deskSteps = ["discover", "consume_video_intake", "cross_assess", "calendar_scan", "compare_desk_history", "select_desk1", "publish_desk1"];

function sourceChecks(sources) {
  return sources.map((source) => ({ source, status: "no_new_items", itemCount: 0 }));
}

function processLog(steps) {
  return steps.map((step) => ({ step, status: "completed" }));
}

function evidenceLinks() {
  return [1, 2, 3, 4].map((index) => ({
    title: `Official source ${index}`,
    url: `https://example.com/evidence-${index}`,
    publisher: `Agency ${index}`,
    publishedAt: "2026-08-05T00:00:00+08:00",
    claim: `Independent evidence ${index}`,
  }));
}

function videoRun(overrides = {}) {
  const evidence = evidenceLinks();
  return {
    runKey: "video-midnight-2026-08-05",
    scheduleSlot: "video_midnight",
    scheduledFor: "2026-08-05T00:40:00+08:00",
    sourceChecks: sourceChecks(VIDEO_RESEARCH_SOURCES),
    processLog: processLog(videoSteps),
    items: [{
      itemKey: "fxevolution:video-1",
      itemType: "video",
      publisher: "FX Evolution",
      title: "Dollar positioning and rates",
      url: "https://www.youtube.com/watch?v=example1",
      publishedAt: "2026-08-04T22:00:00+08:00",
      transcriptStatus: "ready",
      transcriptProvider: "official",
      transcriptText: "A complete transcript used for independent review.",
      videoReviewStatus: "reviewed",
      creatorLogic: "The creator links rate repricing to dollar positioning.",
      recontextualizedSummary: "Alchemy data is used to test the rates and positioning claim.",
      claimChecks: [{
        claim: "Rate repricing is supporting the dollar.",
        material: true,
        status: "verified",
        assessment: "The direction agrees with independently observed market data.",
        independentSources: [evidence[0]],
      }],
      termsDetected: [],
      jargonResearch: [],
      expertNotes: [],
      summary: "A candidate FX transmission idea.",
      sourceQuality: 55,
      relevance: 80,
      novelty: 60,
      materiality: 70,
      recommendedAction: "collect_evidence",
      evidence,
    }],
    ...overrides,
  };
}

function deskRun(storyFocus) {
  return {
    runKey: "desk-morning-2026-08-05",
    scheduleSlot: "morning",
    scheduledFor: "2026-08-05T08:30:00+08:00",
    sourceChecks: sourceChecks(DESK_RESEARCH_SOURCES),
    processLog: processLog(deskSteps),
    calendarChecks: ["economic", "earnings"].map((calendar) => ({
      calendar,
      status: "checked",
      windowStart: "2026-08-05T08:00:00+08:00",
      windowEnd: "2026-08-12T09:00:00+08:00",
      eventCount: 0,
    })),
    previousDeskDays: [
      { date: "2026-08-03", leadStorySlug: "dollar-rates", angleKey: "rates-support" },
      { date: "2026-08-04", leadStorySlug: null, angleKey: null },
    ],
    items: [],
    storyFocus,
  };
}

const persistedEvidence = [{
  runId: "prior-video-run",
  runStatus: "completed",
  itemKey: "fxevolution:video-1",
  itemType: "video",
  intakeStatus: "accepted",
  transcriptStatus: "ready",
  videoReviewStatus: "reviewed",
  claimChecks: [{
    claim: "Rate repricing is supporting the dollar.",
    material: true,
    status: "verified",
    assessment: "Confirmed independently.",
    independentSources: [evidenceLinks()[0]],
  }],
  evidence: evidenceLinks(),
}];

test("video and desk slots have distinct source ownership", () => {
  assert.deepEqual(requiredSourcesForSlot("video_midnight"), VIDEO_RESEARCH_SOURCES);
  assert.deepEqual(requiredSourcesForSlot("morning"), DESK_RESEARCH_SOURCES);
  assert.equal(VIDEO_RESEARCH_SOURCES.some((source) => DESK_RESEARCH_SOURCES.includes(source)), false);
});

test("a fully reviewed and independently checked video passes intake validation", () => {
  const result = validateResearchRun(videoRun());
  assert.deepEqual(result.errors, []);
  assert.equal(result.videoGatePassed, true);
  assert.equal(result.processGatePassed, true);
});

test("a transcript-only creator review is rejected", () => {
  const run = videoRun();
  run.items[0].videoReviewStatus = "transcript_only";
  const result = validateResearchRun(run);
  assert.equal(result.videoGatePassed, false);
  assert.match(result.errors.join("\n"), /independent review or listen/);
});

test("a repeated lead without material change is demoted without invalidating the run", () => {
  const result = validateResearchRun(deskRun([{
    storySlug: "dollar-rates",
    headline: "Dollar remains supported by rates",
    angleKey: "rates-support",
    priority: 1,
    proposedDecision: "lead",
    eventAt: "2026-08-05T01:00:00+08:00",
    materialChange: false,
    evidenceItemKeys: ["fxevolution:video-1"],
  }]), persistedEvidence);
  assert.deepEqual(result.errors, []);
  assert.equal(result.storyFocus[0].decision, "background");
  assert.equal(result.freshnessGatePassed, true);
});

test("an active Desk 1 focus is blocked when its Evidence Room is incomplete", () => {
  const result = validateResearchRun(deskRun([{
    storySlug: "oil-flows",
    headline: "Oil flows face a new physical constraint",
    angleKey: "physical-flow-change",
    priority: 1,
    proposedDecision: "lead",
    eventAt: "2026-08-05T02:00:00+08:00",
    materialChange: true,
    materialChangeReason: "A newly reported outage changes expected supply.",
    evidenceItemKeys: ["missing:item"],
  }]));
  assert.equal(result.evidenceGatePassed, false);
  assert.match(result.warnings.join("\n"), /focus references missing intake items/);
});

test("cosmetic rewrites are rejected from Desk 1 focus", () => {
  const result = validateResearchRun(deskRun([{
    storySlug: "dollar-rates",
    headline: "Dollar rates story with new wording",
    angleKey: "rates-support",
    priority: 1,
    proposedDecision: "lead",
    eventAt: "2026-08-05T01:00:00+08:00",
    materialChange: false,
    cosmeticRewrite: true,
    evidenceItemKeys: ["fxevolution:video-1"],
  }]), persistedEvidence);
  assert.equal(result.storyFocus[0].decision, "rejected");
  assert.match(result.storyFocus[0].demotionReason, /Cosmetic rewrite/);
});

test("a Desk 1 run records a background decision instead of publishing empty state", () => {
  const result = validateResearchRun(deskRun([]));
  assert.match(result.errors.join("\n"), /at least one Desk 1 focus decision/);
});

test("Desk 1 rejects evidence retained by a blocked intake run", () => {
  const blockedEvidence = [{ ...persistedEvidence[0], runStatus: "blocked" }];
  const result = validateResearchRun(deskRun([{
    storySlug: "oil-flows",
    headline: "Oil flows face a new physical constraint",
    angleKey: "physical-flow-change",
    priority: 1,
    proposedDecision: "lead",
    eventAt: "2026-08-05T02:00:00+08:00",
    materialChange: true,
    materialChangeReason: "A newly reported outage changes expected supply.",
    evidenceItemKeys: ["fxevolution:video-1"],
  }]), blockedEvidence);
  assert.equal(result.evidenceGatePassed, false);
  assert.match(result.warnings.join("\n"), /unvalidated persisted intake/);
});

test("Desk 1 accepts completed and accepted prior video evidence", () => {
  const result = validateResearchRun(deskRun([{
    storySlug: "oil-flows",
    headline: "Oil flows face a new physical constraint",
    angleKey: "physical-flow-change",
    priority: 1,
    proposedDecision: "lead",
    eventAt: "2026-08-05T02:00:00+08:00",
    materialChange: true,
    materialChangeReason: "A newly reported outage changes expected supply.",
    evidenceItemKeys: ["fxevolution:video-1"],
  }]), persistedEvidence);
  assert.deepEqual(result.errors, []);
  assert.equal(result.evidenceGatePassed, true);
  assert.equal(result.storyFocus[0].decision, "lead");
});
