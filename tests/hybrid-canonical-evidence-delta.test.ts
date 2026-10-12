import assert from "node:assert/strict";
import test from "node:test";
import { compareHybridStoryEvidenceBriefs } from "../lib/hybrid-canonical-evidence-delta.ts";
import type { buildHybridStoryEvidenceBrief } from "../lib/hybrid-story-evidence-brief.ts";

type Brief = ReturnType<typeof buildHybridStoryEvidenceBrief>;
function brief(id: string, refs: string[], options: {
  storyId?: string; persistentStoryId?: string | null; asOf?: string
} = {}): Brief {
  const sid = options.storyId ?? "story:duration";
  const pid = options.persistentStoryId === undefined ? "p-durable" : options.persistentStoryId;
  return {
    dossierId: id,
    asOf: options.asOf ?? (id === "old" ? "2026-10-11T19:05:27.565Z" : "2026-10-11T19:09:59.440Z"),
    headline: "AI leaders holding up despite bond pressure",
    items: [
      { storyId:sid, persistentStoryId:pid, storyTitle:"Bonds and AI", kind:"SUPPORT",
        text:"The same October 8 observation appears in both Dossiers.", evidenceRefs:refs,
        evidenceStatus:"DOSSIER_CITED" },
      { storyId:sid, persistentStoryId:pid, storyTitle:"Bonds and AI", kind:"NEXT_TEST",
        text:"Check actual credit spreads", evidenceRefs:[], evidenceStatus:"CONDITION_ONLY" },
    ],
    adjudicatedMotions: [],
  };
}

test("repeated October 8 evidence is carried forward, not fresh October 11 market news", () => {
  const previous = brief("old", ["ny-fed-acm:10y:2026-10-08"]);
  const current = brief("new", ["ny-fed-acm:10y:2026-10-08"]);
  const delta = compareHybridStoryEvidenceBriefs({
    current, previous, expectedPreviousDossierId:"old",
  });
  assert.equal(delta.baselineStatus, "EXACT_PREDECESSOR");
  assert.equal(delta.items[0]?.change, "CARRIED_FORWARD");
  assert.equal(delta.items[1]?.change, "WATCH_CONDITION");
});

test("a genuinely new reference is new to this Dossier, not called a new market event", () => {
  const delta = compareHybridStoryEvidenceBriefs({
    current:brief("new", ["ny-fed-acm:10y:2026-10-08", "spread:oas:2026-10-11"]),
    previous:brief("old", ["ny-fed-acm:10y:2026-10-08"]),
    expectedPreviousDossierId:"old",
  });
  assert.equal(delta.items[0]?.change, "NEWLY_CITED_IN_DOSSIER");
});

test("missing or non-matching prior, reversed chronology and unbound renamed Story fail closed", () => {
  const now = brief("new",["ev-a"]);
  const noPrior = compareHybridStoryEvidenceBriefs({
    current:now, previous:null, expectedPreviousDossierId:"old",
  });
  assert.equal(noPrior.items[0]?.change, "NO_EXACT_BASELINE");
  const wrongPrior = compareHybridStoryEvidenceBriefs({
    current:now, previous:brief("wrong",["ev-a"]), expectedPreviousDossierId:"old",
  });
  assert.equal(wrongPrior.items[0]?.change, "NO_EXACT_BASELINE");
  const renamed = compareHybridStoryEvidenceBriefs({
    current:brief("new",["ev-a"],{storyId:"brand-new",persistentStoryId:null}),
    previous:brief("old",["ev-a"],{storyId:"prior",persistentStoryId:null}),
    expectedPreviousDossierId:"old",
  });
  assert.equal(renamed.items[0]?.change, "NO_COMPARABLE_PRIOR_STORY");
});

test("canonical A2 Motion changes compare exact IDs, never infer from source routing", () => {
  const old = brief("old",["ev-a"]); const now = brief("new",["ev-a"]);
  old.adjudicatedMotions.push({
    motionId:"motion-1",storyId:"story:duration",decision:"ACCEPT",conclusion:"Supported",
    evidenceRefs:["ev-a"], observedAt:"2026-10-09T16:00:00Z", nextTest:null,
  });
  now.adjudicatedMotions.push(...old.adjudicatedMotions, {
    motionId:"motion-2",storyId:"story:duration",decision:"REFINE",conclusion:"Narrower supported",
    evidenceRefs:["ev-a"], observedAt:"2026-10-10T16:00:00Z", nextTest:"Check again",
  });
  const delta=compareHybridStoryEvidenceBriefs({
    current:now,previous:old,expectedPreviousDossierId:"old",
  });
  assert.deepEqual(delta.motions.map(x=>x.change),["ALREADY_ADJUDICATED","NEWLY_ADJUDICATED"]);
});
