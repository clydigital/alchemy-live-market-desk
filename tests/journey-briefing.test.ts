import assert from "node:assert/strict";
import test from "node:test";

import {
  composeAlchemyEdition,
  type EditionStory,
} from "../lib/intelligence/edition.ts";

function story(id: string, overrides: Partial<EditionStory> = {}): EditionStory {
  return {
    id,
    parentStoryId: id,
    lifecycleStatus: "developing",
    title: `${id} headline`,
    centralQuestion: `What changed in ${id}?`,
    thesis: `${id} thesis remains conditional.`,
    whatChanged: `${id} changed on canonical evidence.`,
    previousState: `${id} was previously stable.`,
    currentState: `${id} is now under test.`,
    marketReaction: `${id} assets repriced.`,
    acceptedExplanation: `The accepted explanation for ${id}.`,
    contradiction: "",
    overlookedVariable: `${id} overlooked variable.`,
    overlookedVariableEvidenceStatus: "inferred",
    marketMayBeRight: `${id} market may still be right.`,
    mechanismSteps: [{ step: 1, text: `${id} mechanism step.`, evidenceStatus: "strongly_supported" }],
    plainEnglish: `${id} in plain English.`,
    affectedAssets: [id.toUpperCase()],
    themes: ["Macro"],
    nextTest: `${id} next test.`,
    confirmation: `${id} confirmation.`,
    invalidation: `${id} invalidation.`,
    confidence: 70,
    prohibitedClaims: [],
    changeKinds: ["evidence"],
    eventAt: "2026-08-26T08:00:00.000Z",
    thesisVersionId: `thesis-${id}`,
    evidenceRefs: [`evidence-${id}`],
    ...overrides,
  };
}

function board(stories: EditionStory[]) {
  return composeAlchemyEdition({
    generatedAt: "2026-08-26T09:00:00.000Z",
    comparisonWindowStart: "2026-08-25T09:00:00.000Z",
    stories,
    marketTape: {
      regimeSummary: "Rates lead; cross-asset confirmation is mixed.",
      assets: [{ symbol: "SPX", move: "Observed", state: "Firm", whyRelevant: "Direct market evidence." }],
    },
    upcoming: {
      economicCalendar: [{ time: "2026-08-26", event: "CPI", consensus: "2.8", prior: "2.7", exposedAssets: ["SPX"], whyItMatters: "Does inflation change the policy path?" }],
      earnings: [{ company: "ACME", time: "2026-08-27 · 08:30 ET", decisiveVariable: "Demand", linkedTheme: "Macro", confirmationCase: "Stable", disappointmentCase: "Lower" }],
      geopoliticalClock: [{ time: null, event: "Iran policy discussion", participants: ["Iran"], transmission: "Risk premium", decisiveOutcome: "Policy signal", scheduled: true, timePrecision: "tbc" }],
    },
  });
}

test("normal edition composes three persisted stories in canonical material-change order", () => {
  const result = board([story("lead"), story("second"), story("third"), story("extra")]);

  assert.equal(result.journey?.contractVersion, "journey-briefing/v1");
  assert.deepEqual(result.journey?.bigStories.map((item) => item.storyId), ["lead", "second", "third"]);
  assert.equal(result.journey?.leadStoryId, "lead");
  assert.equal(result.journey?.bigStories[0]?.thesisVersionId, "thesis-lead");
  assert.deepEqual(result.journey?.bigStories[0]?.evidenceRefs, ["evidence-lead"]);
  assert.equal(result.journey?.horizon.today[0]?.title, "CPI");
  assert.equal(result.journey?.horizon.later[0]?.timing.precision, "date");
  assert.equal(result.journey?.horizon.later[1]?.timing.precision, "tbc");
});

test("contradiction is retained as canonical challenger content", () => {
  const result = board([story("lead", { contradiction: "Credit spreads reject the growth read." })]);
  assert.equal(result.journey?.bigStories[0]?.contradiction, "Credit spreads reject the growth read.");
});

test("sparse edition does not manufacture additional big stories", () => {
  const result = board([story("only")]);
  assert.deepEqual(result.journey?.bigStories.map((item) => item.storyId), ["only"]);
});

test("Event Horizon degradation remains visible and does not gate the Journey", () => {
  const base = board([story("fed")]);
  const result = composeAlchemyEdition({
    generatedAt: base.generatedAt,
    comparisonWindowStart: base.comparisonWindowStart,
    stories: base.stories,
    marketTape: base.marketTape,
    upcoming: {
      ...base.upcoming,
      economicCalendar: [{ time: "2026-08-27", event: "Fed appearance", consensus: null, prior: null, exposedAssets: ["USD"], whyItMatters: "Does communication change the policy path?" }],
    },
    diagnostics: {
      warnings: ["Energy source_failed", "Geopolitical coverage unsupported"],
      eventHorizonCoverage: [
        { family: "central_bank_appearances", state: "covered", sourceName: "Fed", sourceUrl: null, retrievedAt: "2026-08-26T09:00:00.000Z", confirmedEventCount: 1, detail: "Fed covered" },
        { family: "energy_policy", state: "source_failed", sourceName: "OPEC", sourceUrl: null, retrievedAt: "2026-08-26T09:00:00.000Z", confirmedEventCount: 0, detail: "Energy unavailable" },
        { family: "geopolitical_diplomatic", state: "unsupported", sourceName: null, sourceUrl: null, retrievedAt: "2026-08-26T09:00:00.000Z", confirmedEventCount: 0, detail: "No adapter" },
      ],
    },
  });
  assert.equal(result.journey?.bigStories.length, 1);
  assert.equal(result.journey?.horizon.later[0]?.title, "Fed appearance");
  assert.deepEqual(result.journey?.diagnostics.warnings, ["Energy source_failed", "Geopolitical coverage unsupported"]);
  assert.equal(result.journey?.diagnostics.eventHorizonCoverage?.find((item) => item.family === "energy_policy")?.state, "source_failed");
});

test("hostile presentation title does not alter canonical Journey causal content", () => {
  const original = board([story("oil")]).journey!;
  const hostile = board([story("oil", { title: "Hostile display title" })]).journey!;
  const causal = (journey: typeof original) => journey.bigStories.map(({ headline, ...item }) => item);
  assert.deepEqual(causal(hostile), causal(original));
});

test("date-labelled time remains date precision when the label contains a timezone", () => {
  const result = board([story("time")]);
  const item = result.journey?.horizon.later.find((candidate) => candidate.title === "ACME earnings");
  assert.equal(item?.timing.value, "2026-08-27 · 08:30 ET");
  assert.equal(item?.timing.label, "08:30 ET");
  assert.equal(item?.timing.precision, "date");
});
