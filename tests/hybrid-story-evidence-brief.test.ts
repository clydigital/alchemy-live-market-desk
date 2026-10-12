import assert from "node:assert/strict";
import test from "node:test";

import { buildHybridStoryEvidenceBrief, type HybridStoryEvidenceSource } from "../lib/hybrid-story-evidence-brief.ts";

function source(): HybridStoryEvidenceSource {
  return {
    dossierId: "dossier-oct-11",
    asOf: "2026-10-11T19:09:59.440Z",
    header: {
      headline: "AI leaders hold their ground despite higher Treasury pressure",
      answer: "The evidence is mixed.",
      regimeImplication: "Rates pressure with equity leadership.",
      regimeFamily: "MIXED_TRANSITION",
      epistemicLabel: "SUPPORTED",
      whatWouldChangeMind: "Broader credit weakness.",
    },
    whatMattersNow: {
      leadThreadId: "thread:main",
      supportingStoryIds: ["story:rates", "story:ai"],
      stories: [
        {
          id: "story:rates", persistentStoryId: "persistent-rates",
          title: "Long bond pressure", whatChanged: "Term premium moved up about 1.5bp.",
          whyItMatters: "Borrowing cost pressure.", mechanism: "Higher premium, higher hurdle.",
          conclusion: "Rates are still a headwind.", whatWouldChangeMind: "Watch nominal yields and auctions.",
          epistemicLabel: "OBSERVED", evidenceRefs: ["ev-rate", "ev-unresolved"],
          confirmingEvidenceRefs: ["ev-rate"], contradictingEvidenceRefs: [],
          unresolvedEvidenceRefs: ["ev-unresolved"], investigationIds: [], chartIds: [],
        },
        {
          id: "story:ai", persistentStoryId: "persistent-ai",
          title: "Chip resilience", whatChanged: "Semiconductor leaders held up at the last close.",
          whyItMatters: "The index still has support.", mechanism: "Leadership holds.",
          conclusion: "AI leadership remains resilient.", whatWouldChangeMind: "Watch earnings and wider breadth.",
          epistemicLabel: "SUPPORTED", evidenceRefs: ["ev-ai","ev-reject"],
          confirmingEvidenceRefs: ["ev-ai"], contradictingEvidenceRefs: ["ev-reject"],
          unresolvedEvidenceRefs: [], investigationIds: [], chartIds: [],
        },
        {
          id: "story:unrelated", persistentStoryId: "persistent-unrelated",
          title: "Unrelated", whatChanged: "An unrelated fact", whyItMatters: "irrelevant",
          mechanism: "none", conclusion: "unrelated", whatWouldChangeMind: "none",
          epistemicLabel: "OBSERVED", evidenceRefs: ["ev-unrelated"],
          confirmingEvidenceRefs: ["ev-unrelated"], contradictingEvidenceRefs: [],
          unresolvedEvidenceRefs: [], investigationIds: [], chartIds: [],
        },
      ],
    },
    evidenceIndex: [
      { evidenceId: "ev-rate", usedIn: ["story:story:rates"] },
      { evidenceId: "ev-unresolved", usedIn: ["story:story:rates"] },
      { evidenceId: "ev-ai", usedIn: ["story:story:ai"] },
      { evidenceId: "ev-reject", usedIn: ["story:story:ai"] },
      { evidenceId: "ev-unrelated", usedIn: ["story:story:unrelated"] },
    ],
    motionAdjudicationContext: [],
  };
}

test("groups exact, cited Story evidence under the main headline without fabricating a Motion", () => {
  const result = buildHybridStoryEvidenceBrief(source());
  assert.equal(result.dossierId, "dossier-oct-11");
  assert.deepEqual(result.items.map(i => [i.storyId, i.kind]), [
    ["story:rates", "SUPPORT"], ["story:rates", "NEXT_TEST"],
    ["story:ai", "SUPPORT"], ["story:ai", "CHALLENGE"], ["story:ai", "NEXT_TEST"],
  ]);
  assert.deepEqual(result.items[0]?.evidenceRefs, ["ev-rate"]);
  assert.deepEqual(result.items[2]?.evidenceRefs, ["ev-ai"]);
  assert.equal(result.items.at(-1)?.evidenceStatus, "CONDITION_ONLY");
  assert.deepEqual(result.adjudicatedMotions, []);
});

test("source lead, fuzzy Story ID and non-evidentiary A2 decisions never become supporting developments", () => {
  const dossier = source();
  dossier.motionAdjudicationContext = [
    { motionId: "lead", decision: "ACCEPT", storyId: "persistent-ai", regimeSlug: "us-china-ai",
      conclusion: "Creator said so", rationale: "Unverified", nextTest: null, observedAt: null,
      canonicalEvidenceRefs: [], versionNumber: 1, directRegimeRoute: false, destinationRefs: ["STORY:story:ai"] },
    { motionId: "fuzzy", decision: "REFINE", storyId: "something-similar", regimeSlug: "us-china-ai",
      conclusion: "Similar subject", rationale: "Unsafe match", nextTest: "Check", observedAt: null,
      canonicalEvidenceRefs: ["ev-ai"], versionNumber: 1, directRegimeRoute: false, destinationRefs: ["STORY:story:ai"] },
    { motionId: "wrong-destination", decision: "ACCEPT", storyId: "persistent-ai", regimeSlug: "us-china-ai",
      conclusion: "Wrong target", rationale: "unsafe", nextTest: null, observedAt: null,
      canonicalEvidenceRefs: ["ev-ai"], versionNumber: 1, directRegimeRoute: false, destinationRefs: ["REGIME:CURRENT"] },
    { motionId: "real-a2", decision: "REFINE", storyId: "persistent-ai", regimeSlug: "us-china-ai",
      conclusion: "Canonical evidence narrows the claim.", rationale: "A2 judgement", nextTest: "Compare closes",
      observedAt: "2026-10-11T12:00:00Z", canonicalEvidenceRefs: ["ev-ai"], versionNumber: 2,
      directRegimeRoute: false, destinationRefs: ["STORY:story:ai"] },
  ];
  const result = buildHybridStoryEvidenceBrief(dossier);
  assert.equal(result.adjudicatedMotions.length, 1);
  assert.deepEqual(result.adjudicatedMotions.map(x => x.motionId), ["real-a2"]);
  assert.deepEqual(result.adjudicatedMotions[0]?.evidenceRefs, ["ev-ai"]);
});

test("a Story identifier or invented evidence reference cannot create a confirmation", () => {
  const dossier = source();
  dossier.whatMattersNow.stories[0]!.confirmingEvidenceRefs = ["ev-not-in-index"];
  const result = buildHybridStoryEvidenceBrief(dossier);
  assert.equal(result.items.filter(x => x.storyId === "story:rates" && x.kind === "SUPPORT").length, 0);
  assert.ok(result.items.some(x => x.storyId === "story:rates" && x.kind === "NEXT_TEST"));
});
