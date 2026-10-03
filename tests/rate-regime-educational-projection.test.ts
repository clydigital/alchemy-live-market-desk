import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { RegimeExplanation } from "../lib/regime-explanations.ts";
import type { RoutedDossierInvestigation } from "../lib/regime-investigations.ts";
import {
  buildRateEducationalProjection,
  RATE_EDUCATIONAL_PROJECTION_VERSION,
} from "../lib/rate-regime-educational-projection.ts";
import type { ProjectedRegime, ProjectedRegimeSubgroup, ProjectedStory } from "../lib/regimes.ts";

const story: ProjectedStory = {
  id: "story-rates",
  slug: "fed-long-end-stress",
  title: "Long-end Treasury pressure",
  thesis: "Long yields remain restrictive despite softer policy pressure.",
  question: "Why is the long end refusing to ease?",
  confidence: 82,
  lifecycle: "active",
  editorialVerdict: "persist",
  assets: ["US02Y", "US10Y", "US30Y"],
  versionId: "story-version-2",
  versionNumber: 2,
  routes: [
    { regime: "global-cost-of-capital", subgroup: "long-end", role: "core", score: 100 },
    { regime: "global-cost-of-capital", subgroup: "fed-front-end", role: "bridge", score: 80 },
  ],
  maturity: "durable",
  contributesToState: true,
  maturityReason: "Accepted persistent Story.",
  hybridHref: "/hybrid-output?story=fed-long-end-stress",
};

function subgroup(
  key: string,
  label: string,
  state: string,
  stateKind: ProjectedRegimeSubgroup["stateKind"],
  detail: string,
): ProjectedRegimeSubgroup {
  return {
    key,
    label,
    accent: key === "long-end" ? "orange" : "blue",
    whyItMatters: `${label} matters for the rates transmission chain.`,
    mechanism: `${label} mechanism.`,
    state,
    stateKind,
    stories: key === "long-end" || key === "fed-front-end" ? [story] : [],
    durableStories: key === "long-end" || key === "fed-front-end" ? [story] : [],
    contextStories: [],
    nodes: [],
    telemetry: [{
      key: key.toUpperCase(),
      label,
      state,
      detail,
      asOf: "2026-10-03T01:00:00.000Z",
      source: "rate-regime/1",
    }],
    latestAt: "2026-10-03T01:00:00.000Z",
  };
}

function ratesRegime(): ProjectedRegime {
  return {
    slug: "global-cost-of-capital",
    title: "Sovereign Funding & Global Cost of Capital",
    shortTitle: "Cost of Capital",
    coreQuestion: "Can the economy absorb high financing costs?",
    whyItMatters: "Rates feed borrowing costs, housing, credit and valuation.",
    mechanism: "Policy + supply + inflation → yields → borrowing costs.",
    affectedMarkets: ["US02Y", "US10Y", "US30Y"],
    state: "Rates mixed · broader funding partial",
    stateKind: "unresolved",
    confidence: "PARTIAL · rates MEDIUM",
    asOf: "2026-10-03T01:05:00.000Z",
    stories: [story],
    durableStories: [story],
    contextStories: [],
    latestNode: {
      id: "news:nfp",
      title: "Weak payrolls reduce near-term Fed pressure",
      detail: "The labour release was softer, while the long end later failed to hold its rally.",
      timestamp: "2026-10-03T00:55:00.000Z",
      state: "interpretation_pending",
      sourceKind: "news",
      verification: "reporting",
      storyId: null,
      storySlug: null,
      href: "https://example.com/nfp",
      hybridHref: null,
    },
    subgroups: [
      subgroup("fed-front-end", "Fed / Front End", "Easing", "system1", "2Y pricing eased after the labour release."),
      subgroup("treasury-fiscal", "Treasury / Fiscal", "Active / unresolved", "interpreted", "Supply remains a live Story question."),
      subgroup("long-end", "Long End / Term Premium", "Restrictive / tighter", "system1", "10Y/30Y pressure remains elevated."),
      subgroup("global-rates", "Global Rates / Japan", "Unresolved", "unresolved", "Global confirmation is incomplete."),
      subgroup("credit-financing", "Credit / Financing", "Contained", "system1", "Credit stress is not yet confirming a broader break."),
      subgroup("housing", "Housing / Real Economy", "Restrictive", "interpreted", "Mortgage-rate transmission remains restrictive."),
    ],
    hybridHref: "/hybrid-output?regime=global-cost-of-capital",
  };
}

