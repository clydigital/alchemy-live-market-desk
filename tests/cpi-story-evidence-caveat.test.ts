import assert from "node:assert/strict";
import test from "node:test";
import { cpiStoryEvidenceCaveat } from "../lib/cpi-story-evidence-caveat.ts";

const event = {
  storyTitle: "CPI shock splits front‑end Fed repricing from long‑end yield‑locking",
  eventAt: "2026-10-15T02:47:26.751Z",
  dossierId: "a74915fe-ffec-45ef-99c1-12cbff0e8578",
  dossierAsOf: "2026-10-15T03:04:26.861Z",
  gaps: [{ severity: "MATERIAL", description: "Canonical intraday Fed‑funds futures and 1–5m US2Y/US10Y bars around the 2026‑10‑14 CPI release are missing." }],
};

test("a matching material CPI gap labels the historical Story claim with exact current provenance", () => {
  const caveat = cpiStoryEvidenceCaveat(event);
  assert.match(caveat ?? "", /UNRESOLVED in current Dossier a74915fe/);
  assert.match(caveat ?? "", /front-end repricing mechanism and relative causal weight are not confirmed/);
  assert.match(caveat ?? "", /2026-10-15T03:04:26.861Z/);
});

test("an unrelated, informational, or earlier Dossier gap cannot relabel the event", () => {
  assert.equal(cpiStoryEvidenceCaveat({ ...event, gaps: [{ severity: "INFORMATIONAL", description: event.gaps[0].description }] }), null);
  assert.equal(cpiStoryEvidenceCaveat({ ...event, gaps: [{ severity: "MATERIAL", description: "2026-09-14 CPI intraday bars missing" }] }), null);
  assert.equal(cpiStoryEvidenceCaveat({ ...event, dossierAsOf: "2026-10-14T00:00:00Z" }), null);
  assert.equal(cpiStoryEvidenceCaveat({ ...event, dossierId: null }), null);
  assert.equal(cpiStoryEvidenceCaveat({ ...event, storyTitle: "AI capex outlook" }), null);
});

test("latest Dossier's dated futures and 2Y evidence blocker qualifies historical CPI claim even without word CPI", () => {
  const caveat = cpiStoryEvidenceCaveat({
    ...event,
    dossierId: "71f4afcc-14ac-4326-a6e9-a29844ac09b6",
    dossierAsOf: "2026-10-15T18:39:37.599Z",
    gaps: [{ severity: "MATERIAL", description:
      "Canonical intraday LSEG Fed-funds-futures bars and exchange 2Y intraday bars for 2026-10-14 are missing; this blocks durable policy repricing adjudication." }],
  });
  assert.match(caveat ?? "", /UNRESOLVED in current Dossier 71f4afcc/);
});

test("conditional PPI revision or a rate gap lacking correct instruments cannot inherit CPI release warning", () => {
  assert.equal(cpiStoryEvidenceCaveat({ ...event,
    claimText: "The strong September final-demand PPI corroborates recent CPI upside, raising the conditional probability of hawkish Fed language." }), null);
  assert.equal(cpiStoryEvidenceCaveat({ ...event,
    claimText: "A Treasury-flow reallocation outweighed near-term PPI pressure." }), null);
  assert.equal(cpiStoryEvidenceCaveat({ ...event,
    gaps: [{severity:"MATERIAL",description:"Intraday equity volume on 2026-10-14 was missing."}] }), null);
});
