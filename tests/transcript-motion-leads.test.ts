import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTranscriptMotionLeads,
  MAX_TRANSCRIPT_MOTION_LEADS,
  normaliseTranscriptResearchReview,
  type TranscriptResearchReview,
} from "../lib/transcript-research-review-contract.ts";

const review: TranscriptResearchReview = {
  summary: "Anthropic's IPO filing creates a new AI-financing and unit-economics research lead.",
  creatorLogic: "The creator links rapid revenue growth with heavy operating losses and compute commitments.",
  recontextualizedSummary: "Treat the filing as a lead for AI financing research, not proof of a sector-wide conclusion.",
  termsDetected: ["Anthropic", "IPO", "AI"],
  claimChecks: [
    {
      claim: "Anthropic filed IPO papers and is running at more than $8 billion of operating losses.",
      kind: "creator_claim",
      verificationNeeded: true,
      verificationTarget: "Anthropic IPO filing / prospectus and high-quality reporting",
    },
    {
      claim: "The filing shows a $4.6 billion revenue figure.",
      kind: "cited_fact",
      verificationNeeded: true,
      verificationTarget: "Anthropic prospectus financial statements",
    },
  ],
  expertNotes: [
    {
      kind: "catalyst",
      note: "Anthropic's IPO filing makes private-AI economics directly inspectable.",
    },
    {
      kind: "research_question",
      note: "How much of Anthropic's loss profile is operating burn versus financing/accounting effects, and what are the compute commitments?",
    },
    {
      kind: "article_hook",
      note: "Anthropic's IPO could turn the AI boom into a public test of whether revenue growth can outrun compute costs.",
    },
  ],
  affectedStorySlugs: [],
  researchLeadScore: 91,
};

test("creator review becomes discrete claims, statistics, catalysts, research questions and writing hooks", () => {
  const leads = buildTranscriptMotionLeads(review);

  assert.ok(leads.length >= 5);
  assert.ok(leads.some((lead) => lead.tags.includes("company_event")));
  assert.ok(leads.some((lead) => lead.tags.includes("statistic")));
  assert.ok(leads.some((lead) => lead.kind === "catalyst"));
  assert.ok(leads.some((lead) => lead.kind === "research_question" && lead.searchPrompt?.includes("compute commitments")));
  assert.ok(leads.some((lead) => lead.kind === "article_hook" && lead.articleHook?.includes("public test")));
  assert.ok(leads.some((lead) => lead.entities.includes("Anthropic")));
  assert.ok(leads.filter((lead) => lead.kind === "claim").every((lead) => lead.verificationNeeded));
});

test("creator leads remain bounded and duplicate text is removed", () => {
  const noisy: TranscriptResearchReview = {
    ...review,
    claimChecks: Array.from({ length: 20 }, (_, index) => ({
      claim: index < 2 ? "Repeated claim" : `Distinct creator claim ${index} with 25% growth`,
      kind: "creator_claim" as const,
      verificationNeeded: true,
      verificationTarget: "Primary source",
    })),
    expertNotes: Array.from({ length: 10 }, (_, index) => ({
      kind: "research_question" as const,
      note: `Research question ${index}`,
    })),
  };

  const leads = buildTranscriptMotionLeads(noisy);
  assert.equal(leads.length, MAX_TRANSCRIPT_MOTION_LEADS);
  assert.equal(leads.filter((lead) => lead.text === "Repeated claim").length, 1);
});

test("normalisation accepts writing and research hooks without inventing Story links", () => {
  const normalised = normaliseTranscriptResearchReview(review, new Set(["some-existing-story"]));

  assert.ok(normalised.expertNotes.some((note) => note.kind === "article_hook"));
  assert.ok(normalised.expertNotes.some((note) => note.kind === "research_question"));
  assert.deepEqual(normalised.affectedStorySlugs, []);
});
