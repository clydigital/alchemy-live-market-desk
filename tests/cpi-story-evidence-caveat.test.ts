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