const explanation: RegimeExplanation = {
  plainEnglish: "This Regime is about the price of money and how expensive long-term borrowing affects the economy.",
  counterfactual: "The structural pressure weakens if long yields, real yields and financing costs fall sustainably.",
  chains: [],
  concepts: [],
};

function investigation(): RoutedDossierInvestigation {
  return {
    id: "inv-rates",
    status: "open",
    question: "Why did long yields fail to stay down after weak payrolls?",
    whyItMatters: "It separates the Fed path from structural duration pressure.",
    currentExplanation: "Near-term Fed pressure eased, but the long end still faces unresolved structural duration pressure.",
    expectedReaction: "2Y should fall most, with 10Y and 30Y also easing.",
    observedReaction: "2Y fell, but the long end later reversed higher.",
    divergence: "MATERIAL",
    competingExplanations: ["Treasury supply", "global duration"],
    candidateExplanations: [{
      rank: 1,
      explanation: "Term-premium and supply pressure offset the dovish policy impulse.",
      evidenceForRefs: ["ev:long-end"],
      evidenceAgainstRefs: [],
      confidence: "MEDIUM",
      discriminatingTest: "Check real yields, term premium, auctions and global long yields.",
    }],
    researchNext: "Separate real-yield, supply and global-duration contributions.",
    confirmationCondition: "Long yields remain high while front-end policy pricing continues to ease.",
    invalidationCondition: "10Y/30Y fall sustainably alongside lower real yields and term premium.",
    evidenceRefs: ["ev:nfp", "ev:long-end"],
    missingEvidence: ["term premium"],
    chartIds: [],
    storyIds: ["story-rates"],
    thesisIds: [],
    reactionChecks: [],
    reactionCalibration: {
      basis: "SYSTEM1_REACTION_AUDIT",
      outcome: "DIVERGENT",
      precision: "INTRADAY",
      checkCount: 1,
      alignedCount: 0,
      divergentCount: 1,
      reactionWindows: ["5m", "close"],
      expectationChanged: false,
      requiresReview: true,
    },
    journey: {
      currentId: "inv-rates",
      previousId: "inv-rates",
      matchedBy: "id",
      transition: "DIVERGENCE_DETECTED",
      previousDivergence: "NONE",
      currentDivergence: "MATERIAL",
      previousStatus: "open",
      currentStatus: "open",
      previousExpectedReaction: "Weak payrolls should lower yields, led by the 2Y.",
      currentExpectedReaction: "2Y should fall most, with 10Y and 30Y also easing.",
      expectationChanged: true,
      question: "Why did long yields fail to stay down after weak payrolls?",
    },
    regimeRoutes: [
      { regime: "global-cost-of-capital", subgroup: "long-end", role: "core", score: 100 },
    ],
  };
}

test("rates educational projection gives a two-sentence layman read from canonical state", () => {
  const projection = buildRateEducationalProjection({
    regime: ratesRegime(),
    explanation,
    investigations: [investigation()],
    dossier: { dossierId: "dossier-12345678", asOf: "2026-10-03T01:05:00.000Z" },
  });

  assert.ok(projection);
  assert.equal(projection.contractVersion, RATE_EDUCATIONAL_PROJECTION_VERSION);
  assert.equal(projection.quickRead.length, 2);
  assert.match(projection.quickRead[0], /Short-term Fed-sensitive rates are easing/);
  assert.match(projection.quickRead[0], /longer-term Treasury pressure is still tight/);
  assert.match(projection.quickRead[1], /current accepted explanation/);
  assert.equal(projection.dossierId, "dossier-12345678");
});

