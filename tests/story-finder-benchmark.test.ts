import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateStoryFinderBenchmark,
  findStoryForChange,
  type CandidateChange,
  type StoryFingerprint,
  type StoryRelation,
} from "./story-finder-benchmark-core.ts";

const STORIES: StoryFingerprint[] = [
  {
    slug: "oil-physical-disruption",
    title: "Oil relief breaks as Hormuz talks stall",
    thesis: "Physical normalisation through Hormuz requires sustained shipping, lower insurance and freight stress, and fewer attacks before the energy inflation impulse is treated as resolved.",
    assets: ["USOIL", "UKOIL", "DIESEL_CRACK", "GASOLINE_CRACK", "DXY", "US02Y"],
    themes: ["oil hormuz shipping disruption", "geopolitics energy shipping"],
    mechanismTerms: ["physical reopening shipping insurance freight war premium"],
  },
  {
    slug: "refining-crack-spread-stress",
    title: "Crude can fall while fuel inflation stays hot",
    thesis: "Product tightness and refining losses can keep fuel inflation elevated even when flat crude falls.",
    assets: ["USOIL", "UKOIL", "DIESEL_CRACK", "GASOLINE_CRACK", "PSX", "VLO"],
    themes: ["refining crack spreads fuel inflation products"],
    mechanismTerms: ["refinery outages product scarcity margins refined supply"],
  },
  {
    slug: "fed-rate-repricing",
    title: "Weak jobs meet expensive oil; CPI becomes the tie-breaker",
    thesis: "Soft labour argues for restraint while firmer energy prices can keep inflation expectations and front-end yields elevated.",
    assets: ["US02Y", "US10Y", "DXY", "NASDAQ", "SPX", "GOLD", "USOIL"],
    themes: ["fed policy front end inflation labour cpi"],
    mechanismTerms: ["policy repricing inflation labour energy fed rate expectations"],
  },
  {
    slug: "fed-long-end-stress",
    title: "The Fed held, but the long end still questions the inflation path",
    thesis: "Long yields can stay elevated when inflation credibility and term-premium stress persist despite slower growth.",
    assets: ["US30Y", "US10Y", "DXY", "NASDAQ", "SPX", "BREAKEVENS"],
    themes: ["treasury long end term premium inflation credibility supply"],
    mechanismTerms: ["term premium inflation credibility treasury supply long yields"],
  },
  {
    slug: "yen-carry-unwind",
    title: "Yen intervention changed price, not yet the carry regime",
    thesis: "A lasting carry unwind requires repeated official action, spread compression or broader yen strength across risk-sensitive crosses.",
    assets: ["USDJPY", "AUDJPY", "GBPJPY", "DXY", "US02Y", "NIKKEI", "TOPIX"],
    themes: ["yen intervention carry usd jpy boj"],
    mechanismTerms: ["rate differential carry trade intervention repatriation"],
  },
  {
    slug: "ai-capex-cash-conversion",
    title: "AI capex is shifting from spending risk to financing risk",
    thesis: "AI demand remains strong, but financing structures, utilisation and cash returns increasingly determine whether capital intensity is justified.",
    assets: ["NVDA", "CRWV", "MSFT", "GOOGL", "META", "AMZN", "AMD", "SOXX", "GS", "BX", "KKR", "APO"],
    themes: ["ai capex financing cash conversion returns"],
    mechanismTerms: ["capital intensity financing utilisation cash returns expectations"],
  },
  {
    slug: "earnings-market-support",
    title: "Record-high optimism is meeting a fresh macro test",
    thesis: "Earnings can support equities, but breadth and rate sensitivity matter more as the macro cushion becomes less clean.",
    assets: ["SPX", "NASDAQ", "RSP", "SOXX", "NVDA", "AMD", "US02Y", "USOIL"],
    themes: ["equities earnings breadth rotation rates"],
    mechanismTerms: ["earnings support breadth valuation yields macro cushion"],
  },
  {
    slug: "china-ai-pressure",
    title: "China AI cost and model pressure",
    thesis: "Cheaper Chinese open-weight models can expand usage while pressuring Western model pricing and compute assumptions.",
    assets: ["BABA", "NVDA", "AMD", "MSFT", "GOOGL", "META"],
    themes: ["china ai models pricing cost open weight"],
    mechanismTerms: ["lower model costs pricing pressure compute demand"],
  },
  {
    slug: "market-breadth-health",
    title: "Market breadth versus index strength",
    thesis: "Index resilience is healthier when participation broadens beyond a narrow group of large stocks.",
    assets: ["SPX", "RSP", "SOXX"],
    themes: ["market breadth equal weight index participation"],
    mechanismTerms: ["participation breadth concentration index resilience"],
  },
  {
    slug: "productivity-labor-share",
    title: "Productivity gains now face a weaker-demand test",
    thesis: "Productivity can support margins while weak labour income makes the household-demand payoff more conditional.",
    assets: ["SPX", "RSP", "DXY", "US02Y", "CONSUMER_DISCRETIONARY", "AI_INFRASTRUCTURE"],
    themes: ["productivity labour wages demand margins"],
    mechanismTerms: ["productivity margins labour share household demand"],
  },
];

