import assert from "node:assert/strict";
import test from "node:test";

import { findStoryForChange, type StoryFingerprint } from "./story-finder-benchmark-core.ts";

const stories: StoryFingerprint[] = [
  {
    slug: "oil-physical-disruption",
    title: "Oil relief breaks as Hormuz talks stall",
    thesis: "Physical normalisation through Hormuz requires sustained shipping before the energy inflation impulse is resolved.",
    assets: ["USOIL", "UKOIL", "US02Y", "DXY"],
    themes: ["oil hormuz shipping disruption"],
    mechanismTerms: ["physical disruption shipping war premium"],
  },
  {
    slug: "fed-rate-repricing",
    title: "Weak jobs meet expensive oil; CPI becomes the tie-breaker",
    thesis: "Energy inflation can keep front-end yields and Fed expectations elevated.",
    assets: ["US02Y", "DXY", "USOIL"],
    themes: ["fed policy front end inflation cpi"],
    mechanismTerms: ["policy repricing inflation energy fed rate expectations"],
  },
];

test("cross-Story macro evidence is not auto-attached but preserves both related Stories", () => {
  const decision = findStoryForChange({
    stories,
    candidate: {
      id: "oil-fed-cross-story",
      headline: "Oil spike lifts two-year yields ahead of CPI",
      detail: "A renewed energy shock simultaneously worsens physical oil risk and tightens front-end Fed pricing.",
      assets: ["USOIL", "UKOIL", "US02Y", "DXY"],
      themes: ["oil hormuz inflation fed policy front end"],
      mechanismTerms: ["physical disruption energy policy repricing inflation"],
      relationSignal: "escalation",
      materiality: 95,
      material: true,
      evidenceFingerprint: "cross:oil-fed",
    },
  });

  assert.equal(decision.relation, "NEW_STORY");
  assert.equal(decision.matchedStorySlug, null);
  assert.deepEqual(new Set(decision.relatedStorySlugs), new Set(["oil-physical-disruption", "fed-rate-repricing"]));
});