test("latest unpromoted news is visible as observed input but never treated as accepted causal explanation", () => {
  const projection = buildRateEducationalProjection({
    regime: ratesRegime(),
    explanation,
    investigations: [investigation()],
    dossier: { dossierId: "dossier-12345678", asOf: "2026-10-03T01:05:00.000Z" },
  })!;

  assert.equal(projection.latestCatalyst?.interpretationPending, true);
  assert.match(projection.adaptiveExplanation[0]?.text ?? "", /not yet been promoted into an accepted causal explanation/);
  assert.equal(projection.dominantDriver?.subgroupKey, "long-end");
});

test("adaptive explanation preserves prior expectation, observed tape and exact canonical test", () => {
  const projection = buildRateEducationalProjection({
    regime: ratesRegime(),
    explanation,
    investigations: [investigation()],
    dossier: { dossierId: "dossier-12345678", asOf: "2026-10-03T01:05:00.000Z" },
  })!;

  const expected = projection.adaptiveExplanation.find((item) => item.key === "expected");
  const observed = projection.adaptiveExplanation.find((item) => item.key === "observed");
  const changes = projection.adaptiveExplanation.find((item) => item.key === "what_changes_view");

  assert.equal(expected?.text, "Weak payrolls should lower yields, led by the 2Y.");
  assert.match(observed?.text ?? "", /long end later reversed higher/);
  assert.match(changes?.text ?? "", /Confirm:/);
  assert.match(changes?.text ?? "", /Invalidate:/);
  assert.equal(projection.currentTest?.candidateCount, 1);
});

test("state board keeps row-level System 1 / System 2 / unresolved ownership", () => {
  const projection = buildRateEducationalProjection({
    regime: ratesRegime(),
    explanation,
    investigations: [investigation()],
    dossier: { dossierId: "dossier-12345678", asOf: "2026-10-03T01:05:00.000Z" },
  })!;

  assert.equal(projection.stateBoard.length, 6);
  assert.equal(projection.stateBoard.find((row) => row.key === "fed-front-end")?.stateKind, "system1");
  assert.equal(projection.stateBoard.find((row) => row.key === "treasury-fiscal")?.stateKind, "interpreted");
  assert.equal(projection.stateBoard.find((row) => row.key === "global-rates")?.stateKind, "unresolved");
});

test("projection fails closed when the current Dossier has no exact linked investigation", () => {
  const projection = buildRateEducationalProjection({
    regime: ratesRegime(),
    explanation,
    investigations: [],
    dossier: { dossierId: "dossier-12345678", asOf: "2026-10-03T01:05:00.000Z" },
  })!;

  assert.equal(projection.currentTest, null);
  assert.equal(projection.dominantDriver, null);
  assert.match(projection.quickRead[1], /still being tested rather than assumed/);
});

test("educational projection is rates-specific and does not manufacture a second Regime", () => {
  const regime = { ...ratesRegime(), slug: "equity-rally-quality" as const };
  assert.equal(buildRateEducationalProjection({
    regime,
    explanation,
    investigations: [],
    dossier: null,
  }), null);
});

test("Live and Hybrid render the same shared educational projection instead of computing separate rates reads", () => {
  const livePage = readFileSync(new URL("../app/regimes/[slug]/page.tsx", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../components/live-desk/RegimeDetailWorkspace.tsx", import.meta.url), "utf8");
  const hybrid = readFileSync(new URL("../app/hybrid-output/page.tsx", import.meta.url), "utf8");
  const projectionSource = readFileSync(new URL("../lib/rate-regime-educational-projection.ts", import.meta.url), "utf8");

  assert.match(livePage, /buildRateEducationalProjection/);
  assert.match(workspace, /RateRegimeEducationalShell/);
  assert.match(hybrid, /buildRateEducationalProjection/);
  assert.match(hybrid, /RateRegimeEducationalShell/);
  assert.doesNotMatch(projectionSource, /fetch\(|createSupabaseAdminClient|executeResearchBrain|runIntelligenceEngine/);
  assert.doesNotMatch(hybrid, /buildDossierRateRegime/);
});