function candidate(input: Partial<CandidateChange> & Pick<CandidateChange, "id" | "headline" | "detail">): CandidateChange {
  return {
    assets: [],
    themes: [],
    mechanismTerms: [],
    relationSignal: "none",
    materiality: 80,
    material: true,
    evidenceFingerprint: `fp:${input.id}`,
    ...input,
  };
}

type BenchmarkCase = {
  candidate: CandidateChange;
  expectedRelation: StoryRelation;
  expectedStorySlug: string | null;
};

const CASES: BenchmarkCase[] = [
  {
    candidate: candidate({
      id: "oil-recalibration",
      headline: "Oil relief reverses as Hormuz talks stall",
      detail: "Brent and WTI rebound as negotiations stall and physical reopening again becomes the deciding variable.",
      assets: ["USOIL", "UKOIL"],
      themes: ["oil hormuz shipping disruption"],
      mechanismTerms: ["physical reopening shipping war premium"],
      relationSignal: "update",
    }),
    expectedRelation: "UPDATE_EXISTING_STORY",
    expectedStorySlug: "oil-physical-disruption",
  },
  {
    candidate: candidate({
      id: "oil-confirmation",
      headline: "Route coordinates strengthen the Hormuz reopening case",
      detail: "Formal coordinates improve the diplomatic path, but sustained vessel passage is still required for physical normalisation.",
      assets: ["USOIL", "UKOIL"],
      themes: ["hormuz shipping geopolitics"],
      mechanismTerms: ["physical reopening shipping"],
      relationSignal: "confirmation",
    }),
    expectedRelation: "CONFIRMATION",
    expectedStorySlug: "oil-physical-disruption",
  },
  {
    candidate: candidate({
      id: "oil-escalation",
      headline: "Commodity transits fall to zero after talks stall",
      detail: "A collapse in observed traffic converts diplomatic risk into a more acute physical shipping disruption.",
      assets: ["USOIL", "UKOIL"],
      themes: ["oil hormuz shipping disruption"],
      mechanismTerms: ["physical shipping disruption freight war premium"],
      relationSignal: "escalation",
    }),
    expectedRelation: "ESCALATION",
    expectedStorySlug: "oil-physical-disruption",
  },
  {
    candidate: candidate({
      id: "refining-separation",
      headline: "Diesel cracks widen while crude stalls",
      detail: "Refinery outages and product scarcity keep fuel margins elevated even without another crude rally.",
      assets: ["DIESEL_CRACK", "GASOLINE_CRACK", "VLO"],
      themes: ["refining crack spreads fuel inflation products"],
      mechanismTerms: ["refinery outages product scarcity margins"],
      relationSignal: "confirmation",
    }),
    expectedRelation: "CONFIRMATION",
    expectedStorySlug: "refining-crack-spread-stress",
  },
  {
    candidate: candidate({
      id: "fed-recalibration",
      headline: "Oil reintroduces inflation risk ahead of CPI",
      detail: "Weak payrolls remain dovish, but firmer energy means CPI must resolve the conflict for front-end policy pricing.",
      assets: ["US02Y", "DXY", "USOIL"],
      themes: ["fed policy front end inflation labour cpi"],
      mechanismTerms: ["policy repricing inflation labour energy"],
      relationSignal: "update",
    }),
    expectedRelation: "UPDATE_EXISTING_STORY",
    expectedStorySlug: "fed-rate-repricing",
  },
  {
    candidate: candidate({
      id: "fed-confirmation",
      headline: "Hot CPI lifts two-year yields and hike odds",
      detail: "A stronger inflation print pushes front-end yields higher and reprices the expected Fed path.",
      assets: ["US02Y", "DXY"],
      themes: ["fed policy front end inflation cpi"],
      mechanismTerms: ["policy repricing inflation fed rate expectations"],
      relationSignal: "confirmation",
    }),
    expectedRelation: "CONFIRMATION",
    expectedStorySlug: "fed-rate-repricing",
  },
  {
    candidate: candidate({
      id: "fed-contradiction",
      headline: "Soft CPI and falling energy unwind hike pricing",
      detail: "Cooling inflation and lower oil pull the two-year yield down, contradicting the near-term policy-tightening branch.",
      assets: ["US02Y", "DXY", "USOIL"],
      themes: ["fed policy front end inflation cpi"],
      mechanismTerms: ["policy repricing inflation energy fed rate expectations"],
      relationSignal: "contradiction",
    }),
    expectedRelation: "CONTRADICTION",
    expectedStorySlug: "fed-rate-repricing",
  },
  {
    candidate: candidate({
      id: "long-end-confirmation",
      headline: "Thirty-year yield above 5% keeps credibility premium alive",
      detail: "Long yields stay elevated as inflation credibility and Treasury supply preserve term-premium pressure.",
      assets: ["US30Y", "US10Y", "BREAKEVENS"],
      themes: ["treasury long end term premium inflation credibility supply"],
      mechanismTerms: ["term premium inflation credibility treasury supply long yields"],
      relationSignal: "confirmation",
    }),
    expectedRelation: "CONFIRMATION",
    expectedStorySlug: "fed-long-end-stress",
  },
  {
    candidate: candidate({
      id: "long-end-contradiction",
      headline: "Long yields collapse despite sticky inflation",
      detail: "A sharp term-premium unwind and strong auction demand undercut the persistent long-end stress thesis.",
      assets: ["US30Y", "US10Y"],
      themes: ["treasury long end term premium supply"],
      mechanismTerms: ["term premium treasury supply long yields"],
      relationSignal: "contradiction",
    }),
    expectedRelation: "CONTRADICTION",
    expectedStorySlug: "fed-long-end-stress",
  },
  {
    candidate: candidate({
      id: "yen-recalibration",
      headline: "Yen gives back nearly half the intervention gain",
      detail: "USDJPY returns toward 159 because the carry incentive remains despite official intervention risk.",
      assets: ["USDJPY", "AUDJPY"],
      themes: ["yen intervention carry usd jpy"],
      mechanismTerms: ["rate differential carry trade intervention"],
      relationSignal: "update",
    }),
    expectedRelation: "UPDATE_EXISTING_STORY",
    expectedStorySlug: "yen-carry-unwind",
  },
  {
    candidate: candidate({
      id: "yen-confirmation",
      headline: "US Treasury makes the intervention backstop explicit",
      detail: "Official support raises the cost of rebuilding short-yen exposure but does not erase the policy-rate differential.",
      assets: ["USDJPY", "DXY"],
      themes: ["yen intervention carry"],
      mechanismTerms: ["rate differential carry trade intervention"],
      relationSignal: "confirmation",
    }),
    expectedRelation: "CONFIRMATION",
    expectedStorySlug: "yen-carry-unwind",
  },
  {
    candidate: candidate({
      id: "yen-escalation",
      headline: "BoJ surprise tightening compresses the carry spread",
      detail: "A larger policy move combines with intervention to remove part of the economic incentive behind short-yen funding.",
      assets: ["USDJPY", "AUDJPY", "NIKKEI"],
      themes: ["yen carry boj intervention"],
      mechanismTerms: ["rate differential carry trade intervention repatriation"],
      relationSignal: "escalation",
    }),
    expectedRelation: "ESCALATION",
    expectedStorySlug: "yen-carry-unwind",
  },
  {
    candidate: candidate({
      id: "ai-financing-update",
      headline: "Nvidia brings Wall Street deeper into AI financing",
      detail: "Large financing platforms broaden third-party capital participation in the compute buildout.",
      assets: ["NVDA", "GS", "BX"],
      themes: ["ai capex financing cash conversion"],
      mechanismTerms: ["capital intensity financing cash returns"],
      relationSignal: "update",
    }),
    expectedRelation: "UPDATE_EXISTING_STORY",
    expectedStorySlug: "ai-capex-cash-conversion",
  },
  {
    candidate: candidate({
      id: "ai-confirmation",
      headline: "Strong AI growth still fails the stock-market expectations test",
      detail: "Revenue and guidance rise but shares fall as investors demand better margins and cash conversion.",
      assets: ["AMD", "SOXX"],
      themes: ["ai capex cash conversion returns"],
      mechanismTerms: ["capital intensity cash returns expectations"],
      relationSignal: "confirmation",
    }),
    expectedRelation: "CONFIRMATION",
    expectedStorySlug: "ai-capex-cash-conversion",
  },
  {
    candidate: candidate({
      id: "earnings-recalibration",
      headline: "Equity rebound loses part of its macro cushion",
      detail: "Softer breadth and renewed rate pressure make earnings support less sufficient for the index.",
      assets: ["SPX", "NASDAQ", "RSP", "US02Y"],
      themes: ["equities earnings breadth rates"],
      mechanismTerms: ["earnings support breadth valuation yields macro cushion"],
      relationSignal: "update",
    }),
    expectedRelation: "UPDATE_EXISTING_STORY",
    expectedStorySlug: "earnings-market-support",
  },
  {
    candidate: candidate({
      id: "earnings-confirmation",
      headline: "Dow record and Nasdaq weakness show rotation beneath the index",
      detail: "Cash-generating companies offset expensive AI weakness as equal-weight participation broadens.",
      assets: ["SPX", "NASDAQ", "RSP"],
      themes: ["equities earnings breadth rotation"],
      mechanismTerms: ["earnings support breadth valuation"],
      relationSignal: "confirmation",
    }),
    expectedRelation: "CONFIRMATION",
    expectedStorySlug: "earnings-market-support",
  },
  {
    candidate: candidate({
      id: "earnings-contradiction",
      headline: "Semiconductor weakness drags the broad tape despite earnings beats",
      detail: "The breadth cushion fails as index participation narrows and valuation sensitivity overwhelms reported earnings strength.",
      assets: ["SPX", "NASDAQ", "SOXX", "RSP"],
      themes: ["equities earnings breadth rates"],
      mechanismTerms: ["earnings support breadth valuation macro cushion"],
      relationSignal: "contradiction",
    }),
    expectedRelation: "CONTRADICTION",
    expectedStorySlug: "earnings-market-support",
  },
  {
    candidate: candidate({
      id: "china-ai-update",
      headline: "Chinese open-weight models cut serving costs again",
      detail: "Lower inference cost increases adoption while adding pressure to Western model pricing assumptions.",
      assets: ["BABA", "MSFT", "GOOGL"],
      themes: ["china ai models pricing cost open weight"],
      mechanismTerms: ["lower model costs pricing pressure compute demand"],
      relationSignal: "update",
    }),
    expectedRelation: "UPDATE_EXISTING_STORY",
    expectedStorySlug: "china-ai-pressure",
  },
  {
    candidate: candidate({
      id: "breadth-confirmation",
      headline: "Equal-weight participation improves while the index holds highs",
      detail: "More stocks participate in the advance, reducing concentration risk.",
      assets: ["SPX", "RSP"],
      themes: ["market breadth equal weight index participation"],
      mechanismTerms: ["participation breadth concentration index resilience"],
      relationSignal: "confirmation",
    }),
    expectedRelation: "CONFIRMATION",
    expectedStorySlug: "market-breadth-health",
  },
  {
    candidate: candidate({
      id: "breadth-contradiction",
      headline: "Index reaches a high while equal-weight participation deteriorates",
      detail: "Concentration rises and fewer stocks support index resilience.",
      assets: ["SPX", "RSP", "SOXX"],
      themes: ["market breadth equal weight index participation"],
      mechanismTerms: ["participation breadth concentration index resilience"],
      relationSignal: "contradiction",
    }),
    expectedRelation: "CONTRADICTION",
    expectedStorySlug: "market-breadth-health",
  },
  {
    candidate: candidate({
      id: "productivity-update",
      headline: "Productivity improves but wage growth and participation weaken",
      detail: "Better output per hour supports margins while the household-demand payoff becomes more conditional.",
      assets: ["SPX", "CONSUMER_DISCRETIONARY"],
      themes: ["productivity labour wages demand margins"],
      mechanismTerms: ["productivity margins labour share household demand"],
      relationSignal: "update",
    }),
    expectedRelation: "UPDATE_EXISTING_STORY",
    expectedStorySlug: "productivity-labor-share",
  },
  {
    candidate: candidate({
      id: "new-canada-housing",
      headline: "Canadian mortgage resets begin to pressure household consumption",
      detail: "Higher renewal rates are tightening household cash flow and changing the Bank of Canada growth trade-off.",
      assets: ["USDCAD", "CAD", "CANADA_HOUSING"],
      themes: ["canada housing mortgages household consumption boc"],
      mechanismTerms: ["mortgage reset household leverage consumption bank of canada"],
      relationSignal: "none",
    }),
    expectedRelation: "NEW_STORY",
    expectedStorySlug: null,
  },
  {
    candidate: candidate({
      id: "new-water-infrastructure",
      headline: "Data-centre water constraints lift cooling infrastructure demand",
      detail: "Local water scarcity raises demand for closed-loop cooling, treatment and reuse infrastructure.",
      assets: ["XYL", "VRT", "WTRG"],
      themes: ["water cooling infrastructure data centres utilities"],
      mechanismTerms: ["water scarcity cooling treatment reuse capacity"],
      relationSignal: "none",
    }),
    expectedRelation: "NEW_STORY",
    expectedStorySlug: null,
  },
  {
    candidate: candidate({
      id: "new-agriculture",
      headline: "Fertiliser shortages collide with drought-driven crop stress",
      detail: "Input scarcity and weather risk raise farm costs and threaten crop yields.",
      assets: ["MOS", "NTR", "CORN", "WHEAT"],
      themes: ["agriculture fertiliser drought crops"],
      mechanismTerms: ["input scarcity weather yields farm costs"],
      relationSignal: "none",
    }),
    expectedRelation: "NEW_STORY",
    expectedStorySlug: null,
  },
  {
    candidate: candidate({
      id: "ambiguous-oil-fed",
      headline: "Oil spike lifts two-year yields ahead of CPI",
      detail: "A renewed energy shock simultaneously worsens physical oil risk and tightens front-end Fed pricing.",
      assets: ["USOIL", "UKOIL", "US02Y", "DXY"],
      themes: ["oil inflation fed policy front end hormuz"],
      mechanismTerms: ["energy shock policy repricing physical disruption"],
      relationSignal: "escalation",
    }),
    expectedRelation: "NEW_STORY",
    expectedStorySlug: null,
  },
  {
    candidate: candidate({
      id: "duplicate-route",
      headline: "Hormuz route coordinates are agreed",
      detail: "Same underlying route-coordinates evidence arrives under a different headline.",
      assets: ["USOIL", "UKOIL"],
      themes: ["hormuz shipping"],
      mechanismTerms: ["physical reopening shipping"],
      relationSignal: "confirmation",
      evidenceFingerprint: "seen:hormuz-route-2026-08-05",
    }),
    expectedRelation: "DUPLICATE",
    expectedStorySlug: null,
  },
  {
    candidate: candidate({
      id: "duplicate-ai",
      headline: "Nvidia financing consortium restated by another aggregator",
      detail: "No new underlying financing evidence is present.",
      assets: ["NVDA", "GS"],
      themes: ["ai capex financing"],
      mechanismTerms: ["capital intensity financing"],
      relationSignal: "update",
      evidenceFingerprint: "seen:nvda-finance-platform",
    }),
    expectedRelation: "DUPLICATE",
    expectedStorySlug: null,
  },
  {
    candidate: candidate({
      id: "noise-company-logo",
      headline: "Energy company refreshes its corporate logo",
      detail: "No evidence changes supply, demand, shipping, refining or market pricing.",
      assets: ["USOIL"],
      themes: ["energy corporate branding"],
      mechanismTerms: ["branding"],
      relationSignal: "none",
      materiality: 15,
      material: false,
    }),
    expectedRelation: "NOISE",
    expectedStorySlug: null,
  },
  {
    candidate: candidate({
      id: "noise-commentary",
      headline: "Unverified social post predicts a market crash",
      detail: "The post contains no new traceable evidence or observable market change.",
      assets: ["SPX"],
      themes: ["social commentary"],
      mechanismTerms: ["unsupported claim"],
      relationSignal: "none",
      materiality: 20,
      material: false,
    }),
    expectedRelation: "NOISE",
    expectedStorySlug: null,
  },
];

const SEEN = new Set(["seen:hormuz-route-2026-08-05", "seen:nvda-finance-platform"]);

test("Story Finder benchmark covers all target relation classes", () => {
  const classes = new Set(CASES.map((item) => item.expectedRelation));
  assert.deepEqual(
    [...classes].sort(),
    [
      "CONFIRMATION",
      "CONTRADICTION",
      "DUPLICATE",
      "ESCALATION",
      "NEW_STORY",
      "NOISE",
      "UPDATE_EXISTING_STORY",
    ].sort(),
  );
  assert.ok(CASES.length >= 25);
});

test("historical Story Finder benchmark reaches at least 90% exact relation + Story accuracy", () => {
  const result = evaluateStoryFinderBenchmark({
    cases: CASES,
    stories: STORIES,
    seenEvidenceFingerprints: SEEN,
  });

  const failures = result.decisions.filter((item) => !item.correct);
  assert.ok(
    result.accuracy >= 0.9,
    `Expected >=90% exact accuracy, got ${(result.accuracy * 100).toFixed(1)}%. Failures: ${JSON.stringify(failures, null, 2)}`,
  );
});

test("oil physical disruption and refining product stress stay separate despite shared crude assets", () => {
  const physical = CASES.find((item) => item.candidate.id === "oil-confirmation")!;
  const refining = CASES.find((item) => item.candidate.id === "refining-separation")!;

  assert.equal(findStoryForChange({ candidate: physical.candidate, stories: STORIES }).matchedStorySlug, "oil-physical-disruption");
  assert.equal(findStoryForChange({ candidate: refining.candidate, stories: STORIES }).matchedStorySlug, "refining-crack-spread-stress");
});

test("Fed front-end repricing and long-end term-premium stress stay separate", () => {
  const frontEnd = CASES.find((item) => item.candidate.id === "fed-confirmation")!;
  const longEnd = CASES.find((item) => item.candidate.id === "long-end-confirmation")!;

  assert.equal(findStoryForChange({ candidate: frontEnd.candidate, stories: STORIES }).matchedStorySlug, "fed-rate-repricing");
  assert.equal(findStoryForChange({ candidate: longEnd.candidate, stories: STORIES }).matchedStorySlug, "fed-long-end-stress");
});

test("ambiguous cross-Story evidence is conservatively not auto-attached", () => {
  const ambiguous = CASES.find((item) => item.candidate.id === "ambiguous-oil-fed")!;
  const decision = findStoryForChange({ candidate: ambiguous.candidate, stories: STORIES });
  assert.equal(decision.relation, "NEW_STORY");
  assert.equal(decision.matchedStorySlug, null);
  assert.ok(decision.margin < 0.65 || decision.score < 5.4);
});

test("duplicate detection runs before semantic matching", () => {
  const duplicate = CASES.find((item) => item.candidate.id === "duplicate-route")!;
  const decision = findStoryForChange({ candidate: duplicate.candidate, stories: STORIES, seenEvidenceFingerprints: SEEN });
  assert.equal(decision.relation, "DUPLICATE");
  assert.equal(decision.matchedStorySlug, null);
});

test("upstream materiality can discard noise without invoking Story matching", () => {
  const noise = CASES.find((item) => item.candidate.id === "noise-commentary")!;
  const decision = findStoryForChange({ candidate: noise.candidate, stories: STORIES });
  assert.equal(decision.relation, "NOISE");
  assert.equal(decision.score, 0);
});
